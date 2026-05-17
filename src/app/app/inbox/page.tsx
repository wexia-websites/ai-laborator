'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Tool, type ToolAudit, type ToolAuditStatus } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'
import type { AiWatchItem } from '@/lib/ai-watch/types'
import { mergeAiWatchToolsIntoInbox } from '@/lib/ai-watch/inboxTools'

type AuditDraft = Partial<ToolAudit>

const AUDIT_FIELDS: Array<{
  key: keyof ToolAudit
  label: string
  type: 'text' | 'textarea' | 'number'
  hint?: string
}> = [
  { key: 'purpose',          label: 'K čemu se nástroj hodí',         type: 'textarea', hint: 'Stručně, na co je primárně určený.' },
  { key: 'best_for_roles',   label: 'Pro koho je vhodný',             type: 'text',     hint: 'Role / pozice ve firmě.' },
  { key: 'output_quality',   label: 'Kvalita výstupu',                type: 'textarea', hint: 'Subjektivní hodnocení toho, co produkuje.' },
  { key: 'hallucinates',     label: 'Halucinuje?',                    type: 'textarea', hint: 'Při čem si vymýšlí. Konkrétní příklady pomáhají.' },
  { key: 'weaknesses',       label: 'Slabiny',                        type: 'textarea' },
  { key: 'security_risks',   label: 'Bezpečnostní rizika',            type: 'textarea', hint: 'Data, ze kterých se může učit. Compliance.' },
  { key: 'limitations',      label: 'Limity / omezení',               type: 'textarea' },
  { key: 'ui_intuitive',     label: 'Intuitivnost UI',                type: 'textarea' },
  { key: 'onboarding_score', label: 'Onboarding score (1–10)',        type: 'number',   hint: 'Jak rychle se v tom orientuje nováček.' },
  { key: 'time_saved',       label: 'Ušetří kolik času',              type: 'text',     hint: 'Např. „15 min/úkol", „2 h/týden".' },
  { key: 'aha_moment',       label: 'Aha moment',                     type: 'textarea', hint: 'V čem tě překvapilo pozitivně.' },
  { key: 'pricing',          label: 'Cena / licence',                 type: 'text' },
  { key: 'recommended',      label: 'Doporučuješ?',                   type: 'text',     hint: 'Ano / Ne / Podmíněně — odůvodnit.' },
  { key: 'rating',           label: 'Celkové hodnocení (1–10)',       type: 'number' },
  { key: 'notes',            label: 'Souhrn / poznámky pro Wexia',    type: 'textarea', hint: 'Krátké tl;dr pro verifikaci.' },
]

const STATUS_LABEL: Record<ToolAuditStatus, string> = {
  draft:           'rozpracováno',
  pending_review:  'čeká na verifikaci',
  needs_revision:  'vráceno k úpravě',
  approved:        'schváleno',
  rejected:        'zamítnuto',
}

const STATUS_COLOR: Record<ToolAuditStatus, string> = {
  draft:           'tag-violet',
  pending_review:  'tag-amber',
  needs_revision:  'tag-amber',
  approved:        'tag-green',
  rejected:        '',
}

