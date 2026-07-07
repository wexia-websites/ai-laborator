'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { markOnboardingComplete } from '@/lib/onboarding'

type TourStep = {
  id: string
  target: string | null
  title: string
  description: string
  position: 'center' | 'right' | 'left' | 'top' | 'bottom'
  navigateTo?: string
  ctaButtons?: { label: string; href: string; primary: boolean }[]
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Vítej v AI Laboratoři! 🧪',
    description: 'AI Laboratoř je firemní systém pro dokumentaci a sdílení AI znalostí — use casy, nástroje, projekty a žebříčky. Za 2 minuty tě provedeme vším důležitým.',
    position: 'center',
  },
  {
    id: 'chat',
    target: '[data-nav-id="chat"]',
    title: 'Chat — tvůj hlavní vstupní bod 💬',
    description: 'Tady začíná vše. Popiš projekt nebo problém vlastními slovy — AI se tě doptá a automaticky vytvoří draft use casu nebo projektu. Nemusíš vyplňovat žádný formulář.',
    position: 'right',
  },
  {
    id: 'chat-input',
    target: '[data-tour-id="chat-input"]',
    navigateTo: '/app/chat',
    title: 'Napiš sem co řešíš ✍️',
    description: 'Stačí napsat "Chci zdokumentovat projekt" nebo "Testoval jsem nový AI nástroj" — AI se postará o zbytek. Mluv přirozeně, jako s kolegou.',
    position: 'top',
  },
  {
    id: 'inbox',
    target: '[data-nav-id="inbox"]',
    navigateTo: '/app',
    title: 'K otestování — fronta nástrojů 🔬',
    description: 'Sem přicházejí nové AI nástroje čekající na otestování. Claimni nástroj, otestuj ho a zdokumentuj výsledky — hodnocení, úspory času, slabiny.',
    position: 'right',
  },
  {
    id: 'usecases',
    target: '[data-nav-id="usecases"]',
    title: 'Use casy — firemní znalostní báze 📚',
    description: 'Knihovna všech zdokumentovaných AI use casů. Filtruj podle kategorie, náročnosti nebo autora. Každý use case má hodnocení, aha moment a doporučení pro ostatní.',
    position: 'right',
  },
  {
    id: 'new-usecase',
    target: '[data-tour-id="new-usecase"]',
    navigateTo: '/app/usecases',
    title: 'Tady přidáš nový use case ➕',
    description: 'Klikni sem pro ruční vyplnění formuláře. Nebo použij Chat — AI ho vytvoří za tebe na základě rozhovoru.',
    position: 'bottom',
  },
  {
    id: 'projects',
    target: '[data-nav-id="projects"]',
    navigateTo: '/app',
    title: 'Projekty — zpětná analýza 📁',
    description: 'Dokumentuj projekty kde byla použita AI. Co fungovalo, co ne, jaké nástroje, jak přispěla AI. Skvělý mustr pro příští podobný projekt.',
    position: 'right',
  },
  {
    id: 'ranking',
    target: '[data-nav-id="ranking"]',
    title: 'Žebříček — nejlepší nástroje a use casy 🏆',
    description: 'Přehled nejlépe hodnoceného obsahu napříč celou firmou. Rychlý způsob jak zjistit co ostatním funguje nejlépe.',
    position: 'right',
  },
  {
    id: 'revision',
    target: '[data-nav-id="revision"]',
    title: 'Revize — schvalovací fronta ✅',
    description: 'Drafty use casů a projektů čekají na schválení adminů. Po schválení se zobrazí v knihovně přístupné všem.',
    position: 'right',
  },
  {
    id: 'finish',
    target: null,
    title: 'Jsi připraven/a! 🚀',
    description: 'Teď víš o všem co AI Laboratoř umí. Nejlepší start? Otevři Chat a napiš o prvním projektu nebo nástroji který jsi testoval/a — AI se postará o zbytek.',
    position: 'center',
    ctaButtons: [
      { label: 'Otevřít Chat', href: '/app/chat', primary: true },
      { label: 'Přejít na Dashboard', href: '/app', primary: false },
    ],
  },
]

type TargetRect = { top: number; left: number; width: number; height: number }

const PAD = 8
const TOOLTIP_W = 320

