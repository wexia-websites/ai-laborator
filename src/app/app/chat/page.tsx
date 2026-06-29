'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, type Message } from '@/lib/supabase'

type Session = {
  id: string
  title: string
  messages: Message[]
  created_at: string
  updated_at: string
}

type Attachment = {
  name: string
  kind: 'image' | 'doc'
  mediaType: string
  data: string
  preview: string
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const PROJECT_KEYWORDS = [
  'zaznamenat projekt', 'nový projekt', 'zpětná vazba na projekt',
  'zdokumentovat projekt', 'projekt s ai', 'ai projekt',
  'retrospektiva projektu', 'dokumentace projektu',
  'chci projekt', 'přidat projekt', 'retrospektiva',
  'chci zaznamenat', 'chci zdokumentovat',
]

function md(text: string) {
  const lines = text.split('\n')
  const out: string[] = []
  let inList = false
  for (const line of lines) {
    const isList = line.startsWith('- ')
    if (isList && !inList) { out.push('<ul style="margin:4px 0;padding-left:20px">'); inList = true }
    if (!isList && inList) { out.push('</ul>'); inList = false }
    if (isList) {
      out.push(`<li>${line.slice(2)}</li>`)
    } else if (line.startsWith('## ')) {
      out.push(`<h2 style="font-size:15px;margin:10px 0 4px">${line.slice(3)}</h2>`)
    } else if (line.startsWith('### ')) {
      out.push(`<h3 style="font-size:14px;margin:8px 0 4px">${line.slice(4)}</h3>`)
    } else {
      out.push(line)
    }
  }
  if (inList) out.push('</ul>')
  return out.join('\n')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
}

function ChatPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toolParam = searchParams.get('tool')
  const modeParam = searchParams.get('mode')
  const startParam = searchParams.get('start')

  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [toast] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [mode, setMode] = useState<'chat' | 'project'>('chat')
  const [dbIndicator, setDbIndicator] = useState<Record<number, number>>({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const [titleGenerated, setTitleGenerated] = useState(false)
  const [hoveredHistoryId, setHoveredHistoryId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const historyBtnRef = useRef<HTMLButtonElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { loadSessions() }, [])

  // Close history panel on click outside
  useEffect(() => {
    if (!historyOpen) return
    const handle = (e: MouseEvent) => {
      if (
        historyRef.current && !historyRef.current.contains(e.target as Node) &&
        historyBtnRef.current && !historyBtnRef.current.contains(e.target as Node)
      ) setHistoryOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [historyOpen])
  useEffect(() => {
    if (!input && textareaRef.current) textareaRef.current.style.height = '48px'
  }, [input])

  // Persist messages + sessionId to sessionStorage on every change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      sessionStorage.setItem('chat_session_id', sessionId)
      sessionStorage.setItem('chat_messages', JSON.stringify(messages))
    }
  }, [sessionId, messages])

  // Restore last session from sessionStorage on mount — no API call needed
  useEffect(() => {
    if (toolParam || modeParam || startParam) return
    const savedId = sessionStorage.getItem('chat_session_id')
    const savedMessages = sessionStorage.getItem('chat_messages')
    if (!savedId || !savedMessages) return
    try {
      const msgs: Message[] = JSON.parse(savedMessages)
      if (Array.isArray(msgs) && msgs.length > 0) {
        setMessages(msgs)
        setSessionId(savedId)
        setTitleGenerated(true)
      }
    } catch { /* corrupted data — ignore */ }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (modeParam === 'project') {
      setMode('project')
      send('Chci zpětně zdokumentovat projekt kde jsme použili AI.', 'project')
    } else if (startParam === 'usecase') {
      send('Chci vytvořit use case pro AI nástroj, který jsme testovali.')
    } else if (toolParam) {
      send(`Chci vytvořit use case pro nástroj: ${toolParam}`)
    }
  }, [toolParam, modeParam, startParam])  // eslint-disable-line react-hooks/exhaustive-deps

  // Bug 1: load only current user's sessions
  const loadSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at, messages')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setSessions((data ?? []) as Session[])
  }

  const renameSession = async (id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) { setEditingSessionId(null); return }
    await supabase.from('chat_sessions').update({ title: trimmed }).eq('id', id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s))
    setEditingSessionId(null)
  }

  const newChat = () => {
    setMessages([])
    setSessionId(null)
    setSaved(false)
    setInput('')
    setAttachment(null)
    setMode('chat')
    setTitleGenerated(false)
    sessionStorage.removeItem('chat_session_id')
    sessionStorage.removeItem('chat_messages')
    abortControllerRef.current?.abort()
  }

  const openSession = (s: Session) => {
    setMessages(s.messages ?? [])
    setSessionId(s.id)
    setSaved(false)
    setAttachment(null)
    setTitleGenerated(true) // existující session — název už byl vygenerován
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const isImage = IMAGE_TYPES.includes(file.type)
    const reader = new FileReader()

    if (isImage) {
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        const base64 = dataUrl.split(',')[1]
        setAttachment({ name: file.name, kind: 'image', mediaType: file.type, data: base64, preview: dataUrl })
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = ev => {
        const text = ev.target?.result as string
        setAttachment({ name: file.name, kind: 'doc', mediaType: '', data: text, preview: '' })
      }
      reader.readAsText(file)
    }
  }

  const send = async (text?: string, overrideMode?: 'chat' | 'project') => {
    const userText = text ?? input.trim()
    if ((!userText && !attachment) || loading) return
    setInput('')

    // Auto-detect project mode from typed keywords
    let activeMode = overrideMode ?? mode
    if (activeMode === 'chat' && userText && PROJECT_KEYWORDS.some(kw => userText.toLowerCase().includes(kw))) {
      activeMode = 'project'
      setMode('project')
    }

    const displayText = userText || `📎 ${attachment!.name}`
    const next: Message[] = [...messages, { role: 'user', content: displayText }]
    setMessages(next)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiMessages: any[] = next.slice(0, -1).map(m => ({ role: m.role, content: m.content }))

    if (attachment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks: any[] = []
      if (attachment.kind === 'image') {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: attachment.mediaType, data: attachment.data } })
        if (userText) blocks.push({ type: 'text', text: userText })
      } else {
        const combined = `[Obsah souboru: ${attachment.name}]\n${attachment.data}${userText ? '\n\n' + userText : ''}`
        blocks.push({ type: 'text', text: combined })
      }
      apiMessages.push({ role: 'user', content: blocks })
    } else {
      apiMessages.push({ role: 'user', content: displayText })
    }

    setAttachment(null)
    setLoading(true)

    let currentSessionId = sessionId
    if (!currentSessionId) {
      const { data: { user } } = await supabase.auth.getUser()
      const title = (userText || attachment?.name || 'Chat').slice(0, 50)
      const { data } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user?.id, title, messages: next })
        .select('id')
        .single()
      if (data) { currentSessionId = data.id; setSessionId(data.id); loadSessions() }
    }

    try {
      abortControllerRef.current = new AbortController()
      const res = await fetch('/api/chat-db', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ messages: apiMessages, mode: activeMode })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      const withReply: Message[] = [...next, { role: 'assistant', content: data.content }]
      setMessages(withReply)
      if (data.usedDb && data.dbCount > 0) {
        setDbIndicator(prev => ({ ...prev, [withReply.length - 1]: data.dbCount }))
      }
      if (currentSessionId) {
        await supabase.from('chat_sessions')
          .update({ messages: withReply, updated_at: new Date().toISOString() })
          .eq('id', currentSessionId)
        loadSessions()
      }
      // Vygeneruj název po 4. zprávě (kdy AI zná téma), jen jednou
      if (currentSessionId && withReply.length >= 4 && !titleGenerated) {
        setTitleGenerated(true)
        fetch('/api/chat-db', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              ...withReply.slice(0, 6).map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: 'Vygeneruj název této konverzace.' },
            ],
            mode: 'title',
          }),
        }).then(r => r.json()).then(({ content }) => {
          if (content) {
            const smartTitle = content.trim().replace(/['"]/g, '').slice(0, 60)
            supabase.from('chat_sessions')
              .update({ title: smartTitle })
              .eq('id', currentSessionId!)
              .then(() => loadSessions())
          }
        }).catch(() => {/* noop */})
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const errMsg = err instanceof Error ? err.message : String(err)
      setMessages([...next, { role: 'assistant', content: `⚠️ Chyba AI: ${errMsg}` }])
    } finally { setLoading(false) }
  }

  const save = async () => {
    if (saving || saved) return
    setSaving(true)
    try {
      const isProject = mode === 'project'

      // 1. Extrahuj data z konverzace
      const res = await fetch(isProject ? '/api/extract-project' : '/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // 2. Získej přihlášeného uživatele
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Nejsi přihlášen')

      // 3. Ulož do Supabase
      const table = isProject ? 'projects' : 'use_cases'
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { duration: _duration, ...cleanData } = isProject ? data : { ...data, duration: undefined }
      const { data: inserted, error: insertError } = await supabase
        .from(table)
        .insert({
          ...cleanData,
          author_id: user.id,
          author_name: user.email?.split('@')[0] || 'Unknown',
          status: 'draft',
          chat_history: messages,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setSaved(true)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setTimeout(() => router.push(isProject ? '/app/projects' : '/app/usecases'), 1500)
    } catch (e) {
      console.error('Save error:', e)
      alert('Chyba při ukládání: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Včera'
    if (diffDays < 7) return d.toLocaleDateString('cs-CZ', { weekday: 'short' })
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
  }

  return (
    <>
      {/* Celý chat layout */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', position: 'relative' }}>

        {/* TOP BAR */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            ref={historyBtnRef}
            onClick={() => setHistoryOpen(o => !o)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', fontSize: 13, fontFamily: 'inherit',
              padding: '4px 0', transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
          >
            {historyOpen ? '‹ Historie' : 'Historie ›'}
          </button>
          <button
            onClick={newChat}
            style={{
              background: 'transparent',
              border: '1px solid var(--border2)',
              borderRadius: 20, color: 'var(--text2)',
              fontSize: 13, fontFamily: 'inherit',
              padding: '5px 16px', cursor: 'pointer',
              transition: 'border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            Nová konverzace
          </button>
        </div>

        {/* BODY: history sidebar + chat content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* PANEL HISTORIE — inline sidebar, nepřekrývá obsah */}
        {historyOpen && (
          <div ref={historyRef} style={{
            width: 260, flexShrink: 0,
            background: 'var(--surface2)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            padding: '12px 10px', gap: 3,
            overflowY: 'auto',
          }}>
            {sessions.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>Žádné chaty zatím</div>
            )}
            {sessions.map(s => (
              <div key={s.id} style={{ position: 'relative', borderRadius: 8 }}
                onMouseEnter={e => {
                  setHoveredHistoryId(s.id)
                  if (editingSessionId !== s.id) {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setHoveredId(s.id)
                    setTooltipPos({ x: rect.right + 8, y: rect.top })
                  }
                }}
                onMouseLeave={() => { setHoveredHistoryId(null); setHoveredId(null) }}
              >
                {editingSessionId === s.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameSession(s.id, editingTitle)
                      if (e.key === 'Escape') setEditingSessionId(null)
                    }}
                    onBlur={() => renameSession(s.id, editingTitle)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      background: 'var(--surface)', border: '1px solid var(--border2)',
                      color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <button onClick={() => openSession(s)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', paddingRight: 30, borderRadius: 8, border: 'none',
                    background: sessionId === s.id ? 'var(--surface3)' : hoveredHistoryId === s.id ? 'var(--surface)' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}>
                    <div style={{ fontSize: 13, color: sessionId === s.id ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190, transition: 'color 0.1s' }}>
                      {s.title || 'Chat'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate(s.updated_at)}</div>
                  </button>
                )}
                {hoveredHistoryId === s.id && editingSessionId !== s.id && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditingTitle(s.title || ''); setEditingSessionId(s.id); setHoveredId(null) }}
                    style={{
                      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text3)', fontSize: 13, padding: '2px 4px',
                      lineHeight: 1, borderRadius: 4, transition: 'color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
                  >✎</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CONTENT sloupec: zprávy + input */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* ZPRÁVY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: 1, textAlign: 'center',
              padding: '80px 20px 40px', gap: 0,
            }}>
              <style>{`@keyframes sway{0%,100%{transform:rotate(-1.5deg) translateY(0px)}50%{transform:rotate(1.5deg) translateY(-6px)}}`}</style>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/banana.png" alt="" width={260} style={{ marginBottom: 32, animation: 'sway 3.2s ease-in-out infinite', transformOrigin: 'center' }}/>
              <div style={{ color: 'var(--text)', fontSize: 22, fontWeight: 500, marginBottom: 12 }}>
                Jak vám mohu pomoci?
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 36 }}>
                Vytvořte use case, zdokumentujte projekt nebo se zeptejte.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  { label: 'Vytvořit use case pro AI nástroj', action: () => send('Chci vytvořit use case pro AI nástroj, který jsme testovali.') },
                  { label: 'Zpětná vazba na projekt', action: () => { setMode('project'); send('Chci zpětně zdokumentovat projekt kde jsme použili AI.', 'project') } },
                  { label: 'Mám dotaz', action: () => send('Mám dotaz ohledně AI nástrojů nebo use casů.') },
                ].map(({ label, action }) => (
                  <button key={label} onClick={action} style={{
                    background: 'transparent',
                    border: '1px solid var(--border2)',
                    borderRadius: 20, color: 'var(--text2)',
                    fontSize: 13, padding: '8px 18px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#e02020'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
                  >{label}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ paddingTop: 16, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 900, margin: '0 auto' }}>
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>
                  <div className="msg-avatar">{m.role === 'user' ? 'T' : 'λ'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                    <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.role === 'assistant' ? md(m.content) : m.content }} />
                    {m.role === 'assistant' && dbIndicator[i] !== undefined && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 2 }}>
                        📊 Odpověď vychází z {dbIndicator[i]} otestovaných nástrojů v AI Laboratoři
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="msg assistant">
                  <div className="msg-avatar">λ</div>
                  <div className="typing-dot"><span /><span /><span /></div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div style={{ padding: '16px 20px 20px', flexShrink: 0 }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            {/* Preview přílohy */}
            {attachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                {attachment.kind === 'image' ? (
                  <img src={attachment.preview} alt={attachment.name} style={{ height: 36, width: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <span style={{ fontSize: 16, flexShrink: 0 }}>📄</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
                <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            )}

            {/* Input + send button */}
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                placeholder="Napiš zprávu…"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                onInput={e => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 200) + 'px'
                }}
                style={{
                  width: '100%', minHeight: 48, maxHeight: 200, borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--border2)',
                  padding: '12px 50px 12px 16px', color: 'var(--text)',
                  fontSize: 14, fontFamily: 'inherit',
                  resize: 'none', outline: 'none',
                  lineHeight: '24px', transition: 'border-color 0.15s',
                  overflowY: 'hidden',
                }}
              />
              <button
                onClick={() => send()}
                disabled={loading || (!input.trim() && !attachment)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--surface3)',
                  border: 'none', cursor: loading || (!input.trim() && !attachment) ? 'not-allowed' : 'pointer',
                  color: 'var(--text)', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                  opacity: loading || (!input.trim() && !attachment) ? 0.4 : 1,
                }}
                onMouseEnter={e => { if (!loading && (input.trim() || attachment)) e.currentTarget.style.background = '#e02020' }}
                onMouseLeave={e => { if (!loading && (input.trim() || attachment)) e.currentTarget.style.background = 'var(--surface3)' }}
              >↑</button>
            </div>

            {/* Spodní lišta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingLeft: 2, paddingRight: 2 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { label: '⊕ Přiložit', onClick: () => fileInputRef.current?.click(), disabled: loading },
                  { label: 'Z inboxu', onClick: () => router.push('/app/inbox'), disabled: false },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled} style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                    fontSize: 12, fontFamily: 'inherit', padding: '4px 10px',
                    transition: 'color 0.12s, background 0.12s, border-color 0.12s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  >{btn.label}</button>
                ))}
                {messages.length > 2 && (
                  <button onClick={save} disabled={saving || saved} style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, fontFamily: 'inherit', padding: '4px 10px',
                    fontSize: 12, transition: 'color 0.12s, background 0.12s, border-color 0.12s',
                    cursor: saving || saved ? 'default' : 'pointer',
                    color: saved ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.4)',
                  }}
                    onMouseEnter={e => { if (!saving && !saved) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' } }}
                    onMouseLeave={e => { if (!saving && !saved) { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' } }}
                  >
                    {saved ? '✓ Uloženo' : saving ? '⟳ Ukládám…' : mode === 'project' ? 'Uložit projekt' : 'Uložit use case'}
                  </button>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Shift+Enter = nový řádek</span>
            </div>
          </div>
        </div>

        </div>{/* /CONTENT sloupec */}
        </div>{/* /BODY */}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }}
        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        onChange={handleFile} />
      {toast && <div className="toast show">{toast}</div>}
      {hoveredId && (
        <div style={{
          position: 'fixed', left: tooltipPos.x, top: tooltipPos.y,
          background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fff',
          maxWidth: 220, wordWrap: 'break-word', lineHeight: 1.4,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 9999, pointerEvents: 'none',
        }}>
          {sessions.find(s => s.id === hoveredId)?.title}
        </div>
      )}
      {saveSuccess && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', color: '#fff', borderRadius: 10,
          padding: '10px 20px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 9999,
          animation: 'slideUp 0.25s ease',
        }}>
          ✓ {mode === 'project' ? 'Projekt uložen jako draft' : 'Use case uložen jako draft'}
        </div>
      )}
    </>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  )
}
