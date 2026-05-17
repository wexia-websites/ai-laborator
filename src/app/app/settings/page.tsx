'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'
import { AVATARS, dicebearUrl } from '@/components/ProfileSetupModal'

export default function SettingsPage() {
  const router = useRouter()
  const { canAccess, canEdit, loading: roleLoading } = useRole()
  useEffect(() => {
    if (!roleLoading && !canAccess('settings')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [team, setTeam] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [bio, setBio] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null)
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [linkedinError, setLinkedinError] = useState('')

  const [sidebarDefault, setSidebarDefault] = useState(false)
  const [lightMode, setLightMode] = useState(false)
  const [revisionDays, setRevisionDays] = useState(90)
  const [revisionSaved, setRevisionSaved] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? '')
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      if (data) {
        setFirstName(data.first_name ?? '')
        setLastName(data.last_name ?? '')
        setTeam(data.team ?? '')
        setPhone(data.phone ?? '')
        setCompany(data.company ?? '')
        setPosition(data.position ?? '')
        setBio(data.bio ?? '')
        setLinkedinUrl(data.linkedin_url ?? '')
        // Avatar: detect if it's a dicebear URL or custom
        const av: string | null = data.avatar_url ?? null
        if (av) {
          const seedMatch = av.match(/seed=([^&]+)/)
          if (seedMatch) setSelectedSeed(seedMatch[1])
          else setCustomAvatarUrl(av)
        }
      }
      const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'revision_days').single()
      if (setting) setRevisionDays(parseInt(setting.value))
    }
    load()
    setSidebarDefault(localStorage.getItem('sidebar_default_open') !== 'false')
    setLightMode(localStorage.getItem('theme') === 'light')

    // Sync with sidebar theme toggle
    const handleThemeChange = (e: Event) => {
      setLightMode((e as CustomEvent<string>).detail === 'light')
    }
    window.addEventListener('ai-lab-theme-change', handleThemeChange)
    return () => window.removeEventListener('ai-lab-theme-change', handleThemeChange)
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCustomAvatarUrl(reader.result as string)
      setSelectedSeed(null)
    }
    reader.readAsDataURL(file)
  }

  const currentAvatarUrl = customAvatarUrl ?? (selectedSeed ? dicebearUrl(selectedSeed) : null)

  const toggleSidebar = (val: boolean) => {
    setSidebarDefault(val)
    localStorage.setItem('sidebar_default_open', String(val))
  }

  const toggleLightMode = (val: boolean) => {
    setLightMode(val)
    const theme = val ? 'light' : 'dark'
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    window.dispatchEvent(new CustomEvent('ai-lab-theme-change', { detail: theme }))
  }

  const toggleSwitch = (active: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      style={{
        flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: 'pointer', position: 'relative', padding: 0, transition: 'background 0.2s',
        background: active ? '#e02020' : 'var(--border2)',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: active ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  )

  const save = async () => {
    if (linkedinUrl && !linkedinUrl.startsWith('https://')) {
      setLinkedinError('URL musí začínat https://')
      return
    }
    setLinkedinError('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').upsert({
      id: user?.id,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      full_name: `${firstName.trim()} ${lastName.trim()}`.trim() || null,
      team: team.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      position: position.trim() || null,
      bio: bio.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      avatar_url: currentAvatarUrl,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const saveRevisionDays = async () => {
    const days = Math.max(7, Math.min(365, revisionDays))
    await supabase.from('app_settings').upsert({ key: 'revision_days', value: String(days), updated_at: new Date().toISOString() })
    setRevisionDays(days)
    setRevisionSaved(true)
    setTimeout(() => setRevisionSaved(false), 2000)
  }

  const SectionLabel = ({ title }: { title: string }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '16px 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {title}
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div><h1>Nastavení</h1><p>Správa profilu a účtu.</p></div>
      </div>
      <div className="page-body">
        <div className="settings-grid">

          {/* PROFIL */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Profil</h3>

            <SectionLabel title="Avatar" />
            {customAvatarUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <img src={customAvatarUrl} alt="avatar" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e02020' }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setCustomAvatarUrl(null)}>Zrušit vlastní foto</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
                {AVATARS.map(a => (
                  <button
                    key={a.seed}
                    onClick={() => setSelectedSeed(a.seed)}
                    title={`${a.emoji} ${a.name}`}
                    style={{
                      border: `2px solid ${selectedSeed === a.seed ? '#e02020' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: selectedSeed === a.seed ? 'rgba(224,32,32,0.08)' : 'transparent',
                      padding: 6, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <img src={dicebearUrl(a.seed)} alt={a.name} width={40} height={40} style={{ borderRadius: 4 }} />
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{a.emoji}</span>
                  </button>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => fileInputRef.current?.click()}>
              📷 Nahrát vlastní foto
            </button>

            <SectionLabel title="Osobní údaje" />
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={email} disabled style={{ opacity: 0.6 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Jméno</label>
                <input className="form-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jan" />
              </div>
              <div className="form-group">
                <label className="form-label">Příjmení</label>
                <input className="form-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Novák" />
              </div>
              <div className="form-group">
                <label className="form-label">Firma / Organizace</label>
                <input className="form-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Wexia Digital" />
              </div>
              <div className="form-group">
                <label className="form-label">Pracovní pozice</label>
                <input className="form-input" value={position} onChange={e => setPosition(e.target.value)} placeholder="Marketing Manager" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+420 123 456 789" />
              </div>
              <div className="form-group">
                <label className="form-label">Tým / Oddělení</label>
                <input className="form-input" value={team} onChange={e => setTeam(e.target.value)} placeholder="Marketing, IT…" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Bio</label>
                <textarea className="form-textarea" rows={2} value={bio} onChange={e => setBio(e.target.value)} placeholder="Krátce o sobě…" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">LinkedIn URL</label>
                <input className="form-input" style={linkedinError ? { borderColor: '#e02020' } : {}} value={linkedinUrl} onChange={e => { setLinkedinUrl(e.target.value); setLinkedinError('') }} placeholder="https://linkedin.com/in/..." />
                {linkedinError && <div style={{ fontSize: 11, color: '#e02020', marginTop: 3 }}>{linkedinError}</div>}
              </div>
            </div>
            <button className="btn btn-primary" onClick={save}>{saved ? '✓ Uloženo' : 'Uložit profil'}</button>
          </div>

          {/* PŘEDVOLBY */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Předvolby zobrazení</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>Boční panel otevřený po přihlášení</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sidebar se otevře automaticky při každém načtení</div>
              </div>
              {toggleSwitch(sidebarDefault, () => toggleSidebar(!sidebarDefault))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>Světlý režim</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Přepnout na světlé téma aplikace</div>
              </div>
              {toggleSwitch(lightMode, () => toggleLightMode(!lightMode))}
            </div>
          </div>

          {/* REVIZE – pouze pro admin+ */}
          {canEdit() && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Revizní systém</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
                Každý publikovaný use case dostane datum revize. Po uplynutí intervalu se zobrazí v záložce Revize.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Revize každých</label>
                <input type="number" className="form-input" min={7} max={365} value={revisionDays} onChange={e => setRevisionDays(Number(e.target.value))} style={{ width: 80 }} />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>dní</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveRevisionDays}>
                {revisionSaved ? '✓ Uloženo' : 'Uložit'}
              </button>
            </div>
          )}

          {/* O APLIKACI */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>O aplikaci</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
              <strong>AI Laboratoř</strong> — firemní systém pro správu AI use casů.<br /><br />
              AI chatbot (Claude) má API klíč uložený na serveru (Vercel). Zaměstnanci ho nevidí ani nezadávají.
            </p>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Model: claude-sonnet-4-20250514<br />
              Hosting: Vercel<br />
              Databáze: Supabase (PostgreSQL)
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
