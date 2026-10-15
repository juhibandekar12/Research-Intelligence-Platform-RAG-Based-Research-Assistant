# 🔬 Research Intelligence Platform

An AI-powered, full-stack RAG (Retrieval-Augmented Generation) platform for uploading, searching, chatting with, comparing, and generating reports from research papers and patents.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📁 **Document Library** | Upload and manage PDF research papers and patents |
| 🔍 **Semantic Search** | Vector-powered search across all your documents |
| 💬 **AI Chat** | Context-aware conversations with source citations |
| 📊 **Comparison** | Side-by-side multi-document analysis |
| 📝 **Summarization** | Concise and detailed AI summaries |
| 📑 **Reports** | 4 types of structured research reports |
| 🔐 **Authentication** | Secure multi-user JWT auth with isolated libraries |

---

## 🏗️ Architecture

```
Frontend (React + Vite)     →  http://localhost:5173
Backend  (FastAPI)          →  http://localhost:8000
Vector DB (ChromaDB)        →  ./backend/chroma_db/
User DB  (SQLite)           →  ./backend/research_platform.db
LLM      (Google Gemini)    →  API (cloud)
```

---

## ⚡ Quick Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com)

---

### 1. Backend Setup

```powershell
cd e:\rag\backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# → Edit .env and set your GEMINI_API_KEY and SECRET_KEY

# Start the backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`  
Swagger docs: `http://localhost:8000/docs`

---

### 2. Frontend Setup

```powershell
cd e:\rag\frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

---

## 🔑 Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | ✅ Yes |
| `SECRET_KEY` | JWT signing secret (random 32+ chars) | ✅ Yes |
| `LLM_MODEL` | Gemini model name | Default: `gemini-1.5-flash` |
| `EMBEDDING_MODEL` | Embedding model | Default: `models/text-embedding-004` |
| `MAX_RETRIEVAL_DOCS` | Context chunks per RAG query | Default: `8` |
| `CHUNK_SIZE` | Words per text chunk | Default: `1000` |
| `CHUNK_OVERLAP` | Overlap between chunks | Default: `200` |

---

## 📖 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Login → JWT |
| `/api/auth/me` | GET | Current user |
| `/api/documents/upload` | POST | Upload PDF |
| `/api/documents/` | GET | List documents |
| `/api/documents/{id}` | GET/PATCH/DELETE | Manage document |
| `/api/documents/stats` | GET | Library statistics |
| `/api/chat/sessions` | POST/GET | Manage chat sessions |
| `/api/chat/stream` | POST | SSE streaming chat |
| `/api/search/semantic` | POST | Semantic search |
| `/api/compare/` | POST | Compare documents |
| `/api/summarize/{id}` | POST | Summarize document |
| `/api/reports/` | POST/GET | Create/list reports |
| `/api/reports/{id}/download` | GET | Download report (.md) |
| `/api/health` | GET | Health check |

---

## 🗂️ Project Structure

```
e:\rag\
├── backend\
│   ├── app\
│   │   ├── api\           # Route handlers (auth, documents, chat, search, compare, reports, summarize)
│   │   ├── core\          # Config, JWT security
│   │   ├── db\            # SQLAlchemy models & async session
│   │   ├── schemas\       # Pydantic request/response schemas
│   │   ├── services\      # ingestion.py, rag_engine.py (core AI)
│   │   └── main.py        # FastAPI app entry
│   ├── uploads\           # Stored PDFs (per-user)
│   ├── chroma_db\         # ChromaDB vector store
│   ├── reports\           # Generated markdown reports
│   ├── requirements.txt
│   └── .env
│
└── frontend\
    ├── src\
    │   ├── components\    # Sidebar, UploadZone, DocumentCard
    │   ├── pages\         # All 8 pages
    │   ├── store\         # Zustand auth store
    │   ├── services\      # Axios API client
    │   ├── App.jsx        # Router
    │   └── index.css      # Design system
    ├── index.html
    └── package.json
```

---

## 🤖 RAG Pipeline

```
PDF Upload
    ↓
PyMuPDF text extraction (per page)
    ↓
Text cleaning + overlapping chunking (1000 words, 200 overlap)
    ↓
Gemini text-embedding-004 embeddings (batched)
    ↓
ChromaDB upsert (with metadata: doc_id, user_id, page, chunk_index)
    ↓
User Query → Query embedding → ChromaDB similarity search → Top-K chunks
    ↓
Context assembly → Gemini 1.5 Flash → Streamed response + source citations
```

---

## 🔧 Scaling Notes

- **500–1000 docs**: ChromaDB handles up to ~1M vectors — comfortably in range
- **Larger scale**: Swap ChromaDB for Qdrant by changing `get_or_create_collection()` in `ingestion.py`
- **Faster ingestion**: Add Celery + Redis task queue for parallel processing
- **Production DB**: Change `DATABASE_URL` in `.env` to PostgreSQL — SQLAlchemy handles the rest

---

## 🛡️ Security

- Passwords hashed with **bcrypt**
- JWT tokens with configurable expiry (default: 7 days)
- Per-user ChromaDB collection namespaces (data isolation)
- File size limit: 50MB per PDF
- Only PDF MIME type accepted

---

## 📄 License

MIT — free to use and modify.
