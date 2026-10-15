import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ArrowLeft, BookOpen, Cpu, Hash, Calendar,
  Layers, RefreshCw, Loader, ChevronDown, ChevronUp,
  MessageSquare, Search, Sparkles
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { documentsApi, summarizeApi, chatApi } from '../services/api'
import toast from 'react-hot-toast'
import './DocumentDetail.css'

function formatSize(bytes) {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [summarizing, setSummarizing] = useState(null)
  const [summaryType, setSummaryType] = useState('concise')
  const [summary, setSummary] = useState(null)
  const [showSummary, setShowSummary] = useState(false)

  const { data: doc, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id).then((r) => r.data),
    refetchInterval: (data) => data?.status === 'processing' ? 3000 : false,
  })

  const handleSummarize = async (level) => {
    setSummarizing(level)
    setSummaryType(level)
    setShowSummary(true)
    try {
      const { data } = await summarizeApi.summarize(id, level)
      setSummary(data.summary)
      queryClient.invalidateQueries(['document', id])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Summarization failed')
    } finally {
      setSummarizing(null)
    }
  }

  const handleChatWithDoc = async () => {
    try {
      const { data } = await chatApi.createSession({
        title: `Chat: ${doc?.title || doc?.filename}`,
        mode: 'single',
        doc_ids: [id],
      })
      navigate(`/chat?session=${data.id}`)
    } catch {
      navigate('/chat')
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="doc-detail-skeleton">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: i === 0 ? 60 : 40 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Document not found</h3>
          <button className="btn btn-ghost" onClick={() => navigate('/library')}>
            ← Back to Library
          </button>
        </div>
      </div>
    )
  }

  const displaySummary = summary ||
    (summaryType === 'concise' ? doc.summary_concise : null)

  return (
    <div className="page-container">
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/library')} style={{ marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Library
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Hero Header */}
        <div className="doc-detail-hero">
          <div className="doc-detail-hero-icon">
            <FileText size={32} />
          </div>
          <div className="doc-detail-hero-info">
            <h1 className="doc-detail-title">{doc.title || doc.filename}</h1>
            <p className="doc-detail-filename text-sm text-muted">{doc.filename}</p>
            <div className="doc-detail-badges">
              <span className={`badge badge-${doc.doc_type === 'patent' ? 'accent' : 'primary'}`}>
                {doc.doc_type === 'patent' ? <Cpu size={10} /> : <BookOpen size={10} />}
                {doc.doc_type}
              </span>
              <span className={`badge badge-${doc.status === 'ready' ? 'ready' : doc.status === 'error' ? 'error' : 'processing'}`}>
                {doc.status}
              </span>
            </div>
          </div>
          <div className="doc-detail-actions">
            {doc.status === 'ready' && (
              <>
                <button className="btn btn-primary" onClick={handleChatWithDoc}>
                  <MessageSquare size={16} /> Chat with Doc
                </button>
                <button className="btn btn-ghost" onClick={() => navigate('/search')}>
                  <Search size={16} /> Search
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="doc-detail-stats">
          {[
            { icon: Layers, label: 'Pages', value: doc.page_count || '—' },
            { icon: Hash, label: 'Chunks', value: doc.chunk_count || '—' },
            { icon: FileText, label: 'Size', value: formatSize(doc.file_size) },
            {
              icon: Calendar, label: 'Uploaded',
              value: new Date(doc.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="doc-stat-chip">
              <Icon size={13} className="text-primary-color" />
              <span className="text-xs text-muted">{label}:</span>
              <span className="text-sm font-semibold">{value}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {doc.status === 'error' && (
          <div className="doc-detail-error">
            <p className="font-semibold text-red">Processing Error</p>
            <p className="text-sm">{doc.error_message}</p>
          </div>
        )}

        {/* Summarization Section */}
        {doc.status === 'ready' && (
          <div className="doc-detail-section">
            <div className="doc-detail-section-header">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary-color" />
                <h2 className="section-title">AI Summary</h2>
              </div>
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${summaryType === 'concise' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleSummarize('concise')}
                  disabled={!!summarizing}
                >
                  {summarizing === 'concise' ? <Loader size={13} className="spinner" /> : null}
                  Concise
                </button>
                <button
                  className={`btn btn-sm ${summaryType === 'detailed' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleSummarize('detailed')}
                  disabled={!!summarizing}
                >
                  {summarizing === 'detailed' ? <Loader size={13} className="spinner" /> : null}
                  Detailed
                </button>
              </div>
            </div>

            {/* Cached Concise Summary Preview */}
            {doc.summary_concise && !showSummary && (
              <div className="doc-summary-preview">
                <p className="text-sm text-muted">{doc.summary_concise.slice(0, 200)}…</p>
                <button className="btn btn-ghost btn-sm" onClick={() => { setSummary(doc.summary_concise); setShowSummary(true) }}>
                  Show full summary
                </button>
              </div>
            )}

            <AnimatePresence>
              {showSummary && (
                <motion.div
                  className="doc-summary-box"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {summarizing ? (
                    <div className="doc-summary-loading">
                      <Loader size={20} className="spinner text-primary-color" />
                      <p className="text-sm text-muted">Generating {summaryType} summary…</p>
                    </div>
                  ) : displaySummary ? (
                    <div className="prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displaySummary}</ReactMarkdown>
                    </div>
                  ) : null}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowSummary(false)}
                    style={{ marginTop: 12 }}
                  >
                    <ChevronUp size={14} /> Collapse
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Metadata */}
        {doc.doc_metadata && Object.keys(doc.doc_metadata).length > 0 && (
          <div className="doc-detail-section">
            <h2 className="section-title">Metadata</h2>
            <div className="doc-metadata-table">
              {Object.entries(doc.doc_metadata).map(([k, v]) => (
                <div key={k} className="doc-metadata-row">
                  <span className="doc-metadata-key">{k}</span>
                  <span className="doc-metadata-val">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
