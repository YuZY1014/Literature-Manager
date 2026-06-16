import os, shutil, sqlite3, json, uuid
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import Document
from schemas import ZoteroImportRequest
from services.zotero_importer import bake_annotations_into_pdf
from config import PAPERS_DIR

router = APIRouter(prefix="/api/import", tags=["import"])


@router.get("/zotero/auto-detect")
def auto_detect_zotero():
    """Auto-detect Zotero data directory on the local machine."""
    import getpass
    username = getpass.getuser()
    candidates = [
        os.path.join("C:\\Users", username, "Zotero"),
        os.path.join("C:\\Users", username, "AppData", "Roaming", "Zotero", "Zotero"),
    ]
    # Also check any profile dirs
    base = os.path.join("C:\\Users", username, "AppData", "Roaming", "Zotero", "Zotero", "Profiles")
    if os.path.isdir(base):
        for d in os.listdir(base):
            p = os.path.join(base, d)
            if os.path.isdir(p):
                candidates.append(p)

    found = []
    for c in candidates:
        if os.path.isfile(os.path.join(c, "zotero.sqlite")) and os.path.isdir(os.path.join(c, "storage")):
            found.append(c)

    return {"found": found, "default": found[0] if found else None}


def _copy_db(zotero_path):
    tmp = os.path.join(zotero_path, "storage", f"_tmp_{uuid.uuid4().hex}.sqlite")
    shutil.copy2(os.path.join(zotero_path, "zotero.sqlite"), tmp)
    return tmp


def _get_zotero_items(zotero_path: str) -> list[dict]:
    zotero_db = os.path.join(zotero_path, "zotero.sqlite")
    storage = os.path.join(zotero_path, "storage")
    if not os.path.isfile(zotero_db):
        raise ValueError(f"zotero.sqlite 不存在: {zotero_db}")
    if not os.path.isdir(storage):
        raise ValueError(f"storage 目录不存在: {storage}")

    tmp_db = _copy_db(zotero_path)
    try:
        conn = sqlite3.connect(tmp_db)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Get PDF attachments with their storage keys
        cur.execute("""
            SELECT ia.itemID, ia.parentItemID, ia.path, i.key
            FROM itemAttachments ia
            JOIN items i ON ia.itemID = i.itemID
            WHERE ia.contentType = 'application/pdf'
            AND ia.parentItemID IS NOT NULL
        """)
        pdf_rows = cur.fetchall()

        # Build parent metadata map
        parent_ids = set(r["parentItemID"] for r in pdf_rows)
        title_map = {}
        date_map = {}
        pub_map = {}
        doi_map = {}

        if parent_ids:
            placeholders = ",".join("?" for _ in parent_ids)
            params = tuple(parent_ids)

            # Query titles
            cur.execute(f"""
                SELECT id.itemID, idv.value FROM itemData id
                JOIN itemDataValues idv ON id.valueID = idv.valueID
                JOIN fields f ON id.fieldID = f.fieldID
                WHERE f.fieldName = 'title' AND id.itemID IN ({placeholders})
            """, params)
            for r in cur.fetchall():
                title_map[r["itemID"]] = r["value"]

            # Query dates
            cur.execute(f"""
                SELECT id.itemID, idv.value FROM itemData id
                JOIN itemDataValues idv ON id.valueID = idv.valueID
                JOIN fields f ON id.fieldID = f.fieldID
                WHERE f.fieldName = 'date' AND id.itemID IN ({placeholders})
            """, params)
            for r in cur.fetchall():
                date_map[r["itemID"]] = r["value"]

            # Query publicationTitle
            cur.execute(f"""
                SELECT id.itemID, idv.value FROM itemData id
                JOIN itemDataValues idv ON id.valueID = idv.valueID
                JOIN fields f ON id.fieldID = f.fieldID
                WHERE f.fieldName = 'publicationTitle' AND id.itemID IN ({placeholders})
            """, params)
            for r in cur.fetchall():
                pub_map[r["itemID"]] = r["value"]

            # Query DOI
            cur.execute(f"""
                SELECT id.itemID, idv.value FROM itemData id
                JOIN itemDataValues idv ON id.valueID = idv.valueID
                JOIN fields f ON id.fieldID = f.fieldID
                WHERE f.fieldName = 'DOI' AND id.itemID IN ({placeholders})
            """, params)
            for r in cur.fetchall():
                doi_map[r["itemID"]] = r["value"]

        # Get annotation counts
        anno_counts = {}
        att_ids = tuple(r["itemID"] for r in pdf_rows)
        if att_ids:
            placeholders = ",".join("?" for _ in att_ids)
            cur.execute(f"""
                SELECT parentItemID, COUNT(*) as cnt
                FROM itemAnnotations WHERE isExternal = 1
                AND parentItemID IN ({placeholders})
                GROUP BY parentItemID
            """, att_ids)
            anno_counts = {r["parentItemID"]: r["cnt"] for r in cur.fetchall()}

        # Get authors
        author_map = {}
        if parent_ids:
            placeholders = ",".join("?" for _ in parent_ids)
            params = tuple(parent_ids)
            cur.execute(f"""
                SELECT ic.itemID, GROUP_CONCAT(c.lastName || ', ' || c.firstName, '; ') as authors
                FROM itemCreators ic
                JOIN creators c ON ic.creatorID = c.creatorID
                WHERE ic.itemID IN ({placeholders})
                GROUP BY ic.itemID
            """, params)
            author_map = {r["itemID"]: r["authors"] for r in cur.fetchall()}

        conn.close()
    finally:
        os.remove(tmp_db)

    # Build results
    results = []
    seen_fullpaths = set()
    for r in pdf_rows:
        filename = (r["path"] or "").replace("storage:", "")
        if not filename:
            continue
        key = r["key"]
        full_pdf = os.path.join(storage, key, filename)
        if not os.path.isfile(full_pdf):
            continue
        if full_pdf in seen_fullpaths:
            continue
        seen_fullpaths.add(full_pdf)

        pid = r["parentItemID"]
        title = title_map.get(pid) or title_map.get(r["itemID"]) or os.path.splitext(filename)[0]
        title = title.strip()
        date_str = date_map.get(pid) or ""
        year = None
        try:
            if date_str and len(date_str) >= 4:
                year = int(date_str[:4])
        except ValueError:
            pass

        results.append({
            "title": title,
            "authors": author_map.get(pid, ""),
            "year": year,
            "journal": pub_map.get(pid, ""),
            "doi": doi_map.get(pid, ""),
            "source_pdf": full_pdf,
            "annotation_count": anno_counts.get(r["itemID"], 0),
        })
    return results


