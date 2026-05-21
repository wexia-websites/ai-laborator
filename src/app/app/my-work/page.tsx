'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Tool, type UseCase } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

type ActiveTab = 'testing' | 'usecases' | 'review' | 'returned'

const TOOL_STATUS_COLORS: Record<string, string> = {
  claimed:     '#6d28d9',
  in_progress: '#b45309',
  completed:   '#16a34a',
}

const TOOL_STATUS_LABELS: Record<string, string> = {
  claimed:     'Claimed',
  in_progress: 'In Progress',
  completed:   'Completed',
}

const UC_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: 'var(--border)',                   color: 'var(--text2)',  label: 'Koncept' },
  review:    { bg: 'rgba(180, 83, 9, 0.15)',          color: '#f59e0b',       label: 'Ke kontrole' },
  published: { bg: 'rgba(22, 163, 74, 0.15)',         color: '#16a34a',       label: 'Publikováno' },
  archived:  { bg: 'var(--border)',                   color: 'var(--text3)',  label: 'Archivováno' },
  returned:  { bg: 'rgba(239, 68, 68, 0.12)',         color: '#ef4444',       label: 'Vráceno' },
}

function formatDate(val: string | null | undefined) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export default function MyWorkPage() {
  const router = useRouter()
  const { canAccess, loading: roleLoading } = useRole()

  useEffect(() => {
    if (!roleLoading && !canAccess('my-work')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [tab, setTab] = useState<ActiveTab>('testing')
  const [tools, setTools] = useState<Tool[]>([])
  const [useCases, setUseCases] = useState<UseCase[]>([])
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [{ data: toolsData }, { data: ucData }] = await Promise.all([
        supabase
          .from('tools')
          .select('*')
          .eq('claimed_by', user.id)
          .in('status', ['claimed', 'in_progress', 'completed'])
          .order('claimed_at', { ascending: false }),
        supabase
          .from('use_cases')
          .select('*')
          .eq('author_id', user.id)
          .order('updated_at', { ascending: false }),
      ])

      setTools(toolsData ?? [])
      setUseCases((ucData ?? []) as UseCase[])
      setLoading(false)
    }
    load()
  }, [])

  const moveStatus = async (id: string, newStatus: string) => {
    setMovingId(id)
    await supabase.from('tools').update({ status: newStatus }).eq('id', id)
    setTools(prev => prev.map(t => t.id === id ? { ...t, status: newStatus as Tool['status'] } : t))
    setMovingId(null)
  }

  const reviewUc = useMemo(() => useCases.filter(uc => uc.status === 'review'), [useCases])
  const returnedUc = useMemo(() => useCases.filter(uc => (uc as any).returned_reason != null), [useCases])

  const tabs = [
    { id: 'testing',  label: 'Testování',   count: tools.length },
    { id: 'usecases', label: 'Use casy',    count: useCases.length },
    { id: 'review',   label: 'Ke kontrole', count: reviewUc.length },
    { id: 'returned', label: 'Vráceno',     count: returnedUc.length },
  ] as const

  if (loading) return null

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Moje práce</h1>
          <p>Přehled tvých nástrojů a use casů</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/app/inbox')}>
            + Claimnout nástroj
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/app/chat')}>
            + Nový use case
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stat cards */}
        <div className="stats-row" style={{ marginBottom: 24 }}>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', outline: tab === 'testing' ? '1px solid var(--accent)' : 'none' }}
            onClick={() => setTab('testing')}
          >
            <div className="stat-label">Testování</div>
            <div className="stat-value">{tools.length}</div>
            <div className="stat-sub">aktivní</div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', outline: tab === 'usecases' ? '1px solid var(--accent)' : 'none' }}
            onClick={() => setTab('usecases')}
          >
            <div className="stat-label">Use casy</div>
            <div className="stat-value">{useCases.length}</div>
            <div className="stat-sub">celkem</div>
          </div>
          <div
            className="stat-card"
            style={{
              cursor: 'pointer',
              outline: tab === 'review' ? '1px solid var(--accent)' : 'none',
              borderColor: reviewUc.length > 0 ? 'rgba(245,158,11,0.3)' : undefined,
            }}
            onClick={() => setTab('review')}
          >
            <div className="stat-label">Ke kontrole</div>
            <div className="stat-value" style={{ color: reviewUc.length > 0 ? '#f59e0b' : undefined }}>
              {reviewUc.length}
            </div>
            <div className="stat-sub">čeká admin</div>
          </div>
          <div
            className="stat-card"
            style={{
              cursor: 'pointer',
              outline: tab === 'returned' ? '1px solid var(--accent)' : 'none',
              borderColor: returnedUc.length > 0 ? 'rgba(239,68,68,0.3)' : undefined,
            }}
            onClick={() => setTab('returned')}
          >
            <div className="stat-label">Vráceno</div>
            <div className="stat-value" style={{ color: returnedUc.length > 0 ? '#ef4444' : undefined }}>
              {returnedUc.length}
            </div>
            <div className="stat-sub">k úpravě</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-row" style={{ marginBottom: 24 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className={`tab-count${t.count > 0 && tab !== t.id ? ' mw-tab-count-nonzero' : ''}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── TESTOVÁNÍ ── */}
        {tab === 'testing' && (
          tools.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">✦</span>
              Nemáš claimnutý žádný nástroj.{' '}
              <button className="btn btn-ghost btn-xs" style={{ marginLeft: 4 }} onClick={() => router.push('/app/inbox')}>
                Jít na K otestování →
              </button>
            </div>
          ) : (
            <div className="mw-groups">
              {(['claimed', 'in_progress', 'completed'] as const).map(status => {
                const items = tools.filter(t => t.status === status)
                if (items.length === 0) return null
                return (
                  <div key={status} className="mw-group">
                    <div className="mw-group-heading">
                      <span className="mw-dot" style={{ background: TOOL_STATUS_COLORS[status] }} />
                      {TOOL_STATUS_LABELS[status]}
                      <span className="tab-count" style={{ marginLeft: 6 }}>{items.length}</span>
                    </div>
                    {items.map(t => (
                      <div
                        key={t.id}
                        className="tool-card mw-tool-card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/app/chat?tool=${encodeURIComponent(t.name)}`)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                            <div className="tool-name">{t.name}</div>
                            {t.vendor && <span className="tag">{t.vendor}</span>}
                            {t.category && <span className="tag tag-violet">{t.category}</span>}
                          </div>
                          {t.description && (
                            <div className="tool-desc" style={{ marginTop: 4 }}>{t.description}</div>
                          )}
                          <div className="tool-vendor" style={{ marginTop: 6 }}>
                            Claimnuto {formatDate(t.claimed_at)}
                          </div>
                        </div>
                        <div className="tool-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={e => { e.stopPropagation(); router.push(`/app/chat?tool=${encodeURIComponent(t.name)}`) }}
                          >
                            💬 Use case
                          </button>
                          {status === 'claimed' && (
                            <button
                              className="btn btn-ghost btn-xs"
                              disabled={movingId === t.id}
                              onClick={e => { e.stopPropagation(); moveStatus(t.id, 'in_progress') }}
                            >
                              → In Progress
                            </button>
                          )}
                          {status === 'in_progress' && (
                            <button
                              className="btn btn-ghost btn-xs"
                              disabled={movingId === t.id}
                              onClick={e => { e.stopPropagation(); moveStatus(t.id, 'completed') }}
                            >
                              → Hotovo
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── USE CASY ── */}
        {tab === 'usecases' && (
          useCases.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">✦</span>
              Nemáš žádné use casy.{' '}
              <button className="btn btn-ghost btn-xs" style={{ marginLeft: 4 }} onClick={() => router.push('/app/chat')}>
                Vytvořit v Chatu →
              </button>
            </div>
          ) : (
            <>
              {useCases.map(uc => {
                const st = UC_STATUS[(uc as any).returned_reason ? 'returned' : uc.status] ?? UC_STATUS.draft
                return (
                  <div key={uc.id} className="tool-card">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <div className="tool-name">{uc.tool_name ?? uc.title}</div>
                        <span className="mw-status-badge" style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                        {uc.rating != null && <span className="tag tag-green">★ {uc.rating}/10</span>}
                        {uc.category && <span className="tag tag-violet">{uc.category}</span>}
                      </div>
                      {uc.tool_name && uc.tool_name !== uc.title && (
                        <div className="tool-vendor">{uc.title}</div>
                      )}
                      {uc.description && (
                        <div className="tool-desc" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {uc.description}
                        </div>
                      )}
                      <div className="tool-vendor" style={{ marginTop: 4 }}>
                        Upraveno {formatDate(uc.updated_at)}
                      </div>
                    </div>
                    {uc.status === 'draft' && (
                      <div className="tool-actions">
                        <button className="btn btn-ghost btn-xs" onClick={() => router.push('/app/chat')}>
                          ✎ Upravit
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )
        )}

        {/* ── KE KONTROLE ── */}
        {tab === 'review' && (
          reviewUc.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">✦</span>
              Žádné use casy nečekají na schválení.
            </div>
          ) : (
            <>
              <div className="mw-info-banner">
                <span>⏳</span>
                Use casy níže čekají na schválení administrátorem. Jakmile budou schváleny, objeví se v knihovně.
              </div>
              {reviewUc.map(uc => (
                <div key={uc.id} className="tool-card mw-review-card">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <div className="tool-name">{uc.tool_name ?? uc.title}</div>
                      <span className="mw-status-badge" style={{ background: UC_STATUS.review.bg, color: UC_STATUS.review.color }}>
                        Ke kontrole
                      </span>
                      {uc.rating != null && <span className="tag tag-green">★ {uc.rating}/10</span>}
                    </div>
                    {uc.tool_name && uc.tool_name !== uc.title && (
                      <div className="tool-vendor">{uc.title}</div>
                    )}
                    {uc.description && (
                      <div className="tool-desc" style={{ marginTop: 4 }}>{uc.description}</div>
                    )}
                    <div className="tool-vendor" style={{ marginTop: 6 }}>
                      Odesláno ke kontrole {formatDate(uc.updated_at)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )
        )}

        {/* ── VRÁCENO ── */}
        {tab === 'returned' && (
          returnedUc.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">✦</span>
              Žádné vrácené use casy. Pokud admin vrátí use case k úpravě, objeví se tady.
            </div>
          ) : (
            <>
              <div className="mw-info-banner mw-info-banner-red">
                <span>↩</span>
                Tyto use casy byly vráceny adminem k úpravě. Uprav je a znovu odešli ke kontrole.
              </div>
              {returnedUc.map(uc => (
                <div key={uc.id} className="tool-card mw-returned-card">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <div className="tool-name">{uc.tool_name ?? uc.title}</div>
                      <span className="mw-status-badge" style={{ background: UC_STATUS.returned.bg, color: UC_STATUS.returned.color }}>
                        Vráceno k úpravě
                      </span>
                    </div>
                    {(uc as any).returned_reason && (
                      <div className="mw-returned-reason">
                        <strong>Důvod:</strong> {(uc as any).returned_reason}
                      </div>
                    )}
                    <div className="tool-vendor" style={{ marginTop: 4 }}>
                      Vráceno {formatDate(uc.updated_at)}
                    </div>
                  </div>
                  <div className="tool-actions">
                    <button className="btn btn-primary btn-xs" onClick={() => router.push('/app/chat')}>
                      ✎ Upravit
                    </button>
                  </div>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </>
  )
}
