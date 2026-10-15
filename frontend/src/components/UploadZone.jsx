import { useCallback, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentsApi } from '../services/api'
import './UploadZone.css'

export default function UploadZone({ onUploadComplete }) {
  const [files, setFiles] = useState([])
  // Use ref to hold uploadFile so onDrop closure always has latest version
  const uploadFileRef = useRef(null)

  const updateFile = useCallback((id, updates) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }, [])

  const uploadFile = useCallback(async (fileEntry) => {
    updateFile(fileEntry.id, { status: 'uploading', progress: 0 })
    const formData = new FormData()
    formData.append('file', fileEntry.file)
    formData.append('doc_type', 'paper')

    try {
      await documentsApi.upload(formData, (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          updateFile(fileEntry.id, { progress })
        }
      })
      updateFile(fileEntry.id, { status: 'success', progress: 100 })
      toast.success(`${fileEntry.file.name} uploaded! Processing in background…`)
      if (onUploadComplete) onUploadComplete()
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed'
      updateFile(fileEntry.id, { status: 'error', error: msg })
      toast.error(`${fileEntry.file.name}: ${msg}`)
    }
  }, [updateFile, onUploadComplete])

  // Keep ref up-to-date
  uploadFileRef.current = uploadFile

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Accept PDFs by extension as fallback for non-standard MIME
    const pdfsFromRejected = (rejectedFiles || [])
      .map((r) => r.file)
      .filter((f) => f.name.toLowerCase().endsWith('.pdf'))

    const allFiles = [...acceptedFiles, ...pdfsFromRejected]
    const validFiles = allFiles.filter((file) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`${file.name}: Only PDF files are accepted`)
        return false
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 50MB)`)
        return false
      }
      return true
    })

    const newEntries = validFiles.map((file) => ({
      file,
      id: Math.random().toString(36).slice(2),
      progress: 0,
      status: 'pending',
      error: null,
    }))

    setFiles((prev) => [...prev, ...newEntries])
    // Use ref so we always call the latest version of uploadFile
    newEntries.forEach((entry) => uploadFileRef.current(entry))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/x-pdf': ['.pdf'],
      'application/octet-stream': ['.pdf'],
    },
    maxSize: 50 * 1024 * 1024,
    noClick: false,
    multiple: true,
  })

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status === 'uploading'))
  }

  return (
    <div className="upload-zone-wrapper">
      <div
        {...getRootProps()}
        className={`upload-dropzone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <motion.div
          className="upload-dropzone-content"
          animate={{ scale: isDragActive ? 1.02 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <div className="upload-icon-ring">
            <Upload size={28} />
          </div>
          <div className="upload-text">
            <p className="upload-title">
              {isDragActive ? 'Drop PDFs here…' : 'Drag & drop research papers here'}
            </p>
            <p className="upload-subtitle">or click to browse — PDF only, max 50MB per file</p>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            className="upload-file-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="upload-file-list-header">
              <span className="text-sm font-semibold">Uploads ({files.length})</span>
              {files.some((f) => f.status !== 'uploading') && (
                <button className="btn btn-ghost btn-sm" onClick={clearCompleted}>
                  Clear done
                </button>
              )}
            </div>
            {files.map((f) => (
              <motion.div
                key={f.id}
                className="upload-file-item"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <FileText size={16} className="upload-file-icon" />
                <div className="upload-file-info">
                  <div className="upload-file-name">{f.file.name}</div>
                  {f.status === 'uploading' && (
                    <div className="upload-progress-bar">
                      <div
                        className="upload-progress-fill"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                  {f.status === 'error' && (
                    <div className="text-xs text-red">{f.error}</div>
                  )}
                  {f.status === 'success' && (
                    <div className="text-xs" style={{ color: 'var(--color-emerald, #10b981)' }}>
                      Uploaded — indexing in background
                    </div>
                  )}
                </div>
                <div className="upload-file-status">
                  {f.status === 'uploading' && <Loader size={14} className="spinner text-accent" />}
                  {f.status === 'success' && <CheckCircle size={14} className="text-emerald" />}
                  {f.status === 'error' && <AlertCircle size={14} className="text-red" />}
                </div>
                {f.status !== 'uploading' && (
                  <button
                    className="upload-file-remove"
                    onClick={() => removeFile(f.id)}
                  >
                    <X size={12} />
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
