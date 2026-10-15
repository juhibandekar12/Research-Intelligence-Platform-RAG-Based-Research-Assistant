"""
Unified AI Provider Service
Supports both Google Gemini API keys (AIza...) and Groq API keys (gsk_...)
"""

import asyncio
import hashlib
from typing import List, Generator
from app.core.config import get_settings

settings = get_settings()


def detect_provider() -> str:
    """Detect whether key is Groq (gsk_...) or Gemini (AIza...) or none."""
    key = (settings.gemini_api_key or "").strip()
    if key.startswith("gsk_"):
        return "groq"
    elif key.startswith("AIza"):
        return "gemini"
    elif key:
        return "groq" if "gsk_" in key else "gemini"
    return "none"


# ─── Embedding Generation ───────────────────────────────────────────────────

def _local_vector_embedding(text: str, dim: int = 384) -> List[float]:
    """Deterministic local feature-hash vector embedding (384-dim, unit normalized)."""
    import math, re
    vec = [0.0] * dim
    words = re.findall(r'\w+', text.lower())
    if not words:
        return vec
    for w in words:
        # Hash word to dimension index
        h = int(hashlib.md5(w.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if (h >> 16) % 2 == 0 else -1.0
        vec[idx] += sign
    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a list of texts.
    If Gemini key (AIza...) -> use Gemini text-embedding-004.
    If Groq / Local -> use local feature vector embedding.
    """
    provider = detect_provider()
    key = (settings.gemini_api_key or "").strip()

    if provider == "gemini":
        if not key:
            raise ValueError("No API Key configured. Please set GEMINI_API_KEY in backend/.env")
        import google.generativeai as genai
        genai.configure(api_key=key)
        embeddings = []
        for text in texts:
            result = genai.embed_content(
                model=settings.embedding_model,
                content=text,
                task_type="retrieval_document",
            )
            emb = result.get("embedding", [])
            if emb and isinstance(emb[0], list):
                embeddings.extend(emb)
            else:
                embeddings.append(emb)
        return embeddings
    else:
        return [_local_vector_embedding(t) for t in texts]


def generate_query_embedding(query: str) -> List[float]:
    """Generate embedding for a single query text."""
    provider = detect_provider()
    key = (settings.gemini_api_key or "").strip()

    if provider == "gemini":
        if not key:
            raise ValueError("No API Key configured. Please set GEMINI_API_KEY in backend/.env")
        import google.generativeai as genai
        genai.configure(api_key=key)
        result = genai.embed_content(
            model=settings.embedding_model,
            content=query,
            task_type="retrieval_query",
        )
        emb = result.get("embedding", [])
        if emb and isinstance(emb[0], list):
            return emb[0]
        return emb
    else:
        return _local_vector_embedding(query)


# ─── LLM Completion ──────────────────────────────────────────────────────────

def generate_llm_response(prompt: str, system_prompt: str = None) -> str:
    """Synchronous LLM content generation."""
    provider = detect_provider()
    key = (settings.gemini_api_key or "").strip()

    if not key or provider == "none":
        raise ValueError("No API Key configured. Please set GEMINI_API_KEY in backend/.env")

    if provider == "groq":
        import groq
        client = groq.Groq(api_key=key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Try Groq models in order of preference
        models_to_try = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
        for model in models_to_try:
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=4096,
                )
                return resp.choices[0].message.content
            except Exception as e:
                if model == models_to_try[-1]:
                    raise e
    else:
        # Gemini
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel(settings.llm_model)
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        resp = model.generate_content(full_prompt)
        return resp.text


def stream_llm_response(messages_list: list, system_prompt: str = None) -> Generator[str, None, None]:
    """Generator for streaming response chunks."""
    provider = detect_provider()
    key = (settings.gemini_api_key or "").strip()

    if not key or provider == "none":
        raise ValueError("No API Key configured. Please set GEMINI_API_KEY in backend/.env")

    if provider == "groq":
        import groq
        client = groq.Groq(api_key=key)
        groq_messages = []
        if system_prompt:
            groq_messages.append({"role": "system", "content": system_prompt})
        
        for m in messages_list:
            role = m.get("role", "user")
            if role == "model":
                role = "assistant"
            content = m.get("parts", [m.get("content", "")])[0] if isinstance(m.get("parts"), list) else m.get("content", "")
            groq_messages.append({"role": role, "content": content})

        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            stream=True,
            temperature=0.3,
            max_tokens=4096,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    else:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel(settings.llm_model)
        
        # Build prompt
        last_user_msg = messages_list[-1] if messages_list else {"content": ""}
        prompt_text = f"{system_prompt}\n\nUser question: {last_user_msg.get('content', '')}"
        
        history = []
        for m in messages_list[:-1]:
            role = "user" if m.get("role") == "user" else "model"
            content = m.get("parts", [m.get("content", "")])[0] if isinstance(m.get("parts"), list) else m.get("content", "")
            history.append({"role": role, "parts": [content]})
            
        chat = model.start_chat(history=history)
        response_stream = chat.send_message(prompt_text, stream=True)
        for chunk in response_stream:
            if chunk.text:
                yield chunk.text
