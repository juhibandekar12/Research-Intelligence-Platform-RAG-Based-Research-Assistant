"""
PDF Ingestion Service
- Extracts text per page using PyMuPDF
- Cleans and chunks text
- Generates Gemini embeddings
- Upserts to ChromaDB with rich metadata
- Updates Document status in SQLite
"""

import asyncio
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

import fitz  # PyMuPDF
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import Document

settings = get_settings()

# ─── ChromaDB Client (singleton) ─────────────────────────────────────────────

_chroma_client = None


def get_chroma_client() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_or_create_collection(user_id: str) -> chromadb.Collection:
    """Each user gets their own ChromaDB collection (namespace isolation)."""
    client = get_chroma_client()
    collection_name = f"user_{user_id.replace('-', '_')}"
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )


# ─── Text Extraction ──────────────────────────────────────────────────────────

def extract_pages(file_path: str) -> List[Tuple[int, str]]:
    """Return list of (page_number, cleaned_text) tuples using PyMuPDF or fallback pypdf."""
    pages = []
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        for i, page in enumerate(doc):
            text = page.get_text("text")
            text = clean_text(text)
            if text.strip():
                pages.append((i + 1, text))
        doc.close()
        return pages
    except Exception as fitz_err:
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                text = clean_text(text)
                if text.strip():
                    pages.append((i + 1, text))
            return pages
        except Exception as pypdf_err:
            raise RuntimeError(f"PDF text extraction failed: PyMuPDF error ({fitz_err}), pypdf error ({pypdf_err})")


def clean_text(text: str) -> str:
    """Remove common PDF artifacts."""
    # Remove excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {3,}", " ", text)
    # Remove page numbers (isolated numbers on a line)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


# ─── Chunking ─────────────────────────────────────────────────────────────────

def chunk_text(text: str, page: int, chunk_size: int = None, overlap: int = None) -> List[dict]:
    """Split text into overlapping chunks with page metadata."""
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap
    words = text.split()
    chunks = []
    idx = 0
    chunk_index = 0
    while idx < len(words):
        chunk_words = words[idx: idx + chunk_size]
        chunk_text_content = " ".join(chunk_words)
        if len(chunk_text_content.strip()) > 50:  # skip tiny chunks
            chunks.append({
                "text": chunk_text_content,
                "page": page,
                "chunk_index": chunk_index,
            })
            chunk_index += 1
        idx += chunk_size - overlap
    return chunks


# ─── Embeddings ───────────────────────────────────────────────────────────────

from app.services.ai_provider import (
    generate_embeddings_batch,
    generate_query_embedding,
)


# ─── Main Ingestion Pipeline ──────────────────────────────────────────────────

async def ingest_document(doc_id: str, user_id: str, file_path: str, doc_title: str, doc_type: str):
    """
    Full ingestion pipeline for a single PDF.
    Runs in a background asyncio task.
    """
    async with AsyncSessionLocal() as db:
        try:
            # 1. Extract text pages
            pages = await asyncio.to_thread(extract_pages, file_path)
            page_count = len(pages)

            # 2. Chunk all pages
            all_chunks = []
            for page_num, page_text in pages:
                page_chunks = chunk_text(page_text, page_num)
                all_chunks.extend(page_chunks)

            if not all_chunks:
                raise ValueError("No text could be extracted from this PDF.")

            # 3. Generate embeddings in batches of 100
            BATCH_SIZE = 100
            all_embeddings = []
            texts = [c["text"] for c in all_chunks]
            for i in range(0, len(texts), BATCH_SIZE):
                batch = texts[i: i + BATCH_SIZE]
                embeddings = await asyncio.to_thread(generate_embeddings_batch, batch)
                all_embeddings.extend(embeddings)

            # 4. Upsert to ChromaDB
            collection = await asyncio.to_thread(get_or_create_collection, user_id)
            ids = []
            embeddings_list = []
            documents_list = []
            metadatas_list = []

            for i, (chunk, embedding) in enumerate(zip(all_chunks, all_embeddings)):
                chunk_id = f"{doc_id}_chunk_{i}"
                ids.append(chunk_id)
                embeddings_list.append(embedding)
                documents_list.append(chunk["text"])
                metadatas_list.append({
                    "doc_id": doc_id,
                    "user_id": user_id,
                    "title": doc_title or "Untitled",
                    "doc_type": doc_type,
                    "page": chunk["page"],
                    "chunk_index": chunk["chunk_index"],
                })

            # Upsert in batches
            for i in range(0, len(ids), BATCH_SIZE):
                await asyncio.to_thread(
                    collection.upsert,
                    ids=ids[i: i + BATCH_SIZE],
                    embeddings=embeddings_list[i: i + BATCH_SIZE],
                    documents=documents_list[i: i + BATCH_SIZE],
                    metadatas=metadatas_list[i: i + BATCH_SIZE],
                )

            # 5. Update DB record
            doc = await db.get(Document, doc_id)
            if doc:
                doc.status = "ready"
                doc.page_count = page_count
                doc.chunk_count = len(all_chunks)
                doc.processed_at = datetime.now(timezone.utc)
                await db.commit()

        except Exception as e:
            async with AsyncSessionLocal() as err_db:
                doc = await err_db.get(Document, doc_id)
                if doc:
                    doc.status = "error"
                    doc.error_message = str(e)[:500]
                    await err_db.commit()


async def delete_document_vectors(doc_id: str, user_id: str):
    """Remove all ChromaDB chunks for a document."""
    collection = await asyncio.to_thread(get_or_create_collection, user_id)
    results = await asyncio.to_thread(
        collection.get,
        where={"doc_id": doc_id},
    )
    if results["ids"]:
        await asyncio.to_thread(collection.delete, ids=results["ids"])
