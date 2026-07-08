'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/* ─── Types ─────────────────────────────────────────────── */
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
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  tryMode?: TryMode
}

/* ─── Steps ─────────────────────────────────────────────── */
const STEPS: TourStep[] = [
  // 1. Uvítání
  {
    id: 'welcome',
    position: 'center',
    title: 'Vítej v AI Laboratoři! 🧪',
    description: 'Firemní systém pro dokumentaci a sdílení AI znalostí. Průvodce tě provede vším za ~3 minuty.',
    bullets: [
      'Dokumentace AI use casů a nástrojů',
      'Zpětná analýza projektů kde byla použita AI',
      'Žebříček nejlepšího obsahu napříč firmou',
      'AI News feed — novinky ze světa AI automaticky',
    ],
    tip: 'Průvodce kdykoliv spustíš znovu přes "Průvodce" v levém menu.',
  },
  // 2. Dashboard
  {
    id: 'dashboard',
    position: 'right',
    target: '[data-nav-id="dashboard"]',
    navigateTo: '/app',
    title: 'Dashboard — přehled všeho 📊',
    description: 'Stav celé AI Laboratoře na jednom místě.',
    bullets: [
      'Statistiky: kandidáti, claimy, revize, use casy, projekty',
      'Klik na kartu statistiky = filtr seznamu pod ní',
      'Workflow karty — rychlé zkratky k hlavním akcím',
      'Poslední aktivita — co se dělo nedávno',
    ],
    tip: 'Červený badge "V revizi" = čeká na tvoji akci jako admin.',
  },
  // 3. Chat intro
  {
    id: 'chat-intro',
    position: 'right',
    target: '[data-nav-id="chat"]',
    navigateTo: '/app',
    title: 'Chat — hlavní vstupní bod 💬',
    description: 'Popiš projekt nebo problém vlastními slovy — AI se tě doptá a vytvoří draft.',
    bullets: [
      'Mluv přirozeně — žádné formuláře',
      'Režim use case: "Chci zdokumentovat AI nástroj"',
      'Režim projekt: "Chci zaznamenat projekt"',
      'AI se doptá, vytvoří draft, ty jen schválíš',
    ],
    tip: 'Začni větou "Chci zdokumentovat..." a AI převezme iniciativu.',
  },
  // 4. Chat — zkus napsat
  {
    id: 'chat-try',
    position: 'top',
    target: '[data-tour-id="chat-input"]',
    navigateTo: '/app/chat',
    title: 'Zkus napsat zprávu ✍️',
    description: 'Napiš cokoliv a AI odpoví. Klidně zkus napsat první zprávu — průvodce počká.',
    bullets: [
      'AI pokládá doplňující otázky',
      'Na konci: tlačítko "Uložit jako draft"',
      'Draft čeká na revizi adminů',
      'Po schválení viditelný všem',
    ],
    tip: 'Zkus: "Chci zdokumentovat jak jsem použil Claude pro psaní emailů"',
    tryMode: {
      instruction: '✍️ Napiš a odešli zprávu — průvodce automaticky pokračuje',
      type: 'mutation',
      selector: '.msg.user',
      skipLabel: 'Přeskočit',
    },
  },
  // 5. K otestování
  {
    id: 'inbox',
    position: 'right',
    target: '[data-nav-id="inbox"]',
    navigateTo: '/app',
    title: 'K otestování — fronta nástrojů 🔬',
    description: 'Nové AI nástroje čekající na otestování. Claimni nástroj a vezmi si ho k testování.',
    bullets: [
      'Seznam nástrojů navržených k otestování',
      '"Claim" = přiřadíš si nástroj sobě',
      'Po testování vyplníš hodnocení a poznámky',
      'Výsledek přejde do knihovny "Otestované"',
    ],
    tip: 'Claimnutý nástroj najdeš v sekci "Moje práce".',
    tryMode: {
      instruction: '🔬 Klikni na "K otestování" v levém menu',
      type: 'navigate',
      targetUrl: '/app/inbox',
      skipLabel: 'Přeskočit',
    },
  },
  // 6. Otestované
  {
    id: 'tools-tested',
    position: 'right',
    target: '[data-nav-id="tools-tested"]',
    navigateTo: '/app/inbox',
    title: 'Otestované — znalostní báze 📖',
    description: 'Knihovna otestovaných AI nástrojů s kompletními recenzemi.',
    bullets: [
      'Hodnocení 1–10, úspora času, aha moment, slabiny',
      'Filtrování podle kategorie a hodnocení',
      'Klik na nástroj = plný detail s recenzí',
    ],
    tip: 'Před testováním nového nástroje se podívej jestli ho někdo netestoval dřív.',
    tryMode: {
      instruction: '📖 Klikni na libovolnou kartu nástroje pro zobrazení detailu',
      type: 'click',
      selector: '.tool-card',
      skipLabel: 'Přeskočit',
    },
  },
  // 7. Use casy
  {
    id: 'usecases',
    position: 'right',
    target: '[data-nav-id="usecases"]',
    navigateTo: '/app/tools-tested',
    title: 'Use casy — firemní znalostní báze 📚',
    description: 'Hlavní knihovna zdokumentovaných AI use casů.',
    bullets: [
      'Filtrování podle kategorie, náročnosti, autora',
      'Každý use case: účel, úspora času, aha moment, slabiny',
      'Klik na kartu = plný detail',
      '"Review" = odešle draft ke schválení adminům',
    ],
    tip: 'Klikni na libovolný use case — otevře se plný detail.',
    tryMode: {
      instruction: '📚 Klikni na "Use casy" v levém menu',
      type: 'navigate',
      targetUrl: '/app/usecases',
      skipLabel: 'Přeskočit',
    },
  },
  // 8. Detail use casu
  {
    id: 'usecase-detail',
    position: 'right',
    target: '.uc-card',
    navigateTo: '/app/usecases',
    title: 'Rozklikni detail use casu 🔍',
    description: 'Každý use case má kompletní detail.',
    bullets: [
      'Hodnocení náročnosti, dopadu a confidence',
      'Úspora času a aha moment',
      'Slabiny a doporučení pro ostatní',
      'Export do HTML, PDF nebo Word',
    ],
    tip: 'Klikni na libovolnou kartu — otevře se plný detail.',
    tryMode: {
      instruction: '🔍 Klikni na libovolný use case',
      type: 'click',
      selector: '.uc-card',
      skipLabel: 'Přeskočit',
    },
  },
  // 9. Nový use case — BEZ tryMode (uživatel může kliknout a jít do chatu)
  {
    id: 'new-usecase',
    position: 'bottom',
    target: '[data-tour-id="new-usecase"]',
    navigateTo: '/app/usecases',
    title: 'Přidej nový use case ➕',
    description: 'Klikni sem pro vytvoření nového use casu.',
    bullets: [
      'Ruční formulář: vyplníš všechna pole sám',
      'Chat: AI se tě doptá a vyplní za tebe',
      'Obojí vytvoří draft čekající na revizi',
    ],
    tip: 'Doporučujeme Chat — AI ti pomůže formulovat vše správně.',
    // ŽÁDNÝ tryMode — uživatel může kliknout a jít do chatu, průvodce nesmí blokovat
  },
  // 10. Projekty
  {
    id: 'projects',
    position: 'right',
    target: '[data-nav-id="projects"]',
    navigateTo: '/app/usecases',
    title: 'Projekty — zpětná analýza 📁',
    description: 'Dokumentuj projekty kde byla použita AI.',
    bullets: [
      'Dashboard: probíhající, dokončené, v revizi, drafty',
      'Chat průvodce: AI se tě doptá na retrospektivu',
      'Hodnocení nástrojů a celkové hodnocení projektu',
    ],
    tip: 'Klikni na "+ Nový projekt (chat)" — AI se tě sám doptá na vše.',
    tryMode: {
      instruction: '📁 Klikni na "Projekty" v levém menu',
      type: 'navigate',
      targetUrl: '/app/projects',
      skipLabel: 'Přeskočit',
    },
  },
  // 11. Žebříček
  {
    id: 'ranking',
    position: 'right',
    target: '[data-nav-id="ranking"]',
    navigateTo: '/app/projects',
    title: 'Žebříček — nejlepší obsah 🏆',
    description: 'Nejlépe hodnocené use casy a nástroje napříč firmou.',
    bullets: [
      'Filtruj podle kategorie: obrázky, kódování, chatbot, ostatní',
      'Klik na položku = plný detail',
      'Aktualizuje se automaticky po schválení nového obsahu',
    ],
    tip: 'Rychlý způsob jak zjistit co ostatním funguje nejlépe.',
    tryMode: {
      instruction: '🏆 Klikni na "Žebříček" v levém menu',
      type: 'navigate',
      targetUrl: '/app/ranking',
      skipLabel: 'Přeskočit',
    },
  },
  // 12. Revize
  {
    id: 'revision',
    position: 'right',
    target: '[data-nav-id="revision"]',
    navigateTo: '/app/ranking',
    title: 'Revize — schvalovací fronta ✅',
    description: 'Drafty čekající na schválení adminů.',
    bullets: [
      'Schválit = obsah viditelný všem uživatelům',
      'Vrátit k úpravám = autor dostane zpětnou vazbu',
      'Červený badge v sidebaru = počet čekajících',
    ],
    tip: 'Pokud jsi admin, červené číslo v sidebaru = čeká na tebe.',
    tryMode: {
      instruction: '✅ Klikni na "Revize" v levém menu',
      type: 'navigate',
      targetUrl: '/app/revision',
      skipLabel: 'Přeskočit',
    },
  },
  // 13. Finish
  {
    id: 'finish',
    position: 'center',
    title: 'Jsi připraven/a! 🚀',
    description: 'Teď víš o všem co AI Laboratoř umí.',
    tip: 'Průvodce kdykoliv spustíš znovu přes "Průvodce" v levém menu.',
  },
]

