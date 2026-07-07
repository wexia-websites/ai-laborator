'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/* ─── Types ────────────────────────────────────────────────── */
type TryMode = {
  instruction: string
  type: 'mutation' | 'click' | 'navigate'
  selector?: string
  targetUrl?: string
  skipLabel: string
}

type TourStep = {
  id: string
  title: string
  description: string
  bullets?: string[]
  tip?: string
  target?: string
  navigateTo?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  tryMode?: TryMode
}

/* ─── Steps ─────────────────────────────────────────────────── */
const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Vítej v AI Laboratoři! 🧪',
    description: 'AI Laboratoř je firemní systém pro dokumentaci a sdílení AI znalostí — use casy, nástroje, projekty a žebříčky. Za chvíli tě provedeme vším důležitým.',
    bullets: [
      'Dokumentace AI use casů a nástrojů',
      'Zpětná analýza projektů kde byla použita AI',
      'Žebříček nejlepšího obsahu napříč firmou',
      'AI News feed — novinky ze světa AI automaticky',
    ],
    tip: 'Průvodce tě provede vším za ~3 minuty. Kdykoliv ho spustíš znovu přes "Průvodce" v levém menu.',
    position: 'center',
  },
  {
    id: 'dashboard',
    title: 'Dashboard — přehled všeho 📊',
    description: 'Na dashboardu vidíš stav celé AI Laboratoře na jednom místě.',
    bullets: [
      'Statistiky: kandidáti, claimy, revize, use casy, projekty',
      'Kliknutím na kartu statistiky filtruješ seznam pod ní',
      'Workflow karty — rychlé zkratky k hlavním akcím',
      'Poslední aktivita — co se v appce dělo nedávno',
    ],
    tip: 'Červený badge "V revizi" = čeká na tvoji akci jako admin.',
    target: '[data-nav-id="dashboard"]',
    navigateTo: '/app',
    position: 'right',
  },
  {
    id: 'chat-intro',
    title: 'Chat — hlavní vstupní bod 💬',
    description: 'Tady začíná vše. Popiš projekt nebo problém vlastními slovy — AI se tě doptá a automaticky vytvoří draft use casu nebo projektu.',
    bullets: [
      'Mluv přirozeně — žádné formuláře',
      'Režim use case: "Chci zdokumentovat AI nástroj"',
      'Režim projekt: "Chci zaznamenat projekt"',
      'AI se doptá, vytvoří draft, ty jen schválíš',
    ],
    tip: 'Začni větou "Chci zdokumentovat..." a AI převezme iniciativu.',
    target: '[data-nav-id="chat"]',
    navigateTo: '/app',
    position: 'right',
  },
  {
    id: 'chat-try',
    title: 'Zkus napsat zprávu ✍️',
    description: 'Chat funguje jako rozhovor. Napiš cokoliv a AI odpoví.',
    bullets: [
      'Po odeslání AI pokládá doplňující otázky',
      'Na konci rozhovoru tlačítko "Uložit jako draft"',
      'Draft pak čeká na revizi adminů',
      'Po schválení se zobrazí všem uživatelům',
    ],
    tip: 'Zkus napsat: "Chci zdokumentovat jak jsem použil Claude pro psaní emailů"',
    target: '[data-tour-id="chat-input"]',
    navigateTo: '/app/chat',
    position: 'top',
    tryMode: {
      instruction: '✍️ Napiš zprávu do chatu a odešli ji — průvodce automaticky pokračuje',
      type: 'mutation',
      selector: '.msg.user',
      skipLabel: 'Přeskočit',
    },
  },
  {
    id: 'inbox',
    title: 'K otestování — fronta nástrojů 🔬',
    description: 'Sem přicházejí nové AI nástroje čekající na otestování. Každý člen týmu si může nástroj claimnout.',
    bullets: [
      'Seznam nástrojů navržených k otestování',
      '"Claim" = přiřadíš si nástroj sobě k testování',
      'Po testování vyplníš hodnocení a poznámky',
      'Výsledek přejde do knihovny "Otestované"',
    ],
    tip: 'Claimnutý nástroj najdeš pak v sekci "Moje práce".',
    target: '[data-nav-id="inbox"]',
    navigateTo: '/app',
    position: 'right',
    tryMode: {
      instruction: '🔬 Klikni na "K otestování" v levém menu',
      type: 'navigate',
      targetUrl: '/app/inbox',
      skipLabel: 'Přeskočit',
    },
  },
  {
    id: 'tools-tested',
    title: 'Otestované — znalostní báze nástrojů 📖',
    description: 'Knihovna všech otestovaných AI nástrojů s kompletními recenzemi.',
    bullets: [
      'Detailní recenze každého nástroje',
      'Hodnocení 1–10, úspora času, aha moment, slabiny',
      'Filtrování podle kategorie a hodnocení',
      'Klik na nástroj → otevře plný detail s recenzí',
    ],
    tip: 'Klikni na libovolný nástroj — zobrazí se kompletní detail.',
    target: '[data-nav-id="tools-tested"]',
    navigateTo: '/app/inbox',
    position: 'right',
    tryMode: {
      instruction: '📖 Klikni na libovolnou kartu nástroje pro zobrazení detailu',
      type: 'click',
      selector: '.tool-card',
      skipLabel: 'Přeskočit',
    },
  },
  {
    id: 'usecases',
    title: 'Use casy — firemní znalostní báze 📚',
    description: 'Hlavní knihovna zdokumentovaných AI use casů. Každý use case popisuje konkrétní způsob využití AI v praxi.',
    bullets: [
      'Filtrování podle kategorie, náročnosti, autora',
      'Každý use case: účel, úspora času, aha moment, slabiny',
      'Klik na kartu → otevře plný detail',
      'Tlačítko "Review" → odešle draft ke schválení',
    ],
    tip: 'Klikni na libovolný use case pro zobrazení detailu.',
    target: '[data-nav-id="usecases"]',
    navigateTo: '/app/tools-tested',
    position: 'right',
    tryMode: {
      instruction: '📚 Klikni na "Use casy" v levém menu',
      type: 'navigate',
      targetUrl: '/app/usecases',
      skipLabel: 'Přeskočit',
    },
  },
  {
    id: 'usecase-detail',
    title: 'Rozklikni detail use casu 🔍',
    description: 'Každý use case má kompletní detail s hodnocením, úsporami času a doporučeními.',
    bullets: [
      'Hodnocení náročnosti, dopadu a confidence',
      'Úspora času a aha moment',
      'Slabiny a doporučení pro ostatní',
      'Export do HTML, PDF nebo Word',
    ],
    tip: 'Klikni na libovolnou kartu — otevře se plný detail.',
    target: '.uc-card',
    navigateTo: '/app/usecases',
    position: 'right',
    tryMode: {
      instruction: '🔍 Klikni na libovolný use case pro zobrazení detailu',
      type: 'click',
      selector: '.uc-card',
      skipLabel: 'Přeskočit',
    },
  },
  {
    id: 'new-usecase',
    title: 'Přidej nový use case ➕',
    description: 'Klikni sem pro vytvoření nového use casu — buď ručně formulářem nebo přes Chat kde AI pomůže.',
    bullets: [
      'Ruční formulář: vyplníš všechna pole sám',
      'Chat: AI se tě doptá a vyplní za tebe',
      'Obojí vytvoří draft čekající na revizi',
      'Po schválení adminem viditelný všem',
    ],
    tip: 'Doporučujeme Chat — je rychlejší a AI ti pomůže formulovat vše správně.',
    target: '[data-tour-id="new-usecase"]',
    navigateTo: '/app/usecases',
    position: 'bottom',
  },
  {
    id: 'projects',
    title: 'Projekty — zpětná analýza 📁',
    description: 'Dokumentuj projekty kde byla použita AI. Co fungovalo, co ne, jaké nástroje, jak přispěla AI.',
    bullets: [
      'Dashboard: probíhající, dokončené, v revizi, drafty',
      'Chat průvodce: AI se tě doptá na celou retrospektivu',
      'Hodnocení nástrojů a celkové hodnocení projektu',
      'Filtrování kliknutím na kartu stavu',
    ],
    tip: 'Klikni na "+ Nový projekt (chat)" — AI se tě sám doptá na vše.',
    target: '[data-nav-id="projects"]',
    navigateTo: '/app/usecases',
    position: 'right',
    tryMode: {
      instruction: '📁 Klikni na "Projekty" v levém menu',
      type: 'navigate',
      targetUrl: '/app/projects',
      skipLabel: 'Přeskočit',
    },
  },
  {
    id: 'ranking',
    title: 'Žebříček — nejlepší obsah firmy 🏆',
    description: 'Nejlépe hodnocené use casy a nástroje napříč celou firmou seřazené podle ratingu.',
    bullets: [
      'Filtruj podle kategorie: obrázky, kódování, chatbot, ostatní',
      'Klik na položku → plný detail',
      'Automaticky se aktualizuje po schválení nového obsahu',
      'Rychlý způsob jak zjistit co ostatním funguje nejlépe',
    ],
    tip: 'Před testováním nástroje se podívej sem — možná ho někdo testoval před tebou.',
    target: '[data-nav-id="ranking"]',
    navigateTo: '/app/projects',
    position: 'right',
  },
  {
    id: 'revision',
    title: 'Revize — schvalovací fronta ✅',
    description: 'Drafty use casů a projektů čekají na schválení adminů. Červený badge = počet čekajících.',
    bullets: [
      'Admini vidí všechny drafty čekající na schválení',
      'Schválit → obsah viditelný všem uživatelům',
      'Vrátit k úpravám → autor dostane zpětnou vazbu',
      'Zamítnout → draft se smaže',
    ],
    tip: 'Pokud jsi admin, červené číslo v sidebaru = čeká na tebe.',
    target: '[data-nav-id="revision"]',
    navigateTo: '/app/ranking',
    position: 'right',
  },
  {
    id: 'finish',
    title: 'Jsi připraven/a! 🚀',
    description: 'Teď víš o všem co AI Laboratoř umí. Nejlepší start? Otevři Chat a napiš o prvním projektu nebo nástroji.',
    tip: 'Průvodce kdykoliv spustíš znovu přes "Průvodce" v levém menu.',
    position: 'center',
  },
]

