import os, shutil, uuid, re
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Document
from schemas import DocumentCreate, DocumentUpdate, DocumentOut
from config import PAPERS_DIR

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/extract-meta")
async def extract_metadata(pdf: UploadFile = File(...)):
    """Extract metadata from a PDF file using PyMuPDF."""
    import fitz
    tmp_path = os.path.join(PAPERS_DIR, f"_tmp_{uuid.uuid4().hex}.pdf")
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(pdf.file, f)

        doc = fitz.open(tmp_path)
        meta = doc.metadata
        page_count = len(doc)
        text = ""
        if page_count > 0:
            text = doc[0].get_text()
        doc.close()

        # Try to extract DOI from first page text
        doi = ""
        doi_match = re.search(r'(?:DOI|doi)[:\s]*([^\s]+)', text)
        if not doi_match:
            doi_match = re.search(r'10\.\d{4,}/[^\s]+', text)
        if doi_match:
            doi = doi_match.group(1) if doi_match.lastindex else doi_match.group(0)
            doi = doi.rstrip(".,;")

        return {
            "title": meta.get("title", ""),
            "authors": meta.get("author", ""),
            "doi": doi,
            "page_count": page_count,
        }
    except Exception as e:
        return {"title": "", "authors": "", "doi": "", "error": str(e)}
    finally:
        if os.path.isfile(tmp_path):
            os.remove(tmp_path)

@router.get("", response_model=list[DocumentOut])
def list_docs(
    tag: str = Query(None),
    q: str = Query(None),
    year: int = Query(None),
    untagged: bool = Query(False),
    db: Session = Depends(get_db),
):
    qry = db.query(Document)
    if q:
        like = f"%{q}%"
        qry = qry.filter(
            (Document.title.like(like)) |
            (Document.authors.like(like)) |
            (Document.abstract.like(like)) |
            (Document.notes.like(like)) |
            (Document.journal.like(like))
        )
    if year:
        qry = qry.filter(Document.year == year)
    if tag:
        qry = qry.filter(Document.tags.any(name=tag))
    if untagged:
        from models import document_tags
        qry = qry.outerjoin(document_tags).filter(document_tags.c.document_id == None)
    docs = qry.order_by(Document.updated_at.desc()).all()
    # Filter out docs whose PDF files no longer exist on disk
    return [d for d in docs if d.file_path and os.path.isfile(d.file_path)]

@router.get("/cleanup-orphans")
def cleanup_orphans(db: Session = Depends(get_db)):
    """Delete database records whose PDF files no longer exist on disk."""
    docs = db.query(Document).all()
    removed = 0
    for d in docs:
        if not d.file_path or not os.path.isfile(d.file_path):
            db.delete(d)
            removed += 1
    db.commit()
    return {"removed": removed}


@router.get("/check-duplicate")
def check_duplicate(title: str = Query(...), authors: str = Query(""), year: str = Query(""), db: Session = Depends(get_db)):
    qry = db.query(Document).filter(Document.title == title.strip())
    if authors.strip():
        qry = qry.filter(Document.authors == authors.strip())
    if year.strip():
        try:
            qry = qry.filter(Document.year == int(year))
        except ValueError:
            pass
    existing = qry.first()
    if existing:
        return {"duplicate": True, "id": existing.id, "title": existing.title, "year": existing.year}
    return {"duplicate": False, "id": None}


@router.get("/{doc_id}", response_model=DocumentOut)
def get_doc(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).get(doc_id)
    if not doc:
        raise HTTPException(404, "文献不存在")
    return doc

@router.post("", response_model=DocumentOut)
async def create_doc(
    title: str = Form(...),
    authors: str = Form(""),
    year: str = Form(""),
    journal: str = Form(""),
    doi: str = Form(""),
    abstract: str = Form(""),
    pdf: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Save PDF to papers/
    ext = os.path.splitext(pdf.filename)[1] or ".pdf"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(PAPERS_DIR, safe_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(pdf.file, f)

    doc = Document(
        title=title,
        authors=authors,
        year=int(year) if year else None,
        journal=journal,
        doi=doi,
        abstract=abstract,
        file_path=dest,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

@router.put("/{doc_id}", response_model=DocumentOut)
def update_doc(doc_id: int, data: DocumentUpdate, db: Session = Depends(get_db)):
    doc = db.query(Document).get(doc_id)
    if not doc:
        raise HTTPException(404, "文献不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(doc, k, v)
    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/{doc_id}")
def delete_doc(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).get(doc_id)
    if not doc:
        raise HTTPException(404, "文献不存在")
    from config import PAPERS_DIR
    if doc.file_path and os.path.isfile(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"ok": True}

@router.get("/{doc_id}/thumbnail")
def get_thumbnail(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).get(doc_id)
    if not doc or not doc.file_path or not os.path.isfile(doc.file_path):
        raise HTTPException(404, "PDF 文件不存在")

    import fitz
    from fastapi.responses import Response

    try:
        pdf = fitz.open(doc.file_path)
        page = pdf[0]
        pix = page.get_pixmap(dpi=120)
        img_data = pix.tobytes("png")
        pdf.close()
        return Response(content=img_data, media_type="image/png")
    except Exception:
        raise HTTPException(500, "缩略图生成失败")


@router.get("/{doc_id}/pdf")
def get_pdf(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).get(doc_id)
    if not doc or not doc.file_path or not os.path.isfile(doc.file_path):
        raise HTTPException(404, "PDF 文件不存在")
    return FileResponse(doc.file_path, media_type="application/pdf")
