import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Library, MessageSquare, Search,
  GitCompare, FileText, LogOut, ChevronLeft, ChevronRight,
  Sparkles, FlaskConical
} from 'lucide-react'
import { useState } from 'react'
import useAuthStore from '../store/authStore'
import './Sidebar.css'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/compare', icon: GitCompare, label: 'Compare' },
  { to: '/reports', icon: FileText, label: 'Reports' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <motion.aside
      className="sidebar"
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <FlaskConical size={20} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className="sidebar-logo-text"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <span className="gradient-text">ResearchAI</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav Links */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="sidebar-link-icon" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        {!collapsed && user && (
          <motion.div
            className="sidebar-user"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="sidebar-user-avatar">
              {user.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.full_name}</div>
              <div className="sidebar-user-email">{user.email}</div>
            </div>
          </motion.div>
        )}
        <button
          className="sidebar-logout"
          onClick={handleLogout}
          title="Log out"
        >
          <LogOut size={16} />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </motion.aside>
  )
}
