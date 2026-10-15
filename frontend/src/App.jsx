import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import Sidebar from './components/Sidebar'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import ChatPage from './pages/ChatPage'
import SearchPage from './pages/SearchPage'
import ComparePage from './pages/ComparePage'
import ReportsPage from './pages/ReportsPage'
import DocumentDetail from './pages/DocumentDetail'

function ProtectedLayout({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={
          <PublicRoute><AuthPage /></PublicRoute>
        } />

        {/* Protected */}
        <Route path="/dashboard" element={
          <ProtectedLayout><Dashboard /></ProtectedLayout>
        } />
        <Route path="/library" element={
          <ProtectedLayout><Library /></ProtectedLayout>
        } />
        <Route path="/chat" element={
          <ProtectedLayout><ChatPage /></ProtectedLayout>
        } />
        <Route path="/search" element={
          <ProtectedLayout><SearchPage /></ProtectedLayout>
        } />
        <Route path="/compare" element={
          <ProtectedLayout><ComparePage /></ProtectedLayout>
        } />
        <Route path="/reports" element={
          <ProtectedLayout><ReportsPage /></ProtectedLayout>
        } />
        <Route path="/document/:id" element={
          <ProtectedLayout><DocumentDetail /></ProtectedLayout>
        } />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
