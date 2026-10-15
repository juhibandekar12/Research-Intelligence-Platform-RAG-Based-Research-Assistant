import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FileText, Loader, Filter, X, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchApi, documentsApi } from '../services/api'
import toast from 'react-hot-toast'
import './SearchPage.css'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [topK, setTopK] = useState(10)
  const [docType, setDocType] = useState('')
  const navigate = useNavigate()

  const { data: docs = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  })

  const readyDocs = docs.filter((d) => d.status === 'ready')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const { data } = await searchApi.semantic({
        query: query.trim(),
        top_k: topK,
        doc_type: docType || undefined,
      })
      setResults(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1>Semantic Search</h1>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Search across {readyDocs.length} indexed document{readyDocs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            className="input search-input"
            placeholder="What are the key findings on transformer attention mechanisms?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => { setQuery(''); setResults(null) }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="search-options">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Type:</label>
            <select
              className="input"
              style={{ width: 'auto', padding: '8px 12px' }}
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="">All</option>
              <option value="paper">Papers</option>
              <option value="patent">Patents</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Results:</label>
            <select
              className="input"
              style={{ width: 'auto', padding: '8px 12px' }}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
            {loading ? <Loader size={16} className="spinner" /> : <Search size={16} />}
            Search
          </button>
        </div>

        {/* Suggested Queries */}
        {!results && (
          <div className="search-suggestions">
            <span className="text-xs text-muted">Try:</span>
            {[
              'deep learning image classification',
              'drug discovery methodology',
              'neural network architecture',
              'experimental results accuracy',
            ].map((s) => (
              <button
                key={s}
                type="button"
                className="search-suggestion-chip"
                onClick={() => setQuery(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Results */}
      <AnimatePresence>
        {results !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="section-header" style={{ marginTop: 32 }}>
              <h2 className="section-title">
                {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
              </h2>
            </div>

            {results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Search size={28} /></div>
                <h3>No results found</h3>
                <p>Try rephrasing your query or uploading more documents</p>
              </div>
            ) : (
              <div className="search-results">
                {results.map((result, i) => (
                  <motion.div
                    key={i}
                    className="search-result-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="search-result-header">
                      <div className="flex items-center gap-2">
                        <div className="search-result-num">{i + 1}</div>
                        <div>
                          <button
                            className="search-result-title"
                            onClick={() => navigate(`/document/${result.doc_id}`)}
                          >
                            {result.doc_title}
                            <ExternalLink size={12} />
                          </button>
                          <div className="flex gap-2 items-center" style={{ marginTop: 2 }}>
                            <span className={`badge badge-${result.doc_type === 'patent' ? 'accent' : 'primary'}`}>
                              {result.doc_type}
                            </span>
                            <span className="text-xs text-muted">Page {result.page}</span>
                          </div>
                        </div>
                      </div>
                      <div className="search-result-score">
                        <div
                          className="search-score-bar"
                          style={{ '--score': `${Math.round(result.relevance_score * 100)}%` }}
                        />
                        <span className="text-xs font-semibold">
                          {Math.round(result.relevance_score * 100)}%
                        </span>
                      </div>
                    </div>
                    <p className="search-result-excerpt">{result.excerpt}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
