from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks

from app.db.session import get_db
from app.db.models import Document
from app.schemas.chat import SummarizeRequest
from app.core.security import get_current_user
from app.services.rag_engine import summarize_document

router = APIRouter(prefix="/api/summarize", tags=["Summarize"])


@router.post("/{doc_id}")
async def summarize_doc(
    doc_id: str,
    payload: SummarizeRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(status_code=400, detail="Document is not yet processed")

    # Return cached summary if available
    if payload.detail_level == "concise" and doc.summary_concise:
        return {"summary": doc.summary_concise, "detail_level": "concise", "cached": True}
    if payload.detail_level == "detailed" and doc.summary_detailed:
        return {"summary": doc.summary_detailed, "detail_level": "detailed", "cached": True}

    summary = await summarize_document(
        doc_id=doc_id,
        user_id=user_id,
        detail_level=payload.detail_level,
        db=db,
    )
    return {"summary": summary, "detail_level": payload.detail_level, "cached": False}
