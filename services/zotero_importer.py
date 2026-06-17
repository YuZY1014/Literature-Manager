import os, shutil, sqlite3, json, uuid
import fitz  # PyMuPDF

ANNOTATION_TYPE_MAP = {1: "highlight", 2: "underline", 3: "note", 4: "strikethrough", 5: "text"}


def bake_annotations_into_pdf(pdf_path: str, db_path: str) -> int:
    """Read annotations from Zotero DB and permanently write them into the PDF.
    Returns the number of annotations baked."""
    try:
        pdf_basename = os.path.basename(pdf_path)
    except Exception:
        return 0

    # Copy DB (and WAL/SHM) to avoid lock
    tmp_db = None
    try:
        tmp_db = os.path.join(os.path.dirname(pdf_path), f"_tmp_{uuid.uuid4().hex}.sqlite")
        shutil.copy2(db_path, tmp_db)
        for suffix in ("-wal", "-shm"):
            wal_src = db_path + suffix
            if os.path.isfile(wal_src):
                shutil.copy2(wal_src, tmp_db + suffix)
    except Exception:
        if tmp_db is not None:
            for suffix in ("", "-wal", "-shm"):
                f = tmp_db + suffix
                if os.path.isfile(f):
                    try:
                        os.remove(f)
                    except OSError:
                        pass
        return 0

    conn = sqlite3.connect(tmp_db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Find the attachment itemID for this PDF
    cur.execute("""
        SELECT ia.itemID FROM itemAttachments ia
        WHERE ia.path LIKE ? AND ia.contentType = 'application/pdf'
    """, (f"%storage:{pdf_basename}%",))
    att_row = cur.fetchone()
    if not att_row:
        # Try without storage: prefix
        cur.execute("""
            SELECT ia.itemID FROM itemAttachments ia
            WHERE ia.path LIKE ? AND ia.contentType = 'application/pdf'
        """, (f"%{pdf_basename}%",))
        att_row = cur.fetchone()
    if not att_row:
        conn.close()
        _cleanup_tmp_db(tmp_db)
        return 0

    att_id = att_row["itemID"]

    # Detect schema: Zotero 7 removed isExternal column
    try:
        cur.execute("PRAGMA table_info(itemAnnotations)")
        anno_columns = {row[1] for row in cur.fetchall()}
    except sqlite3.OperationalError:
        # itemAnnotations table doesn't exist at all
        conn.close()
        _cleanup_tmp_db(tmp_db)
        return 0

    anno_is_external_clause = ""
    if "isExternal" in anno_columns:
        anno_is_external_clause = " AND isExternal = 1"

    # Get annotations for this attachment
    cur.execute(f"""
        SELECT type, text, comment, color, pageLabel, position
        FROM itemAnnotations
        WHERE parentItemID = ?{anno_is_external_clause}
        ORDER BY sortIndex
    """, (att_id,))
    annos = cur.fetchall()
    conn.close()
    _cleanup_tmp_db(tmp_db)

    if not annos:
        return 0

    # Open PDF and bake annotations
    doc = fitz.open(pdf_path)
    baked = 0
    for a in annos:
        try:
            pos = json.loads(a["position"])
            page_idx = pos.get("pageIndex", 0)
            if page_idx >= len(doc):
                continue
            page = doc[page_idx]
            rects = pos.get("rects", [])
            atype = a["type"]
            color_hex = a["color"] or "#ffff00"
            # Convert hex to RGB tuple normalized 0-1
            r = int(color_hex[1:3], 16) / 255
            g = int(color_hex[3:5], 16) / 255
            b = int(color_hex[5:7], 16) / 255
            text = a["text"] or ""
            comment = a["comment"] or ""

            if atype in (1, 4):  # highlight or strikethrough
                for rect_arr in rects:
                    if len(rect_arr) < 4:
                        continue
                    x0, y0, x1, y1 = rect_arr[:4]
                    if x1 <= x0:
                        x1 = x0 + 50
                    rect = fitz.Rect(x0, y0, x1, y1)
                    if atype == 1:
                        annot = page.add_highlight_annot(rect)
                    else:
                        annot = page.add_strikeout_annot(rect)
                    annot.set_colors(stroke=(r, g, b))
                    if text:
                        annot.set_info(content=text)
                    annot.update()
                    baked += 1

            elif atype == 2:  # underline
                for rect_arr in rects:
                    if len(rect_arr) < 4:
                        continue
                    x0, y0, x1, y1 = rect_arr[:4]
                    if x1 <= x0:
                        x1 = x0 + 50
                    rect = fitz.Rect(x0, y0, x1, y1)
                    annot = page.add_underline_annot(rect)
                    annot.set_colors(stroke=(r, g, b))
                    if text:
                        annot.set_info(content=text)
                    annot.update()
                    baked += 1

            elif atype in (3, 5):  # note or text
                # Put a small icon at the first rect position
                if rects and len(rects[0]) >= 4:
                    x0, y0, x1, y1 = rects[0][:4]
                else:
                    x0, y0, x1, y1 = 100, 100, 120, 120
                rect = fitz.Rect(x0, y0 - 20, x0 + 20, y0)
                content = comment or text
                annot = page.add_text_annot(rect.tl, content)
                annot.set_colors(stroke=(r, g, b))
                annot.update()
                baked += 1
        except Exception:
            continue

    if baked > 0:
        tmp_path = pdf_path + ".baked.pdf"
        doc.save(tmp_path, garbage=4, deflate=True)
        doc.close()
        os.replace(tmp_path, pdf_path)
    else:
        doc.close()
    return baked


def _cleanup_tmp_db(tmp_db: str):
    """Remove temp DB and its WAL/SHM companions."""
    for suffix in ("", "-wal", "-shm"):
        f = tmp_db + suffix
        if os.path.isfile(f):
            try:
                os.remove(f)
            except OSError:
                pass
