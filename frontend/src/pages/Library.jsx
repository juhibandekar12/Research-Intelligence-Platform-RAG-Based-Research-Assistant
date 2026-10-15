import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, Library as LibraryIcon, Search, Filter, RefreshCw, Loader } from 'lucide-react'
import DocumentCard from '../components/DocumentCard'
import UploadZone from '../components/UploadZone'
import { documentsApi } from '../services/api'
import './Library.css'

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }

export default function Library() {
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | paper | patent | processing | ready | error
  const queryClient = useQueryClient()

  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
    refetchInterval: 5000,
  })

  const filtered = docs.filter((doc) => {
    const matchSearch = !search || 
      doc.title?.toLowerCase().includes(search.toLowerCase()) ||
      doc.filename.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || doc.doc_type === filter || doc.status === filter
    return matchSearch && matchFilter
  })

  const handleUploadComplete = () => {
    setTimeout(() => queryClient.invalidateQueries(['documents']), 1000)
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1>Document Library</h1>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            {docs.length} document{docs.length !== 1 ? 's' : ''} • {docs.filter(d => d.status === 'ready').length} ready
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => refetch()} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Upload size={16} />
            {showUpload ? 'Hide Uploader' : 'Upload Papers'}
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      {showUpload && (
        <motion.div
          className="library-upload-section"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <UploadZone onUploadComplete={handleUploadComplete} />
        </motion.div>
      )}

      {/* Filters */}
      <div className="library-filters">
        <div className="library-search-wrap">
          <Search size={15} className="library-search-icon" />
          <input
            className="input library-search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="library-filter-tabs">
          {['all', 'paper', 'patent', 'ready', 'processing', 'error'].map((f) => (
            <button
              key={f}
              className={`library-filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="library-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 200 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><LibraryIcon size={28} /></div>
          <h3>{docs.length === 0 ? 'No documents yet' : 'No matching documents'}</h3>
          <p>{docs.length === 0
            ? 'Upload your first research paper or patent to get started'
            : 'Try adjusting your search or filter'
          }</p>
          {docs.length === 0 && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Upload size={16} /> Upload Now
            </button>
          )}
        </div>
      ) : (
        <motion.div
          className="library-grid"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {filtered.map((doc) => (
            <motion.div key={doc.id} variants={item}>
              <DocumentCard
                doc={doc}
                onDeleted={() => queryClient.invalidateQueries(['documents'])}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
