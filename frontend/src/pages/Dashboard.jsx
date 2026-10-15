import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Library, MessageSquare, Search, GitCompare, FileText,
  Upload, TrendingUp, BookOpen, Cpu, Clock, Sparkles
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import { documentsApi } from '../services/api'
import './Dashboard.css'

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }

const QUICK_ACTIONS = [
  { icon: Upload, label: 'Upload Papers', desc: 'Add PDFs to your library', to: '/library', color: 'primary' },
  { icon: MessageSquare, label: 'AI Chat', desc: 'Converse with documents', to: '/chat', color: 'accent' },
  { icon: Search, label: 'Semantic Search', desc: 'Find relevant passages', to: '/search', color: 'emerald' },
  { icon: GitCompare, label: 'Compare Docs', desc: 'Side-by-side analysis', to: '/compare', color: 'amber' },
  { icon: FileText, label: 'Reports', desc: 'Generate insights', to: '/reports', color: 'red' },
]

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['doc-stats'],
    queryFn: () => documentsApi.stats().then((r) => r.data),
    refetchInterval: 10000,
  })

  const { data: docs } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
    refetchInterval: 10000,
  })

  const recentDocs = docs?.slice(0, 5) || []

  return (
    <div className="page-container">
      {/* Hero Greeting */}
      <motion.div
        className="dashboard-hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="dashboard-hero-text">
          <h1>
            Welcome back, <span className="gradient-text">{user?.full_name?.split(' ')[0]}</span>
          </h1>
          <p>Your AI research assistant is ready. What would you like to explore today?</p>
        </div>
        <div className="dashboard-hero-badge">
          <Sparkles size={14} />
          <span>Powered by Gemini AI</span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="dashboard-stats"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: 'Total Documents', value: isLoading ? '—' : stats?.total_documents ?? 0, icon: Library, color: 'primary' },
          { label: 'Ready to Query', value: isLoading ? '—' : stats?.ready_documents ?? 0, icon: BookOpen, color: 'emerald' },
          { label: 'Total Pages', value: isLoading ? '—' : (stats?.total_pages ?? 0).toLocaleString(), icon: TrendingUp, color: 'accent' },
          { label: 'Text Chunks', value: isLoading ? '—' : (stats?.total_chunks ?? 0).toLocaleString(), icon: Cpu, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} className={`stat-card stat-card-${color}`} variants={item}>
            <div className={`stat-icon stat-icon-${color}`}>
              <Icon size={20} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="dashboard-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="section-header">
          <h2 className="section-title">Quick Actions</h2>
        </div>
        <div className="quick-actions-grid">
          {QUICK_ACTIONS.map(({ icon: Icon, label, desc, to, color }) => (
            <motion.button
              key={to}
              className={`quick-action-card quick-action-${color}`}
              onClick={() => navigate(to)}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={`quick-action-icon qa-icon-${color}`}>
                <Icon size={22} />
              </div>
              <div className="quick-action-label">{label}</div>
              <div className="quick-action-desc">{desc}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Recent Documents */}
      <motion.div
        className="dashboard-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="section-header">
          <h2 className="section-title">Recent Documents</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/library')}>
            View all →
          </button>
        </div>

        {recentDocs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Library size={28} /></div>
            <h3>No documents yet</h3>
            <p>Upload your first research paper to get started</p>
            <button className="btn btn-primary" onClick={() => navigate('/library')}>
              <Upload size={16} /> Upload Papers
            </button>
          </div>
        ) : (
          <div className="recent-docs-list">
            {recentDocs.map((doc) => (
              <motion.div
                key={doc.id}
                className="recent-doc-item"
                whileHover={{ x: 4 }}
                onClick={() => navigate(`/document/${doc.id}`)}
              >
                <div className="recent-doc-icon">
                  <FileText size={16} />
                </div>
                <div className="recent-doc-info">
                  <div className="recent-doc-title">{doc.title || doc.filename}</div>
                  <div className="recent-doc-meta text-xs text-muted">
                    {doc.page_count > 0 ? `${doc.page_count} pages` : 'Processing…'} •{' '}
                    {new Date(doc.upload_date).toLocaleDateString()}
                  </div>
                </div>
                <span className={`badge badge-${doc.status === 'ready' ? 'ready' : doc.status === 'error' ? 'error' : 'processing'}`}>
                  {doc.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
