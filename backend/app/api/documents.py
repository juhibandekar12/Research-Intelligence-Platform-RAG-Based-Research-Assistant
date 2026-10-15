import asyncio
import os
import uuid
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.db.models import Document
from app.schemas.document import DocumentOut, DocumentStats, DocumentUpdate
from app.core.security import get_current_user
from app.core.config import get_settings
from app.services.ingestion import ingest_document, delete_document_vectors

settings = get_settings()
router = APIRouter(prefix="/api/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    doc_type: str = Form(default="paper"),
    title: str = Form(default=None),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file type
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Save to disk
    doc_id = str(uuid.uuid4())
    user_upload_dir = Path(settings.upload_dir) / user_id
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(user_upload_dir / f"{doc_id}.pdf")

    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB record
    doc_title = title or Path(file.filename).stem
    doc = Document(
        id=doc_id,
        user_id=user_id,
        filename=file.filename,
        title=doc_title,
        doc_type=doc_type,
        status="processing",
        file_size=len(content),
        file_path=file_path,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Kick off ingestion in background
    background_tasks.add_task(
        ingest_document,
        doc_id=doc_id,
        user_id=user_id,
        file_path=file_path,
        doc_title=doc_title,
        doc_type=doc_type,
    )

    return DocumentOut.model_validate(doc)


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.upload_date.desc())
    )
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.get("/stats", response_model=DocumentStats)
async def get_stats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Document).where(Document.user_id == user_id))
    docs = result.scalars().all()

    return DocumentStats(
        total_documents=len(docs),
        ready_documents=sum(1 for d in docs if d.status == "ready"),
        processing_documents=sum(1 for d in docs if d.status == "processing"),
        error_documents=sum(1 for d in docs if d.status == "error"),
        total_chunks=sum(d.chunk_count for d in docs),
        total_pages=sum(d.page_count for d in docs),
    )


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut.model_validate(doc)


@router.patch("/{doc_id}", response_model=DocumentOut)
async def update_document(
    doc_id: str,
    payload: DocumentUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")

    if payload.title is not None:
        doc.title = payload.title
    if payload.doc_type is not None:
        doc.doc_type = payload.doc_type

    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete PDF file
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    # Delete vectors in background
    background_tasks.add_task(delete_document_vectors, doc_id, user_id)

    await db.delete(doc)
    await db.commit()
