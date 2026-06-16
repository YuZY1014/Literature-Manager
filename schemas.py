from datetime import datetime
from typing import Optional
from pydantic import BaseModel

# --- Document ---
class DocumentCreate(BaseModel):
    title: str
    file_path: str
    authors: Optional[str] = None
    year: Optional[int] = None
    journal: Optional[str] = None
    doi: Optional[str] = None
    abstract: Optional[str] = None
    notes: Optional[str] = ""

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[int] = None
    journal: Optional[str] = None
    doi: Optional[str] = None
    abstract: Optional[str] = None
    notes: Optional[str] = None

class TagBrief(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}

class DocumentOut(BaseModel):
    id: int
    title: str
    file_path: str
    authors: Optional[str] = None
    year: Optional[int] = None
    journal: Optional[str] = None
    doi: Optional[str] = None
    abstract: Optional[str] = None
    notes: Optional[str] = ""
    created_at: datetime
    updated_at: datetime
    tags: list[TagBrief] = []

    model_config = {"from_attributes": True}

# --- Tag ---
class TagCreate(BaseModel):
    name: str
    color: Optional[str] = "#3b82f6"

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class TagOut(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}

# --- Annotation ---
class AnnotationCreate(BaseModel):
    page: int
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    text: Optional[str] = ""
    anno_type: str = "highlight"
    color: Optional[str] = "#ffff00"

class AnnotationUpdate(BaseModel):
    text: Optional[str] = None
    color: Optional[str] = None

class AnnotationOut(BaseModel):
    id: int
    document_id: int
    page: int
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    text: Optional[str] = ""
    anno_type: str
    color: str
    created_at: datetime

    model_config = {"from_attributes": True}

# --- Attachment ---
class AttachmentOut(BaseModel):
    id: int
    document_id: int
    filename: str
    file_type: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

# --- Import ---
class ZoteroImportRequest(BaseModel):
    profile_path: str
