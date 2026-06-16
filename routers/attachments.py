import os, shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Attachment, Document
from schemas import AttachmentOut
from config import ATTACHMENTS_DIR

router = APIRouter(prefix="/api/documents/{doc_id}/attachments", tags=["attachments"])

@router.get("", response_model=list[AttachmentOut])
def list_attachments(doc_id: int, db: Session = Depends(get_db)):
    return db.query(Attachment).filter(Attachment.document_id == doc_id).all()

@router.post("", response_model=AttachmentOut)
def upload_attachment(doc_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    doc = db.query(Document).get(doc_id)
    if not doc:
        raise HTTPException(404, "文献不存在")

    folder = os.path.join(ATTACHMENTS_DIR, str(doc_id))
    os.makedirs(folder, exist_ok=True)
    stored_path = os.path.join(folder, file.filename)

    with open(stored_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    ext = os.path.splitext(file.filename)[1].lstrip(".").lower()
    att = Attachment(document_id=doc_id, filename=file.filename, stored_path=stored_path, file_type=ext)
    db.add(att)
    db.commit()
    db.refresh(att)
    return att

@router.get("/{att_id}/content")
def get_attachment_content(doc_id: int, att_id: int, db: Session = Depends(get_db)):
    """Return text content of an attachment (txt files) inline for preview."""
    att = db.query(Attachment).filter(Attachment.id == att_id, Attachment.document_id == doc_id).first()
    if not att or not os.path.isfile(att.stored_path):
        raise HTTPException(404, "附件不存在")

    text_exts = {"txt", "doc", "docx", "md", "csv", "json", "xml", "py", "js", "html", "css", "yaml", "yml", "log"}
    if att.file_type in text_exts:
        try:
            content = open(att.stored_path, "r", encoding="utf-8", errors="replace").read()
        except Exception:
            content = open(att.stored_path, "r", encoding="gbk", errors="replace").read()
        return {"ok": True, "filename": att.filename, "content": content[:50000], "truncated": len(content) > 50000}
    return {"ok": False, "filename": att.filename, "msg": "此文件类型不可预览，请下载查看"}


@router.get("/{att_id}/download")
def download_attachment(doc_id: int, att_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == att_id, Attachment.document_id == doc_id).first()
    if not att or not os.path.isfile(att.stored_path):
        raise HTTPException(404, "附件不存在")
    return FileResponse(att.stored_path, filename=att.filename)

@router.delete("/{att_id}")
def delete_attachment(doc_id: int, att_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == att_id, Attachment.document_id == doc_id).first()
    if not att:
        raise HTTPException(404, "附件不存在")
    if os.path.isfile(att.stored_path):
        os.remove(att.stored_path)
    db.delete(att)
    db.commit()
    return {"ok": True}
