"""
RAG Engine — Core Intelligence Service
Handles: semantic search, multi-turn chat, summarization, comparison, reports
"""

import asyncio
import json
from typing import List, Optional, AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import Document, ChatSession, ChatMessage
from app.services.ingestion import (
    get_or_create_collection,
)
from app.services.ai_provider import (
    generate_query_embedding,
    generate_llm_response,
    stream_llm_response,
)
from app.schemas.chat import SourceCitation, SearchResult

settings = get_settings()

DEFAULT_COMPARISON_ASPECTS = [
    "Research Objective & Problem Statement",
    "Methodology & Approach",
    "Datasets & Experimental Setup",
    "Key Results & Metrics",
    "Innovations & Contributions",
    "Limitations",
    "Conclusions",
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

from app.services.ai_provider import (
    generate_llm_response,
    stream_llm_response,
)


def truncate_context(chunks: list, max_chars: int = 12000) -> list:
    """Limit total context size sent to LLM."""
    total = 0
    result = []
    for c in chunks:
        text = c.get("document", c.get("text", ""))
        if total + len(text) > max_chars:
            break
        result.append(c)
        total += len(text)
    return result


# ─── Semantic Search ──────────────────────────────────────────────────────────

async def semantic_search(
    query: str,
    user_id: str,
    doc_ids: Optional[List[str]] = None,
    top_k: int = 10,
    doc_type: Optional[str] = None,
) -> List[SearchResult]:
    """Perform vector similarity search in ChromaDB."""
    query_embedding = await asyncio.to_thread(generate_query_embedding, query)
    collection = await asyncio.to_thread(get_or_create_collection, user_id)

    where_conditions = [{"user_id": user_id}]
    if doc_ids:
        if len(doc_ids) == 1:
            where_conditions.append({"doc_id": doc_ids[0]})
        else:
            where_conditions.append({"doc_id": {"$in": doc_ids}})
    if doc_type:
        where_conditions.append({"doc_type": doc_type})

    if len(where_conditions) == 1:
        where_filter = where_conditions[0]
    else:
        where_filter = {"$and": where_conditions}

    results = await asyncio.to_thread(
        collection.query,
        query_embeddings=[query_embedding],
        n_results=min(top_k, 50),
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    search_results = []
    if results["ids"] and results["ids"][0]:
        for i, (doc_text, meta, distance) in enumerate(zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )):
            relevance = max(0.0, 1.0 - distance)
            search_results.append(SearchResult(
                doc_id=meta.get("doc_id", ""),
                doc_title=meta.get("title", "Unknown"),
                doc_type=meta.get("doc_type", "paper"),
                page=meta.get("page", 1),
                chunk_index=meta.get("chunk_index", 0),
                excerpt=doc_text[:400] + ("..." if len(doc_text) > 400 else ""),
                relevance_score=round(relevance, 4),
            ))

    return search_results


# ─── RAG Context Retrieval ────────────────────────────────────────────────────

async def retrieve_context(
    query: str,
    user_id: str,
    doc_ids: Optional[List[str]] = None,
    top_k: int = None,
) -> tuple[list, List[SourceCitation]]:
    """Retrieve top-k relevant chunks and format as (context_text, citations)."""
    top_k = top_k or settings.max_retrieval_docs
    results = await semantic_search(query, user_id, doc_ids, top_k)
    results = results[:top_k]

    context_parts = []
    citations = []
    for i, r in enumerate(results):
        context_parts.append(
            f"[SOURCE {i+1}] Document: '{r.doc_title}' | Page {r.page}\n{r.excerpt}"
        )
        citations.append(SourceCitation(
            doc_id=r.doc_id,
            doc_title=r.doc_title,
            page=r.page,
            chunk_index=r.chunk_index,
            excerpt=r.excerpt,
            relevance_score=r.relevance_score,
        ))

    return "\n\n---\n\n".join(context_parts), citations


# ─── Chat ─────────────────────────────────────────────────────────────────────

RAG_SYSTEM_PROMPT = """You are a Research Intelligence Assistant — an expert AI that helps researchers, students, and professionals analyze academic papers and patents.

RULES:
1. Answer ONLY based on the provided document context below. Do NOT use external knowledge.
2. If the context does not contain sufficient information, clearly say so.
3. Always cite your sources using [SOURCE N] notation in your answer.
4. Be precise, scholarly, and concise.
5. For technical questions, include relevant details, metrics, and methodology when available.
6. Structure longer answers with clear sections.

DOCUMENT CONTEXT:
{context}

---
Answer the user's question based strictly on the above context."""


async def chat_stream(
    user_message: str,
    session: ChatSession,
    existing_messages: List[ChatMessage],
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    """Stream a RAG chat response, save to DB, yield tokens."""
    # Retrieve context
    context_text, citations = await retrieve_context(
        user_message,
        session.user_id,
        session.doc_ids or [],
    )

    # Build conversation history
    history = []
    for msg in existing_messages[-8:]:  # last 4 turns
        role = "user" if msg.role == "user" else "model"
        history.append({"role": role, "parts": [msg.content]})

    # Build prompt
    system_prompt = RAG_SYSTEM_PROMPT.format(context=context_text or "No relevant documents found.")

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=user_message,
        sources=[],
    )
    db.add(user_msg)
    await db.commit()

    # Stream LLM response
    full_response = ""

    try:
        messages_payload = history + [{"role": "user", "content": user_message}]
        for token in stream_llm_response(messages_payload, system_prompt=system_prompt):
            full_response += token
            yield token

    except Exception as e:
        error_msg = f"I encountered an error generating a response: {str(e)}"
        full_response = error_msg
        yield error_msg

    # Save assistant message
    citations_dict = [c.model_dump() for c in citations]
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=full_response,
        sources=citations_dict,
    )
    db.add(assistant_msg)

    # Update session title if first message
    if len(existing_messages) == 0:
        session.title = user_message[:80] + ("..." if len(user_message) > 80 else "")

    await db.commit()

    # Yield citations as final JSON marker
    yield f"\n\n__SOURCES__{json.dumps(citations_dict)}"


