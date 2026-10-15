import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical, Mail, Lock, User, ArrowRight, Loader, Eye, EyeOff } from 'lucide-react'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import './AuthPage.css'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // login | register
  const [form, setForm] = useState({ email: '', password: '', fullName: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    let result
    if (mode === 'login') {
      result = await login(form.email, form.password)
    } else {
      if (!form.fullName.trim()) {
        toast.error('Full name is required')
        setLoading(false)
        return
      }
      result = await register(form.email, form.password, form.fullName)
    }
    setLoading(false)
    if (result.success) {
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
      navigate('/dashboard')
    } else {
      toast.error(result.error)
    }
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  return (
    <div className="auth-page">
      {/* Background blobs */}
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <FlaskConical size={28} />
          </div>
          <div>
            <h1 className="auth-logo-title gradient-text">ResearchAI</h1>
            <p className="auth-logo-subtitle">Research Intelligence Platform</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="auth-toggle">
          <button
            className={`auth-toggle-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button
            className={`auth-toggle-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            onSubmit={handleSubmit}
            className="auth-form"
            initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {mode === 'register' && (
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input
                    className="input auth-input"
                    type="text"
                    name="fullName"
                    placeholder="Dr. Jane Smith"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  className="input auth-input"
                  type="email"
                  name="email"
                  placeholder="researcher@university.edu"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  className="input auth-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full auth-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader size={16} className="spinner" />
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </motion.form>
        </AnimatePresence>

        {/* Features callout */}
        <div className="auth-features">
          {['Upload & Analyze PDFs', 'AI-Powered Chat', 'Semantic Search', 'Compare Documents'].map((f) => (
            <span key={f} className="auth-feature-chip">{f}</span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
