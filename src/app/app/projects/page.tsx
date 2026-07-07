'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

type Project = {
  id: string
  title: string
  description: string | null
  status: string
  client: string | null
  team: string | null
  tools_used: string | null
  project_goal: string | null
  what_worked: string | null
  what_failed: string | null
  challenges: string | null
  lessons_learned: string | null
  avoid_next_time: string | null
  process_that_worked: string | null
  ai_contribution: string | null
  reusable: string | null
  recommendations: string | null
  tool_ratings: { tool: string; rating: number; note?: string }[]
  overall_rating: number | null
  would_repeat: string | null
  author_name: string | null
  start_date: string | null
  end_date: string | null
  project_type: string | null
  created_at: string
}

const EMPTY_FORM = {
  title: '', description: '', client: '', team: '', duration: '', tools_used: '',
  start_date: '', end_date: '', project_type: 'internal',
  project_goal: '', what_worked: '', what_failed: '', lessons_learned: '',
  avoid_next_time: '', process_that_worked: '', ai_contribution: '',
  challenges: '', recommendations: '', reusable: '',
  overall_rating: '', would_repeat: '',
}
const EMPTY_TOOL_RATING = () => ({ tool: '', rating: '', note: '' })

function Section({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {title}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

function ProjectsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const idParam = searchParams.get('id')
  const { canAccess, canEdit, loading: roleLoading } = useRole()
  useEffect(() => {
    if (!roleLoading && !canAccess('projects')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [projects, setProjects] = useState<Project[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'ongoing' | 'completed' | 'review' | 'draft' | null>(null)
  const [toolRatings, setToolRatings] = useState<{tool: string; rating: string; note: string}[]>([])

  const load = () => {
    supabase.from('projects').select('*').order('created_at', { ascending: false })
      .then(({ data }: any) => setProjects((data ?? []) as Project[]))
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (idParam && projects.length > 0 && !selected) {
      const found = projects.find(p => p.id === idParam)
      if (found) setSelected(found)
    }
  }, [idParam, projects]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const openEdit = (p: Project) => {
    setForm({
      title: p.title ?? '', description: p.description ?? '', client: p.client ?? '',
      team: p.team ?? '', duration: '', tools_used: p.tools_used ?? '',
      start_date: p.start_date ?? '', end_date: p.end_date ?? '',
      project_type: p.project_type ?? 'internal',
      project_goal: p.project_goal ?? '', what_worked: p.what_worked ?? '',
      what_failed: p.what_failed ?? '', lessons_learned: p.lessons_learned ?? '',
      avoid_next_time: p.avoid_next_time ?? '', process_that_worked: p.process_that_worked ?? '',
      ai_contribution: p.ai_contribution ?? '',
      challenges: p.challenges ?? '', recommendations: p.recommendations ?? '',
      reusable: p.reusable ?? '', overall_rating: p.overall_rating?.toString() ?? '',
      would_repeat: p.would_repeat ?? '',
    })
    setToolRatings((p.tool_ratings ?? []).map(tr => ({ tool: tr.tool, rating: tr.rating.toString(), note: tr.note ?? '' })))
    setEditingId(p.id)
    setSelected(null)
    setShowForm(true)
  }

  const saveManual = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title, description: form.description || null,
      client: form.client || null, team: form.team || null,
      duration: form.duration || null, tools_used: form.tools_used || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      project_type: form.project_type || null,
      project_goal: form.project_goal || null, what_worked: form.what_worked || null,
      what_failed: form.what_failed || null, lessons_learned: form.lessons_learned || null,
      avoid_next_time: form.avoid_next_time || null, process_that_worked: form.process_that_worked || null,
      ai_contribution: form.ai_contribution || null,
      challenges: form.challenges || null, recommendations: form.recommendations || null,
      reusable: form.reusable || null,
      tool_ratings: toolRatings.filter(r => r.tool.trim()).map(r => ({ tool: r.tool.trim(), rating: Number(r.rating) || 0, note: r.note || undefined })),
      overall_rating: form.overall_rating ? Number(form.overall_rating) : null,
      would_repeat: form.would_repeat || null,
    }
    if (editingId) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editingId)
      if (error) { console.error(error); alert('Chyba při ukládání: ' + error.message); setSaving(false); return }
      setProjects(prev => prev.map(p => p.id === editingId ? { ...p, ...payload } : p))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('projects').insert({ ...payload, author_id: user?.id, author_name: user?.email?.split('@')[0], status: 'draft' })
      if (error) { console.error(error); alert('Chyba při ukládání: ' + error.message); setSaving(false); return }
      load()
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setToolRatings([])
  }

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { console.error(error); alert('Chyba při mazání: ' + error.message); return }
    setProjects(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
    setSelected(null)
  }

  const sendToReview = async (id: string) => {
    await supabase.from('projects').update({ status: 'review' }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'review' } : p))
    setSelected(null)
  }

  const publishProject = async (id: string) => {
    const { error } = await supabase.from('projects').update({ status: 'published' }).eq('id', id)
    if (error) { alert('Chyba: ' + error.message); return }
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p))
    setSelected(prev => prev && prev.id === id ? { ...prev, status: 'published' } : prev)
  }

  const returnToDraft = async (id: string) => {
    const { error } = await supabase.from('projects').update({ status: 'draft' }).eq('id', id)
    if (error) { alert('Chyba: ' + error.message); return }
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'draft' } : p))
    setSelected(prev => prev && prev.id === id ? { ...prev, status: 'draft' } : prev)
  }

  const generateHTML = (p: Project) => {
    const row = (label: string, val?: string | number | null) => val ? `<h2>${label}</h2><p>${String(val).replace(/\n/g, '<br>')}</p>` : ''
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${p.title}</title><style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1916;}
      h1{color:#e02020;border-bottom:2px solid #e02020;padding-bottom:10px;}
      h2{color:#333;margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
      p{line-height:1.6;color:#555;margin:0 0 8px;}
      .meta{color:#888;font-size:13px;margin-bottom:24px;}
      .tag{display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:10px;font-size:12px;margin:2px;}
      .score{font-size:28px;font-weight:bold;color:#e02020;}
      @media print{body{margin:20px;}}
    </style></head><body>
      <h1>${p.title}</h1>
      <div class="meta">
        ${p.client ? `<strong>Klient:</strong> ${p.client} &nbsp;` : ''}
        ${p.team ? `<strong>Tým:</strong> ${p.team} &nbsp;` : ''}
        ${p.author_name ? `<strong>Autor:</strong> ${p.author_name} &nbsp;` : ''}
        <strong>Status:</strong> ${p.status} &nbsp;
        <strong>Datum:</strong> ${new Date(p.created_at).toLocaleDateString('cs-CZ')}
      </div>
      ${p.description ? `<p><em>${p.description}</em></p>` : ''}
      ${row('AI nástroje', p.tools_used)}
      ${row('Cíl projektu', p.project_goal)}
      ${row('Přínos AI', p.ai_contribution)}
      ${row('Co fungovalo skvěle', p.what_worked)}
      ${row('Největší výzvy', p.what_failed)}
      ${row('Osvědčený postup', p.process_that_worked)}
      ${row('Lessons learned', p.lessons_learned)}
      ${row('Příště se vyvarovat', p.avoid_next_time)}
      ${p.tool_ratings?.length ? `<h2>Hodnocení nástrojů</h2><p>${p.tool_ratings.map(tr => `<span class="tag">${tr.tool}: ${tr.rating}/10${tr.note ? ' — ' + tr.note : ''}</span>`).join(' ')}</p>` : ''}
      <h2>Finální verdikt</h2>
      <p>
        ${p.overall_rating ? `<span class="score">${p.overall_rating}/10</span> ` : ''}
        ${p.would_repeat ? `<span class="tag">Zopakovat: ${p.would_repeat}</span>` : ''}
      </p>
    </body></html>`
  }

  const exportToHTML = (p: Project) => {
    const blob = new Blob([generateHTML(p)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.title.replace(/[^a-z0-9]/gi, '_')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToPDF = (p: Project) => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
    iframe.contentDocument!.write(generateHTML(p))
    iframe.contentDocument!.close()
    iframe.contentWindow!.focus()
    iframe.contentWindow!.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }

  const exportToWord = (p: Project) => {
    const row = (label: string, val?: string | number | null) => val ? `<h2>${label}</h2><p>${String(val).replace(/\n/g, '<br>')}</p>` : ''
    const content = `
      <h1>${p.title}</h1>
      <p class="meta">
        ${p.client ? `<strong>Klient:</strong> ${p.client} &nbsp;` : ''}
        ${p.team ? `<strong>Tým:</strong> ${p.team} &nbsp;` : ''}
        ${p.author_name ? `<strong>Autor:</strong> ${p.author_name} &nbsp;` : ''}
        <strong>Status:</strong> ${p.status} &nbsp;
        <strong>Datum:</strong> ${new Date(p.created_at).toLocaleDateString('cs-CZ')}
      </p>
      ${p.description ? `<p><em>${p.description}</em></p>` : ''}
      ${row('AI nástroje', p.tools_used)}
      ${row('Cíl projektu', p.project_goal)}
      ${row('Přínos AI', p.ai_contribution)}
      ${row('Co fungovalo skvěle', p.what_worked)}
      ${row('Největší výzvy', p.what_failed)}
      ${row('Osvědčený postup', p.process_that_worked)}
      ${row('Lessons learned', p.lessons_learned)}
      ${row('Příště se vyvarovat', p.avoid_next_time)}
      <h2>Finální verdikt</h2>
      <p>
        ${p.overall_rating ? `Hodnocení: ${p.overall_rating}/10 ` : ''}
        ${p.would_repeat ? `Zopakovat: ${p.would_repeat}` : ''}
      </p>`
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='UTF-8'>
      <style>body{font-family:Arial,sans-serif;}h1{color:#e02020;}h2{font-size:12pt;text-transform:uppercase;}.meta{color:#888;font-size:11pt;}</style>
      </head><body>${content}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.title.replace(/[^a-z0-9]/gi, '_')}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = projects.filter(p => {
    if (activeFilter === 'draft'     && p.status !== 'draft') return false
    if (activeFilter === 'review'    && p.status !== 'review') return false
    if (activeFilter === 'completed' && !p.end_date) return false
    if (activeFilter === 'ongoing'   && !(p.status === 'published' && !p.end_date)) return false
    const ql = q.toLowerCase()
    return !q || p.title?.toLowerCase().includes(ql) ||
      p.client?.toLowerCase().includes(ql) ||
      p.tools_used?.toLowerCase().includes(ql) ||
      p.team?.toLowerCase().includes(ql) ||
      p.description?.toLowerCase().includes(ql) ||
      p.author_name?.toLowerCase().includes(ql)
  })

  const statusTag: Record<string, string> = {
    draft: '', review: 'tag-amber', published: 'tag-green'
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Projekty</h1><p>Zpětná analýza projektů kde byla použita AI.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setToolRatings([]); setShowForm(true) }}>+ Vyplnit ručně</button>
          <button className="btn btn-primary" data-tour-id="new-project" onClick={() => router.push('/app/chat?mode=project')}>+ Nový projekt (chat)</button>
        </div>
      </div>
      <div className="page-body">
        {/* STATS */}
        {projects.length > 0 && (() => {
          const drafts    = projects.filter(p => p.status === 'draft').length
          const inReview  = projects.filter(p => p.status === 'review').length
          const completed = projects.filter(p => !!p.end_date && p.status !== 'draft' && p.status !== 'review').length
          const ongoing   = projects.filter(p => p.status === 'published' && !p.end_date).length
          const stats: { label: string; value: number; key: typeof activeFilter }[] = [
            { label: 'Probíhající', value: ongoing,   key: 'ongoing'   },
            { label: 'Dokončené',   value: completed, key: 'completed' },
            { label: 'V revizi',    value: inReview,  key: 'review'    },
            { label: 'Drafty',      value: drafts,    key: 'draft'     },
          ]
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {stats.map(s => {
                const isActive  = activeFilter === s.key
                const isAccent  = s.key === 'review' && s.value > 0
                const border    = isActive ? '#e02020' : isAccent ? '#e02020' : 'var(--border)'
                const numColor  = isActive || isAccent ? '#e02020' : 'var(--text)'
                return (
                  <div
                    key={s.label}
                    onClick={() => setActiveFilter(prev => prev === s.key ? null : s.key)}
                    style={{
                      background: isActive ? 'rgba(224,32,32,0.07)' : 'var(--surface2)',
                      border: `1px solid ${border}`,
                      borderRadius: 10, padding: '14px 16px',
                      cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 26, fontWeight: 700, color: numColor, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: isActive ? 'var(--text2)' : 'var(--text3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                  </div>
                )
              })}
            </div>
          )
        })()}
        <input className="search-box" placeholder="Hledat projekty…" value={q} onChange={e => setQ(e.target.value)} />
        {filtered.length === 0
          ? <div className="empty"><span className="empty-icon">📁</span>Žádné projekty. Vytvoř první přes chat.</div>
          : filtered.map(p => (
            <div key={p.id} className="uc-card" style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
              <div style={{ flex: 1 }}>
                <div className="uc-title">{p.title}</div>
                <div className="uc-meta">
                  {p.client && <>{p.client} · </>}
                  {p.team && <>{p.team} · </>}
                  {p.author_name && <>autor: {p.author_name}</>}
                </div>
                {p.description && <div className="uc-desc">{p.description}</div>}
                <div className="uc-tags">
                  <span className={`tag ${statusTag[p.status] || ''}`}>{p.status}</span>
                  {p.overall_rating && <span className="tag">⭐ {p.overall_rating}/10</span>}
                  {p.tools_used && <span className="tag">{p.tools_used.split(',')[0].trim()}</span>}
                </div>
              </div>
              <div className="uc-actions">
                <button className="btn btn-outline btn-sm" onClick={() => setSelected(p)}>Detail</button>
                {p.status === 'draft' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => sendToReview(p.id)}>→ Review</button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* FORMULÁŘ (nový i editace) */}
      {showForm && (
        <div className="modal-bg open" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 100, padding: 20, boxSizing: 'border-box' }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: '90vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setToolRatings([]) }}>×</button>
            <div className="modal-header"><div className="modal-title">{editingId ? 'Upravit projekt' : 'Vyplnit projekt ručně'}</div></div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Název projektu *</label>
                <input className="form-input" value={form.title} onChange={f('title')} placeholder="Název projektu" />
              </div>
              <div className="form-group">
                <label className="form-label">Klient</label>
                <input className="form-input" value={form.client} onChange={f('client')} placeholder="Klient nebo interní" />
              </div>
              <div className="form-group">
                <label className="form-label">Tým</label>
                <input className="form-input" value={form.team} onChange={f('team')} placeholder="Kdo pracoval na projektu?" />
              </div>
              <div className="form-group">
                <label className="form-label">Datum zahájení</label>
                <input className="form-input" type="date" value={form.start_date} onChange={f('start_date')} />
              </div>
              <div className="form-group">
                <label className="form-label">Datum ukončení</label>
                <input className="form-input" type="date" value={form.end_date} onChange={f('end_date')} style={{ color: form.end_date ? undefined : 'var(--text3)' }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Nevyplňuj pokud projekt stále probíhá</div>
              </div>
              <div className="form-group">
                <label className="form-label">Typ projektu</label>
                <select className="form-select" value={form.project_type} onChange={f('project_type')}>
                  <option value="internal">Interní</option>
                  <option value="external">Externí</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Délka projektu</label>
                <input className="form-input" value={form.duration} onChange={f('duration')} placeholder="např. 3 měsíce" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">AI nástroje</label>
                <input className="form-input" value={form.tools_used} onChange={f('tools_used')} placeholder="Claude, Midjourney…" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Popis (1–2 věty)</label>
                <textarea className="form-textarea" rows={2} value={form.description} onChange={f('description')} placeholder="Stručný popis projektu" />
              </div>
            </div>

            <Section title="Cíl a průběh" />
            <div className="form-group">
              <label className="form-label">Cíl projektu</label>
              <textarea className="form-textarea" rows={2} value={form.project_goal} onChange={f('project_goal')} placeholder="Co byl záměr projektu?" />
            </div>

            <Section title="Co fungovalo a co ne" />
            <div className="form-group">
              <label className="form-label">Co fungovalo skvěle</label>
              <textarea className="form-textarea" rows={2} value={form.what_worked} onChange={f('what_worked')} placeholder="Největší úspěchy" />
            </div>
            <div className="form-group">
              <label className="form-label">Největší výzvy</label>
              <textarea className="form-textarea" rows={2} value={form.what_failed} onChange={f('what_failed')} placeholder="Co bylo nejtěžší nebo zklamalo?" />
            </div>
            <div className="form-group">
              <label className="form-label">Osvědčený postup</label>
              <textarea className="form-textarea" rows={2} value={form.process_that_worked} onChange={f('process_that_worked')} placeholder="Jaký přístup se nejvíc osvědčil?" />
            </div>

            <Section title="Poučení" />
            <div className="form-group">
              <label className="form-label">Největší výzvy během projektu</label>
              <textarea className="form-textarea" rows={2} value={form.challenges} onChange={f('challenges')} placeholder="Jaké překážky nebo výzvy se vyskytly?" />
            </div>
            <div className="form-group">
              <label className="form-label">Lessons learned</label>
              <textarea className="form-textarea" rows={2} value={form.lessons_learned} onChange={f('lessons_learned')} placeholder="Co si odnášíš z projektu?" />
            </div>
            <div className="form-group">
              <label className="form-label">Příště se vyvarovat</label>
              <textarea className="form-textarea" rows={2} value={form.avoid_next_time} onChange={f('avoid_next_time')} placeholder="Čemu se příště vyhnout?" />
            </div>
            <div className="form-group">
              <label className="form-label">Doporučení pro ostatní</label>
              <textarea className="form-textarea" rows={2} value={form.recommendations} onChange={f('recommendations')} placeholder="Co poradit komukoliv, kdo bude dělat podobný projekt?" />
            </div>

            <Section title="Role AI a hodnocení" />
            <div className="form-group">
              <label className="form-label">Jak AI přispěla k výsledku</label>
              <textarea className="form-textarea" rows={2} value={form.ai_contribution} onChange={f('ai_contribution')} placeholder="Jak AI přispěla k výsledku?" />
            </div>

            <Section title="Hodnocení nástrojů" />
            {toolRatings.map((tr, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                <input className="form-input" placeholder="Název nástroje" value={tr.tool}
                  onChange={e => setToolRatings(prev => prev.map((r, j) => j === i ? { ...r, tool: e.target.value } : r))} />
                <select className="form-select" value={tr.rating}
                  onChange={e => setToolRatings(prev => prev.map((r, j) => j === i ? { ...r, rating: e.target.value } : r))}>
                  <option value="">—</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}/10</option>)}
                </select>
                <input className="form-input" placeholder="Krátká poznámka" value={tr.note}
                  onChange={e => setToolRatings(prev => prev.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} />
                <button type="button" onClick={() => setToolRatings(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 20, lineHeight: 1, padding: '8px 4px' }}>×</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setToolRatings(prev => [...prev, EMPTY_TOOL_RATING()])}
              style={{ marginBottom: 16 }}>+ Přidat nástroj</button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Doporučuješ jako mustr?</label>
                <select className="form-select" value={form.reusable} onChange={f('reusable')}>
                  <option value="">—</option>
                  <option value="yes">Ano, určitě</option>
                  <option value="yes_with_changes">Ano, s úpravami</option>
                  <option value="no">Ne</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Celkové hodnocení (1–10)</label>
                <select className="form-select" value={form.overall_rating} onChange={f('overall_rating')}>
                  <option value="">—</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Zopakoval/a bys přístup?</label>
                <select className="form-select" value={form.would_repeat} onChange={f('would_repeat')}>
                  <option value="">—</option>
                  <option value="ano">Ano</option>
                  <option value="ano s úpravami">Ano, s úpravami</option>
                  <option value="ne">Ne</option>
                </select>
              </div>
            </div>

            </div>
            <div className="modal-footer" style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 24px' }}>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setToolRatings([]) }}>Zrušit</button>
              <button className="btn btn-primary" onClick={saveManual} disabled={saving || !form.title.trim()}>
                {saving ? 'Ukládám…' : editingId ? 'Uložit změny' : 'Uložit jako draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-bg open" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 100, padding: 20, boxSizing: 'border-box' }} onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal modal-detail" style={{ width: '90vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            {/* HEADER */}
            <div className="uc-modal-header">
              <div className="uc-modal-badges">
                {selected.project_type && (
                  <span className={`uc-badge ${selected.project_type === 'external' ? 'uc-badge-cat' : 'uc-badge-status'}`}>
                    {selected.project_type === 'external' ? 'Externí' : 'Interní'}
                  </span>
                )}
                <span className={`uc-badge ${selected.status === 'published' ? 'uc-badge-yes' : selected.status === 'review' ? 'uc-badge-maybe' : 'uc-badge-status'}`}>
                  {selected.status === 'published' ? '✓ Publikováno' : selected.status === 'review' ? '↺ V revizi' : '○ Draft'}
                </span>
                {selected.reusable === 'yes' && (
                  <span className="uc-badge uc-badge-yes">⭐ Doporučený mustr</span>
                )}
                {selected.overall_rating && (
                  <span className={`uc-modal-rating ${selected.overall_rating >= 8 ? 'uc-rating-high' : selected.overall_rating >= 6 ? 'uc-rating-mid' : 'uc-rating-low'}`}>
                    ⭐ {selected.overall_rating}/10
                  </span>
                )}
              </div>
              <div className="uc-modal-title">{selected.title}</div>
              <div className="uc-modal-subtitle">
                {selected.author_name && <span>👤 {selected.author_name}</span>}
                {selected.created_at && <span>📅 {new Date(selected.created_at).toLocaleDateString('cs-CZ')}</span>}
                {selected.start_date && (
                  <span>🗓 {new Date(selected.start_date).toLocaleDateString('cs-CZ')} → {selected.end_date ? new Date(selected.end_date).toLocaleDateString('cs-CZ') : 'Probíhá'}</span>
                )}
              </div>
              {selected.description && <div className="uc-modal-desc">{selected.description}</div>}
            </div>

            {/* SCROLLOVATELNÝ OBSAH */}
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 24px' }}>

              {/* Info karty */}
              <div className="uc-metrics">
                <div className="uc-metric">
                  <div className="uc-metric-label">Klient</div>
                  <div className="uc-metric-value">{selected.client || '—'}</div>
                </div>
                <div className="uc-metric">
                  <div className="uc-metric-label">Tým</div>
                  <div className="uc-metric-value">{selected.team || '—'}</div>
                </div>
                <div className="uc-metric">
                  <div className="uc-metric-label">Délka</div>
                  <div className="uc-metric-value">{
                    selected.start_date && selected.end_date
                      ? (() => {
                          const days = Math.round((new Date(selected.end_date).getTime() - new Date(selected.start_date).getTime()) / 86400000)
                          return days < 30 ? `${days} dní` : `${Math.round(days / 30)} měs.`
                        })()
                      : selected.start_date && !selected.end_date ? 'Probíhá'
                      : '—'
                  }</div>
                </div>
              </div>

              {/* Cíl projektu */}
              {selected.project_goal && (
                <>
                  <div className="uc-section">🎯 Cíl projektu</div>
                  <div className="uc-field">{selected.project_goal}</div>
                </>
              )}

              {/* AI v projektu */}
              {(selected.tools_used || selected.ai_contribution) && (
                <>
                  <div className="uc-section">🤖 AI v projektu</div>
                  {selected.tools_used && (
                    <div className="uc-field">
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: 6 }}>Nástroje:</span>
                      {selected.tools_used}
                    </div>
                  )}
                  {selected.ai_contribution && <div className="uc-field">{selected.ai_contribution}</div>}
                </>
              )}

              {/* Co fungovalo skvěle */}
              {selected.what_worked && (
                <>
                  <div className="uc-section">✅ Co fungovalo skvěle</div>
                  <div className="uc-field">{selected.what_worked}</div>
                </>
              )}

              {/* Osvědčený postup */}
              {selected.process_that_worked && (
                <>
                  <div className="uc-section">📋 Osvědčený postup</div>
                  <div className="uc-field">{selected.process_that_worked}</div>
                </>
              )}

              {/* Výzvy */}
              {(selected.what_failed || selected.challenges) && (
                <>
                  <div className="uc-section">⚠️ Výzvy a překážky</div>
                  {selected.what_failed && <div className="uc-field">{selected.what_failed}</div>}
                  {selected.challenges && <div className="uc-field">{selected.challenges}</div>}
                </>
              )}

              {/* Barevné kartičky */}
              {(selected.lessons_learned || selected.avoid_next_time || selected.recommendations) && (
                <div className="uc-highlights" style={selected.lessons_learned && selected.avoid_next_time && selected.recommendations ? { gridTemplateColumns: '1fr 1fr 1fr' } : undefined}>
                  {selected.lessons_learned && (
                    <div className="uc-highlight uc-highlight-green">
                      <div className="uc-highlight-icon">🟢</div>
                      <div className="uc-highlight-label">Lessons learned</div>
                      <div className="uc-highlight-text">{selected.lessons_learned}</div>
                    </div>
                  )}
                  {selected.avoid_next_time && (
                    <div className="uc-highlight uc-highlight-yellow">
                      <div className="uc-highlight-icon">⚠</div>
                      <div className="uc-highlight-label">Příště se vyvarovat</div>
                      <div className="uc-highlight-text">{selected.avoid_next_time}</div>
                    </div>
                  )}
                  {selected.recommendations && (
                    <div className="uc-highlight uc-highlight-blue">
                      <div className="uc-highlight-icon">💡</div>
                      <div className="uc-highlight-label">Doporučení pro ostatní</div>
                      <div className="uc-highlight-text">{selected.recommendations}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Hodnocení nástrojů */}
              {selected.tool_ratings && selected.tool_ratings.length > 0 && (
                <>
                  <div className="uc-section">⭐ Hodnocení nástrojů</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {selected.tool_ratings.map((tr, i) => {
                      const ratingColor = tr.rating >= 8 ? '#16a34a' : tr.rating >= 6 ? '#b45309' : '#ef4444'
                      return (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, flex: 1 }}>{tr.tool}</span>
                          <span style={{ fontWeight: 800, fontSize: 18, color: ratingColor, minWidth: 44, textAlign: 'right' }}>{tr.rating}/10</span>
                          {tr.note && <span style={{ color: 'var(--text2)', fontSize: 13, flex: 2 }}>{tr.note}</span>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Závěr */}
              {(selected.would_repeat || selected.reusable) && (
                <>
                  <div className="uc-section">🏁 Závěr</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {selected.would_repeat && (
                      <span className={`uc-badge ${selected.would_repeat === 'ano' ? 'uc-badge-yes' : selected.would_repeat === 'ne' ? 'uc-badge-no' : 'uc-badge-maybe'}`} style={{ fontSize: 13, padding: '5px 14px' }}>
                        {selected.would_repeat === 'ano' ? '✓ Zopakoval/a bych' : selected.would_repeat === 'ne' ? '✗ Nezopakoval/a bych' : '± Zopakoval/a, s úpravami'}
                      </span>
                    )}
                    {selected.reusable && (
                      <span className={`uc-badge ${selected.reusable === 'yes' ? 'uc-badge-yes' : selected.reusable === 'no' ? 'uc-badge-no' : 'uc-badge-maybe'}`} style={{ fontSize: 13, padding: '5px 14px' }}>
                        Mustr: {selected.reusable === 'yes' ? '✓ Ano' : selected.reusable === 'yes_with_changes' ? '± S úpravami' : '✗ Ne'}
                      </span>
                    )}
                  </div>
                </>
              )}

            </div>

            {/* FOOTER */}
            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 6, padding: '12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToHTML(selected)}>⬇ HTML</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToPDF(selected)}>⬇ PDF</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToWord(selected)}>⬇ Word</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(selected.id)}>Smazat</button>
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(selected)}>✏ Upravit</button>
              {selected.status === 'draft' && (
                <button className="btn btn-primary btn-sm" onClick={() => sendToReview(selected.id)}>→ Review</button>
              )}
              {selected.status === 'review' && canEdit() && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => publishProject(selected.id)}>✓ Publikovat</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => returnToDraft(selected.id)}>← Draft</button>
                </>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}

      {/* POTVRZENÍ SMAZÁNÍ */}
      {deleteConfirm && (
        <div className="modal-bg open" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Smazat projekt?</div>
              <div className="modal-subtitle">Tato akce je nevratná.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Zrušit</button>
              <button className="btn btn-danger" onClick={() => deleteProject(deleteConfirm)}>Smazat</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ProjectsPage() {
  return <Suspense><ProjectsContent /></Suspense>
}
