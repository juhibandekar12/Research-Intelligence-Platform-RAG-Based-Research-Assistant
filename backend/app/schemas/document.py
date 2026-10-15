from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DocumentOut(BaseModel):
    id: str
    filename: str
    title: Optional[str]
    doc_type: str
    status: str
    page_count: int
    chunk_count: int
    file_size: int
    upload_date: datetime
    processed_at: Optional[datetime]
    summary_concise: Optional[str]
    error_message: Optional[str]

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    doc_type: Optional[str] = None


class DocumentStats(BaseModel):
    total_documents: int
    ready_documents: int
    processing_documents: int
    error_documents: int
    total_chunks: int
    total_pages: int
