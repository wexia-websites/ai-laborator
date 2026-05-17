'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Tool, type ToolAudit } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

type AuditWithTool = ToolAudit & { tool: Tool | null }

const AUDIT_DISPLAY: Array<{ key: keyof ToolAudit; label: string }> = [
  { key: 'purpose',          label: 'K čemu se hodí' },
  { key: 'best_for_roles',   label: 'Pro koho' },
  { key: 'output_quality',   label: 'Kvalita výstupu' },
  { key: 'hallucinates',     label: 'Halucinuje' },
  { key: 'weaknesses',       label: 'Slabiny' },
  { key: 'security_risks',   label: 'Bezpečnostní rizika' },
  { key: 'limitations',      label: 'Limity' },
  { key: 'ui_intuitive',     label: 'Intuitivnost UI' },
  { key: 'onboarding_score', label: 'Onboarding (1–10)' },
  { key: 'time_saved',       label: 'Ušetří času' },
  { key: 'aha_moment',       label: 'Aha moment' },
  { key: 'pricing',          label: 'Cena / licence' },
  { key: 'recommended',      label: 'Doporučuje' },
  { key: 'rating',           label: 'Rating (1–10)' },
  { key: 'notes',            label: 'Souhrn / poznámky' },
]

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

export default function VerifyPage() {
  const router = useRouter()
  const { role, canAccess, loading: roleLoading } = useRole()

  useEffect(() => {
    if (!roleLoading && !canAccess('verify')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [audits, setAudits] = useState<AuditWithTool[]>([])
  const [me, setMe] = useState<{ id: string; name: string | null } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [sendBackNote, setSendBackNote] = useState('')
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAudits = async () => {
    const { data, error } = await supabase
      .from('tool_audits')
      .select('*, tool:tools(*)')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true })
    if (error) { setError(error.message); return }
    setAudits((data ?? []) as AuditWithTool[])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }: any) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('full_name, first_name, last_name').eq('id', user.id).single()
      const name = profile?.full_name ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ?? null
      setMe({ id: user.id, name: name || null })
    })
    fetchAudits()
  }, [])

  const opened = useMemo(() => audits.find(a => a.id === openId) ?? null, [audits, openId])

  const approve = async (a: AuditWithTool) => {
    if (!me || !a.tool) return
    setActing(true); setError(null)
    try {
      const now = new Date().toISOString()
      const { error: e1 } = await supabase.from('tool_audits').update({
        status: 'approved',
        reviewer_id: me.id, reviewer_name: me.name, reviewer_note: null, reviewed_at: now, updated_at: now,
      }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('tools').update({ status: 'completed' }).eq('id', a.tool.id)
      if (e2) throw e2
      setOpenId(null); setSendBackNote('')
      await fetchAudits()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setActing(false) }
  }

  const sendBack = async (a: AuditWithTool) => {
    if (!me) return
    if (!sendBackNote.trim()) { setError('Napiš analytikovi co má upravit.'); return }
    setActing(true); setError(null)
    try {
      const now = new Date().toISOString()
      const { error: e1 } = await supabase.from('tool_audits').update({
        status: 'needs_revision',
        reviewer_id: me.id, reviewer_name: me.name, reviewer_note: sendBackNote.trim(), reviewed_at: now, updated_at: now,
      }).eq('id', a.id)
      if (e1) throw e1
      // tools.status zůstává 'claimed' — analytik stále má vlastnictví
      setOpenId(null); setSendBackNote('')
      await fetchAudits()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setActing(false) }
  }

  const reject = async (a: AuditWithTool) => {
    if (!me || !a.tool) return
    if (!confirm(`Opravdu zamítnout audit nástroje "${a.tool.name}"? Tool půjde do archivu.`)) return
    setActing(true); setError(null)
    try {
      const now = new Date().toISOString()
      const { error: e1 } = await supabase.from('tool_audits').update({
        status: 'rejected',
        reviewer_id: me.id, reviewer_name: me.name,
        reviewer_note: sendBackNote.trim() || null, reviewed_at: now, updated_at: now,
      }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('tools').update({ status: 'archived' }).eq('id', a.tool.id)
      if (e2) throw e2
      setOpenId(null); setSendBackNote('')
      await fetchAudits()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setActing(false) }
  }

  if (roleLoading) return null

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Verifikace auditů</h1>
          <p>Audity, které analytici odeslali ke schválení. Approve → tool jde do „Otestované".</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={fetchAudits}>Obnovit</button>
        </div>
      </div>

      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Čeká na verifikaci</div>
            <div className="stat-value">{audits.length}</div>
            <div className="stat-sub">audity k schválení</div>
          </div>
        </div>

        {error && (
          <div className="empty" style={{ marginBottom: 14, borderColor: '#7f1d1d' }}>
            <span className="empty-icon">⚠️</span>{error}
          </div>
        )}

        {audits.length === 0 ? (
          <div className="empty"><span className="empty-icon">✓</span>Nic k verifikaci. Vše schváleno.</div>
        ) : audits.map(a => (
          <div key={a.id} className="tool-card" style={{ cursor: 'pointer' }} onClick={() => { setOpenId(a.id); setSendBackNote('') }}>
            <div style={{ flex: 1 }}>
              <div className="tool-name">
                {a.tool?.name ?? '(neznámý nástroj)'}
                {a.tool?.vendor && <span className="tool-vendor" style={{ marginLeft: 8 }}>· {a.tool.vendor}</span>}
              </div>
              <div className="tool-vendor">
                od <strong>{a.author_name ?? a.author_id?.slice(0, 8)}</strong> · odesláno {formatDate(a.submitted_at)}
              </div>
              {a.notes && <div className="tool-desc" style={{ marginTop: 6 }}>{a.notes}</div>}
              <div className="tool-tags" style={{ marginTop: 8 }}>
                {a.recommended && <span className="tag">{a.recommended}</span>}
                {a.rating != null && <span className="tag tag-green">rating {a.rating}/10</span>}
                {a.onboarding_score != null && <span className="tag">onboarding {a.onboarding_score}/10</span>}
              </div>
            </div>
            <div className="tool-actions">
              <button className="btn btn-primary btn-sm">Otevřít →</button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {opened && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setOpenId(null)}>
          <div className="modal modal-detail">
            <button className="modal-close" onClick={() => setOpenId(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{opened.tool?.name ?? 'Audit'}</div>
              <div className="tool-vendor">
                {opened.tool?.vendor} · {opened.tool?.website_url && <a href={opened.tool.website_url} target="_blank" rel="noopener noreferrer">{opened.tool.website_url} ↗</a>}
              </div>
              <div className="tool-vendor" style={{ marginTop: 4 }}>
                Analytik: <strong>{opened.author_name ?? '—'}</strong> · odesláno {formatDate(opened.submitted_at)}
              </div>
            </div>
            <div className="modal-body">
              {AUDIT_DISPLAY.map(f => {
                const value = opened[f.key]
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpenId(null)} disabled={acting}>Zavřít</button>
              <button className="btn btn-outline" onClick={() => reject(opened)} disabled={acting} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
                ✗ Zamítnout
              </button>
              <button className="btn btn-outline" onClick={() => sendBack(opened)} disabled={acting || !sendBackNote.trim()}>
                ↩ Vrátit k úpravě
              </button>
              <button className="btn btn-primary" onClick={() => approve(opened)} disabled={acting}>
                {acting ? 'Pracuju…' : '✓ Schválit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
