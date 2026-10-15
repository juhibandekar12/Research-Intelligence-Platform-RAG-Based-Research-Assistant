from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.chat import SearchRequest, SearchResult
from app.core.security import get_current_user
from app.services.rag_engine import semantic_search

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.post("/semantic", response_model=list[SearchResult])
async def semantic_search_endpoint(
    payload: SearchRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Perform semantic (vector) search across user's documents."""
    results = await semantic_search(
        query=payload.query,
        user_id=user_id,
        doc_ids=payload.doc_ids or [],
        top_k=payload.top_k,
        doc_type=payload.doc_type,
    )
    return results
