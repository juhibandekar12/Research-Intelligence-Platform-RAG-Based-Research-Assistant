from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db.session import init_db
from app.db.models import User
from app.db.session import get_db
from app.schemas.user import UserOut
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings.ensure_dirs()
    await init_db()
    print(f"[OK] {settings.app_name} v{settings.app_version} started")
    yield
    # Shutdown
    print("[--] Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-Powered RAG Research Intelligence Platform",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
from app.api import auth, documents, chat, search, compare, reports, summarize

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(compare.router)
app.include_router(reports.router)
app.include_router(summarize.router)


# ─── Auth /me endpoint ────────────────────────────────────────────────────────
@app.get("/api/auth/me", response_model=UserOut, tags=["Authentication"])
async def get_me(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
