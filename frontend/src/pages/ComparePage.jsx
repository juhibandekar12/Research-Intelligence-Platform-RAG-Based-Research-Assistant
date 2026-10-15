import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitCompare, Loader, CheckCircle, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { compareApi, documentsApi } from '../services/api'
import DocumentCard from '../components/DocumentCard'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import './ComparePage.css'

const DEFAULT_ASPECTS = [
  'Research Objective & Problem Statement',
  'Methodology & Approach',
  'Datasets & Experimental Setup',
  'Key Results & Metrics',
  'Innovations & Contributions',
  'Limitations',
  'Conclusions',
]

export default function ComparePage() {
  const [selectedDocs, setSelectedDocs] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const { data: docs = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  })

  const readyDocs = docs.filter((d) => d.status === 'ready')

  const toggleDoc = (id) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : prev.length < 5 ? [...prev, id] : prev
    )
  }

  const handleCompare = async () => {
    if (selectedDocs.length < 2) {
      toast.error('Select at least 2 documents to compare')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const { data } = await compareApi.compare({ doc_ids: selectedDocs })
      setResult(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const selectedDocObjects = readyDocs.filter((d) => selectedDocs.includes(d.id))

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1>Document Comparison</h1>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Select 2–5 documents for AI-powered side-by-side analysis
          </p>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleCompare}
          disabled={selectedDocs.length < 2 || loading}
        >
          {loading ? (
            <><Loader size={16} className="spinner" /> Analyzing…</>
          ) : (
            <><GitCompare size={16} /> Compare {selectedDocs.length > 0 ? `(${selectedDocs.length})` : ''}</>
          )}
        </button>
      </div>

      {/* Selection */}
      <div className="compare-section">
        <h2 className="section-title" style={{ marginBottom: 16 }}>
          Select Documents
          <span className="compare-selection-count">
            {selectedDocs.length}/5 selected
          </span>
        </h2>

        {readyDocs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><GitCompare size={28} /></div>
            <h3>No ready documents</h3>
            <p>Upload and process documents first</p>
          </div>
        ) : (
          <div className="compare-doc-grid">
            {readyDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                selectable
                selected={selectedDocs.includes(doc.id)}
                onSelect={toggleDoc}
              />
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="compare-loading">
          <div className="compare-loading-icon">
            <Loader size={32} className="spinner" />
          </div>
          <h3>Analyzing Documents…</h3>
          <p>This may take a minute for large documents</p>
          <div className="compare-loading-aspects">
            {DEFAULT_ASPECTS.map((a, i) => (
              <motion.div
                key={a}
                className="compare-loading-aspect"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.3 }}
              >
                <Loader size={12} className="spinner" />
                {a}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            className="compare-results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Summary */}
            <div className="compare-summary-card">
              <h2 className="section-title">Overall Comparison Summary</h2>
              <div className="prose compare-summary-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
              </div>
            </div>

            {/* Aspect Table */}
            <h2 className="section-title" style={{ marginTop: 32, marginBottom: 16 }}>
              Aspect-by-Aspect Analysis
            </h2>
            <div className="compare-table-wrapper">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th className="compare-table-aspect-col">Aspect</th>
                    {selectedDocObjects.map((doc) => (
                      <th key={doc.id}>{doc.title || doc.filename}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.aspects.map((aspect) => (
                    <tr key={aspect}>
                      <td className="compare-table-aspect">{aspect}</td>
                      {selectedDocs.map((docId) => (
                        <td key={docId} className="compare-table-cell">
                          {result.comparison[aspect]?.[docId]?.content || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
