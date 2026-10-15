from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class SourceCitation(BaseModel):
    doc_id: str
    doc_title: str
    page: int
    chunk_index: int
    excerpt: str
    relevance_score: float


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: List[SourceCitation] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"
    mode: str = "collection"  # single | collection | selected
    doc_ids: Optional[List[str]] = []


class ChatSessionOut(BaseModel):
    id: str
    title: str
    mode: str
    doc_ids: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    session_id: str
    message: str


class SearchRequest(BaseModel):
    query: str
    doc_ids: Optional[List[str]] = []  # empty = search all user docs
    top_k: int = 10
    doc_type: Optional[str] = None  # filter by paper | patent


class SearchResult(BaseModel):
    doc_id: str
    doc_title: str
    doc_type: str
    page: int
    chunk_index: int
    excerpt: str
    relevance_score: float


class CompareRequest(BaseModel):
    doc_ids: List[str]  # 2 or more
    aspects: Optional[List[str]] = None  # None = use all default aspects


class CompareResult(BaseModel):
    aspects: List[str]
    comparison: dict  # {aspect: {doc_id: text}}
    summary: str


class SummarizeRequest(BaseModel):
    detail_level: str = "concise"  # concise | detailed


class ReportRequest(BaseModel):
    title: str
    report_type: str  # summary | comparison | research | insights
    doc_ids: List[str]
    custom_instructions: Optional[str] = None


class ReportOut(BaseModel):
    id: str
    title: str
    report_type: str
    doc_ids: List[str]
    status: str
    content: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
