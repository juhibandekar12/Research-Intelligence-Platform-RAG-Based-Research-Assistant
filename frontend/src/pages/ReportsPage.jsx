import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Download, Loader, Trash2, CheckCircle,
  AlertCircle, RefreshCw, Clock, BookOpen
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { reportsApi, documentsApi } from '../services/api'
import toast from 'react-hot-toast'
import './ReportsPage.css'

const REPORT_TYPES = [
  { value: 'summary', label: 'Summary Report', desc: 'Comprehensive summary of selected documents' },
  { value: 'comparison', label: 'Comparison Report', desc: 'Side-by-side comparative analysis' },
  { value: 'research', label: 'Research Insights', desc: 'Deep research landscape analysis' },
  { value: 'insights', label: 'Strategic Insights', desc: 'Actionable insights for decision makers' },
]

export default function ReportsPage() {
  const [showBuilder, setShowBuilder] = useState(false)
  const [form, setForm] = useState({ title: '', report_type: 'research', doc_ids: [], custom_instructions: '' })
  const [generating, setGenerating] = useState(false)
  const [viewReport, setViewReport] = useState(null)
  const queryClient = useQueryClient()

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.list().then((r) => r.data),
    refetchInterval: 8000,
  })

  const { data: docs = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  })

  const readyDocs = docs.filter((d) => d.status === 'ready')

  const toggleDoc = (id) => {
    setForm((prev) => ({
      ...prev,
      doc_ids: prev.doc_ids.includes(id) ? prev.doc_ids.filter((d) => d !== id) : [...prev.doc_ids, id],
    }))
  }

  const handleGenerate = async () => {
    if (!form.title.trim()) { toast.error('Report title is required'); return }
    if (form.doc_ids.length === 0) { toast.error('Select at least one document'); return }
    setGenerating(true)
    try {
      await reportsApi.create(form)
      queryClient.invalidateQueries(['reports'])
      setShowBuilder(false)
      setForm({ title: '', report_type: 'research', doc_ids: [], custom_instructions: '' })
      toast.success('Report generation started!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start report generation')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this report?')) return
    try {
      await reportsApi.delete(id)
      queryClient.invalidateQueries(['reports'])
      if (viewReport?.id === id) setViewReport(null)
      toast.success('Report deleted')
    } catch { toast.error('Delete failed') }
  }

  const handleView = async (report) => {
    if (report.status !== 'ready') return
    const { data } = await reportsApi.get(report.id)
    setViewReport(data)
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1>Research Reports</h1>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Generate structured research reports from your documents
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => queryClient.invalidateQueries(['reports'])}>
            <RefreshCw size={16} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowBuilder(!showBuilder)}>
            <Plus size={16} /> Generate Report
          </button>
        </div>
      </div>

      {/* Report Builder */}
      <AnimatePresence>
        {showBuilder && (
          <motion.div
            className="report-builder"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h2 className="section-title" style={{ marginBottom: 20 }}>Configure Report</h2>

            <div className="report-builder-grid">
              <div className="flex-col gap-4">
                {/* Title */}
                <div className="input-group">
                  <label className="input-label">Report Title</label>
                  <input
                    className="input"
                    placeholder="e.g., Q3 2024 Research Survey"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                {/* Report Type */}
                <div className="input-group">
                  <label className="input-label">Report Type</label>
                  <div className="report-type-grid">
                    {REPORT_TYPES.map((t) => (
                      <button
                        key={t.value}
                        className={`report-type-card ${form.report_type === t.value ? 'active' : ''}`}
                        onClick={() => setForm({ ...form, report_type: t.value })}
                      >
                        <span className="report-type-label">{t.label}</span>
                        <span className="report-type-desc">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div className="input-group">
                  <label className="input-label">Custom Instructions (optional)</label>
                  <textarea
                    className="input"
                    placeholder="Focus on machine learning methodologies…"
                    value={form.custom_instructions}
                    onChange={(e) => setForm({ ...form, custom_instructions: e.target.value })}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Doc Selector */}
              <div className="input-group">
                <label className="input-label">
                  Documents ({form.doc_ids.length} selected)
                </label>
                <div className="report-doc-list">
                  {readyDocs.length === 0 ? (
                    <p className="text-sm text-muted" style={{ padding: 12 }}>No ready documents</p>
                  ) : (
                    readyDocs.map((doc) => (
                      <label key={doc.id} className="report-doc-option">
                        <input
                          type="checkbox"
                          checked={form.doc_ids.includes(doc.id)}
                          onChange={() => toggleDoc(doc.id)}
                        />
                        <BookOpen size={13} className="text-primary-color" />
                        <span className="truncate text-sm">{doc.title || doc.filename}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <><Loader size={16} className="spinner" /> Generating…</> : <><FileText size={16} /> Generate Report</>}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowBuilder(false)}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="reports-layout">
        {/* Report List */}
        <div className="reports-list-col">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 100 }} />
            ))
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FileText size={28} /></div>
              <h3>No reports yet</h3>
              <p>Generate your first research report</p>
            </div>
          ) : (
            reports.map((report) => (
              <motion.div
                key={report.id}
                className={`report-card ${viewReport?.id === report.id ? 'active' : ''}`}
                onClick={() => handleView(report)}
                whileHover={{ x: 3 }}
              >
                <div className="flex items-center justify-between">
                  <span className={`badge badge-${
                    report.status === 'ready' ? 'ready' : report.status === 'error' ? 'error' : 'processing'
                  }`}>
                    {report.status === 'ready' ? <CheckCircle size={10} /> :
                     report.status === 'error' ? <AlertCircle size={10} /> :
                     <Loader size={10} className="spinner" />}
                    {report.status}
                  </span>
                  <button
                    className="btn btn-icon btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(report.id) }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="report-card-title">{report.title}</div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{report.report_type}</span>
                  <span className="text-xs text-muted">{report.doc_ids.length} doc{report.doc_ids.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Clock size={11} />
                  {new Date(report.created_at).toLocaleDateString()}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Report Viewer */}
        <div className="report-viewer-col">
          {viewReport ? (
            <div className="report-viewer">
              <div className="report-viewer-header">
                <h2 className="section-title">{viewReport.title}</h2>
                <a
                  href={reportsApi.downloadUrl(viewReport.id)}
                  download
                  className="btn btn-accent btn-sm"
                >
                  <Download size={14} /> Download .md
                </a>
              </div>
              <div className="report-viewer-body prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {viewReport.content || ''}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ height: '400px' }}>
              <div className="empty-state-icon"><FileText size={28} /></div>
              <p>Select a report to view its content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
