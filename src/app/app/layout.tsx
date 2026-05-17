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
      { id: 'revision',      label: 'Revize',          icon: '↺', href: '/app/revision' },
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

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail as 'dark' | 'light'
      setTheme(prev => prev === next ? prev : next)
    }
    window.addEventListener('ai-lab-theme-change', handleThemeChange)
    return () => window.removeEventListener('ai-lab-theme-change', handleThemeChange)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    window.dispatchEvent(new CustomEvent('ai-lab-theme-change', { detail: next }))
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

  const activeId = ALL_NAV_ITEMS.find(n => {
    const hrefPath = n.href.split('?')[0]
    return pathname === hrefPath || (hrefPath !== '/app' && pathname.startsWith(hrefPath))
  })?.id ?? 'dashboard'

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

      {sidebarOpen ? (
        <button
          onClick={() => setSidebarOpen(false)}
          title="Skrýt sidebar"
          style={{
            position: 'fixed',
            top: '50%',
            left: 208,
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
          ‹
        </button>
      ) : (
        <div
          onClick={() => setSidebarOpen(true)}
          title="Zobrazit sidebar"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            width: 16,
            background: 'var(--border)',
            cursor: 'pointer',
            transition: 'background 0.2s',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e02020')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--border)')}
        >
          <span style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1, userSelect: 'none' }}>›</span>
        </div>
      )}

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
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          {/* Klikatelný blok → nastavení */}
          <div
            onClick={() => router.push('/app/settings')}
            style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s', margin: '4px 4px 0' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Řádek 1: Avatar + Jméno + Theme toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar"
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#e02020', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff', fontWeight: 700,
                }}>
                  {initials}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
              </div>
              {/* Theme toggle – zastaví propagaci kliknutí na settings */}
              <button
                onClick={e => { e.stopPropagation(); toggleTheme() }}
                title={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '2px 4px', borderRadius: 4, color: 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {sidebarOpen
                  ? (theme === 'dark' ? '☀️ Světlý' : '🌙 Tmavý')
                  : (theme === 'dark' ? '☀️' : '🌙')}
              </button>
            </div>
            {/* Řádek 2: Role badge */}
            {role && (
              <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 40 }}>
                {ROLE_LABELS[role]}
              </div>
            )}
          </div>
          {/* Řádek 3: Odhlásit */}
          <div style={{ padding: '4px 12px 10px', display: 'flex', alignItems: 'center' }}>
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
