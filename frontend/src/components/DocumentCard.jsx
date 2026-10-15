import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Trash2, Loader, CheckCircle, AlertCircle, BookOpen, Cpu } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { documentsApi } from '../services/api'
import './DocumentCard.css'

const STATUS_CONFIG = {
  ready: { icon: CheckCircle, label: 'Ready', cls: 'badge-ready' },
  processing: { icon: Loader, label: 'Processing', cls: 'badge-processing' },
  error: { icon: AlertCircle, label: 'Error', cls: 'badge-error' },
}

const TYPE_CONFIG = {
  paper: { icon: BookOpen, label: 'Paper', cls: 'badge-primary' },
  patent: { icon: Cpu, label: 'Patent', cls: 'badge-accent' },
  other: { icon: FileText, label: 'Other', cls: 'badge-ready' },
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export default function DocumentCard({ doc, onDeleted, selectable, selected, onSelect }) {
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing
  const type = TYPE_CONFIG[doc.doc_type] || TYPE_CONFIG.other
  const StatusIcon = status.icon
  const TypeIcon = type.icon

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await documentsApi.delete(doc.id)
      toast.success('Document deleted')
      if (onDeleted) onDeleted(doc.id)
    } catch {
      toast.error('Failed to delete document')
      setDeleting(false)
    }
  }

  const handleClick = () => {
    if (selectable) {
      onSelect?.(doc.id)
    } else {
      navigate(`/document/${doc.id}`)
    }
  }

  return (
    <motion.div
      className={`doc-card ${selected ? 'selected' : ''} ${selectable ? 'selectable' : ''}`}
      onClick={handleClick}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      layout
    >
      {/* Selection Indicator */}
      {selectable && (
        <div className={`doc-card-checkbox ${selected ? 'checked' : ''}`}>
          {selected && <CheckCircle size={14} />}
        </div>
      )}

      {/* Header */}
      <div className="doc-card-header">
        <div className="doc-card-icon">
          <FileText size={22} />
        </div>
        <div className="flex gap-2 items-center">
          <span className={`badge ${type.cls}`}>
            <TypeIcon size={10} />
            {type.label}
          </span>
          <span className={`badge ${status.cls}`}>
            <StatusIcon size={10} className={doc.status === 'processing' ? 'spinner' : ''} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="doc-card-title">{doc.title || doc.filename}</div>
      <div className="doc-card-filename text-xs text-muted truncate">{doc.filename}</div>

      {/* Metadata */}
      <div className="doc-card-meta">
        <span>{doc.page_count > 0 ? `${doc.page_count} pages` : '—'}</span>
        <span>{doc.chunk_count > 0 ? `${doc.chunk_count} chunks` : '—'}</span>
        <span>{formatSize(doc.file_size)}</span>
      </div>

      {/* Error */}
      {doc.status === 'error' && doc.error_message && (
        <div className="doc-card-error">{doc.error_message.slice(0, 80)}</div>
      )}

      {/* Footer */}
      <div className="doc-card-footer">
        <span className="doc-card-date text-xs text-muted">{formatDate(doc.upload_date)}</span>
        {!selectable && (
          <button
            className="btn btn-icon btn-ghost btn-sm doc-card-delete"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete document"
          >
            {deleting ? <Loader size={14} className="spinner" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>

      {/* Processing shimmer overlay */}
      {doc.status === 'processing' && <div className="doc-card-processing-bar" />}
    </motion.div>
  )
}
