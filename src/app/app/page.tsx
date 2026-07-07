'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ActivityItem = {
  id: string
  type: 'usecase' | 'project'
  title: string
  author: string
  updatedAt: string
  href: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'právě teď'
  if (mins < 60) return `před ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `před ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `před ${days} d`
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

const STAT_CARDS = [
  { key: 'inbox',        label: 'Noví kandidáti',      sub: 'v inboxu',          href: '/app/inbox',                    color: '#e02020', icon: '⊹' },
  { key: 'claimed',      label: 'Claimnuté nástroje',  sub: 'aktivní',           href: '/app/claimboard',               color: '#22c55e', icon: '✦' },
  { key: 'review',       label: 'Čeká na kontrolu',    sub: 'use casy + projekty', href: '/app/review',                 color: '#f59e0b', icon: '◎' },
  { key: 'published',    label: 'Publikované use casy', sub: 'v knihovně',        href: '/app/usecases?filter=published', color: '#3b82f6', icon: '⧉' },
  { key: 'publishedProj', label: 'Publikované projekty', sub: 'zdokumentováno',  href: '/app/projects',                 color: '#8b5cf6', icon: '⬡' },
] as const

const WF_CARDS = [
  {
    title: 'Inbox nástrojů',
    desc: 'Přidej AI nástroje jako kandidáty a claimni je pro evaluaci.',
    href: '/app/inbox',
    btnLabel: 'Otevřít inbox',
    icon: '📥',
    accentColor: '#3b82f6',
    bg: 'rgba(59,130,246,0.07)',
  },
  {
    title: 'Claim → Test → Draft',
    desc: 'Claimni nástroj, vyplň evaluaci a vygeneruj draft use case pomocí AI.',
    href: '/app/claimboard',
    btnLabel: 'Moje claimy',
    icon: '✎',
    accentColor: '#22c55e',
    bg: 'rgba(34,197,94,0.07)',
  },
  {
    title: 'Chat asistent',
    desc: 'Popiš projekt nebo problém. AI se doptá a vytvoří kompletní use case draft.',
    href: '/app/chat',
    btnLabel: 'Otevřít chat',
    icon: '💬',
    accentColor: '#e02020',
    bg: 'rgba(224,32,32,0.07)',
  },
  {
    title: 'Projekty',
    desc: 'Zpětná analýza projektů kde byla použita AI. Co fungovalo, co ne a co příště.',
    href: '/app/projects',
    btnLabel: 'Otevřít projekty',
    icon: '📁',
    accentColor: '#8b5cf6',
    bg: 'rgba(139,92,246,0.07)',
  },
]