@router.post("/zotero/preview")
def preview_import(req: ZoteroImportRequest):
    try:
        items = _get_zotero_items(req.profile_path)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {
        "count": len(items),
        "items": [{
            "title": it["title"],
            "authors": it["authors"],
            "year": it["year"],
            "journal": it["journal"],
            "annotation_count": it["annotation_count"],
            "source_pdf": it["source_pdf"],
        } for it in items],
    }


@router.post("/zotero/execute")
def execute_import(req: ZoteroImportRequest):
    try:
        items = _get_zotero_items(req.profile_path)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not items:
        return {"imported": 0, "baked_annotations": 0}

    db_path = os.path.join(req.profile_path, "zotero.sqlite")
    db = SessionLocal()
    imported = 0
    skipped = 0
    baked_total = 0
    try:
        for it in items:
            # Check duplicate first
            existing = db.query(Document).filter(
                Document.title == it["title"],
                Document.year == it["year"],
            ).first()
            if existing:
                skipped += 1
                continue

            # Copy PDF
            pdf_basename = os.path.basename(it["source_pdf"])
            dest = os.path.join(PAPERS_DIR, pdf_basename)
            counter = 1
            while os.path.exists(dest):
                base, ext = os.path.splitext(pdf_basename)
                dest = os.path.join(PAPERS_DIR, f"{base}_{counter}{ext}")
                counter += 1
            shutil.copy2(it["source_pdf"], dest)

            # Bake annotations
            baked = bake_annotations_into_pdf(dest, db_path)
            baked_total += baked

            doc = Document(
                title=it["title"],
                authors=it["authors"],
                year=it["year"],
                journal=it["journal"],
                doi=it["doi"],
                file_path=dest,
            )
            db.add(doc)
            imported += 1
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"导入失败: {e}")
    finally:
        db.close()
    return {"imported": imported, "baked_annotations": baked_total, "duplicates_skipped": skipped}
