"""
Reports API — background task uses its own DB session (not passed from request).
"""
import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import Document, Report
from app.schemas.chat import ReportRequest, ReportOut
from app.core.security import get_current_user
from app.services.rag_engine import generate_report as _generate_report
from app.core.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/reports", tags=["Reports"])


async def _run_report(report_id: str, doc_ids: list, report_type: str,
                      user_id: str, custom_instructions: str | None):
    """Background task — creates its own DB session."""
    async with AsyncSessionLocal() as db:
        await _generate_report(
            report_id=report_id,
            doc_ids=doc_ids,
            report_type=report_type,
            user_id=user_id,
            custom_instructions=custom_instructions,
            db=db,
        )


@router.post("/", response_model=ReportOut, status_code=201)
async def create_report(
    payload: ReportRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for doc_id in payload.doc_ids:
        doc = await db.get(Document, doc_id)
        if not doc or doc.user_id != user_id:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        if doc.status != "ready":
            raise HTTPException(status_code=400, detail=f"Document '{doc.title}' is not ready")

    report = Report(
        user_id=user_id,
        title=payload.title,
        report_type=payload.report_type,
        doc_ids=payload.doc_ids,
        status="generating",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    background_tasks.add_task(
        _run_report,
        report_id=report.id,
        doc_ids=payload.doc_ids,
        report_type=payload.report_type,
        user_id=user_id,
        custom_instructions=payload.custom_instructions,
    )

    return ReportOut.model_validate(report)


@router.get("/", response_model=list[ReportOut])
async def list_reports(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report)
        .where(Report.user_id == user_id)
        .order_by(Report.created_at.desc())
    )
    return [ReportOut.model_validate(r) for r in result.scalars().all()]


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report or report.user_id != user_id:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportOut.model_validate(report)


@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report or report.user_id != user_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "ready" or not report.file_path:
        raise HTTPException(status_code=400, detail="Report not ready for download")
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found on disk")

    return FileResponse(
        report.file_path,
        media_type="text/markdown",
        filename=f"{report.title.replace(' ', '_')}.md",
    )


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report or report.user_id != user_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.file_path and os.path.exists(report.file_path):
        os.remove(report.file_path)
    await db.delete(report)
    await db.commit()