export default function InboxPage() {
  const router = useRouter()
  const { role, canAccess, loading: roleLoading } = useRole()

  useEffect(() => {
    if (!roleLoading && !canAccess('inbox')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [tools, setTools] = useState<Tool[]>([])
  const [auditsByTool, setAuditsByTool] = useState<Record<string, ToolAudit>>({})
  const [me, setMe] = useState<{ id: string; name: string | null } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [auditModal, setAuditModal] = useState<{ tool: Tool; audit: AuditDraft } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deduplicating, setDeduplicating] = useState(false)
  const [aiNewsRunning, setAiNewsRunning] = useState(false)
  const [aiNewsCount, setAiNewsCount] = useState(0)
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ name: '', vendor: '', website_url: '', description: '', category: '', tags: '' })

  const fetchAiWatchItems = async (): Promise<AiWatchItem[]> => {
    try {
      const response = await fetch('/api/ai-watch/feed', { cache: 'no-store' })
      if (!response.ok) return []
      const payload = await response.json()
      return Array.isArray(payload.items) ? payload.items : []
    } catch (e) {
      console.error('AI Watch feed failed', e)
      return []
    }
  }

  const fetchTools = async () => {
    const { data } = await supabase.from('tools').select('*').order('created_at', { ascending: false })
    const allTools = (data ?? []) as Tool[]
    const newTools = allTools.filter(t => t.status === 'new')
    const aiWatchItems = await fetchAiWatchItems()
    const aiWatchTools = mergeAiWatchToolsIntoInbox(allTools, aiWatchItems)
    setAiNewsCount(aiWatchTools.length)
    // Pro inbox zobrazujeme: new + claimed + (any in_progress legacy). Verify a tested necháváme jiným tabům.
    const inboxTools = allTools.filter(t => t.status === 'new' || t.status === 'claimed' || t.status === 'in_progress')
    setTools([...aiWatchTools, ...inboxTools.filter(t => t.status !== 'new')]) // claimed cards first, then ai-watch suggestions, then new
    // Order: claimed by me first → claimed by others → new → ai-watch suggestions. Apply sort:
    const ordered = [
      ...inboxTools.filter(t => t.status === 'claimed' && t.claimed_by === me?.id),
      ...inboxTools.filter(t => t.status === 'in_progress' && t.claimed_by === me?.id),
      ...inboxTools.filter(t => t.status === 'claimed' && t.claimed_by !== me?.id),
      ...newTools,
      ...aiWatchTools,
    ]
    setTools(ordered)

    // Načti audity pro všechny claimed tools v jednom dotazu
    const claimedIds = inboxTools.filter(t => t.claimed_by).map(t => t.id)
    if (claimedIds.length > 0) {
      const { data: auditData } = await supabase
        .from('tool_audits')
        .select('*')
        .in('tool_id', claimedIds)
        .in('status', ['draft', 'pending_review', 'needs_revision'])
      const map: Record<string, ToolAudit> = {}
      for (const a of (auditData ?? []) as ToolAudit[]) {
        map[a.tool_id] = a
      }
      setAuditsByTool(map)
    } else {
      setAuditsByTool({})
    }
  }

  const loadMeAndTools = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('full_name, first_name, last_name').eq('id', user.id).single()
    const name = profile?.full_name ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ?? null
    setMe({ id: user.id, name: name || null })
  }

  useEffect(() => {
    loadMeAndTools()
  }, [])

  useEffect(() => {
    if (me) fetchTools()
  }, [me]) // eslint-disable-line react-hooks/exhaustive-deps

  // A not-yet-persisted AI Watch *suggestion* has an id like "ai-watch-aiw_xxx".
  // A real tools-table row (even one that originally came from AI Watch) has a UUID id.
  const isAiWatchSuggestion = (t: Tool) => String(t.id).startsWith('ai-watch-')

  const claim = async (tool: Tool) => {
    if (!me) return
    const claimedFields = { status: 'claimed', claimed_by: me.id, claimed_at: new Date().toISOString() }
    let toolId = tool.id

    if (isAiWatchSuggestion(tool)) {
      // AI Watch suggestion → vytvořit row v tools nejdřív
      const { data: inserted, error } = await supabase.from('tools').insert({
        name: tool.name, vendor: tool.vendor, website_url: tool.website_url, description: tool.description,
        category: tool.category, tags: tool.tags, source: 'ai_watch',
        legit_score: tool.legit_score, fit_score: tool.fit_score, novelty_score: tool.novelty_score,
        ...claimedFields,
      }).select('id').single()
      if (error || !inserted) { alert('Claim selhal: ' + (error?.message ?? 'nelze vložit nástroj')); return }
      toolId = inserted.id as string
    } else {
      await supabase.from('tools').update(claimedFields).eq('id', tool.id)
    }

    // Vytvoř draft audit (RLS vyžaduje author_id=auth.uid())
    const { error: auditErr } = await supabase.from('tool_audits').insert({
      tool_id: toolId,
      author_id: me.id,
      author_name: me.name,
      status: 'draft',
    })
    if (auditErr) console.error('Audit draft create failed:', auditErr)

    fetchTools()
  }

  const unclaim = async (tool: Tool) => {
    const audit = auditsByTool[tool.id]
    if (audit && audit.status !== 'draft') {
      alert('Nelze unclaimnout — audit už je odeslán k verifikaci.')
      return
    }
    if (audit) await supabase.from('tool_audits').delete().eq('id', audit.id)
    await supabase.from('tools').update({ status: 'new', claimed_by: null, claimed_at: null }).eq('id', tool.id)
    fetchTools()
  }

  const openAudit = (tool: Tool) => {
    const existing = auditsByTool[tool.id]
    setAuditModal({ tool, audit: existing ? { ...existing } : { tool_id: tool.id } })
  }

  const updateAuditField = (key: keyof ToolAudit, value: string) => {
    if (!auditModal) return
    let parsed: unknown = value
    if (key === 'onboarding_score' || key === 'rating') {
      const n = value === '' ? null : Number(value)
      parsed = Number.isFinite(n as number) ? n : null
    }
    setAuditModal({ ...auditModal, audit: { ...auditModal.audit, [key]: parsed } })
  }

  const saveAudit = async (submit: boolean) => {
    if (!auditModal || !me) return
    setSubmitting(true)
    try {
      const existing = auditsByTool[auditModal.tool.id]
      const payload: Record<string, unknown> = {
        tool_id: auditModal.tool.id,
        author_id: me.id,
        author_name: me.name,
        purpose:          auditModal.audit.purpose ?? null,
        best_for_roles:   auditModal.audit.best_for_roles ?? null,
        output_quality:   auditModal.audit.output_quality ?? null,
        hallucinates:     auditModal.audit.hallucinates ?? null,
        weaknesses:       auditModal.audit.weaknesses ?? null,
        security_risks:   auditModal.audit.security_risks ?? null,
        limitations:      auditModal.audit.limitations ?? null,
        recommended:      auditModal.audit.recommended ?? null,
        pricing:          auditModal.audit.pricing ?? null,
        ui_intuitive:     auditModal.audit.ui_intuitive ?? null,
        onboarding_score: auditModal.audit.onboarding_score ?? null,
        rating:           auditModal.audit.rating ?? null,
        time_saved:       auditModal.audit.time_saved ?? null,
        aha_moment:       auditModal.audit.aha_moment ?? null,
        notes:            auditModal.audit.notes ?? null,
        status:           submit ? 'pending_review' : (existing?.status === 'needs_revision' && !submit ? 'needs_revision' : 'draft'),
        submitted_at:     submit ? new Date().toISOString() : (existing?.submitted_at ?? null),
        updated_at:       new Date().toISOString(),
      }

      if (existing) {
        const { error } = await supabase.from('tool_audits').update(payload).eq('id', existing.id)
        if (error) { alert('Uložení selhalo: ' + error.message); return }
      } else {
        const { error } = await supabase.from('tool_audits').insert(payload)
        if (error) { alert('Vytvoření selhalo: ' + error.message); return }
      }

      setAuditModal(null)
      fetchTools()
    } finally {
      setSubmitting(false)
    }
  }

  const addTool = async () => {
    setLoading(true)
    await supabase.from('tools').insert({
      name: form.name, vendor: form.vendor, website_url: form.website_url,
      description: form.description, category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      status: 'new', source: 'manual',
    })
    setForm({ name: '', vendor: '', website_url: '', description: '', category: '', tags: '' })
    setShowAddModal(false); setLoading(false); fetchTools()
  }

  const runAiNews = async () => {
    setAiNewsRunning(true)
    try {
      // Tools-mode: prompt zaměřený na konkrétní tooly/repa/SaaS, ne breaking news.
      await fetch('/api/ai-watch/run?mode=tools', { method: 'POST' })
    } catch (e) { console.error(e) }
    finally { setAiNewsRunning(false); fetchTools() }
  }

  const deduplicate = async () => {
    setDeduplicating(true)
    try {
      const { data: allTools } = await supabase.from('tools').select('*').order('created_at', { ascending: true })
      if (!allTools) return
      const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
      const isDuplicate = (a: string, b: string) => {
        const na = normalize(a); const nb = normalize(b)
        return na === nb || na.includes(nb) || nb.includes(na)
      }
      const kept: { id: string; name: string }[] = []
      const toDelete: string[] = []
      allTools.forEach((tool: Tool) => {
        const match = kept.find(k => isDuplicate(k.name, tool.name))
        if (match) toDelete.push(tool.id)
        else kept.push({ id: tool.id, name: tool.name })
      })
      if (toDelete.length === 0) { alert('Žádné duplicity nenalezeny'); return }
      const { error } = await supabase.from('tools').delete().in('id', toDelete)
      if (error) { alert('Chyba při mazání: ' + error.message); return }
      alert(`Smazáno ${toDelete.length} duplicit`)
      fetchTools()
    } finally { setDeduplicating(false) }
  }

  const visibleTools = useMemo(() => {
    if (!q) return tools
    const needle = q.toLowerCase()
    return tools.filter(t =>
      t.name?.toLowerCase().includes(needle)
      || t.vendor?.toLowerCase().includes(needle)
      || t.category?.toLowerCase().includes(needle)
      || t.description?.toLowerCase().includes(needle)
      || t.tags?.some(tag => tag.toLowerCase().includes(needle)),
    )
  }, [tools, q])

  const myQueueCount = tools.filter(t => t.claimed_by === me?.id && (t.status === 'claimed' || t.status === 'in_progress')).length
  const needsRevisionCount = Object.values(auditsByTool).filter(a => a.status === 'needs_revision' && a.author_id === me?.id).length

  const renderAction = (t: Tool) => {
    // AI Watch suggestion — ještě není v DB (id "ai-watch-…", ne UUID)
    if (isAiWatchSuggestion(t)) {
      return <button className="btn btn-primary btn-sm" onClick={() => claim(t)}>Claim + uložit</button>
    }

    // Volný nástroj
    if (t.status === 'new') {
      return <button className="btn btn-primary btn-sm" onClick={() => claim(t)}>Claim</button>
    }

    // Claimnutý někým jiným
    if (t.claimed_by !== me?.id) {
      return <span className="tag tag-violet">claimed</span>
    }

    // Můj claim — řízeno audit statusem
    const audit = auditsByTool[t.id]
    const auditStatus: ToolAuditStatus = (audit?.status as ToolAuditStatus) ?? 'draft'

    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
        <span className={`tag ${STATUS_COLOR[auditStatus]}`}>{STATUS_LABEL[auditStatus]}</span>
        {auditStatus === 'pending_review' ? (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Wexia ho má v rukou</span>
        ) : auditStatus === 'needs_revision' ? (
          <button className="btn btn-primary btn-sm" onClick={() => openAudit(t)}>Upravit audit</button>
        ) : (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => openAudit(t)}>
              {audit ? 'Pokračovat v auditu' : 'Napsat audit'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => unclaim(t)}>Unclaim</button>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>K otestování</h1>
          <p>Nové AI nástroje k claimnutí a deep auditu. Po dokončení posíláš na verifikaci Wexii.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={runAiNews} disabled={aiNewsRunning}>
            {aiNewsRunning ? '⟳ Hledám nástroje…' : '✦ Najít nové nástroje'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={deduplicate} disabled={deduplicating}>
            {deduplicating ? '⟳ Mažu…' : '⊗ Smazat duplicity'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fetchTools}>Obnovit</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Přidat ručně</button>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Volných k claimnutí</div>
            <div className="stat-value">{tools.filter(t => t.status === 'new' || isAiWatchSuggestion(t)).length}</div>
            <div className="stat-sub">k otestování od týmu</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Moje rozpracované audity</div>
            <div className="stat-value">{myQueueCount}</div>
            <div className="stat-sub">claimnuté tebou</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Vrácené k úpravě</div>
            <div className="stat-value">{needsRevisionCount}</div>
            <div className="stat-sub">Wexia poslala zpět</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Z AI News feedu</div>
            <div className="stat-value">{aiNewsCount}</div>
            <div className="stat-sub">nezpracované návrhy</div>
          </div>
        </div>

        <input className="search-box" placeholder="Hledat nástroje…" value={q} onChange={e => setQ(e.target.value)} />

        {visibleTools.length === 0 ? (
          <div className="empty"><span className="empty-icon">📭</span>Žádné nástroje. Klikni „Najít nové nástroje" nebo přidej ručně.</div>
        ) : visibleTools.map(t => {
          const audit = auditsByTool[t.id]
          const isMine = t.claimed_by === me?.id
          const borderColor = isMine && audit?.status === 'needs_revision' ? '#f59e0b'
            : isMine && audit?.status === 'pending_review' ? '#3b82f6'
            : isMine ? '#22c55e'
            : 'transparent'
          return (
            <div key={t.id} className="tool-card" style={{ borderLeft: `3px solid ${borderColor}` }}>
              <div style={{ flex: 1 }}>
                <div className="tool-name">
                  {t.name}
                  {t.vendor && <span className="tool-vendor" style={{ marginLeft: 8 }}>· {t.vendor}</span>}
                </div>
                {t.description && <div className="tool-desc">{t.description}</div>}
                {t.website_url && (
                  <div className="tool-vendor">
                    <a href={t.website_url} target="_blank" rel="noopener noreferrer">{t.website_url} ↗</a>
                  </div>
                )}
                {isMine && audit?.status === 'needs_revision' && audit.reviewer_note && (
                  <div className="tool-desc" style={{ marginTop: 8, padding: 10, background: 'rgba(245,158,11,0.08)', borderRadius: 6, borderLeft: '2px solid #f59e0b' }}>
                    <strong>Vráceno k úpravě:</strong> {audit.reviewer_note}
                    {audit.reviewer_name && <span style={{ opacity: 0.7 }}> — {audit.reviewer_name}</span>}
                  </div>
                )}
                <div className="tool-tags" style={{ marginTop: 8 }}>
                  {t.category && <span className="tag">{t.category}</span>}
                  {t.tags?.map(tag => <span key={tag} className="tag">{tag}</span>)}
                </div>
              </div>
              <div className="tool-actions">{renderAction(t)}</div>
            </div>
          )
        })}
      </div>

      {/* === Audit form modal === */}
      {auditModal && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setAuditModal(null)}>
          <div className="modal modal-detail">
            <button className="modal-close" onClick={() => setAuditModal(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">Audit: {auditModal.tool.name}</div>
              <div className="tool-vendor">{auditModal.tool.vendor} · {auditModal.tool.website_url}</div>
            </div>
            <div className="modal-body">
              {auditModal.audit.status === 'needs_revision' && (auditsByTool[auditModal.tool.id]?.reviewer_note) && (
                <div style={{ marginBottom: 16, padding: 12, background: 'rgba(245,158,11,0.08)', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>
                  <strong>Poznámka od Wexia:</strong> {auditsByTool[auditModal.tool.id].reviewer_note}
                </div>
              )}
              {AUDIT_FIELDS.map(f => (
                <div key={f.key as string} className="form-group">
                  <label className="form-label">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      className="form-textarea"
                      value={String(auditModal.audit[f.key] ?? '')}
                      onChange={e => updateAuditField(f.key, e.target.value)}
                      rows={3}
                    />
                  ) : (
                    <input
                      className="form-input"
                      type={f.type === 'number' ? 'number' : 'text'}
                      min={f.type === 'number' ? 1 : undefined}
                      max={f.type === 'number' ? 10 : undefined}
                      value={String(auditModal.audit[f.key] ?? '')}
                      onChange={e => updateAuditField(f.key, e.target.value)}
                    />
                  )}
                  {f.hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{f.hint}</div>}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAuditModal(null)} disabled={submitting}>Zavřít</button>
              <button className="btn btn-outline" onClick={() => saveAudit(false)} disabled={submitting}>
                {submitting ? 'Ukládám…' : 'Uložit draft'}
              </button>
              <button className="btn btn-primary" onClick={() => saveAudit(true)} disabled={submitting}>
                {submitting ? 'Odesílám…' : 'Odeslat k verifikaci →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Add tool modal === */}
      <div className={`modal-bg ${showAddModal ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
        <div className="modal">
          <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
          <div className="modal-header"><div className="modal-title">Přidat nástroj</div></div>
          {(['name', 'vendor', 'website_url', 'category'] as const).map(f => (
            <div key={f} className="form-group">
              <label className="form-label">{{ name: 'Název *', vendor: 'Vendor', website_url: 'URL', category: 'Kategorie' }[f]}</label>
              <input className="form-input" value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })} />
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">Popis</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Tagy (čárkou)</label>
            <input className="form-input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Zrušit</button>
            <button className="btn btn-primary" onClick={addTool} disabled={loading || !form.name}>
              {loading ? 'Přidávám…' : 'Přidat'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
