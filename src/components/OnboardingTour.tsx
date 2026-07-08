'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/* ─── Types ─────────────────────────────────────────────── */
type TourStep = {
  id: string
  title: string
  description: string
  bullets?: string[]
  tip?: string
  target?: string       // CSS selector to highlight
  navigateTo?: string   // navigate here before showing step
  position?: string     // ignored — panel always bottom-right
}

/* ─── Steps ─────────────────────────────────────────────── */
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
  },
  {
    id: 'chat-input',
    title: 'Zkus napsat zprávu do chatu ✍️',
    description: 'Sem napiš cokoliv — AI odpoví a povede tě rozhovorem. Klidně teď zkus napsat první zprávu.',
    bullets: [
      'Po odeslání AI pokládá doplňující otázky',
      'Na konci rozhovoru tlačítko "Uložit jako draft"',
      'Draft pak čeká na revizi adminů',
      'Po schválení se zobrazí všem uživatelům',
    ],
    tip: 'Zkus: "Chci zdokumentovat jak jsem použil Claude pro psaní emailů"',
    target: '[data-tour-id="chat-input"]',
    navigateTo: '/app/chat',
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
  },
  {
    id: 'usecase-detail',
    title: 'Detail use casu 🔍',
    description: 'Každý use case má kompletní detail s hodnocením, úsporami času a doporučeními.',
    bullets: [
      'Hodnocení náročnosti, dopadu a confidence',
      'Úspora času a aha moment',
      'Slabiny a doporučení pro ostatní',
      'Export do HTML, PDF nebo Word',
    ],
    tip: 'Klikni na libovolnou kartu use casu — otevře se plný detail.',
    target: '.uc-card',
    navigateTo: '/app/usecases',
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
  },
  {
    id: 'finish',
    title: 'Jsi připraven/a! 🚀',
    description: 'Teď víš o všem co AI Laboratoř umí. Nejlepší start? Otevři Chat a napiš o prvním projektu nebo nástroji.',
    tip: 'Průvodce kdykoliv spustíš znovu přes "Průvodce" v levém menu.',
  },
]

/* ─── Component ─────────────────────────────────────────── */
interface Props { onComplete: () => void }

