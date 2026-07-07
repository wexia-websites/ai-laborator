'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, type UseCase } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

const EMPTY_FORM = {
  title: '', tool_name: '', team: '', description: '',
  purpose: '', similar_tools: '', best_for_roles: '', time_saved: '', aha_moment: '',
  onboarding_score: '', ui_intuitive: '', output_quality: '', hallucinates: '',
  weaknesses: '', security_risks: '', limitations: '',
  recommended: '', rating: '', pricing: '',
  effort: '', impact: '', tags: '',
}

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

function UseCasesContent() {
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')
  const tabParam = searchParams.get('tab')
  const idParam = searchParams.get('id')

  const { role, canEdit } = useRole()
  const isViewer = role === 'viewer'
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const canEditItem = (u: UseCase) => canEdit() || (u as any).author_id === currentUserId

  const [usecases, setUsecases] = useState<UseCase[]>([])
  const [q, setQ] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'revize'>(tabParam === 'revize' ? 'revize' : 'all')
  const [viewTab, setViewTab] = useState<'published' | 'mine' | 'drafts'>('published')
  const [selected, setSelected] = useState<UseCase | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])

  const load = () => {
    supabase.from('use_cases').select('*').order('created_at', { ascending: false })
      .then(({ data }: any) => setUsecases(data ?? []))
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (idParam && usecases.length > 0 && !selected) {
      const found = usecases.find(u => u.id === idParam)
      if (found) setSelected(found)
    }
  }, [idParam, usecases]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => setCurrentUserId(user?.id ?? null))
  }, [])

  const renewRevision = async (id: string) => {
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'revision_days').single()
    const days = parseInt(setting?.value ?? '90')
    const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    await supabase.from('use_cases').update({ revision_due_at: due.toISOString(), revision_status: 'ok' }).eq('id', id)
    load()
  }

  const archiveUseCase = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'archived' }).eq('id', id)
    load()
  }

  const revisionItems = usecases.filter(u => {
    if (u.status !== 'published') return false
    const uc = u as any
    return uc.revision_status === 'due' || (uc.revision_due_at && new Date(uc.revision_due_at) <= new Date())
  })

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const openEdit = (u: UseCase) => {
    const uc = u as any
    setForm({
      title: u.title ?? '', tool_name: u.tool_name ?? '', team: u.team ?? '', description: u.description ?? '',
      purpose: uc.purpose ?? '', similar_tools: uc.similar_tools ?? '', best_for_roles: uc.best_for_roles ?? '',
      time_saved: uc.time_saved ?? '', aha_moment: uc.aha_moment ?? '',
      onboarding_score: uc.onboarding_score?.toString() ?? '', ui_intuitive: uc.ui_intuitive ?? '',
      output_quality: uc.output_quality ?? '', hallucinates: uc.hallucinates ?? '',
      weaknesses: uc.weaknesses ?? '', security_risks: uc.security_risks ?? '', limitations: uc.limitations ?? '',
      recommended: uc.recommended ?? '', rating: uc.rating?.toString() ?? '', pricing: uc.pricing ?? '',
      effort: u.effort ?? '', impact: u.impact ?? '', tags: u.tags?.join(', ') ?? '',
    })
    setEditingId(u.id)
    setSelected(null)
    setShowForm(true)
  }

  const saveManual = async () => {
    const requiredFields = [
      { key: 'title', label: 'Název use case' },
      { key: 'tool_name', label: 'Název nástroje' },
      { key: 'description', label: 'Popis' },
      { key: 'rating', label: 'Rating' },
      { key: 'recommended', label: 'Doporučeno' },
    ]
    const errors = requiredFields.filter(f => !form[f.key as keyof typeof EMPTY_FORM]?.trim()).map(f => f.label)
    if (errors.length > 0) { setFormErrors(errors); return }
    setFormErrors([])
    setSaving(true)
    const payload = {
      title: form.title, tool_name: form.tool_name || null, team: form.team || null,
      description: form.description || null, purpose: form.purpose || null,
      similar_tools: form.similar_tools || null, best_for_roles: form.best_for_roles || null,
      time_saved: form.time_saved || null, aha_moment: form.aha_moment || null,
      onboarding_score: form.onboarding_score ? Number(form.onboarding_score) : null,
      ui_intuitive: form.ui_intuitive || null, output_quality: form.output_quality || null,
      hallucinates: form.hallucinates || null, weaknesses: form.weaknesses || null,
      security_risks: form.security_risks || null, limitations: form.limitations || null,
      recommended: form.recommended || null, rating: form.rating ? Number(form.rating) : null,
      pricing: form.pricing || null, effort: form.effort || null, impact: form.impact || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }
    if (editingId) {
      const uc = usecases.find(u => u.id === editingId)
      if (uc && !canEditItem(uc)) { alert('Nemáš oprávnění upravovat tento use case.'); setSaving(false); return }
      const { error } = await supabase.from('use_cases').update(payload).eq('id', editingId)
      if (error) { console.error(error); alert('Chyba při ukládání: ' + error.message); setSaving(false); return }
      setUsecases(prev => prev.map(u => u.id === editingId ? { ...u, ...payload } as UseCase : u))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('use_cases').insert({ ...payload, author_id: user?.id, author_name: user?.email?.split('@')[0], status: 'draft' })
      if (error) { console.error(error); alert('Chyba při ukládání: ' + error.message); setSaving(false); return }
      load()
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const deleteUseCase = async (id: string) => {
    const uc = usecases.find(u => u.id === id)
    if (uc && !canEditItem(uc)) { alert('Nemáš oprávnění mazat tento use case.'); return }
    const { error } = await supabase.from('use_cases').delete().eq('id', id)
    if (error) { console.error(error); alert('Chyba při mazání: ' + error.message); return }
    setUsecases(prev => prev.filter(u => u.id !== id))
    setDeleteConfirm(null)
    setSelected(null)
  }

  const sendToReview = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'review' }).eq('id', id)
    setUsecases(prev => prev.map(u => u.id === id ? { ...u, status: 'review' } : u))
    setSelected(null)
  }

  const generateHTML = (u: UseCase) => {
    const uc = u as any
    const row = (label: string, val?: string | number | null) => val ? `<h2>${label}</h2><p>${String(val).replace(/\n/g, '<br>')}</p>` : ''
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${u.title}</title><style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1916;}
      h1{color:#e02020;border-bottom:2px solid #e02020;padding-bottom:10px;}
      h2{color:#333;margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
      p{line-height:1.6;color:#555;margin:0 0 8px;}
      .meta{color:#888;font-size:13px;margin-bottom:24px;}
      .tag{display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:10px;font-size:12px;margin:2px;}
      .score{font-size:28px;font-weight:bold;color:#e02020;}
      @media print{body{margin:20px;}}
    </style></head><body>
      <h1>${u.title}</h1>
      <div class="meta">
        ${u.tool_name ? `<strong>Nástroj:</strong> ${u.tool_name} &nbsp;` : ''}
        ${u.team ? `<strong>Tým:</strong> ${u.team} &nbsp;` : ''}
        ${u.author_name ? `<strong>Autor:</strong> ${u.author_name} &nbsp;` : ''}
        <strong>Status:</strong> ${u.status} &nbsp;
        <strong>Datum:</strong> ${new Date(u.created_at).toLocaleDateString('cs-CZ')}
      </div>
      ${u.description ? `<p><em>${u.description}</em></p>` : ''}
      ${row('Účel nástroje', uc.purpose)}
      ${row('Podobné nástroje', uc.similar_tools)}
      ${row('Cena', uc.pricing)}
      ${row('Nejlepší pro', uc.best_for_roles)}
      ${row('Úspora času', uc.time_saved)}
      ${row('Aha! moment', uc.aha_moment)}
      ${uc.onboarding_score || uc.ui_intuitive ? `<h2>Uživatelská přívětivost</h2><p>${uc.onboarding_score ? `Onboarding: ${uc.onboarding_score}/5 &nbsp;` : ''}${uc.ui_intuitive ? `UI: ${uc.ui_intuitive}` : ''}</p>` : ''}
      ${row('Kvalita výstupů', uc.output_quality)}
      ${uc.hallucinates ? `<h2>Halucinace</h2><p>${uc.hallucinates}</p>` : ''}
      ${row('Slabiny', uc.weaknesses)}
      ${row('Bezpečnostní rizika', uc.security_risks)}
      ${row('Limity nástroje', uc.limitations)}
      <h2>Finální verdikt</h2>
      <p>
        ${uc.recommended ? `<span class="tag">Doporučení: ${uc.recommended}</span> ` : ''}
        ${uc.rating ? `<span class="score">${uc.rating}/10</span> ` : ''}
        ${u.effort ? `<span class="tag">Náročnost: ${u.effort}</span> ` : ''}
        ${u.impact ? `<span class="tag">Dopad: ${u.impact}</span> ` : ''}
        ${u.confidence_score > 0 ? `<span class="tag">Confidence: ${u.confidence_score}%</span>` : ''}
      </p>
      ${u.tags?.length ? `<p>${u.tags.map(t => `<span class="tag">${t}</span>`).join(' ')}</p>` : ''}
    </body></html>`
  }

  const exportToHTML = (u: UseCase) => {
    const blob = new Blob([generateHTML(u)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${u.title.replace(/[^a-z0-9]/gi, '_')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToPDF = (u: UseCase) => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
    iframe.contentDocument!.write(generateHTML(u))
    iframe.contentDocument!.close()
    iframe.contentWindow!.focus()
    iframe.contentWindow!.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }

  const exportToWord = (u: UseCase) => {
    const uc = u as any
    const row = (label: string, val?: string | number | null) => val ? `<h2>${label}</h2><p>${String(val).replace(/\n/g, '<br>')}</p>` : ''
    const content = `
      <h1>${u.title}</h1>
      <p class="meta">
        ${u.tool_name ? `<strong>Nástroj:</strong> ${u.tool_name} &nbsp;` : ''}
        ${u.team ? `<strong>Tým:</strong> ${u.team} &nbsp;` : ''}
        ${u.author_name ? `<strong>Autor:</strong> ${u.author_name} &nbsp;` : ''}
        <strong>Status:</strong> ${u.status} &nbsp;
        <strong>Datum:</strong> ${new Date(u.created_at).toLocaleDateString('cs-CZ')}
      </p>
      ${u.description ? `<p><em>${u.description}</em></p>` : ''}
      ${row('Účel nástroje', uc.purpose)}
      ${row('Podobné nástroje', uc.similar_tools)}
      ${row('Cena', uc.pricing)}
      ${row('Nejlepší pro', uc.best_for_roles)}
      ${row('Úspora času', uc.time_saved)}
      ${row('Aha! moment', uc.aha_moment)}
      ${row('Kvalita výstupů', uc.output_quality)}
      ${row('Slabiny', uc.weaknesses)}
      ${row('Bezpečnostní rizika', uc.security_risks)}
      ${row('Limity nástroje', uc.limitations)}
      <h2>Finální verdikt</h2>
      <p>
        ${uc.recommended ? `Doporučení: ${uc.recommended} ` : ''}
        ${uc.rating ? `Hodnocení: ${uc.rating}/10 ` : ''}
        ${u.effort ? `Náročnost: ${u.effort} ` : ''}
        ${u.impact ? `Dopad: ${u.impact}` : ''}
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
    a.download = `${u.title.replace(/[^a-z0-9]/gi, '_')}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  const STATUS_LABELS: Record<string, string> = {
    draft: 'Rozpracovaný', review: 'Ke kontrole', published: 'Publikovaný',
    archived: 'Archivovaný', claimed: 'Převzato', in_progress: 'Rozpracováváno',
    completed: 'Dokončeno', new: 'Nový'
  }

  const publishedItems = usecases.filter(u => u.status === 'published')
  const myItems = usecases.filter(u => (u as any).author_id === currentUserId)
  const draftItems = usecases.filter(u => ['draft', 'review'].includes(u.status ?? '') && (u as any).author_id === currentUserId)

  const viewItems = viewTab === 'published' ? publishedItems : viewTab === 'mine' ? myItems : draftItems

  const filtered = viewItems.filter(u => {
    if (filterParam === 'published' && u.status !== 'published') return false
    const ql = q.toLowerCase()
    return !q || u.title?.toLowerCase().includes(ql) ||
      u.tool_name?.toLowerCase().includes(ql) ||
      u.team?.toLowerCase().includes(ql) ||
      u.description?.toLowerCase().includes(ql) ||
      u.author_name?.toLowerCase().includes(ql) ||
      u.tags?.some(t => t.toLowerCase().includes(ql))
  })

  const statusTag: Record<string, string> = {
    draft: '', review: 'tag-amber', published: 'tag-green', archived: ''
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Use casy</h1>
          <p>{filterParam === 'published' ? 'Publikované use casy.' : 'Knihovna use casů. Drafty pošli do review a publikuj.'}</p>
        </div>
        <div className="page-actions">
          {filterParam === 'published' && (
            <a href="/app/usecases" className="btn btn-ghost btn-sm">← Vše</a>
          )}
          {!isViewer && (
            <>
              <button className="btn btn-outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true) }}>+ Vyplnit ručně</button>
              <button className="btn btn-primary" onClick={() => window.location.href = '/app/chat?start=usecase'}>+ Nový use case</button>
            </>
          )}
        </div>
      </div>
      <div className="tabs-row">
        <button className={`tab-btn${viewTab === 'published' ? ' active' : ''}`} onClick={() => setViewTab('published')}>
          Všechny publikované <span className="tab-count">{publishedItems.length}</span>
        </button>
        <button className={`tab-btn${viewTab === 'mine' ? ' active' : ''}`} onClick={() => setViewTab('mine')}>
          Moje <span className="tab-count">{myItems.length}</span>
        </button>
        <button className={`tab-btn${viewTab === 'drafts' ? ' active' : ''}`} onClick={() => setViewTab('drafts')}>
          Rozpracované <span className="tab-count">{draftItems.length}</span>
        </button>
      </div>

      <div className="page-body">
        <div className="revision-tabs">
          <button
            className={`revision-tab${activeTab === 'all' ? ' active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Všechny
          </button>
          <button
            className={`revision-tab${activeTab === 'revize' ? ' active' : ''}`}
            onClick={() => setActiveTab('revize')}
          >
            Revize {revisionItems.length > 0 && <span className="revision-badge">{revisionItems.length}</span>}
          </button>
        </div>

        {activeTab === 'revize' ? (
          <>
            {revisionItems.length === 0
              ? <div className="empty"><span className="empty-icon">✅</span>Žádné use casy nečekají na revizi.</div>
              : revisionItems.map(u => {
                  const uc = u as any
                  const dueDate = uc.revision_due_at ? new Date(uc.revision_due_at) : null
                  const daysOverdue = dueDate ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
                  return (
                    <div key={u.id} className="revision-item">
                      <div style={{ flex: 1 }}>
                        <div className="revision-title">{u.title}</div>
                        <div className="revision-meta">
                          {u.tool_name && <>{u.tool_name} · </>}
                          {u.team && <>{u.team} · </>}
                          autor: {u.author_name}
                        </div>
                        <div className="revision-dates">
                          {uc.published_at && (
                            <span>Publikováno: {new Date(uc.published_at).toLocaleDateString('cs-CZ')}</span>
                          )}
                          {dueDate && (
                            <span className="revision-overdue">
                              Revize: {dueDate.toLocaleDateString('cs-CZ')}
                              {daysOverdue > 0 && ` · ${daysOverdue} dní po termínu`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="revision-actions">
                        <button className="btn btn-accent btn-sm" onClick={() => renewRevision(u.id)}>✅ Stále aktuální</button>
                        {canEditItem(u) && <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>✏️ Upravit</button>}
                        {canEditItem(u) && <button className="btn btn-ghost btn-sm" onClick={() => archiveUseCase(u.id)}>🗄️ Archivovat</button>}
                      </div>
                    </div>
                  )
                })
            }
          </>
        ) : (
        <>
        <input className="search-box" placeholder="Hledat use casy…" value={q} onChange={e => setQ(e.target.value)} />
        {filtered.length === 0
          ? <div className="empty"><span className="empty-icon">📋</span>Žádné use casy. Vytvoř první v Chatu.</div>
          : filtered.map(u => {
              const uc = u as any
              const rating = uc.rating as number | null
              const ratingClass = !rating ? '' : rating >= 8 ? 'uc-rating-high' : rating >= 6 ? 'uc-rating-mid' : 'uc-rating-low'
              const effortBadge = u.effort === 'low' ? 'uc-badge-effort-low' : u.effort === 'medium' ? 'uc-badge-effort-med' : u.effort === 'high' ? 'uc-badge-effort-high' : ''
              const effortLabel = u.effort === 'low' ? 'Nízká náročnost' : u.effort === 'medium' ? 'Střední náročnost' : u.effort === 'high' ? 'Vysoká náročnost' : ''
              const recBadge = uc.recommended === 'ano' ? 'uc-badge-yes' : uc.recommended === 'ne' ? 'uc-badge-no' : uc.recommended === 'možná' ? 'uc-badge-maybe' : ''
              const recLabel = uc.recommended === 'ano' ? '✓ Doporučeno' : uc.recommended === 'ne' ? '✗ Nedoporučeno' : uc.recommended === 'možná' ? '? Možná' : ''
              return (
                <div key={u.id} className="uc-card" onClick={() => setSelected(u)}>
                  <div className="uc-card-top">
                    {u.status !== 'published' && (
                      <span className="uc-badge uc-badge-status">{STATUS_LABELS[u.status] ?? u.status}</span>
                    )}
                    {uc.category && <span className="uc-badge uc-badge-cat">{uc.category}</span>}
                    {recBadge && <span className={`uc-badge ${recBadge}`}>{recLabel}</span>}
                    {effortBadge && <span className={`uc-badge ${effortBadge}`}>{effortLabel}</span>}
                    {rating && (
                      <span className={`uc-card-rating ${ratingClass}`}>⭐ {rating}/10</span>
                    )}
                  </div>
                  <div className="uc-card-title">{u.title}</div>
                  <div className="uc-card-meta">
                    {u.tool_name && <strong>{u.tool_name}</strong>}
                    {u.tool_name && (u.author_name || u.created_at) && ' · '}
                    {u.author_name && <>{u.author_name}</>}
                    {u.created_at && <> · {new Date(u.created_at).toLocaleDateString('cs-CZ')}</>}
                  </div>
                  {u.description && <div className="uc-card-desc">{u.description}</div>}
                  <div className="uc-card-footer">
                    <div className="uc-card-tags">
                      {u.tags?.slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSelected(u) }}>Detail →</button>
                    {!isViewer && u.status === 'draft' && (
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); sendToReview(u.id) }}>→ Review</button>
                    )}
                  </div>
                </div>
              )
            })
        }
        </>
        )}
      </div>

      {/* FORMULÁŘ (nový i editace) */}
      {showForm && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 620 }}>
            <button className="modal-close" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setFormErrors([]) }}>×</button>
            <div className="modal-header"><div className="modal-title">{editingId ? 'Upravit use case' : 'Vyplnit use case ručně'}</div></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Název use case <span style={{color:'#e02020'}}>*</span></label>
                <input className="form-input" value={form.title} onChange={f('title')} placeholder="Krátký výstižný název" />
              </div>
              <div className="form-group">
                <label className="form-label">Název nástroje <span style={{color:'#e02020'}}>*</span></label>
                <input className="form-input" value={form.tool_name} onChange={f('tool_name')} placeholder="např. Notion AI" />
              </div>
              <div className="form-group">
                <label className="form-label">Tým / Oddělení</label>
                <input className="form-input" value={form.team} onChange={f('team')} placeholder="např. Marketing" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Popis (1–2 věty) <span style={{color:'#e02020'}}>*</span></label>
                <textarea className="form-textarea" rows={2} value={form.description} onChange={f('description')} placeholder="Stručný popis use case" />
              </div>
            </div>

            <Section title="Základní přehled" />
            <div className="form-group">
              <label className="form-label">Účel nástroje</label>
              <textarea className="form-textarea" rows={2} value={form.purpose} onChange={f('purpose')} placeholder="Co nástroj umí a k čemu slouží?" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Podobné nástroje</label>
                <input className="form-input" value={form.similar_tools} onChange={f('similar_tools')} placeholder="Alternativy na trhu" />
              </div>
              <div className="form-group">
                <label className="form-label">Cena (pricing)</label>
                <input className="form-input" value={form.pricing} onChange={f('pricing')} placeholder="free / freemium / placené…" />
              </div>
            </div>

            <Section title="Přínos pro byznys" />
            <div className="form-group">
              <label className="form-label">Pro která oddělení / role</label>
              <input className="form-input" value={form.best_for_roles} onChange={f('best_for_roles')} placeholder="Marketing, HR, IT…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Úspora času</label>
                <input className="form-input" value={form.time_saved} onChange={f('time_saved')} placeholder="např. 2 hod/týden" />
              </div>
              <div className="form-group">
                <label className="form-label">Aha! moment</label>
                <input className="form-input" value={form.aha_moment} onChange={f('aha_moment')} placeholder="Kdy nástroj překvapil?" />
              </div>
            </div>

            <Section title="Uživatelská přívětivost" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Onboarding (1–5)</label>
                <select className="form-select" value={form.onboarding_score} onChange={f('onboarding_score')}>
                  <option value="">—</option>
                  <option value="1">1 – velmi složitý</option>
                  <option value="2">2</option>
                  <option value="3">3 – střední</option>
                  <option value="4">4</option>
                  <option value="5">5 – ihned použitelný</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">UI intuitivní?</label>
                <select className="form-select" value={form.ui_intuitive} onChange={f('ui_intuitive')}>
                  <option value="">—</option>
                  <option value="ano">Ano</option>
                  <option value="částečně">Částečně</option>
                  <option value="ne">Ne</option>
                </select>
              </div>
            </div>

            <Section title="Výkon AI" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Kvalita výstupů</label>
                <textarea className="form-textarea" rows={2} value={form.output_quality} onChange={f('output_quality')} placeholder="Jsou výstupy použitelné rovnou?" />
              </div>
              <div className="form-group">
                <label className="form-label">Halucinace?</label>
                <select className="form-select" value={form.hallucinates} onChange={f('hallucinates')}>
                  <option value="">—</option>
                  <option value="ne">Ne</option>
                  <option value="občas">Občas</option>
                  <option value="ano">Ano</option>
                </select>
              </div>
            </div>

            <Section title="Rizika" />
            <div className="form-group">
              <label className="form-label">Slabiny</label>
              <textarea className="form-textarea" rows={2} value={form.weaknesses} onChange={f('weaknesses')} placeholder="Kde nástroj selhává?" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Bezpečnostní rizika</label>
                <textarea className="form-textarea" rows={2} value={form.security_risks} onChange={f('security_risks')} placeholder="Jak nakládá s daty?" />
              </div>
              <div className="form-group">
                <label className="form-label">Limity nástroje</label>
                <textarea className="form-textarea" rows={2} value={form.limitations} onChange={f('limitations')} placeholder="Co neumí nebo odmítá?" />
              </div>
            </div>

            <Section title="Finální verdikt" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Doporučeno <span style={{color:'#e02020'}}>*</span></label>
                <select className="form-select" value={form.recommended} onChange={f('recommended')}>
                  <option value="">—</option>
                  <option value="ano">Ano</option>
                  <option value="možná">Možná</option>
                  <option value="ne">Ne</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rating (1–10) <span style={{color:'#e02020'}}>*</span></label>
                <select className="form-select" value={form.rating} onChange={f('rating')}>
                  <option value="">—</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Náročnost</label>
                <select className="form-select" value={form.effort} onChange={f('effort')}>
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dopad</label>
                <select className="form-select" value={form.impact} onChange={f('impact')}>
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Tagy (čárkou)</label>
              <input className="form-input" value={form.tags} onChange={f('tags')} placeholder="ai, hr, automatizace…" />
            </div>

            {formErrors.length > 0 && (
              <div style={{ background: 'rgba(224,32,32,0.1)', border: '1px solid rgba(224,32,32,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#e02020', fontWeight: 600, marginBottom: 4 }}>Vyplň povinná pole:</div>
                {formErrors.map(e => <div key={e} style={{ fontSize: 12, color: '#e02020' }}>• {e}</div>)}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setFormErrors([]) }}>Zrušit</button>
              <button className="btn btn-primary" onClick={saveManual} disabled={saving}>
                {saving ? 'Ukládám…' : editingId ? 'Uložit změny' : 'Uložit jako draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal modal-detail" style={{ width: '90vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>

            {/* Hlavička */}
            <div className="uc-modal-header">
              {(() => {
                const s = selected as any
                const rating = s.rating as number | null
                const ratingClass = !rating ? '' : rating >= 8 ? 'uc-rating-high' : rating >= 6 ? 'uc-rating-mid' : 'uc-rating-low'
                const recBadge = s.recommended === 'ano' ? 'uc-badge-yes' : s.recommended === 'ne' ? 'uc-badge-no' : s.recommended === 'možná' ? 'uc-badge-maybe' : ''
                const recLabel = s.recommended === 'ano' ? '✓ Doporučeno' : s.recommended === 'ne' ? '✗ Nedoporučeno' : s.recommended === 'možná' ? '? Možná' : ''
                const effortBadge = selected.effort === 'low' ? 'uc-badge-effort-low' : selected.effort === 'medium' ? 'uc-badge-effort-med' : selected.effort === 'high' ? 'uc-badge-effort-high' : ''
                const effortLabel = selected.effort === 'low' ? 'Nízká náročnost' : selected.effort === 'medium' ? 'Střední náročnost' : selected.effort === 'high' ? 'Vysoká náročnost' : ''
                return (
                  <>
                    <div className="uc-modal-badges">
                      {s.category && <span className={`uc-badge uc-badge-cat`}>{s.category}</span>}
                      {recBadge && <span className={`uc-badge ${recBadge}`}>{recLabel}</span>}
                      {effortBadge && <span className={`uc-badge ${effortBadge}`}>{effortLabel}</span>}
                      {rating && <span className={`uc-modal-rating ${ratingClass}`}>⭐ {rating}/10</span>}
                    </div>
                    <div className="uc-modal-title">{selected.title}</div>
                    <div className="uc-modal-subtitle">
                      {selected.tool_name && <span>🔧 {selected.tool_name}</span>}
                      {selected.author_name && <span>👤 {selected.author_name}</span>}
                      {selected.created_at && <span>📅 {new Date(selected.created_at).toLocaleDateString('cs-CZ')}</span>}
                    </div>
                    {selected.description && <div className="uc-modal-desc">{selected.description}</div>}
                  </>
                )
              })()}
            </div>

            {/* Scrollovatelný obsah */}
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 24px' }}>
              {(() => {
                const s = selected as any
                return (
                  <>
                    {/* Metriky */}
                    <div className="uc-metrics">
                      <div className="uc-metric">
                        <div className="uc-metric-label">Náročnost</div>
                        <div className="uc-metric-value">
                          {selected.effort === 'low' ? '🟢 Nízká' : selected.effort === 'medium' ? '🟡 Střední' : selected.effort === 'high' ? '🔴 Vysoká' : '—'}
                        </div>
                      </div>
                      <div className="uc-metric">
                        <div className="uc-metric-label">Dopad</div>
                        <div className="uc-metric-value">
                          {selected.impact === 'low' ? '↘ Nízký' : selected.impact === 'medium' ? '→ Střední' : selected.impact === 'high' ? '↗ Vysoký' : '—'}
                        </div>
                      </div>
                      <div className="uc-metric">
                        <div className="uc-metric-label">Confidence</div>
                        <div className="uc-metric-value">{selected.confidence_score > 0 ? `${selected.confidence_score} %` : '—'}</div>
                      </div>
                    </div>

                    {/* Účel + Pro koho + Podobné + Cena */}
                    {s.purpose && (
                      <>
                        <div className="uc-section">🎯 Účel nástroje</div>
                        <div className="uc-field">{s.purpose}</div>
                      </>
                    )}
                    {s.best_for_roles && (
                      <>
                        <div className="uc-section">👥 Nejlepší pro</div>
                        <div className="uc-field">{s.best_for_roles}</div>
                      </>
                    )}
                    {s.similar_tools && (
                      <>
                        <div className="uc-section">🔄 Podobné nástroje</div>
                        <div className="uc-field">{s.similar_tools}</div>
                      </>
                    )}
                    {s.pricing && (
                      <>
                        <div className="uc-section">💰 Cena</div>
                        <div className="uc-field">{s.pricing}</div>
                      </>
                    )}

                    {/* Zvýrazněné kartičky: Úspora času + Aha moment */}
                    {(s.time_saved || s.aha_moment) && (
                      <div className="uc-highlights">
                        {s.time_saved && (
                          <div className="uc-highlight uc-highlight-green">
                            <div className="uc-highlight-icon">⏱</div>
                            <div className="uc-highlight-label">Úspora času</div>
                            <div className="uc-highlight-text">{s.time_saved}</div>
                          </div>
                        )}
                        {s.aha_moment && (
                          <div className="uc-highlight uc-highlight-blue">
                            <div className="uc-highlight-icon">✨</div>
                            <div className="uc-highlight-label">Aha! moment</div>
                            <div className="uc-highlight-text">{s.aha_moment}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Onboarding + UI */}
                    {(s.onboarding_score || s.ui_intuitive) && (
                      <>
                        <div className="uc-section">⭐ Onboarding · UI</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                          {s.onboarding_score && (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Onboarding {s.onboarding_score}/5</div>
                              <div className="uc-onboarding-dots">
                                {[1,2,3,4,5].map(i => (
                                  <div key={i} className={`uc-onboarding-dot ${i <= s.onboarding_score ? 'uc-onboarding-dot-filled' : 'uc-onboarding-dot-empty'}`} />
                                ))}
                              </div>
                            </div>
                          )}
                          {s.ui_intuitive && (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>UI intuitivní</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{s.ui_intuitive}</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Výkon AI */}
                    {(s.output_quality || s.hallucinates) && (
                      <>
                        <div className="uc-section">🤖 Výkon AI</div>
                        {s.output_quality && <div className="uc-field">{s.output_quality}</div>}
                        {s.hallucinates && (
                          <div style={{ marginBottom: 14 }}>
                            <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 8 }}>Halucinace:</span>
                            <span className={`uc-halluc-badge ${s.hallucinates === 'ne' ? 'uc-halluc-no' : s.hallucinates === 'ano' ? 'uc-halluc-yes' : 'uc-halluc-sometimes'}`}>
                              {s.hallucinates === 'ne' ? '✓ Nehalucinuje' : s.hallucinates === 'ano' ? '✗ Halucinuje' : '⚠ Občas'}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Varování kartičky: Slabiny + Bezpečnost */}
                    {(s.weaknesses || s.security_risks) && (
                      <div className="uc-highlights">
                        {s.weaknesses && (
                          <div className="uc-highlight uc-highlight-yellow">
                            <div className="uc-highlight-icon">⚠</div>
                            <div className="uc-highlight-label">Slabiny</div>
                            <div className="uc-highlight-text">{s.weaknesses}</div>
                          </div>
                        )}
                        {s.security_risks && (
                          <div className="uc-highlight uc-highlight-red">
                            <div className="uc-highlight-icon">🔒</div>
                            <div className="uc-highlight-label">Bezpečnostní rizika</div>
                            <div className="uc-highlight-text">{s.security_risks}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Limitace */}
                    {s.limitations && (
                      <>
                        <div className="uc-section">🚧 Limitace</div>
                        <div className="uc-field">{s.limitations}</div>
                      </>
                    )}

                    {/* Tagy */}
                    {selected.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                        {selected.tags.map(t => <span key={t} className="tag">{t}</span>)}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Sticky patička */}
            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 6, padding: '12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToHTML(selected)}>⬇ HTML</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToPDF(selected)}>⬇ PDF</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToWord(selected)}>⬇ Word</button>
              <div style={{ flex: 1 }} />
              {canEditItem(selected) && (
                <>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(selected.id)}>Smazat</button>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(selected)}>✏ Upravit</button>
                  {selected.status === 'draft' && (
                    <button className="btn btn-primary btn-sm" onClick={() => sendToReview(selected.id)}>→ Review</button>
                  )}
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
              <div className="modal-title">Smazat use case?</div>
              <div className="modal-subtitle">Tato akce je nevratná.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Zrušit</button>
              <button className="btn btn-danger" onClick={() => deleteUseCase(deleteConfirm)}>Smazat</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function UseCasesPage() {
  return <Suspense><UseCasesContent /></Suspense>
}