/* ─── Arrow helper ─────────────────────────────────────────── */
type ArrowSide = 'left' | 'right' | 'top' | 'bottom'

function arrowStyle(side: ArrowSide | null): React.CSSProperties {
  if (!side) return {}
  const base: React.CSSProperties = { position: 'absolute', width: 0, height: 0 }
  switch (side) {
    case 'left':  return { ...base, left: -9, top: '50%', transform: 'translateY(-50%)', borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: '9px solid var(--accent)' }
    case 'right': return { ...base, right: -9, top: '50%', transform: 'translateY(-50%)', borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '9px solid var(--accent)' }
    case 'top':   return { ...base, top: -9, left: '50%', transform: 'translateX(-50%)', borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: '9px solid var(--accent)' }
    case 'bottom':return { ...base, bottom: -9, left: '50%', transform: 'translateX(-50%)', borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '9px solid var(--accent)' }
  }
}

/* ─── Component ────────────────────────────────────────────── */
interface Props { onComplete: () => void }

export default function OnboardingTour({ onComplete }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [stepIndex, setStepIndex]       = useState(0)
  const [tryCompleted, setTryCompleted] = useState(false)
  const [tryTimedOut, setTryTimedOut]   = useState(false)
  const [tooltipX, setTooltipX]         = useState<number | null>(null)
  const [tooltipY, setTooltipY]         = useState<number | null>(null)
  const [arrow, setArrow]               = useState<ArrowSide | null>(null)
  const [fading, setFading]             = useState(false)

  const highlightRef   = useRef<HTMLElement | null>(null)
  const pendingNavRef  = useRef<string | null>(null)
  const onCompleteRef  = useRef(onComplete)
  const stepIndexRef   = useRef(stepIndex)

  onCompleteRef.current = onComplete
  stepIndexRef.current  = stepIndex

  const step    = STEPS[stepIndex]
  const isCenter = !step.target || step.position === 'center'
  const isLast  = stepIndex === STEPS.length - 1
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  /* ── Highlight helpers ── */
  const removeHighlight = useCallback(() => {
    if (!highlightRef.current) return
    const el = highlightRef.current
    el.style.outline = ''
    el.style.outlineOffset = ''
    el.style.position = ''
    el.style.zIndex = ''
    highlightRef.current = null
  }, [])

  const applyHighlight = useCallback((sel: string): HTMLElement | null => {
    removeHighlight()
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return null
    el.style.outline = '3px solid var(--accent)'
    el.style.outlineOffset = '4px'
    el.style.position = 'relative'
    el.style.zIndex = '9999'
    highlightRef.current = el
    return el
  }, [removeHighlight])

  /* ── Tooltip position ── */
  const positionTooltip = useCallback((sel: string, pos: TourStep['position']) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el || pos === 'center') {
      setTooltipX(null); setTooltipY(null); setArrow(null)
      return
    }
    const r    = el.getBoundingClientRect()
    const TW   = 420, TH = 420, M = 16
    const vw   = window.innerWidth, vh = window.innerHeight
    const EDGE = 16                     // viewport margin
    const SIDEBAR_END = 228             // min left after sidebar (~220px sidebar + 8px gap)
    const clampX = (v: number) => Math.max(EDGE, Math.min(v, vw - TW - EDGE))
    const clampY = (v: number) => Math.max(EDGE, Math.min(v, vh - TH - EDGE))

    switch (pos) {
      case 'right': {
        // Always place after sidebar + gap, never overlap it
        const rawLeft = r.right + M
        setTooltipX(Math.max(SIDEBAR_END, Math.min(rawLeft, vw - TW - EDGE)))
        setTooltipY(clampY(r.top + r.height / 2 - TH / 2))
        setArrow('left')
        break
      }
      case 'left':
        setTooltipX(Math.max(EDGE, r.left - TW - M))
        setTooltipY(clampY(r.top + r.height / 2 - TH / 2))
        setArrow('right')
        break
      case 'bottom':
        setTooltipX(clampX(r.left + r.width / 2 - TW / 2))
        setTooltipY(clampY(r.bottom + M))
        setArrow('top')
        break
      case 'top':
        setTooltipX(clampX(r.left + r.width / 2 - TW / 2))
        setTooltipY(clampY(r.top - TH - M))
        setArrow('bottom')
        break
      default:
        setTooltipX(null); setTooltipY(null); setArrow(null)
    }
  }, [])

  /* ── Setup step (with retry) ── */
  const setupStep = useCallback((idx: number, currentPath: string) => {
    const s = STEPS[idx]
    setTryCompleted(false)

    if (s.navigateTo && currentPath.split('?')[0] !== s.navigateTo) {
      pendingNavRef.current = s.navigateTo
      router.push(s.navigateTo)
      return
    }
    pendingNavRef.current = null

    if (!s.target || s.position === 'center') {
      removeHighlight()
      setTooltipX(null); setTooltipY(null); setArrow(null)
      return
    }

    const attempt = (n = 0) => {
      const el = applyHighlight(s.target!)
      if (el) { positionTooltip(s.target!, s.position); return }
      if (n < 15) setTimeout(() => attempt(n + 1), 200)
      else { removeHighlight(); setTooltipX(null); setTooltipY(null); setArrow(null) }
    }
    attempt()
  }, [router, applyHighlight, positionTooltip, removeHighlight])

  /* ── Advance ── */
  const advance = useCallback(() => {
    const idx = stepIndexRef.current
    if (idx >= STEPS.length - 1) {
      removeHighlight()
      onCompleteRef.current()
    } else {
      setFading(true)
      setTimeout(() => { setFading(false); setStepIndex(idx + 1) }, 150)
    }
  }, [removeHighlight])

  const skipTryMode = () => { setTryCompleted(true); setTryTimedOut(false); advance() }
  const prevStep    = () => { if (stepIndex > 0) { setTryCompleted(false); setTryTimedOut(false); setFading(true); setTimeout(() => { setFading(false); setStepIndex(s => s - 1) }, 150) } }

  /* ── Step change effect ── */
  useEffect(() => {
    setupStep(stepIndex, pathname)
  }, [stepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pathname change effect ── */
  useEffect(() => {
    // Pending navigation resolved
    if (pendingNavRef.current && pathname === pendingNavRef.current) {
      pendingNavRef.current = null
      const s = STEPS[stepIndex]
      if (s.target && s.position !== 'center') {
        setTimeout(() => {
          applyHighlight(s.target!)
          positionTooltip(s.target!, s.position)
        }, 500)
      }
    }

    // tryMode: navigate type
    const s = STEPS[stepIndex]
    if (s?.tryMode?.type === 'navigate' && s.tryMode.targetUrl && pathname === s.tryMode.targetUrl) {
      setTryCompleted(true)
      setTimeout(() => advance(), 600)
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── tryMode: click listener ── */
  useEffect(() => {
    const s = STEPS[stepIndex]
    if (!s.tryMode || s.tryMode.type !== 'click' || !s.tryMode.selector || tryCompleted) return
    const sel = s.tryMode.selector
    const handler = (e: MouseEvent) => {
      if ((e.target as Element)?.closest(sel)) {
        document.removeEventListener('click', handler, true)
        setTryCompleted(true)
        setTimeout(() => advance(), 1000)
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [stepIndex, tryCompleted, advance])

  /* ── tryMode: mutation — multi-method chat detection ── */
  useEffect(() => {
    const s = STEPS[stepIndex]
    if (!s.tryMode || s.tryMode.type !== 'mutation' || tryCompleted) return

    const cleanups: Array<() => void> = []
    let done = false
    const complete = () => {
      if (done) return
      done = true
      cleanups.forEach(c => c())
      setTryCompleted(true)
      setTimeout(() => advance(), 800)
    }

    // Method 1: MutationObserver — detect new .msg element (user message)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof Element)) continue
          // Chat user messages: div.msg.user or div containing .msg
          if (
            node.classList.contains('msg') ||
            node.querySelector?.('.msg') ||
            node.matches?.('.msg.user')
          ) {
            complete(); return
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    cleanups.push(() => observer.disconnect())

    // Method 2: Enter key on chat textarea (backup)
    const ta = document.querySelector('[data-tour-id="chat-input"]') as HTMLTextAreaElement | null
    if (ta) {
      const kh = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) setTimeout(complete, 600)
      }
      ta.addEventListener('keydown', kh)
      cleanups.push(() => ta.removeEventListener('keydown', kh))
    }

    // Method 3: Submit button click (backup)
    const submitBtn = ta?.parentElement?.querySelector('button') as HTMLButtonElement | null
    if (submitBtn) {
      const ch = () => setTimeout(complete, 600)
      submitBtn.addEventListener('click', ch)
      cleanups.push(() => submitBtn.removeEventListener('click', ch))
    }

    return () => cleanups.forEach(c => c())
  }, [stepIndex, tryCompleted, advance])

  /* ── tryMode: 45s timeout → show "Pokračovat →" ── */
  useEffect(() => {
    const s = STEPS[stepIndex]
    if (!s.tryMode || tryCompleted) return
    setTryTimedOut(false)
    const timer = setTimeout(() => setTryTimedOut(true), 45000)
    return () => clearTimeout(timer)
  }, [stepIndex, tryCompleted])

  /* ── Cleanup ── */
  useEffect(() => () => removeHighlight(), [removeHighlight])

  /* ─── Render ─────────────────────────────────────────────── */
  const tooltipBaseStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    width: 420,
    background: 'var(--bg2)',
    border: '1.5px solid var(--accent)',
    borderRadius: 16,
    padding: '24px 28px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    pointerEvents: 'all',
    opacity: fading ? 0 : 1,
    transition: 'opacity 0.15s ease',
  }

  const positionedStyle: React.CSSProperties = tooltipX !== null && tooltipY !== null
    ? { top: tooltipY, left: tooltipX }
    : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

  const renderBody = () => (
    <>
      {/* Progress */}
      <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 2, marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Krok {stepIndex + 1} z {STEPS.length}
      </div>

      {/* Title */}
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.3 }}>
        {step.title}
      </div>

      {/* Description */}
      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: step.bullets ? 12 : 0 }}>
        {step.description}
      </div>

      {/* Bullets */}
      {step.bullets && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {step.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>•</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      {step.tip && (
        <div style={{ background: 'var(--surface3)', borderLeft: '3px solid var(--accent)', borderRadius: '0 6px 6px 0', padding: '8px 12px', marginBottom: 16, fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.5 }}>
          💡 {step.tip}
        </div>
      )}

      {/* tryMode instruction */}
      {step.tryMode && !tryCompleted && (
        <div style={{ background: 'var(--surface3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{step.tryMode.instruction}</span>
            <button onClick={skipTryMode} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {step.tryMode.skipLabel}
            </button>
          </div>
          {tryTimedOut && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setTryCompleted(true); advance() }}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                Pokračovat →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )

  const renderFooter = () => {
    if (isLast) {
      return (
        <>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => { removeHighlight(); onComplete(); router.push('/app/chat') }}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Otevřít Chat →
            </button>
            <button onClick={() => { removeHighlight(); onComplete(); router.push('/app') }}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1.5px solid var(--border2)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14 }}>
              Na Dashboard
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 12 }}>
            Průvodce kdykoliv spustíš znovu přes "Průvodce" v levém menu.
          </div>
        </>
      )
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <button onClick={() => { removeHighlight(); onComplete() }}
          style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Přeskočit průvodce
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {stepIndex > 0 && (
            <button onClick={prevStep}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>
              ← Zpět
            </button>
          )}
          {(!step.tryMode || tryCompleted || tryTimedOut) && (
            <button onClick={advance}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              Další →
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop — purely visual, never blocks interaction */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.88)', pointerEvents: 'none' }} />

      {/* Tooltip */}
      <div style={{ ...tooltipBaseStyle, ...positionedStyle }}>
        {/* Arrow */}
        {!isCenter && arrow && <div style={arrowStyle(arrow)} />}

        {/* Welcome step — just title + body + single CTA */}
        {stepIndex === 0 ? (
          <>
            {renderBody()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={advance}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
                Začít průvodce →
              </button>
            </div>
          </>
        ) : (
          <>
            {renderBody()}
            {renderFooter()}
          </>
        )}
      </div>
    </>
  )
}
