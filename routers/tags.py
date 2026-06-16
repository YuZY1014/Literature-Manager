from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Tag, Document
from schemas import TagCreate, TagUpdate, TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])

@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.name).all()

@router.post("", response_model=TagOut)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == data.name).first()
    if existing:
        raise HTTPException(400, "标签已存在")
    tag = Tag(name=data.name, color=data.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag

@router.put("/{tag_id}", response_model=TagOut)
def update_tag(tag_id: int, data: TagUpdate, db: Session = Depends(get_db)):
    tag = db.query(Tag).get(tag_id)
    if not tag:
        raise HTTPException(404, "标签不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tag, k, v)
    db.commit()
    db.refresh(tag)
    return tag

@router.delete("/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).get(tag_id)
    if not tag:
        raise HTTPException(404, "标签不存在")
    db.delete(tag)
    db.commit()
    return {"ok": True}


# --- document-tag associations ---
@router.post("/{tag_id}/documents/{doc_id}")
def add_doc_tag(tag_id: int, doc_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).get(tag_id)
    doc = db.query(Document).get(doc_id)
    if not tag or not doc:
        raise HTTPException(404, "标签或文献不存在")
    if tag not in doc.tags:
        doc.tags.append(tag)
        db.commit()
    return {"ok": True}

@router.delete("/{tag_id}/documents/{doc_id}")
def remove_doc_tag(tag_id: int, doc_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).get(tag_id)
    doc = db.query(Document).get(doc_id)
    if not tag or not doc:
        raise HTTPException(404, "标签或文献不存在")
    if tag in doc.tags:
        doc.tags.remove(tag)
        db.commit()
    return {"ok": True}