# ─── Summarization ────────────────────────────────────────────────────────────

async def summarize_document(
    doc_id: str,
    user_id: str,
    detail_level: str = "concise",
    db: AsyncSession = None,
) -> str:
    """Generate a summary using map-reduce approach."""
    collection = await asyncio.to_thread(get_or_create_collection, user_id)

    # Get ALL chunks for this document
    results = await asyncio.to_thread(
        collection.get,
        where={"doc_id": doc_id},
        include=["documents", "metadatas"],
    )

    if not results["ids"]:
        return "No content found for this document."

    # Sort by page
    chunks_with_meta = sorted(
        zip(results["documents"], results["metadatas"]),
        key=lambda x: (x[1].get("page", 0), x[1].get("chunk_index", 0))
    )

    # Map step: summarize groups of chunks
    GROUP_SIZE = 10
    partial_summaries = []
    texts = [c[0] for c in chunks_with_meta]

    for i in range(0, len(texts), GROUP_SIZE):
        group = "\n\n".join(texts[i: i + GROUP_SIZE])
        map_prompt = f"""Summarize the following excerpt from a research paper or patent. 
Capture: key findings, methods, results. Be concise.

EXCERPT:
{group}

SUMMARY:"""
        try:
            res_text = await asyncio.to_thread(generate_llm_response, map_prompt)
            partial_summaries.append(res_text)
        except Exception:
            partial_summaries.append(group[:500])

    # Reduce step: combine partial summaries
    combined = "\n\n".join(partial_summaries)
    doc_title = chunks_with_meta[0][1].get("title", "this document") if chunks_with_meta else "this document"

    if detail_level == "concise":
        reduce_prompt = f"""Based on the following partial summaries of "{doc_title}", 
write a CONCISE summary (150-200 words) covering:
- Main research objective
- Key methodology  
- Principal findings
- Conclusion

PARTIAL SUMMARIES:
{combined[:8000]}

CONCISE SUMMARY:"""
    else:
        reduce_prompt = f"""Based on the following partial summaries of "{doc_title}", 
write a DETAILED comprehensive summary covering:
1. **Abstract/Overview**
2. **Research Objective & Motivation**
3. **Methodology & Approach**
4. **Experimental Setup & Datasets**
5. **Key Results & Metrics**
6. **Innovations & Contributions**
7. **Limitations**
8. **Conclusions & Future Work**

PARTIAL SUMMARIES:
{combined[:12000]}

DETAILED SUMMARY (use markdown headings):"""

    try:
        summary = await asyncio.to_thread(generate_llm_response, reduce_prompt)

        # Cache in DB
        if db:
            doc = await db.get(Document, doc_id)
            if doc:
                if detail_level == "concise":
                    doc.summary_concise = summary
                else:
                    doc.summary_detailed = summary
                await db.commit()

        return summary
    except Exception as e:
        return f"Error generating summary: {str(e)}"


# ─── Document Comparison ──────────────────────────────────────────────────────

