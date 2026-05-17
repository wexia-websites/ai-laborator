'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'
import ProfileSetupModal from '@/components/ProfileSetupModal'
import type { User } from '@supabase/supabase-js'

type NavItem = { id: string; label: string; icon: string; href: string }
type NavSection = { heading?: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: 'chat',      label: 'Chat',    icon: '💬', href: '/app/chat' },
      { id: 'dashboard', label: 'Přehled', icon: '▦',  href: '/app' },
    ],
  },
  {
    heading: 'AI NÁSTROJE',
    items: [
      { id: 'inbox',         label: 'K otestování',    icon: '⊹', href: '/app/inbox' },
      { id: 'verify',        label: 'Verifikace',      icon: '⚐', href: '/app/verify' },
      { id: 'tools-tested',  label: 'Otestované',      icon: '✦', href: '/app/tools-tested' },
      { id: 'ai-watch',      label: 'AI News feed',    icon: '◌', href: '/app/ai-watch' },
      { id: 'claimboard',    label: 'Claim board',     icon: '✎', href: '/app/claimboard' },
      { id: 'usecases',      label: 'Use casy',        icon: '⧉', href: '/app/usecases' },
      { id: 'revision',      label: 'Revize',          icon: '↺', href: '/app/usecases?tab=revize' },
      { id: 'ranking',       label: 'Žebříček',        icon: '⊟', href: '/app/ranking' },
    ],
  },
  {
    heading: 'PROJEKTY',
    items: [
      { id: 'projects', label: 'Projekty', icon: '⬡', href: '/app/projects' },
    ],
  },
  {
    heading: 'SPRÁVA',
    items: [
      { id: 'review',   label: 'Kontrola',         icon: '✓', href: '/app/review' },
      { id: 'settings', label: 'Nastavení',        icon: '◈', href: '/app/settings' },
      { id: 'admin',    label: 'Správa uživatelů', icon: '◉', href: '/app/admin' },
    ],
  },
]

const ROLE_LABELS: Record<string, string> = {
  super_admin: '👑 Super Admin',
  admin: '🔧 Admin',
  analyst: '📝 Analyst',
  viewer: '👁️ Viewer',
}

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [revisionDueCount, setRevisionDueCount] = useState(0)
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' || localStorage.getItem('sidebar_default_open') !== 'false'
  )
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark'
  })

  const { role, loading: roleLoading, canAccess } = useRole()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  const checkRevisions = async () => {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('use_cases')
      .select('id')
      .eq('status', 'published')
      .lte('revision_due_at', now)
    if (data && data.length > 0) {
      await supabase.from('use_cases').update({ revision_status: 'due' })
        .eq('status', 'published').lte('revision_due_at', now)
      setRevisionDueCount(data.length)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      if (!session) { router.replace('/login'); return }
      setUser(session.user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_completed, avatar_url, first_name, last_name')
        .eq('id', session.user.id)
        .single()

      setProfileCompleted(profile?.profile_completed ?? false)
      setAvatarUrl(profile?.avatar_url ?? null)
      setFirstName(profile?.first_name ?? null)
      setLastName(profile?.last_name ?? null)

      setLoading(false)
      checkRevisions()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_: any, session: any) => {
      if (!session) router.replace('/login')
      else setUser(session.user)
    })
    return () => subscription.unsubscribe()
  }, [router])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (roleLoading) return
    if (role === 'viewer' && (pathname === '/app' || pathname === '/app/')) {
      router.replace('/app/ranking')
    }
  }, [role, roleLoading, pathname, router])

  if (loading || roleLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#606060', background: '#0a0a0a' }}>
      Načítám…
    </div>
  )

  const filteredSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(n => canAccess(n.id)),
  })).filter(s => s.items.length > 0)

  const activeId = ALL_NAV_ITEMS.find(n =>
    pathname === n.href || (n.href !== '/app' && !n.href.includes('?') && pathname.startsWith(n.href))
  )?.id ?? 'dashboard'

  const navHeadingStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    color: 'var(--text3)',
    marginTop: 16,
    marginBottom: 4,
    paddingLeft: 11,
    whiteSpace: 'nowrap',
  }

  const displayName = firstName
    ? `${firstName}${lastName ? ' ' + lastName : ''}`
    : user?.email?.split('@')[0] ?? ''

  const initials = firstName
    ? `${firstName[0]}${lastName?.[0] ?? ''}`.toUpperCase()
    : (user?.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="app">
      {/* Profile setup modal – nelze zavřít dokud není profil vyplněn */}
      {profileCompleted === false && user && (
        <ProfileSetupModal
          userId={user.id}
          onComplete={(url, fn, ln) => {
            setProfileCompleted(true)
            setAvatarUrl(url)
            setFirstName(fn)
            setLastName(ln)
          }}
        />
      )}

      <button
        onClick={() => setSidebarOpen(o => !o)}
        title={sidebarOpen ? 'Skrýt sidebar' : 'Zobrazit sidebar'}
        style={{
          position: 'fixed',
          top: '50%',
          left: sidebarOpen ? 208 : 0,
          transform: 'translateY(-50%)',
          zIndex: 60,
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          color: 'var(--text)',
          fontSize: 28,
          cursor: 'pointer',
          lineHeight: 1,
          padding: '4px 2px',
          transition: 'left 0.25s ease, color 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e02020')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
      >
        {sidebarOpen ? '‹' : '›'}
      </button>

      <nav className={`sidebar${sidebarOpen ? '' : ' closed'}`}>
        <div className="sidebar-logo" onClick={() => router.push('/app/chat')} style={{ cursor: 'pointer' }}>
          <div className="sidebar-logo-mark">λ</div>
          <div className="sidebar-logo-text">
            <strong>AI Laboratoř</strong>
            <span>use case systém</span>
          </div>
        </div>
        {filteredSections.map((section, i) => (
          <div key={i}>
            {section.heading && <div style={navHeadingStyle}>{section.heading}</div>}
            {section.items.map(n => (
              <button key={n.id} className={`nav-link ${activeId === n.id ? 'active' : ''}`}
                onClick={() => router.push(n.href)}>
                <span className="nav-icon">{n.icon}</span>{n.label}
                {n.id === 'revision' && revisionDueCount > 0 && (
                  <span className="revision-badge">{revisionDueCount}</span>
                )}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-tip">
          <strong>Tip</strong><br />
          Napiš popis v <strong>Chatu</strong> → AI se doptá → uloží use case. Nebo claimni nástroj z <strong>Inboxu</strong>.
        </div>

        {/* User info + avatar */}
        <div style={{ padding: '10px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#e02020',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#fff', fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              {role && (
                <div style={{ fontSize: 10, color: 'var(--text3)', opacity: 0.7 }}>{ROLE_LABELS[role]}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 4, color: 'var(--text3)' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="btn btn-ghost btn-xs"
              onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}>
              Odhlásit
            </button>
          </div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
