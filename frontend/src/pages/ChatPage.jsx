import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Plus, Send, Loader, ChevronDown, ChevronUp,
  FileText, BookOpen, Trash2, Bot, User, X
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chatApi, documentsApi } from '../services/api'
import toast from 'react-hot-toast'
import './ChatPage.css'

export default function ChatPage() {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingSources, setStreamingSources] = useState([])
  const [showDocSelector, setShowDocSelector] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState([])
  const [chatMode, setChatMode] = useState('collection')
  const messagesEndRef = useRef(null)

  const { data: docs = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  })

  const readyDocs = docs.filter((d) => d.status === 'ready')

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])

  const loadSessions = async () => {
    try {
      const { data } = await chatApi.listSessions()
      setSessions(data)
      if (data.length > 0 && !activeSession) {
        openSession(data[0])
      }
    } catch {}
  }

  const openSession = async (session) => {
    setActiveSession(session)
    try {
      const { data } = await chatApi.getMessages(session.id)
      setMessages(data)
    } catch {}
  }

  const createNewSession = async () => {
    try {
      const { data } = await chatApi.createSession({
        title: 'New Chat',
        mode: chatMode,
        doc_ids: chatMode === 'selected' ? selectedDocs : [],
      })
      setSessions((prev) => [data, ...prev])
      setActiveSession(data)
      setMessages([])
    } catch {
      toast.error('Failed to create chat session')
    }
  }

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation()
    try {
      await chatApi.deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setMessages([])
      }
    } catch {}
  }

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    if (!activeSession) {
      await createNewSession()
      return
    }

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
      sources: [],
      created_at: new Date().toISOString(),
    }])
    setStreaming(true)
    setStreamingText('')
    setStreamingSources([])

    const token = JSON.parse(localStorage.getItem('rag-auth') || '{}')?.state?.token
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: activeSession.id, message: userMsg }),
    })

    if (!response.ok) {
      setStreaming(false)
      toast.error('Chat request failed')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let sources = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              toast.error(`Error: ${parsed.error}`)
            } else if (parsed.text) {
              if (parsed.text.includes('__SOURCES__')) {
                const parts = parsed.text.split('__SOURCES__')
                fullText += parts[0]
                setStreamingText(fullText)
                try { sources = JSON.parse(parts[1]) } catch {}
              } else {
                fullText += parsed.text
                setStreamingText(fullText)
              }
            }
          } catch {}
        }
      }
    }

    setStreaming(false)
    setStreamingSources(sources)
    setMessages((prev) => [...prev, {
      id: Date.now().toString() + '_ai',
      role: 'assistant',
      content: fullText,
      sources,
      created_at: new Date().toISOString(),
    }])
    setStreamingText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-layout">
      {/* Sessions Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2 className="section-title">Chats</h2>
          <button className="btn btn-primary btn-sm" onClick={createNewSession}>
            <Plus size={14} /> New
          </button>
        </div>

        {/* Mode Selector */}
        <div className="chat-mode-selector">
          {['collection', 'selected'].map((m) => (
            <button
              key={m}
              className={`chat-mode-btn ${chatMode === m ? 'active' : ''}`}
              onClick={() => setChatMode(m)}
            >
              {m === 'collection' ? 'All Docs' : 'Select Docs'}
            </button>
          ))}
        </div>

        {chatMode === 'selected' && (
          <div className="chat-doc-selector">
            <p className="text-xs text-muted">Select documents to chat with:</p>
            {readyDocs.map((doc) => (
              <label key={doc.id} className="chat-doc-option">
                <input
                  type="checkbox"
                  checked={selectedDocs.includes(doc.id)}
                  onChange={(e) => {
                    setSelectedDocs(prev =>
                      e.target.checked ? [...prev, doc.id] : prev.filter(id => id !== doc.id)
                    )
                  }}
                />
                <span className="truncate text-xs">{doc.title || doc.filename}</span>
              </label>
            ))}
          </div>
        )}

        <div className="chat-session-list">
          {sessions.length === 0 && (
            <div className="text-xs text-muted" style={{ padding: '12px 8px' }}>
              No chats yet. Click "New" to start.
            </div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`chat-session-item ${activeSession?.id === s.id ? 'active' : ''}`}
              onClick={() => openSession(s)}
            >
              <MessageSquare size={13} className="flex-shrink-0" />
              <span className="flex-1 truncate">{s.title}</span>
              <button
                className="chat-session-delete"
                onClick={(e) => deleteSession(s.id, e)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-main">
        {!activeSession ? (
          <div className="chat-empty">
            <div className="empty-state-icon" style={{ width: 72, height: 72 }}>
              <Bot size={32} />
            </div>
            <h2>Start a Research Conversation</h2>
            <p>Ask questions about your uploaded research papers and patents</p>
            <button className="btn btn-primary btn-lg" onClick={createNewSession}>
              <Plus size={18} /> New Chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="chat-messages">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Streaming */}
              {streaming && (
                <div className="chat-msg chat-msg-assistant">
                  <div className="chat-msg-avatar chat-avatar-ai">
                    <Bot size={16} />
                  </div>
                  <div className="chat-msg-content">
                    {streamingText ? (
                      <div className="prose">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingText}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="chat-typing">
                        <span /><span /><span />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-bar">
              <textarea
                className="chat-textarea"
                placeholder="Ask about your research papers… (Enter to send, Shift+Enter for new line)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={streaming}
              />
              <button
                className="btn btn-primary chat-send-btn"
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
              >
                {streaming ? <Loader size={18} className="spinner" /> : <Send size={18} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ChatMessage({ message }) {
  const [showSources, setShowSources] = useState(false)
  const isUser = message.role === 'user'

  return (
    <div className={`chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-assistant'}`}>
      <div className={`chat-msg-avatar ${isUser ? 'chat-avatar-user' : 'chat-avatar-ai'}`}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className="chat-msg-body">
        <div className="chat-msg-content">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources?.length > 0 && (
          <div className="chat-sources">
            <button
              className="chat-sources-toggle"
              onClick={() => setShowSources(!showSources)}
            >
              <FileText size={12} />
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
              {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <AnimatePresence>
              {showSources && (
                <motion.div
                  className="chat-sources-list"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {message.sources.map((src, i) => (
                    <div key={i} className="chat-source-card">
                      <div className="chat-source-header">
                        <FileText size={12} className="text-primary-color" />
                        <span className="font-semibold text-xs">{src.doc_title}</span>
                        <span className="text-xs text-muted">Page {src.page}</span>
                        <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
                          {Math.round(src.relevance_score * 100)}%
                        </span>
                      </div>
                      <p className="chat-source-excerpt">{src.excerpt}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