async def compare_documents(
    doc_ids: List[str],
    user_id: str,
    aspects: Optional[List[str]] = None,
    db: AsyncSession = None,
) -> dict:
    """Compare multiple documents across specified aspects."""
    aspects = aspects or DEFAULT_COMPARISON_ASPECTS

    # Fetch document titles
    doc_titles = {}
    if db:
        for doc_id in doc_ids:
            doc = await db.get(Document, doc_id)
            if doc:
                doc_titles[doc_id] = doc.title or doc.filename

    comparison = {}
    for aspect in aspects:
        comparison[aspect] = {}
        for doc_id in doc_ids:
            results = await semantic_search(
                aspect,
                user_id,
                doc_ids=[doc_id],
                top_k=4,
            )
            context = "\n".join([r.excerpt for r in results])
            title = doc_titles.get(doc_id, doc_id[:8])

            prompt = f"""From the research document titled "{title}", extract information specifically about: **{aspect}**

RELEVANT PASSAGES:
{context or 'No relevant passages found.'}

Provide a focused 2-4 sentence answer about "{aspect}" for this document. If not found, say "Not explicitly discussed."

ANSWER:"""
            try:
                res_text = await asyncio.to_thread(generate_llm_response, prompt)
                comparison[aspect][doc_id] = {
                    "title": title,
                    "content": res_text.strip(),
                }
            except Exception as e:
                comparison[aspect][doc_id] = {
                    "title": title,
                    "content": f"Error: {str(e)}",
                }

    # Generate overall comparison summary
    doc_list = ", ".join([f'"{doc_titles.get(d, d[:8])}"' for d in doc_ids])
    summary_prompt = f"""You have compared {len(doc_ids)} documents: {doc_list}.

Based on the following aspect-by-aspect comparison, write a concise overall summary (300 words) that:
1. Highlights the KEY SIMILARITIES between the documents
2. Highlights the KEY DIFFERENCES
3. States which document appears most innovative/significant and why

COMPARISON DATA:
{json.dumps(comparison, indent=2)[:6000]}

OVERALL COMPARISON SUMMARY:"""

    try:
        summary = await asyncio.to_thread(generate_llm_response, summary_prompt)
    except Exception as e:
        summary = f"Summary generation failed: {str(e)}"

    return {
        "aspects": aspects,
        "doc_ids": doc_ids,
        "doc_titles": doc_titles,
        "comparison": comparison,
        "summary": summary,
    }


# ─── Report Generation ────────────────────────────────────────────────────────

REPORT_PROMPTS = {
    "summary": """Generate a comprehensive RESEARCH SUMMARY REPORT for the following documents.

Structure the report with:
# Research Summary Report
## Executive Summary
## Documents Analyzed
## Key Themes & Findings
## Methodologies Overview
## Important Results
## Conclusions
## Recommendations for Further Research

Documents: {doc_titles}
Context from documents:
{context}

Write a professional, scholarly report in Markdown format.""",

    "comparison": """Generate a detailed COMPARATIVE ANALYSIS REPORT.

Structure:
# Comparative Analysis Report
## Overview
## Documents Compared
## Methodology Comparison
## Results Comparison
## Innovation Assessment
## Key Differences & Similarities
## Overall Assessment

Documents: {doc_titles}
Context:
{context}

Write in professional Markdown format.""",

    "research": """Generate a comprehensive RESEARCH INSIGHTS REPORT.

Structure:
# Research Insights Report
## Research Landscape Overview
## Key Research Questions Addressed
## Methodological Approaches
## Datasets & Experimental Evidence
## Critical Findings
## Gaps & Open Problems
## Future Research Directions
## References Summary

Documents: {doc_titles}
Context:
{context}

Write in professional Markdown with citations.""",

    "insights": """Generate a STRATEGIC INSIGHTS REPORT for decision-makers.

Structure:
# Strategic Research Insights Report
## Executive Brief
## Core Innovations Identified
## Technical Readiness Assessment
## Competitive Landscape
## Key Takeaways
## Actionable Recommendations

Documents: {doc_titles}
Context:
{context}

Write in professional Markdown, prioritize clarity and actionable insights.""",
}


async def generate_report(
    report_id: str,
    doc_ids: List[str],
    report_type: str,
    user_id: str,
    custom_instructions: Optional[str] = None,
    db: AsyncSession = None,
) -> str:
    """Generate a structured research report."""
    from app.db.models import Report

    doc_titles = {}
    if db:
        for doc_id in doc_ids:
            doc = await db.get(Document, doc_id)
            if doc:
                doc_titles[doc_id] = doc.title or doc.filename

    # Gather context from all docs
    all_contexts = []
    for doc_id in doc_ids:
        results = await semantic_search(
            "main findings methodology results contribution",
            user_id,
            doc_ids=[doc_id],
            top_k=6,
        )
        title = doc_titles.get(doc_id, doc_id[:8])
        if results:
            excerpts = "\n".join([r.excerpt for r in results])
            all_contexts.append(f"### {title}\n{excerpts}")

    context = "\n\n---\n\n".join(all_contexts)
    doc_titles_str = ", ".join([f'"{t}"' for t in doc_titles.values()])

    prompt_template = REPORT_PROMPTS.get(report_type, REPORT_PROMPTS["research"])
    prompt = prompt_template.format(doc_titles=doc_titles_str, context=context[:15000])

    if custom_instructions:
        prompt += f"\n\nAdditional Instructions: {custom_instructions}"

    try:
        content = await asyncio.to_thread(generate_llm_response, prompt)

        # Save to DB and file
        if db:
            report = await db.get(Report, report_id)
            if report:
                report.content = content
                report.status = "ready"

                # Save as markdown file
                import os
                os.makedirs(settings.reports_dir, exist_ok=True)
                file_path = f"{settings.reports_dir}/{report_id}.md"
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                report.file_path = file_path
                await db.commit()

        return content
    except Exception as e:
        if db:
            report = await db.get(Report, report_id)
            if report:
                report.status = "error"
                report.content = f"Error: {str(e)}"
                await db.commit()
        raise