function computeTooltipStyle(
  rect: TargetRect,
  position: TourStep['position']
): React.CSSProperties {
  const GAP = 14
  const hl = { top: rect.top - PAD, left: rect.left - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 }
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const clampL = (l: number) => Math.max(8, Math.min(l, vw - TOOLTIP_W - 8))

  switch (position) {
    case 'right':
      return { top: Math.max(8, hl.top + hl.h / 2 - 110), left: Math.min(hl.left + hl.w + GAP, vw - TOOLTIP_W - 8) }
    case 'left':
      return { top: Math.max(8, hl.top + hl.h / 2 - 110), left: Math.max(8, hl.left - TOOLTIP_W - GAP) }
    case 'bottom':
      return { top: Math.min(hl.top + hl.h + GAP, vh - 260), left: clampL(hl.left + hl.w / 2 - TOOLTIP_W / 2) }
    case 'top':
      return { top: Math.max(8, hl.top - 220 - GAP), left: clampL(hl.left + hl.w / 2 - TOOLTIP_W / 2) }
    default:
      return {}
  }
}

type Props = {
  userId: string
  onClose: () => void
  preview?: boolean
}

export default function OnboardingTour({ userId, onClose, preview = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const current = STEPS[step]

  const clearRetry = () => { if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null } }

  const findRect = useCallback((selector: string): boolean => {
    const el = document.querySelector(selector)
    if (!el) return false
    const r = el.getBoundingClientRect()
    setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    return true
  }, [])

  const startRetry = useCallback((selector: string) => {
    clearRetry()
    if (findRect(selector)) return
    let attempts = 0
    retryRef.current = setInterval(() => {
      attempts++
      if (findRect(selector)) { clearRetry(); return }
      if (attempts >= 15) clearRetry()
    }, 200)
  }, [findRect])

  // When step changes
  useEffect(() => {
    clearRetry()
    setTargetRect(null)
    if (!current.target) return

    if (current.navigateTo && pathname !== current.navigateTo) {
      setPendingNav(current.navigateTo)
      router.push(current.navigateTo)
      return
    }

    startRetry(current.target)
    return clearRetry
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // After navigation completes
  useEffect(() => {
    if (!pendingNav || pathname !== pendingNav) return
    setPendingNav(null)
    if (current.target) startRetry(current.target)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = async () => {
    clearRetry()
    if (!preview) await markOnboardingComplete(userId)
    onClose()
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else handleClose()
  }

  const handleBack = () => { if (step > 0) setStep(s => s - 1) }

  const isCenter = current.position === 'center'

  const footerButtons = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
      <button
        onClick={handleClose}
        style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
      >
        Přeskočit
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={handleBack}>← Zpět</button>
        )}
        <button className="btn btn-primary btn-sm" onClick={handleNext}>
          {step === STEPS.length - 1 ? 'Dokončit' : 'Další →'}
        </button>
      </div>
    </div>
  )

  const tooltipInner = (
    <>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{current.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>{current.description}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{step + 1} / {STEPS.length}</div>
      {current.ctaButtons ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {current.ctaButtons.map(btn => (
            <button
              key={btn.href}
              className={btn.primary ? 'btn btn-primary' : 'btn btn-outline'}
              onClick={() => { handleClose(); router.push(btn.href) }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      ) : footerButtons}
    </>
  )

  const tooltipBase: React.CSSProperties = {
    background: 'var(--surface2)',
    border: '1px solid var(--accent)',
    borderRadius: 12,
    padding: '16px 20px',
    maxWidth: TOOLTIP_W,
    width: TOOLTIP_W,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    pointerEvents: 'all',
    zIndex: 10000,
  }

  // Centered modal (no target)
  if (isCenter) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{ ...tooltipBase, position: 'relative', maxWidth: 420, width: '100%' }}>
          <button
            onClick={handleClose}
            style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
          {tooltipInner}
        </div>
      </div>
    )
  }

  const hlStyle: React.CSSProperties = targetRect ? {
    position: 'fixed',
    top: targetRect.top - PAD,
    left: targetRect.left - PAD,
    width: targetRect.width + PAD * 2,
    height: targetRect.height + PAD * 2,
    borderRadius: 8,
    outline: '2px solid var(--accent)',
    // Box-shadow creates the backdrop "hole" effect
    boxShadow: '0 0 0 4px rgba(224,32,32,0.25), 0 0 0 9999px rgba(0,0,0,0.65)',
    zIndex: 9998,
    pointerEvents: 'none',
    transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
  } : {}

  const tooltipPos = targetRect
    ? computeTooltipStyle(targetRect, current.position)
    : { top: '50%' as any, left: '50%' as any, transform: 'translate(-50%,-50%)' }

  return (
    <>
      {/* Fallback dark bg before element is found */}
      {!targetRect && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9996, background: 'rgba(0,0,0,0.65)' }} />
      )}

      {/* Click blocker — blocks all background interactions */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9997, cursor: 'default' }}
        onClick={e => e.stopPropagation()} />

      {/* Spotlight highlight */}
      {targetRect && <div style={hlStyle} />}

      {/* Tooltip */}
      <div key={step} style={{ position: 'fixed', ...tooltipPos, ...tooltipBase }}>
        {tooltipInner}
      </div>
    </>
  )
}
