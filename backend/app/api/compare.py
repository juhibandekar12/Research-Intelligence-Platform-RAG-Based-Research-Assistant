from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Document
from app.schemas.chat import CompareRequest, CompareResult
from app.core.security import get_current_user
from app.services.rag_engine import compare_documents

router = APIRouter(prefix="/api/compare", tags=["Compare"])


@router.post("/", response_model=CompareResult)
async def compare_docs(
    payload: CompareRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(payload.doc_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 documents required for comparison")
    if len(payload.doc_ids) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 documents can be compared at once")

    # Verify ownership
    for doc_id in payload.doc_ids:
        doc = await db.get(Document, doc_id)
        if not doc or doc.user_id != user_id:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        if doc.status != "ready":
            raise HTTPException(status_code=400, detail=f"Document '{doc.title}' is not yet processed")

    result = await compare_documents(
        doc_ids=payload.doc_ids,
        user_id=user_id,
        aspects=payload.aspects,
        db=db,
    )

    return CompareResult(
        aspects=result["aspects"],
        comparison=result["comparison"],
        summary=result["summary"],
    )
