import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('rag-auth')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── API Methods ──────────────────────────────────────────────────

// Documents
export const documentsApi = {
  upload: (formData, onProgress) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
      timeout: 120000,
    }),
  list: () => api.get('/documents/'),
  get: (id) => api.get(`/documents/${id}`),
  update: (id, data) => api.patch(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  stats: () => api.get('/documents/stats'),
}

// Chat
export const chatApi = {
  createSession: (data) => api.post('/chat/sessions', data),
  listSessions: () => api.get('/chat/sessions'),
  getMessages: (sessionId) => api.get(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId) => api.delete(`/chat/sessions/${sessionId}`),
}

// Search
export const searchApi = {
  semantic: (data) => api.post('/search/semantic', data),
}

// Summarize
export const summarizeApi = {
  summarize: (docId, detailLevel = 'concise') =>
    api.post(`/summarize/${docId}`, { detail_level: detailLevel }),
}

// Compare
export const compareApi = {
  compare: (data) => api.post('/compare/', data),
}

// Reports
export const reportsApi = {
  create: (data) => api.post('/reports/', data),
  list: () => api.get('/reports/'),
  get: (id) => api.get(`/reports/${id}`),
  delete: (id) => api.delete(`/reports/${id}`),
  downloadUrl: (id) => `/api/reports/${id}/download`,
}

// Auth
export const authApi = {
  me: () => api.get('/auth/me'),
}

export default api
