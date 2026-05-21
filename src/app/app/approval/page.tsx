'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type UseCase, type Tool, type ToolAudit } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

// ── Types ──────────────────────────────────────────────────────────────────

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
  lessons_learned: string | null
  avoid_next_time: string | null
  process_that_worked: string | null
  ai_contribution: string | null
  overall_rating: number | null
  would_repeat: string | null
  author_name: string | null
  created_at: string
  updated_at: string
}

type AuditWithTool = ToolAudit & { tool: Tool | null }

// ── Helpers ────────────────────────────────────────────────────────────────

const AUDIT_DISPLAY: Array<{ key: keyof ToolAudit; label: string }> = [
  { key: 'purpose',          label: 'K čemu se hodí' },
  { key: 'best_for_roles',   label: 'Pro koho' },
  { key: 'output_quality',   label: 'Kvalita výstupu' },
  { key: 'hallucinates',     label: 'Halucinuje' },
  { key: 'weaknesses',       label: 'Slabiny' },
  { key: 'security_risks',   label: 'Bezpečnostní rizika' },
  { key: 'limitations',      label: 'Limity' },
  { key: 'ui_intuitive',     label: 'Intuitivnost UI' },
  { key: 'onboarding_score', label: 'Onboarding (1–5)' },
  { key: 'time_saved',       label: 'Ušetří času' },
  { key: 'aha_moment',       label: 'Aha moment' },
  { key: 'pricing',          label: 'Cena / licence' },
  { key: 'recommended',      label: 'Doporučuje' },
  { key: 'rating',           label: 'Rating (1–10)' },
  { key: 'notes',            label: 'Souhrn / poznámky' },
]

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

function fmtDate(v: string | null | undefined, withTime = false) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d)
}

// ── Page ───────────────────────────────────────────────────────────────────

type ActiveTab = 'usecases' | 'audits'