export default function OnboardingTour({ onComplete }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const [stepIndex, setStepIndex] = useState(0)
  const [pulse, setPulse]         = useState(false)

  const highlightRef  = useRef<HTMLElement | null>(null)
  const pendingNavRef = useRef<string | null>(null)
  const onCompleteRef = useRef(onComplete)
  const stepIndexRef  = useRef(stepIndex)
  onCompleteRef.current = onComplete
  stepIndexRef.current  = stepIndex

  const step     = STEPS[stepIndex]
  const total    = STEPS.length
  const progress = ((stepIndex + 1) / total) * 100
  const isFirst  = stepIndex === 0
  const isLast   = stepIndex === total - 1

  /* ── Highlight ── */
  const removeHighlight = useCallback(() => {
    if (!highlightRef.current) return
    const el = highlightRef.current
    el.style.outline      = ''
    el.style.outlineOffset = ''
    el.style.boxShadow    = ''
    el.style.borderRadius = ''
    el.style.transition   = ''
    highlightRef.current  = null
  }, [])

  const applyHighlight = useCallback((selector: string) => {
    removeHighlight()
    const attempt = (n = 0) => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (el) {
        el.style.outline       = '3px solid var(--accent)'
        el.style.outlineOffset = '4px'
        el.style.borderRadius  = '8px'
        el.style.boxShadow     = '0 0 0 6px rgba(192,57,43,0.15)'
        el.style.transition    = 'all 0.2s ease'
        highlightRef.current   = el
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        return
      }
      if (n < 15) setTimeout(() => attempt(n + 1), 200)
    }
    attempt()
  }, [removeHighlight])

  /* ── Setup step ── */
  const setupStep = useCallback((idx: number, currentPath: string) => {
    const s = STEPS[idx]
    const targetPath = s.navigateTo ?? null

    if (targetPath && currentPath.split('?')[0] !== targetPath) {
      removeHighlight()
      pendingNavRef.current = targetPath
      router.push(targetPath)
      return
    }

    pendingNavRef.current = null
    if (s.target) setTimeout(() => applyHighlight(s.target!), 400)
    else removeHighlight()
  }, [router, applyHighlight, removeHighlight])

  /* ── Step change ── */
  useEffect(() => {
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 300)
    setupStep(stepIndex, pathname)
    return () => clearTimeout(t)
  }, [stepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pathname change (after navigation) ── */
  useEffect(() => {
    if (pendingNavRef.current && pathname === pendingNavRef.current) {
      pendingNavRef.current = null
      const s = STEPS[stepIndexRef.current]
      if (s?.target) setTimeout(() => applyHighlight(s.target!), 400)
    }
  }, [pathname, applyHighlight])

  /* ── Cleanup ── */
  useEffect(() => () => removeHighlight(), [removeHighlight])

  /* ── Navigation ── */
  const advance = () => {
    if (stepIndexRef.current >= total - 1) { removeHighlight(); onCompleteRef.current() }
    else setStepIndex(s => s + 1)
  }
  const goBack  = () => { if (stepIndex > 0) setStepIndex(s => s - 1) }
  const skipAll = () => { removeHighlight(); onCompleteRef.current() }

  /* ── Render ── */
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      width: 340, maxHeight: 480,
      background: 'var(--surface-2)',
      border: '2px solid var(--accent)',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 9999,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      opacity: pulse ? 0.7 : 1,
      transition: 'opacity 0.3s ease',
    }}>

      {/* Header */}
      <div style={{
        background: 'var(--accent)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
          Průvodce • Krok {stepIndex + 1}/{total}
        </span>
        <button onClick={skipAll} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.85)', fontSize: 18, lineHeight: 1,
          padding: '0 2px', fontFamily: 'inherit',
        }}>✕</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: '#fff',
          transition: 'width 0.35s ease',
        }} />
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Title */}
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.3 }}>
          {step.title}
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: step.bullets ? 10 : 0 }}>
          {step.description}
        </div>

        {/* Bullets */}
        {step.bullets && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {step.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 700, marginTop: 1 }}>•</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        {step.tip && (
          <div style={{
            background: 'var(--surface-1)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '0 6px 6px 0',
            padding: '8px 10px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            lineHeight: 1.5,
            marginTop: 4,
          }}>
            💡 {step.tip}
          </div>
        )}

        {/* Finish CTAs */}
        {isLast && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <button onClick={() => { removeHighlight(); onComplete(); router.push('/app/chat') }}
              style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Otevřít Chat →
            </button>
            <button onClick={() => { removeHighlight(); onComplete(); router.push('/app') }}
              style={{ padding: '10px', borderRadius: 8, border: '1.5px solid var(--border2)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>
              Přejít na Dashboard
            </button>
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 2 }}>
              Průvodce kdykoliv spustíš znovu přes "Průvodce" v menu.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!isLast && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <button onClick={skipAll} style={{
            fontSize: 12, color: 'var(--text3)', background: 'none',
            border: 'none', cursor: 'pointer', textDecoration: 'underline',
          }}>
            Přeskočit
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {!isFirst && (
              <button onClick={goBack} style={{
                padding: '6px 12px', borderRadius: 7,
                border: '1px solid var(--border2)', background: 'transparent',
                color: 'var(--text2)', cursor: 'pointer', fontSize: 13,
              }}>
                ← Zpět
              </button>
            )}
            <button onClick={advance} style={{
              padding: '6px 14px', borderRadius: 7,
              border: 'none', background: 'var(--accent)',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}>
              {isFirst ? 'Začít →' : 'Další →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
