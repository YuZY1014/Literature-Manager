import os, shutil, sqlite3, json, uuid, configparser
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import Document
from schemas import ZoteroImportRequest
from services.zotero_importer import bake_annotations_into_pdf
from config import PAPERS_DIR

router = APIRouter(prefix="/api/import", tags=["import"])


def _copy_db(zotero_path: str) -> str:
    """Copy zotero.sqlite (and WAL/SHM companions) to a temp file under storage/."""
    src = os.path.join(zotero_path, "zotero.sqlite")
    tmp = os.path.join(zotero_path, "storage", f"_tmp_{uuid.uuid4().hex}.sqlite")
    shutil.copy2(src, tmp)
    for suffix in ("-wal", "-shm"):
        wal_src = src + suffix
        if os.path.isfile(wal_src):
            shutil.copy2(wal_src, tmp + suffix)
    return tmp


def _cleanup_tmp_db(tmp_db: str):
    """Remove temp DB and its WAL/SHM companions."""
    for suffix in ("", "-wal", "-shm"):
        f = tmp_db + suffix
        if os.path.isfile(f):
            try:
                os.remove(f)
            except OSError:
                pass


@router.get("/zotero/auto-detect")
def auto_detect_zotero():
    """Auto-detect Zotero data directory on the local machine."""
    try:
        import getpass
        username = getpass.getuser()
        candidates = [
            os.path.join("C:\\Users", username, "Zotero"),
            os.path.join("C:\\Users", username, "AppData", "Roaming", "Zotero", "Zotero"),
        ]

        # Parse profiles.ini for custom profile paths (Zotero 7)
        appdata = os.environ.get("APPDATA", os.path.join("C:\\Users", username, "AppData", "Roaming"))
        profiles_ini = os.path.join(appdata, "Zotero", "profiles.ini")
        if os.path.isfile(profiles_ini):
            cp = configparser.ConfigParser()
            cp.read(profiles_ini)
            for section in cp.sections():
                if section.startswith("Profile"):
                    path_val = cp.get(section, "Path", fallback=None)
                    is_relative = cp.get(section, "IsRelative", fallback="1") == "1"
                    if path_val:
                        if is_relative:
                            candidates.append(os.path.join(os.path.dirname(profiles_ini), path_val))
                        else:
                            candidates.append(path_val)

        # Also scan the hardcoded Profiles directory
        base = os.path.join("C:\\Users", username, "AppData", "Roaming", "Zotero", "Zotero", "Profiles")
        if os.path.isdir(base):
            try:
                for d in os.listdir(base):
                    p = os.path.join(base, d)
                    if os.path.isdir(p):
                        candidates.append(p)
            except OSError:
                pass

        # Deduplicate while preserving order
        seen = set()
        unique = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                unique.append(c)

        found = []
        for c in unique:
            if os.path.isfile(os.path.join(c, "zotero.sqlite")) and os.path.isdir(os.path.join(c, "storage")):
                found.append(c)

        return {"found": found, "default": found[0] if found else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"自动检测失败: {e}")


def _get_zotero_items(zotero_path: str) -> list[dict]:
    zotero_db = os.path.join(zotero_path, "zotero.sqlite")
    storage = os.path.join(zotero_path, "storage")
    if not os.path.isfile(zotero_db):
        raise ValueError(f"zotero.sqlite 不存在: {zotero_db}")
    if not os.path.isdir(storage):
        raise ValueError(f"storage 目录不存在: {storage}")

    tmp_db = None
    try:
        tmp_db = _copy_db(zotero_path)
        conn = sqlite3.connect(tmp_db)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Detect Zotero 7 vs 6 schema for itemAnnotations
        cur.execute("PRAGMA table_info(itemAnnotations)")
        anno_columns = {row[1] for row in cur.fetchall()}

        # In Zotero 7 the isExternal column was removed (all annotations are user-created).
        # In Zotero 6, isExternal = 1 filters out internal annotations.
        anno_is_external_clause = ""
        if "isExternal" in anno_columns:
            anno_is_external_clause = " AND isExternal = 1"

        # Get all PDF attachments with their storage keys
        cur.execute("""
            SELECT ia.itemID, ia.parentItemID, ia.path, i.key
            FROM itemAttachments ia
            JOIN items i ON ia.itemID = i.itemID
            WHERE ia.contentType = 'application/pdf'
        """)
        pdf_rows = cur.fetchall()

        # Build parent metadata map
        parent_ids = set(r["parentItemID"] for r in pdf_rows if r["parentItemID"] is not None)
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
                FROM itemAnnotations WHERE 1=1{anno_is_external_clause}
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
        if tmp_db is not None:
            _cleanup_tmp_db(tmp_db)

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
        if pid is not None:
            title = title_map.get(pid) or title_map.get(r["itemID"]) or os.path.splitext(filename)[0]
            title = title.strip()
            date_str = date_map.get(pid) or ""
            year = None
            try:
                if date_str and len(date_str) >= 4:
                    year = int(date_str[:4])
            except ValueError:
                pass
            authors = author_map.get(pid, "")
            journal = pub_map.get(pid, "")
            doi = doi_map.get(pid, "")
        else:
            # Orphan attachment — no bibliographic metadata
            title = os.path.splitext(filename)[0].strip()
            year = None
            authors = ""
            journal = ""
            doi = ""

        results.append({
            "title": title,
            "authors": authors,
            "year": year,
            "journal": journal,
            "doi": doi,
            "source_pdf": full_pdf,
            "annotation_count": anno_counts.get(r["itemID"], 0),
        })
    return results


@router.post("/zotero/preview")
def preview_import(req: ZoteroImportRequest):
    try:
        items = _get_zotero_items(req.profile_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except sqlite3.OperationalError as e:
        raise HTTPException(status_code=400, detail=f"Zotero 数据库读取失败（可能是版本不兼容或数据库被占用）: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"扫描失败: {e}")
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
        raise HTTPException(status_code=400, detail=str(e))
    except sqlite3.OperationalError as e:
        raise HTTPException(status_code=400, detail=f"Zotero 数据库读取失败（可能是版本不兼容或数据库被占用）: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"扫描失败: {e}")

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