export default function Dashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({ inbox: 0, claimed: 0, review: 0, published: 0, publishedProj: 0 })
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    const load = async () => {
      const [
        { count: inbox }, { count: claimed },
        { count: reviewUC }, { count: reviewProj },
        { count: published }, { count: publishedProj },
      ] = await Promise.all([
        supabase.from('tools').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('tools').select('*', { count: 'exact', head: true }).eq('status', 'claimed'),
        supabase.from('use_cases').select('*', { count: 'exact', head: true }).eq('status', 'review'),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'review'),
        supabase.from('use_cases').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      ])
      setStats({
        inbox: inbox ?? 0,
        claimed: claimed ?? 0,
        review: (reviewUC ?? 0) + (reviewProj ?? 0),
        published: published ?? 0,
        publishedProj: publishedProj ?? 0,
      })

      const [{ data: ucData }, { data: projData }] = await Promise.all([
        supabase.from('use_cases').select('id, title, author_name, updated_at').order('updated_at', { ascending: false }).limit(5),
        supabase.from('projects').select('id, title, author_name, updated_at').order('updated_at', { ascending: false }).limit(5),
      ])
      const merged: ActivityItem[] = [
        ...(ucData ?? []).map((r: Record<string, string>) => ({
          id: r.id, type: 'usecase' as const,
          title: r.title ?? '—', author: r.author_name ?? '—',
          updatedAt: r.updated_at, href: `/app/usecases?id=${r.id}`,
        })),
        ...(projData ?? []).map((r: Record<string, string>) => ({
          id: r.id, type: 'project' as const,
          title: r.title ?? '—', author: r.author_name ?? '—',
          updatedAt: r.updated_at, href: `/app/projects?id=${r.id}`,
        })),
      ]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
      setActivity(merged)
    }
    load()
  }, [])

  const statValues: Record<string, number> = {
    inbox: stats.inbox,
    claimed: stats.claimed,
    review: stats.review,
    published: stats.published,
    publishedProj: stats.publishedProj,
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Přehled</h1>
          <p>Stav AI laboratoře — nástroje, claimy a use casy.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => router.push('/app/inbox')}>⟳ Discovery</button>
          <button className="btn btn-primary" onClick={() => router.push('/app/chat')}>+ Nový use case</button>
        </div>
      </div>

      <div className="page-body">
        {/* ── Stat karty ── */}
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20 }}>
          {STAT_CARDS.map(s => {
            const val = statValues[s.key]
            const isReview = s.key === 'review'
            const allClear = isReview && val === 0
            return (
              <div
                key={s.key}
                className="stat-card"
                style={{
                  cursor: 'pointer',
                  borderLeft: `3px solid ${allClear ? '#22c55e' : s.color}`,
                  position: 'relative',
                  ...(allClear ? {
                    boxShadow: '0 0 24px rgba(34,197,94,0.10), var(--shadow)',
                    borderColor: 'rgba(34,197,94,0.4)',
                  } : {}),
                }}
                onClick={() => router.push(s.href)}
              >
                {/* ikona vpravo nahoře */}
                <div style={{
                  position: 'absolute', top: 13, right: 14,
                  fontSize: 15, color: allClear ? '#22c55e' : s.color, opacity: 0.6,
                  lineHeight: 1,
                }}>
                  {s.icon}
                </div>

                <div className="stat-label">{s.label}</div>

                {allClear ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 2px' }}>
                    <span style={{ fontSize: 20, color: '#22c55e', fontWeight: 700, lineHeight: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Vše vyřešeno</span>
                  </div>
                ) : (
                  <div className="stat-value" style={{ fontSize: 36 }}>{val}</div>
                )}

                <div className="stat-sub">{s.sub}</div>
              </div>
            )
          })}
        </div>

        {/* ── Workflow karty ── */}
        <div className="wf-grid" style={{ marginBottom: 28, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {WF_CARDS.map(w => (
            <div
              key={w.title}
              className="wf-card"
              style={{ background: w.bg, transition: 'border-color 0.15s, transform 0.18s ease, box-shadow 0.18s ease' }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,0.28)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              <div style={{
                fontSize: 26, marginBottom: 10,
                color: w.accentColor, lineHeight: 1,
              }}>
                {w.icon}
              </div>
              <h3 style={{ marginBottom: 6 }}>{w.title}</h3>
              <p>{w.desc}</p>
              <div className="wf-card-btns">
                <button
                  className="btn btn-sm"
                  style={{
                    background: w.accentColor,
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                  }}
                  onClick={() => router.push(w.href)}
                >
                  {w.btnLabel}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Poslední aktivita ── */}
        <div>
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.7px',
            color: 'var(--text3)',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}>
            <span>◎</span> Poslední aktivita
          </div>

          {activity.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '16px 0' }}>Žádná aktivita</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {activity.map(item => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => router.push(item.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 14px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border2)'
                    e.currentTarget.style.background = 'var(--surface2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                >
                  <span style={{
                    fontSize: 13,
                    flexShrink: 0,
                    color: item.type === 'usecase' ? '#3b82f6' : '#8b5cf6',
                  }}>
                    {item.type === 'usecase' ? '⧉' : '⬡'}
                  </span>
                  <span style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text)',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
                    {item.author}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
                    {timeAgo(item.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