/* ─── Component ─────────────────────────────────────────── */
interface Props {
  onComplete: () => void
}

type TooltipPosition = {
  top?: number
  left?: number
  center?: boolean
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

export default function OnboardingTour({ onComplete }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [stepIndex, setStepIndex] = useState(0)
  const [tryCompleted, setTryCompleted] = useState(false)
  const [tryTimedOut, setTryTimedOut] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ center: true })
  const [fading, setFading] = useState(false)

  const highlightRef = useRef<HTMLElement | null>(null)
  const pendingNavRef = useRef<string | null>(null)
  const tryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const onCompleteRef = useRef(onComplete)
  const stepIndexRef = useRef(stepIndex)
  const mutationObserverRef = useRef<MutationObserver | null>(null)
  const clickHandlerRef = useRef<((e: MouseEvent) => void) | null>(null)

  onCompleteRef.current = onComplete
  stepIndexRef.current = stepIndex

  const step = STEPS[stepIndex]
  const total = STEPS.length
  const progress = ((stepIndex + 1) / total) * 100
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

  /* ── Highlight ── */
  const removeHighlight = useCallback(() => {
    if (!highlightRef.current) return
    const el = highlightRef.current
    el.style.outline = ''
    el.style.outlineOffset = ''
    el.style.boxShadow = ''
    el.style.borderRadius = ''
    el.style.position = ''
    el.style.zIndex = ''
    el.style.transition = ''
    highlightRef.current = null
  }, [])

  const applyHighlight = useCallback((el: HTMLElement) => {
    removeHighlight()
    el.style.outline = '3px solid #C0392B'
    el.style.outlineOffset = '4px'
    el.style.borderRadius = '8px'
    el.style.boxShadow = '0 0 0 6px rgba(192,57,43,0.2)'
    el.style.position = 'relative'
    el.style.zIndex = '9999'
    el.style.transition = 'all 0.2s ease'
    highlightRef.current = el
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [removeHighlight])

  /* ── Tooltip Positioning ── */
  const positionTooltip = useCallback((targetEl: HTMLElement, position: TourStep['position']) => {
    const rect = targetEl.getBoundingClientRect()
    const tooltipWidth = 380
    const tooltipHeight = 500 // estimated max
    const margin = 16

    let pos: TooltipPosition = { position }

    switch (position) {
      case 'right':
        pos.left = Math.max(228, rect.right + 16) // za sidebarem
        pos.top = rect.top + rect.height / 2 - tooltipHeight / 2
        break
      case 'left':
        pos.left = rect.left - tooltipWidth - 16
        pos.top = rect.top + rect.height / 2 - tooltipHeight / 2
        break
      case 'top':
        pos.top = rect.top - tooltipHeight - 16
        pos.left = rect.left + rect.width / 2 - 190
        break
      case 'bottom':
        pos.top = rect.bottom + 16
        pos.left = rect.left + rect.width / 2 - 190
        break
      case 'center':
        pos.center = true
        break
    }

    // Clamp aby nepřesahoval viewport
    if (!pos.center) {
      if (pos.left !== undefined) {
        pos.left = Math.max(margin, Math.min(pos.left, window.innerWidth - tooltipWidth - margin))
      }
      if (pos.top !== undefined) {
        pos.top = Math.max(margin, Math.min(pos.top, window.innerHeight - tooltipHeight - margin))
      }
    }

    setTooltipPos(pos)
  }, [])

  /* ── Apply Highlight and Position ── */
  const applyHighlightAndPosition = useCallback((s: TourStep) => {
    if (!s.target) {
      removeHighlight()
      setTooltipPos({ center: true })
      return
    }

    const attempt = (n = 0) => {
      const el = document.querySelector(s.target!) as HTMLElement | null
      if (el) {
        applyHighlight(el)
        positionTooltip(el, s.position)
        return
      }
      if (n < 15) {
        setTimeout(() => attempt(n + 1), 200)
      } else {
        // Fallback na center pokud element nenalezen po 3s
        setTooltipPos({ center: true })
      }
    }
    attempt()
  }, [applyHighlight, positionTooltip, removeHighlight])

  /* ── TryMode Cleanup ── */
  const cleanupTryMode = useCallback(() => {
    if (tryTimerRef.current) {
      clearTimeout(tryTimerRef.current)
      tryTimerRef.current = null
    }
    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect()
      mutationObserverRef.current = null
    }
    if (clickHandlerRef.current) {
      document.removeEventListener('click', clickHandlerRef.current, true)
      clickHandlerRef.current = null
    }
  }, [])

  /* ── TryMode Setup ── */
  const setupTryMode = useCallback((s: TourStep) => {
    cleanupTryMode()
    setTryCompleted(false)
    setTryTimedOut(false)

    if (!s.tryMode) return

    const complete = () => {
      setTryCompleted(true)
      cleanupTryMode()
    }

    if (s.tryMode.type === 'click' && s.tryMode.selector) {
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.closest(s.tryMode!.selector!)) {
          complete()
          setTimeout(() => {
            if (stepIndexRef.current < total - 1) {
              setStepIndex(i => i + 1)
            }
          }, 1200)
        }
      }
      clickHandlerRef.current = handler
      document.addEventListener('click', handler, true)
    } else if (s.tryMode.type === 'mutation' && s.tryMode.selector) {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof HTMLElement) {
              if (node.matches(s.tryMode!.selector!) || node.querySelector(s.tryMode!.selector!)) {
                complete()
                setTimeout(() => {
                  if (stepIndexRef.current < total - 1) {
                    setStepIndex(i => i + 1)
                  }
                }, 1200)
                return
              }
            }
          }
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      mutationObserverRef.current = observer

      // Záloha: Enter na chat-input
      const chatInput = document.querySelector('[data-tour-id="chat-input"]')
      if (chatInput) {
        const keyHandler = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            setTimeout(() => {
              const msg = document.querySelector('.msg.user')
              if (msg) {
                complete()
                setTimeout(() => {
                  if (stepIndexRef.current < total - 1) {
                    setStepIndex(i => i + 1)
                  }
                }, 1200)
              }
            }, 800)
          }
        }
        chatInput.addEventListener('keydown', keyHandler as any)
      }

      // Timeout 45s
      tryTimerRef.current = setTimeout(() => {
        setTryTimedOut(true)
      }, 45000)
    }
    // navigate se řeší v useEffect na [pathname]
  }, [cleanupTryMode, total])

  /* ── Navigation ── */
  const goToStep = useCallback((idx: number) => {
    const s = STEPS[idx]
    cleanupTryMode()
    setTryCompleted(false)
    setTryTimedOut(false)
    removeHighlight()

    if (s.navigateTo && pathname.split('?')[0] !== s.navigateTo) {
      pendingNavRef.current = s.navigateTo
      router.push(s.navigateTo)
    } else {
      pendingNavRef.current = null
      setTimeout(() => {
        applyHighlightAndPosition(s)
        setupTryMode(s)
      }, 200)
    }
  }, [pathname, router, removeHighlight, cleanupTryMode, applyHighlightAndPosition, setupTryMode])

  const nextStep = useCallback(() => {
    if (stepIndexRef.current >= total - 1) {
      removeHighlight()
      cleanupTryMode()
      onCompleteRef.current()
    } else {
      setFading(true)
      setTimeout(() => {
        setStepIndex(i => i + 1)
        setFading(false)
      }, 150)
    }
  }, [total, removeHighlight, cleanupTryMode])

  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      setFading(true)
      setTimeout(() => {
        setStepIndex(i => i - 1)
        setFading(false)
      }, 150)
    }
  }, [stepIndex])

  const skipAll = useCallback(() => {
    removeHighlight()
    cleanupTryMode()
    onCompleteRef.current()
  }, [removeHighlight, cleanupTryMode])

  const skipTryMode = useCallback(() => {
    setTryCompleted(true)
    cleanupTryMode()
  }, [cleanupTryMode])

  /* ── Effects ── */
  // Pathname change
  useEffect(() => {
    if (pendingNavRef.current && pathname === pendingNavRef.current) {
      pendingNavRef.current = null
      const s = STEPS[stepIndexRef.current]
      setTimeout(() => {
        applyHighlightAndPosition(s)
        setupTryMode(s)
      }, 400)
    }

    // TryMode navigate
    const s = STEPS[stepIndexRef.current]
    if (s.tryMode?.type === 'navigate' && pathname === s.tryMode.targetUrl) {
      setTryCompleted(true)
      cleanupTryMode()
      setTimeout(() => {
        if (stepIndexRef.current < total - 1) {
          setStepIndex(i => i + 1)
        }
      }, 600)
    }
  }, [pathname, applyHighlightAndPosition, setupTryMode, cleanupTryMode, total])

  // Step change
  useEffect(() => {
    goToStep(stepIndex)
  }, [stepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup
  useEffect(() => {
    return () => {
      removeHighlight()
      cleanupTryMode()
    }
  }, [removeHighlight, cleanupTryMode])

  /* ── Arrow Style ── */
  const arrowStyle = useMemo(() => {
    if (!tooltipPos.position || tooltipPos.center) return null

    const base: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    }

    switch (tooltipPos.position) {
      case 'right':
        return {
          ...base,
          left: -10,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '10px 10px 10px 0',
          borderColor: 'transparent #C0392B transparent transparent',
        }
      case 'left':
        return {
          ...base,
          right: -10,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '10px 0 10px 10px',
          borderColor: 'transparent transparent transparent #C0392B',
        }
      case 'top':
        return {
          ...base,
          left: '50%',
          bottom: -10,
          transform: 'translateX(-50%)',
          borderWidth: '10px 10px 0 10px',
          borderColor: '#C0392B transparent transparent transparent',
        }
      case 'bottom':
        return {
          ...base,
          left: '50%',
          top: -10,
          transform: 'translateX(-50%)',
          borderWidth: '0 10px 10px 10px',
          borderColor: 'transparent transparent #C0392B transparent',
        }
      default:
        return null
    }
  }, [tooltipPos])

  /* ── Tooltip Style ── */
  const tooltipStyle: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      position: 'fixed',
      width: 380,
      background: '#1e1e2e',
      border: '1.5px solid #C0392B',
      borderRadius: 14,
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      zIndex: 10000,
      pointerEvents: 'all',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.15s ease',
    }

    if (tooltipPos.center) {
      return {
        ...base,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    return {
      ...base,
      top: tooltipPos.top ?? 0,
      left: tooltipPos.left ?? 0,
    }
  }, [tooltipPos, fading])

  const showTryInstruction = step.tryMode && !tryCompleted && !tryTimedOut

  /* ── Render ── */
  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 9998,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div style={tooltipStyle}>
        {/* Arrow */}
        {arrowStyle && <div style={arrowStyle} />}

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            background: '#333355',
            borderRadius: '14px 14px 0 0',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: '#C0392B',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: '10px 20px 0',
            fontSize: 11,
            color: '#707080',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Krok {stepIndex + 1} z {total}
        </div>

        {/* Body */}
        <div style={{ padding: '6px 20px 0' }}>
          {/* Title */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.3,
              marginBottom: 8,
            }}
          >
            {step.title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 13,
              color: '#b0b0c0',
              lineHeight: 1.6,
              marginBottom: step.bullets ? 8 : 0,
            }}
          >
            {step.description}
          </div>

          {/* Bullets */}
          {step.bullets && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {step.bullets.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 7,
                    fontSize: 12,
                    color: '#b0b0c0',
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ color: '#C0392B', flexShrink: 0, fontWeight: 700 }}>
                    •
                  </span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tip */}
          {step.tip && (
            <div
              style={{
                background: '#2a2a3e',
                borderLeft: '3px solid #C0392B',
                borderRadius: '0 6px 6px 0',
                margin: '8px 0',
                padding: '8px 10px',
                fontSize: 12,
                color: '#b0b0c0',
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}
            >
              💡 {step.tip}
            </div>
          )}

          {/* TryMode instruction */}
          {showTryInstruction && (
            <div
              style={{
                background: 'rgba(192,57,43,0.1)',
                border: '1px solid #C0392B',
                borderRadius: 8,
                padding: '10px 12px',
                margin: '12px 0',
                fontSize: 13,
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              {step.tryMode!.instruction}
            </div>
          )}

          {/* Finish CTAs */}
          {isLast && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0 12px' }}>
              <button
                onClick={() => {
                  removeHighlight()
                  cleanupTryMode()
                  onComplete()
                  router.push('/app/chat')
                }}
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#C0392B',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Otevřít Chat →
              </button>
              <button
                onClick={() => {
                  removeHighlight()
                  cleanupTryMode()
                  onComplete()
                  router.push('/app')
                }}
                style={{
                  padding: '10px',
                  borderRadius: 8,
                  border: '1.5px solid #444466',
                  background: 'transparent',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Přejít na Dashboard
              </button>
              <div
                style={{
                  fontSize: 11,
                  color: '#707080',
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                Průvodce spustíš znovu přes Průvodce v menu
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLast && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #333355',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <button
              onClick={skipAll}
              style={{
                fontSize: 11,
                color: '#707080',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Přeskočit průvodce
            </button>

            <div style={{ display: 'flex', gap: 6 }}>
              {!isFirst && (
                <button
                  onClick={prevStep}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 7,
                    border: '1px solid #444466',
                    background: 'transparent',
                    color: '#b0b0c0',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ← Zpět
                </button>
              )}

              {showTryInstruction ? (
                <button
                  onClick={skipTryMode}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: '1px solid #444466',
                    background: 'transparent',
                    color: '#b0b0c0',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {step.tryMode!.skipLabel}
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: '#C0392B',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {isFirst ? 'Začít →' : 'Další →'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
