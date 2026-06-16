from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Annotation, Document
from schemas import AnnotationCreate, AnnotationUpdate, AnnotationOut

router = APIRouter(prefix="/api", tags=["annotations"])

@router.get("/documents/{doc_id}/annotations", response_model=list[AnnotationOut])
def list_annotations(doc_id: int, db: Session = Depends(get_db)):
    return db.query(Annotation).filter(Annotation.document_id == doc_id).order_by(Annotation.page).all()

@router.post("/documents/{doc_id}/annotations", response_model=AnnotationOut)
def create_annotation(doc_id: int, data: AnnotationCreate, db: Session = Depends(get_db)):
    doc = db.query(Document).get(doc_id)
    if not doc:
        raise HTTPException(404, "文献不存在")
    anno = Annotation(document_id=doc_id, **data.model_dump())
    db.add(anno)
    db.commit()
    db.refresh(anno)
    return anno

@router.put("/annotations/{anno_id}", response_model=AnnotationOut)
def update_annotation(anno_id: int, data: AnnotationUpdate, db: Session = Depends(get_db)):
    anno = db.query(Annotation).get(anno_id)
    if not anno:
        raise HTTPException(404, "批注不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(anno, k, v)
    db.commit()
    db.refresh(anno)
    return anno

@router.delete("/annotations/{anno_id}")
def delete_annotation(anno_id: int, db: Session = Depends(get_db)):
    anno = db.query(Annotation).get(anno_id)
    if not anno:
        raise HTTPException(404, "批注不存在")
    db.delete(anno)
    db.commit()
    return {"ok": True}