export default function ApprovalPage() {
  const router = useRouter()
  const { canAccess, loading: roleLoading } = useRole()

  useEffect(() => {
    if (!roleLoading && !canAccess('approval')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [tab, setTab] = useState<ActiveTab>('usecases')

  // ── Use cases + projects state ─────────────────────────────────────────
  const [items, setItems] = useState<UseCase[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  // ── Audits state ───────────────────────────────────────────────────────
  const [audits, setAudits] = useState<AuditWithTool[]>([])
  const [me, setMe] = useState<{ id: string; name: string | null } | null>(null)
  const [openAuditId, setOpenAuditId] = useState<string | null>(null)
  const [sendBackNote, setSendBackNote] = useState('')
  const [acting, setActing] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  const openedAudit = useMemo(() => audits.find(a => a.id === openAuditId) ?? null, [audits, openAuditId])

  // ── Load functions ─────────────────────────────────────────────────────
  const loadUseCases = async () => {
    const [{ data: ucData }, { data: projData }] = await Promise.all([
      supabase.from('use_cases').select('*').eq('status', 'review').order('updated_at', { ascending: false }),
      supabase.from('projects').select('*').eq('status', 'review').order('updated_at', { ascending: false }),
    ])
    setItems(ucData ?? [])
    setProjects((projData ?? []) as Project[])
  }

  const loadAudits = async () => {
    const { data, error } = await supabase
      .from('tool_audits')
      .select('*, tool:tools(*)')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true })
    if (error) { setAuditError(error.message); return }
    setAudits((data ?? []) as AuditWithTool[])
  }

  useEffect(() => {
    loadUseCases()
    loadAudits()
    supabase.auth.getUser().then(async ({ data: { user } }: any) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('full_name, first_name, last_name').eq('id', user.id).single()
      const name = profile?.full_name ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ?? null
      setMe({ id: user.id, name: name || null })
    })
  }, [])

  // ── Use case actions ───────────────────────────────────────────────────
  const publish = async (id: string) => {
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'revision_days').single()
    const revisionDays = parseInt(setting?.value ?? '90')
    const now = new Date()
    const revisionDueAt = new Date(now.getTime() + revisionDays * 86_400_000)
    await supabase.from('use_cases').update({
      status: 'published',
      published_at: now.toISOString(),
      revision_due_at: revisionDueAt.toISOString(),
      revision_status: 'ok',
    }).eq('id', id)
    setSelectedUseCase(null)
    loadUseCases()
    setWebhookStatus('loading')
    try {
      const res = await fetch('/api/webhook-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useCaseId: id }),
      })
      setWebhookStatus(res.ok ? 'success' : 'error')
    } catch {
      setWebhookStatus('error')
    }
    setTimeout(() => setWebhookStatus('idle'), 4000)
  }

  const rejectUseCase = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'draft' }).eq('id', id)
    setSelectedUseCase(null)
    loadUseCases()
  }

  const publishProject = async (id: string) => {
    await supabase.from('projects').update({ status: 'published' }).eq('id', id)
    setSelectedProject(null)
    loadUseCases()
  }

  const rejectProject = async (id: string) => {
    await supabase.from('projects').update({ status: 'draft' }).eq('id', id)
    setSelectedProject(null)
    loadUseCases()
  }

  // ── Audit actions ──────────────────────────────────────────────────────
  const approveAudit = async (a: AuditWithTool) => {
    if (!me || !a.tool) return
    setActing(true); setAuditError(null)
    try {
      const now = new Date().toISOString()
      const { error: e1 } = await supabase.from('tool_audits').update({
        status: 'approved', reviewer_id: me.id, reviewer_name: me.name,
        reviewer_note: null, reviewed_at: now, updated_at: now,
      }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('tools').update({ status: 'completed' }).eq('id', a.tool.id)
      if (e2) throw e2
      setOpenAuditId(null); setSendBackNote('')
      await loadAudits()
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : String(e))
    } finally { setActing(false) }
  }

  const sendBackAudit = async (a: AuditWithTool) => {
    if (!me) return
    if (!sendBackNote.trim()) { setAuditError('Napiš analytikovi co má upravit.'); return }
    setActing(true); setAuditError(null)
    try {
      const now = new Date().toISOString()
      const { error: e1 } = await supabase.from('tool_audits').update({
        status: 'needs_revision', reviewer_id: me.id, reviewer_name: me.name,
        reviewer_note: sendBackNote.trim(), reviewed_at: now, updated_at: now,
      }).eq('id', a.id)
      if (e1) throw e1
      setOpenAuditId(null); setSendBackNote('')
      await loadAudits()
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : String(e))
    } finally { setActing(false) }
  }

  const rejectAudit = async (a: AuditWithTool) => {
    if (!me || !a.tool) return
    if (!confirm(`Opravdu zamítnout audit nástroje "${a.tool.name}"? Tool půjde do archivu.`)) return
    setActing(true); setAuditError(null)
    try {
      const now = new Date().toISOString()
      const { error: e1 } = await supabase.from('tool_audits').update({
        status: 'rejected', reviewer_id: me.id, reviewer_name: me.name,
        reviewer_note: sendBackNote.trim() || null, reviewed_at: now, updated_at: now,
      }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('tools').update({ status: 'archived' }).eq('id', a.tool.id)
      if (e2) throw e2
      setOpenAuditId(null); setSendBackNote('')
      await loadAudits()
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : String(e))
    } finally { setActing(false) }
  }

  // ── Export ─────────────────────────────────────────────────────────────
  const exportToHTML = (u: UseCase) => {
    const uc = u as any
    const row = (label: string, val?: string | number | null) =>
      val ? `<h2>${label}</h2><p>${String(val).replace(/\n/g, '<br>')}</p>` : ''
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${u.title}</title><style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1916;}
      h1{color:#e02020;border-bottom:2px solid #e02020;padding-bottom:10px;}
      h2{color:#333;margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
      p{line-height:1.6;color:#555;margin:0 0 8px;}
      .meta{color:#888;font-size:13px;margin-bottom:24px;}
      .tag{display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:10px;font-size:12px;margin:2px;}
      .score{font-size:28px;font-weight:bold;color:#e02020;}
    </style></head><body>
      <h1>${u.title}</h1>
      <div class="meta">
        ${u.tool_name ? `<strong>Nástroj:</strong> ${u.tool_name} &nbsp;` : ''}
        ${u.team ? `<strong>Tým:</strong> ${u.team} &nbsp;` : ''}
        ${u.author_name ? `<strong>Autor:</strong> ${u.author_name} &nbsp;` : ''}
        <strong>Datum:</strong> ${new Date(u.created_at).toLocaleDateString('cs-CZ')}
      </div>
      ${u.description ? `<p><em>${u.description}</em></p>` : ''}
      ${row('Účel nástroje', uc.purpose)}
      ${row('Podobné nástroje', uc.similar_tools)}
      ${row('Nejlepší pro', uc.best_for_roles)}
      ${row('Úspora času', uc.time_saved)}
      ${row('Kvalita výstupů', uc.output_quality)}
      ${row('Slabiny', uc.weaknesses)}
      ${row('Bezpečnostní rizika', uc.security_risks)}
      ${row('Limity nástroje', uc.limitations)}
      <h2>Finální verdikt</h2>
      <p>
        ${uc.recommended ? `<span class="tag">Doporučení: ${uc.recommended}</span> ` : ''}
        ${uc.rating ? `<span class="score">${uc.rating}/10</span> ` : ''}
        ${u.effort ? `<span class="tag">Náročnost: ${u.effort}</span> ` : ''}
        ${u.impact ? `<span class="tag">Dopad: ${u.impact}</span>` : ''}
      </p>
    </body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${u.title.replace(/[^a-z0-9]/gi, '_')}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  const ucCount = items.length + projects.length

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Schválení</h1>
          <p>Fronta use casů, projektů a auditů čekajících na schválení.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={() => { loadUseCases(); loadAudits() }}>⟳ Obnovit</button>
        </div>
      </div>

      {/* Webhook toast */}
      {webhookStatus !== 'idle' && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: webhookStatus === 'loading' ? 'var(--bg2)' : webhookStatus === 'success' ? '#166534' : '#7f1d1d',
          color: webhookStatus === 'loading' ? 'var(--text2)' : '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {webhookStatus === 'loading' && 'Odesílám na Make.com...'}
          {webhookStatus === 'success' && '✅ Odesláno na Make.com'}
          {webhookStatus === 'error' && '⚠️ Odeslání selhalo'}
        </div>
      )}

      <div className="page-body">
        {/* Stat cards */}
        <div className="stats-row" style={{ marginBottom: 24 }}>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', outline: tab === 'usecases' ? '1px solid var(--accent)' : 'none', borderColor: ucCount > 0 ? 'rgba(245,158,11,0.3)' : undefined }}
            onClick={() => setTab('usecases')}
          >
            <div className="stat-label">Use casy & projekty</div>
            <div className="stat-value" style={{ color: ucCount > 0 ? '#f59e0b' : undefined }}>{ucCount}</div>
            <div className="stat-sub">ke schválení</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', outline: tab === 'audits' ? '1px solid var(--accent)' : 'none', borderColor: audits.length > 0 ? 'rgba(245,158,11,0.3)' : undefined }}
            onClick={() => setTab('audits')}
          >
            <div className="stat-label">Audity nástrojů</div>
            <div className="stat-value" style={{ color: audits.length > 0 ? '#f59e0b' : undefined }}>{audits.length}</div>
            <div className="stat-sub">ke schválení</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-row" style={{ marginBottom: 24 }}>
          <button className={`tab-btn${tab === 'usecases' ? ' active' : ''}`} onClick={() => setTab('usecases')}>
            Use casy &amp; projekty <span className="tab-count">{ucCount}</span>
          </button>
          <button className={`tab-btn${tab === 'audits' ? ' active' : ''}`} onClick={() => setTab('audits')}>
            Audity <span className="tab-count">{audits.length}</span>
          </button>
        </div>

        {/* ── USE CASY + PROJEKTY ── */}
        {tab === 'usecases' && (
          <>
            {/* Use cases */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
              Use casy ke kontrole
            </div>
            {items.length === 0
              ? <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>Žádné use casy nečekají na review.</div>
              : items.map(u => (
                <div key={u.id} className="review-card" style={{ cursor: 'pointer', marginBottom: 8 }} onClick={() => setSelectedUseCase(u)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{u.title}</div>
                        <span className="tag tag-violet">AI nástroj</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                        {u.tool_name && <>{u.tool_name} · </>}{u.team && <>{u.team} · </>}autor: {u.author_name}
                        &nbsp;· {fmtDate(u.updated_at)}
                      </div>
                      {u.description && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{u.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-accent btn-sm" onClick={() => publish(u.id)}>✓ Publikovat</button>
                      <button className="btn btn-danger btn-sm" onClick={() => rejectUseCase(u.id)}>← Vrátit</button>
                    </div>
                  </div>
                </div>
              ))
            }

            {/* Projects */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '24px 0 10px' }}>
              Projekty ke kontrole
            </div>
            {projects.length === 0
              ? <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Žádné projekty nečekají na review.</div>
              : projects.map(p => (
                <div key={p.id} className="review-card" style={{ cursor: 'pointer', marginBottom: 8 }} onClick={() => setSelectedProject(p)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{p.title}</div>
                        <span className="tag tag-amber">Projekt</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                        {p.client && <>{p.client} · </>}{p.team && <>{p.team} · </>}autor: {p.author_name}
                        &nbsp;· {fmtDate(p.updated_at)}
                      </div>
                      {p.description && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{p.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-accent btn-sm" onClick={() => publishProject(p.id)}>✓ Publikovat</button>
                      <button className="btn btn-danger btn-sm" onClick={() => rejectProject(p.id)}>← Vrátit</button>
                    </div>
                  </div>
                </div>
              ))
            }
          </>
        )}

        {/* ── AUDITY ── */}
        {tab === 'audits' && (
          <>
            {auditError && (
              <div className="empty" style={{ marginBottom: 14, borderColor: '#7f1d1d' }}>
                <span className="empty-icon">⚠️</span>{auditError}
              </div>
            )}
            {audits.length === 0 ? (
              <div className="empty"><span className="empty-icon">✓</span>Nic k verifikaci. Vše schváleno.</div>
            ) : audits.map(a => (
              <div key={a.id} className="tool-card" style={{ cursor: 'pointer' }} onClick={() => { setOpenAuditId(a.id); setSendBackNote('') }}>
                <div style={{ flex: 1 }}>
                  <div className="tool-name">
                    {a.tool?.name ?? '(neznámý nástroj)'}
                    {a.tool?.vendor && <span className="tool-vendor" style={{ marginLeft: 8 }}>· {a.tool.vendor}</span>}
                  </div>
                  <div className="tool-vendor">
                    od <strong>{a.author_name ?? a.author_id?.slice(0, 8)}</strong> · odesláno {fmtDate(a.submitted_at, true)}
                  </div>
                  {a.notes && <div className="tool-desc" style={{ marginTop: 6 }}>{a.notes}</div>}
                  <div className="tool-tags" style={{ marginTop: 8 }}>
                    {a.recommended && <span className="tag">{a.recommended}</span>}
                    {a.rating != null && <span className="tag tag-green">rating {a.rating}/10</span>}
                    {a.onboarding_score != null && <span className="tag">onboarding {a.onboarding_score}/5</span>}
                  </div>
                </div>
                <div className="tool-actions">
                  <button className="btn btn-primary btn-sm">Otevřít →</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── USE CASE DETAIL MODAL ── */}
      {selectedUseCase && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelectedUseCase(null)}>
          <div className="modal" style={{ width: 680 }}>
            <button className="modal-close" onClick={() => setSelectedUseCase(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selectedUseCase.title}</div>
              <div className="modal-subtitle">
                {selectedUseCase.tool_name && <>{selectedUseCase.tool_name} · </>}
                {selectedUseCase.team && <>{selectedUseCase.team} · </>}
                autor: {selectedUseCase.author_name}
              </div>
            </div>
            {selectedUseCase.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>{selectedUseCase.description}</div>
            )}
            <Section title="Základní přehled" />
            <Field label="Účel nástroje" value={(selectedUseCase as any).purpose} />
            <Field label="Podobné nástroje" value={(selectedUseCase as any).similar_tools} />
            <Field label="Cena" value={(selectedUseCase as any).pricing} />
            <Section title="Přínos pro byznys" />
            <Field label="Nejlepší pro" value={(selectedUseCase as any).best_for_roles} />
            <Field label="Úspora času" value={(selectedUseCase as any).time_saved} />
            <Field label="Aha! moment" value={(selectedUseCase as any).aha_moment} />
            <Section title="Uživatelská přívětivost" />
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              {(selectedUseCase as any).onboarding_score && <span className="tag">Onboarding: {(selectedUseCase as any).onboarding_score}/5</span>}
              {(selectedUseCase as any).ui_intuitive && <span className="tag">UI: {(selectedUseCase as any).ui_intuitive}</span>}
            </div>
            <Section title="Výkon AI" />
            <Field label="Kvalita výstupů" value={(selectedUseCase as any).output_quality} />
            {(selectedUseCase as any).hallucinates && (
              <div style={{ marginBottom: 12 }}><span className="tag">Halucinace: {(selectedUseCase as any).hallucinates}</span></div>
            )}
            <Section title="Rizika" />
            <Field label="Slabiny" value={(selectedUseCase as any).weaknesses} />
            <Field label="Bezpečnostní rizika" value={(selectedUseCase as any).security_risks} />
            <Field label="Limity nástroje" value={(selectedUseCase as any).limitations} />
            <Section title="Finální verdikt" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {(selectedUseCase as any).recommended && (
                <span className={`tag ${(selectedUseCase as any).recommended === 'ano' ? 'tag-green' : (selectedUseCase as any).recommended === 'ne' ? 'tag-red' : 'tag-amber'}`}>
                  Doporučení: {(selectedUseCase as any).recommended}
                </span>
              )}
              {(selectedUseCase as any).rating && <span className="tag">⭐ {(selectedUseCase as any).rating}/10</span>}
              {selectedUseCase.effort && <span className="tag">Náročnost: {selectedUseCase.effort}</span>}
              {selectedUseCase.impact && <span className="tag">Dopad: {selectedUseCase.impact}</span>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => rejectUseCase(selectedUseCase.id)}>← Vrátit do draftu</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToHTML(selectedUseCase)}>⬇ Stáhnout</button>
              <button className="btn btn-ghost" onClick={() => setSelectedUseCase(null)}>Zavřít</button>
              <button className="btn btn-accent" onClick={() => publish(selectedUseCase.id)}>✓ Publikovat</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROJECT DETAIL MODAL ── */}
      {selectedProject && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelectedProject(null)}>
          <div className="modal" style={{ width: 680 }}>
            <button className="modal-close" onClick={() => setSelectedProject(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selectedProject.title}</div>
              <div className="modal-subtitle">
                {selectedProject.client && <>{selectedProject.client} · </>}
                {selectedProject.team && <>{selectedProject.team} · </>}
                autor: {selectedProject.author_name}
              </div>
            </div>
            {selectedProject.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>{selectedProject.description}</div>
            )}
            <Section title="Základní info" />
            <Field label="Klient" value={selectedProject.client} />
            <Field label="Tým" value={selectedProject.team} />
            <Field label="Cíl projektu" value={selectedProject.project_goal} />
            <Field label="AI nástroje" value={selectedProject.tools_used} />
            <Section title="Průběh projektu" />
            <Field label="Co fungovalo" value={selectedProject.what_worked} />
            <Field label="Výzvy a zklamání" value={selectedProject.what_failed} />
            <Field label="Osvědčený postup" value={selectedProject.process_that_worked} />
            <Section title="Poučení" />
            <Field label="Co příště jinak" value={selectedProject.lessons_learned} />
            <Field label="Čemu se vyvarovat" value={selectedProject.avoid_next_time} />
            <Field label="Příspěvek AI" value={selectedProject.ai_contribution} />
            <Section title="Hodnocení" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {selectedProject.overall_rating && <span className="tag">⭐ {selectedProject.overall_rating}/10</span>}
              {selectedProject.would_repeat && <span className="tag">{selectedProject.would_repeat}</span>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => rejectProject(selectedProject.id)}>← Vrátit do draftu</button>
              <button className="btn btn-ghost" onClick={() => setSelectedProject(null)}>Zavřít</button>
              <button className="btn btn-accent" onClick={() => publishProject(selectedProject.id)}>✓ Publikovat</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIT DETAIL MODAL ── */}
      {openedAudit && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setOpenAuditId(null)}>
          <div className="modal modal-detail">
            <button className="modal-close" onClick={() => setOpenAuditId(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{openedAudit.tool?.name ?? 'Audit'}</div>
              <div className="tool-vendor">
                {openedAudit.tool?.vendor}
                {openedAudit.tool?.website_url && <> · <a href={openedAudit.tool.website_url} target="_blank" rel="noopener noreferrer">{openedAudit.tool.website_url} ↗</a></>}
              </div>
              <div className="tool-vendor" style={{ marginTop: 4 }}>
                Analytik: <strong>{openedAudit.author_name ?? '—'}</strong> · odesláno {fmtDate(openedAudit.submitted_at, true)}
              </div>
            </div>
            <div className="modal-body">
              {AUDIT_DISPLAY.map(f => {
                const value = openedAudit[f.key]
                if (value === null || value === undefined || value === '') return null
                return (
                  <div key={f.key as string} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>{f.label}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</div>
                  </div>
                )
              })}
              <div style={{ marginTop: 20, padding: 12, background: 'rgba(245,158,11,0.06)', borderRadius: 6 }}>
                <div className="form-label" style={{ marginBottom: 6 }}>Poznámka pro analytika (povinné pro „Vrátit k úpravě")</div>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={sendBackNote}
                  onChange={e => setSendBackNote(e.target.value)}
                  placeholder="Co konkrétně analytik dopiše / opraví / doplní…"
                />
              </div>
              {auditError && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>⚠️ {auditError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpenAuditId(null)} disabled={acting}>Zavřít</button>
              <button className="btn btn-outline" onClick={() => rejectAudit(openedAudit)} disabled={acting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
                ✗ Zamítnout
              </button>
              <button className="btn btn-outline" onClick={() => sendBackAudit(openedAudit)} disabled={acting || !sendBackNote.trim()}>
                ↩ Vrátit k úpravě
              </button>
              <button className="btn btn-primary" onClick={() => approveAudit(openedAudit)} disabled={acting}>
                {acting ? 'Pracuju…' : '✓ Schválit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
