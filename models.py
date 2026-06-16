from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from database import Base

document_tags = Table(
    "document_tags",
    Base.metadata,
    Column("document_id", Integer, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    file_path = Column(String(1000), unique=True)
    authors = Column(Text)
    year = Column(Integer)
    journal = Column(String(500))
    doi = Column(String(500))
    abstract = Column(Text)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tags = relationship("Tag", secondary=document_tags, back_populates="documents", lazy="selectin")
    annotations = relationship("Annotation", back_populates="document", cascade="all, delete-orphan", lazy="selectin")
    attachments = relationship("Attachment", back_populates="document", cascade="all, delete-orphan", lazy="selectin")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False)
    color = Column(String(7), default="#3b82f6")

    documents = relationship("Document", secondary=document_tags, back_populates="tags", lazy="selectin")

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page = Column(Integer, nullable=False)
    x = Column(Float)
    y = Column(Float)
    width = Column(Float)
    height = Column(Float)
    text = Column(Text, default="")
    anno_type = Column(String(20), default="highlight")
    color = Column(String(7), default="#ffff00")
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="annotations")

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    stored_path = Column(String(1000), nullable=False)
    file_type = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="attachments")
