'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { markOnboardingComplete } from '@/lib/onboarding'

/* ─── Types ─────────────────────────────────────────────── */
type TourStep = {
  id: string
  target: string | null
  title: string
  description: string
  bullets?: string[]
  tip?: string
  position: 'center' | 'right' | 'left' | 'top' | 'bottom'
  navigateTo?: string
  previewTarget?: string   // secondary highlight after 600 ms
  chatExamples?: string[]
  ctaButtons?: { label: string; href: string; primary: boolean }[]
  finishNote?: string
  welcomeOnly?: boolean    // welcome step — single CTA only
}

type Rect = { top: number; left: number; width: number; height: number }

/* ─── Steps ──────────────────────────────────────────────── */
const STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    position: 'center',
    welcomeOnly: true,
    title: 'Vítej v AI Laboratoři! 🧪',
    description: 'AI Laboratoř je firemní systém pro dokumentaci a sdílení AI znalostí. Slouží celému týmu — dokumentuješ AI nástroje, use casy, projekty, a sleduješ co funguje ostatním.',
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
    target: '[data-nav-id="dashboard"]',
    navigateTo: '/app',
    position: 'right',
    title: 'Dashboard — přehled všeho 📊',
    description: 'Na dashboardu vidíš stav celé AI Laboratoře na jednom místě — co čeká na tvoji akci, poslední aktivita, rychlý přístup ke všem sekcím.',
    bullets: [
      'Statistiky: kandidáti, claimy, revize, use casy, projekty',
      'Workflow karty — rychlé zkratky k hlavním akcím',
      'Poslední aktivita — co se v appce dělo nedávno',
      'Kliknutí na kartu statistik filtruje seznam pod ní',
    ],
    tip: 'Červený badge "V revizi" = čeká na tvoji akci jako admin.',
  },
  {
    id: 'chat',
    target: '[data-nav-id="chat"]',
    position: 'right',
    title: 'Chat — hlavní vstupní bod 💬',
    description: 'Tady začíná vše. Popiš projekt nebo problém vlastními slovy — AI se tě doptá a automaticky vytvoří draft use casu nebo projektu.',
    bullets: [
      'Mluv přirozeně — žádné formuláře',
      'Režim use case: "Chci zdokumentovat AI nástroj"',
      'Režim projekt: "Chci zaznamenat projekt"',
      'AI se doptá, vytvoří draft, ty jen schválíš',
    ],
    tip: 'Začni větou "Chci zdokumentovat..." a AI převezme iniciativu.',
  },
  {
    id: 'chat-input',
    target: '[data-tour-id="chat-input"]',
    navigateTo: '/app/chat',
    position: 'top',
    title: 'Sem napiš co řešíš ✍️',
    description: 'Chat funguje jako rozhovor. AI se tě postupně doptá na vše potřebné a na konci vytvoří kompletní draft který pak schválíš nebo upravíš.',
    bullets: [
      'Po odeslání AI pokládá doplňující otázky',
      'Na konci rozhovoru tlačítko "Uložit jako draft"',
      'Draft pak čeká na revizi adminů',
      'Po schválení se zobrazí všem uživatelům',
    ],
    chatExamples: [
      'Chci zdokumentovat jak jsem použil Claude pro psaní emailů',
      'Testoval jsem Midjourney pro tvorbu marketingových obrázků',
      'Chci zaznamenat projekt redesignu webu kde jsme použili AI',
    ],
  },
  {
    id: 'inbox',
    target: '[data-nav-id="inbox"]',
    navigateTo: '/app',
    position: 'right',
    title: 'K otestování — fronta nástrojů 🔬',
    description: 'Sem přicházejí nové AI nástroje čekající na otestování. Každý člen týmu si může nástroj "claimnout" a vzít si ho k otestování.',
    bullets: [
      'Seznam nástrojů navržených k otestování',
      '"Claim" = přiřadíš si nástroj sobě',
      'Po testování vyplníš hodnocení, úspory, slabiny',
      'Výsledek přejde do knihovny "Otestované"',
    ],
    tip: 'Claimnutý nástroj najdeš pak v sekci "Moje práce".',
  },
  {
    id: 'tools-tested',
    target: '[data-nav-id="tools-tested"]',
    navigateTo: '/app/tools-tested',
    position: 'right',
    previewTarget: '.tool-card',
    title: 'Otestované — znalostní báze nástrojů 📖',
    description: 'Knihovna všech otestovaných AI nástrojů s kompletními recenzemi. Než začneš testovat nový nástroj, podívej se jestli ho někdo neotestoval už před tebou.',
    bullets: [
      'Detailní recenze každého nástroje',
      'Hodnocení 1–10, úspora času, aha moment, slabiny',
      'Filtrování podle kategorie a hodnocení',
      'Klik na nástroj → otevře plný detail s recenzí',
    ],
    tip: 'Klikni na libovolný nástroj v seznamu — zobrazí se kompletní detail s hodnocením a doporučeními.',
  },
  {
    id: 'usecases',
    target: '[data-nav-id="usecases"]',
    navigateTo: '/app/usecases',
    position: 'right',
    previewTarget: '.uc-card',
    title: 'Use casy — firemní znalostní báze 📚',
    description: 'Hlavní knihovna zdokumentovaných AI use casů. Každý use case popisuje konkrétní způsob využití AI v praxi.',
    bullets: [
      'Filtrování podle kategorie, náročnosti, autora',
      'Každý use case: účel, úspora času, aha moment, slabiny',
      'Tlačítko "Review" → odešle draft ke schválení adminům',
      'Po schválení viditelný všem uživatelům',
    ],
    tip: 'Klikni na libovolný use case pro zobrazení plného detailu.',
  },
  {
    id: 'new-usecase',
    target: '[data-tour-id="new-usecase"]',
    navigateTo: '/app/usecases',
    position: 'bottom',
    title: 'Takhle přidáš nový use case ➕',
    description: 'Klikni sem pro ruční vyplnění formuláře. Nebo použij Chat — AI ho vytvoří za tebe automaticky na základě rozhovoru.',
    bullets: [
      'Ruční formulář: vyplníš všechna pole sám',
      'Chat: AI se tě doptá a vyplní formulář za tebe',
      'Obojí vytvoří draft čekající na revizi',
    ],
    tip: 'Doporučujeme Chat — je rychlejší a AI ti pomůže formulovat věci které by tě možná nenapadly.',
  },
  {
    id: 'projects',
    target: '[data-nav-id="projects"]',
    navigateTo: '/app',
    position: 'right',
    title: 'Projekty — zpětná analýza 📁',
    description: 'Dokumentuj projekty kde byla použita AI. Co fungovalo, co ne, jaké nástroje, jak přispěla AI.',
    bullets: [
      'Dashboard projektů: probíhající, dokončené, v revizi, drafty',
      'Chat průvodce: AI se tě doptá na celou retrospektivu',
      'Hodnocení nástrojů a celkové hodnocení projektu',
      'Doporučení jako mustr: Ano / Ano s úpravami / Ne',
    ],
    tip: 'Klikni na kartu "Probíhající" nebo "Dokončené" — filtruje seznam projektů podle stavu.',
  },
  {
    id: 'ranking',
    target: '[data-nav-id="ranking"]',
    position: 'right',
    title: 'Žebříček — nejlepší obsah firmy 🏆',
    description: 'Nejlépe hodnocené use casy a nástroje napříč celou firmou seřazené podle ratingu.',
    bullets: [
      'Filtruj podle kategorie: obrázky, kódování, chatbot, ostatní',
      'Klik na položku → plný detail s hodnocením',
      'Rychlý způsob jak zjistit co ostatním funguje nejlépe',
      'Aktualizuje se automaticky po schválení nového obsahu',
    ],
    tip: 'Před testováním nástroje se podívej sem — možná ho někdo otestoval a ušetříš si čas.',
  },
  {
    id: 'revision',
    target: '[data-nav-id="revision"]',
    position: 'right',
    title: 'Revize — schvalovací fronta ✅',
    description: 'Drafty use casů a projektů čekají na schválení adminů. Červený badge v sidebaru = počet čekajících revizí.',
    bullets: [
      'Admini vidí všechny drafty čekající na schválení',
      'Schválit → obsah se zobrazí všem uživatelům',
      'Vrátit k úpravám → autor dostane zpětnou vazbu',
      'Zamítnout → draft se smaže',
    ],
    tip: 'Pokud jsi admin, koukej na badge v sidebaru — červené číslo = čeká na tebe.',
  },
  {
    id: 'finish',
    target: null,
    position: 'center',
    title: 'Jsi připraven/a! 🚀',
    description: 'Teď víš o všem co AI Laboratoř umí. Nejlepší start? Otevři Chat a napiš o prvním projektu nebo nástroji který jsi testoval/a.',
    ctaButtons: [
      { label: 'Otevřít Chat →', href: '/app/chat', primary: true },
      { label: 'Přejít na Dashboard', href: '/app', primary: false },
    ],
    finishNote: 'Průvodce kdykoliv spustíš znovu přes "Průvodce" v levém menu.',
  },
]

/* ─── Helpers ────────────────────────────────────────────── */
const PAD = 6
const TW = 420

function fillChatInput(text: string) {
  const el = document.querySelector('[data-tour-id="chat-input"]') as HTMLTextAreaElement | null
  if (!el) return
  try {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(el, text)
  } catch {
    el.value = text
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
}

function getRect(selector: string): Rect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function computeTooltipPos(hl: Rect, position: TourStep['position']): React.CSSProperties {
  const GAP = 16
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900
  const clampH = (t: number) => Math.max(12, Math.min(t, vh - 320))
  const clampV = (l: number) => Math.max(12, Math.min(l, vw - TW - 12))
  switch (position) {
    case 'right':
      return { top: clampH(hl.top + hl.height / 2 - 150), left: Math.min(hl.left + hl.width + GAP, vw - TW - 12) }
    case 'left':
      return { top: clampH(hl.top + hl.height / 2 - 150), left: Math.max(12, hl.left - TW - GAP) }
    case 'bottom':
      return { top: Math.min(hl.top + hl.height + GAP, vh - 360), left: clampV(hl.left + hl.width / 2 - TW / 2) }
    case 'top':
      return { top: clampH(hl.top - 360 - GAP), left: clampV(hl.left + hl.width / 2 - TW / 2) }
    default:
      return {}
  }
}

function getArrowStyle(position: TourStep['position']): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute', width: 0, height: 0 }
  switch (position) {
    case 'right':
      return { ...base, left: -9, top: '50%', transform: 'translateY(-50%)', borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: '9px solid var(--accent)' }
    case 'left':
      return { ...base, right: -9, top: '50%', transform: 'translateY(-50%)', borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '9px solid var(--accent)' }
    case 'bottom':
      return { ...base, top: -9, left: '50%', transform: 'translateX(-50%)', borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: '9px solid var(--accent)' }
    case 'top':
      return { ...base, bottom: -9, left: '50%', transform: 'translateX(-50%)', borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '9px solid var(--accent)' }
    default:
      return {}
  }
}

/* ─── Component ──────────────────────────────────────────── */
type Props = {
  userId: string
  onClose: () => void
  preview?: boolean
}

export default function OnboardingTour({ userId, onClose, preview = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = STEPS[step]
  const progress = ((step) / (STEPS.length - 1)) * 100

  const clearRetry = () => { if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null } }
  const clearPreview = () => { if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null } }

  const startRetry = useCallback((selector: string, afterFound?: () => void) => {
    clearRetry()
    const r = getRect(selector)
    if (r) { setTargetRect(r); afterFound?.(); return }
    let n = 0
    retryRef.current = setInterval(() => {
      n++
      const r2 = getRect(selector)
      if (r2) { clearRetry(); setTargetRect(r2); afterFound?.(); return }
      if (n >= 15) clearRetry()
    }, 200)
  }, [])

  const activatePreview = useCallback((previewTarget: string) => {
    clearPreview()
    previewTimerRef.current = setTimeout(() => {
      const r = getRect(previewTarget)
      if (r) setTargetRect(r)
    }, 600)
  }, [])

  // Step change
  useEffect(() => {
    clearRetry()
    clearPreview()
    setTargetRect(null)
    if (!current.target) return

    if (current.navigateTo && pathname !== current.navigateTo) {
      setPendingNav(current.navigateTo)
      router.push(current.navigateTo)
      return
    }

    startRetry(current.target, current.previewTarget ? () => activatePreview(current.previewTarget!) : undefined)
    return () => { clearRetry(); clearPreview() }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // After navigation completes
  useEffect(() => {
    if (!pendingNav || pathname !== pendingNav) return
    setPendingNav(null)
    if (!current.target) return
    startRetry(current.target, current.previewTarget ? () => activatePreview(current.previewTarget!) : undefined)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = async () => {
    clearRetry(); clearPreview()
    if (!preview) await markOnboardingComplete(userId)
    onClose()
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else handleClose()
  }

  const handleBack = () => { if (step > 0) setStep(s => s - 1) }

  /* ─ Shared tooltip inner ─ */
  const TooltipBody = () => (
    <>
      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, background: 'var(--surface3)', borderRadius: 2, marginBottom: 6 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>Krok {step + 1} z {STEPS.length}</div>

      {/* Title */}
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.3 }}>{current.title}</div>

      {/* Description */}
      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: current.bullets ? 12 : 0 }}>{current.description}</div>

      {/* Bullets */}
      {current.bullets && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
          {current.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0, fontSize: 12, marginTop: 2 }}>•</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      {current.tip && (
        <div style={{
          background: 'var(--surface3)', borderLeft: '3px solid var(--accent)',
          borderRadius: '0 6px 6px 0', padding: '8px 12px',
          fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5,
        }}>
          💡 {current.tip}
        </div>
      )}

      {/* Chat examples */}
      {current.chatExamples && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Zkus napsat například:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {current.chatExamples.map((ex, i) => (
              <div
                key={i}
                onClick={() => fillChatInput(ex)}
                style={{
                  cursor: 'pointer', padding: '7px 10px', borderRadius: 6,
                  background: 'var(--surface3)', fontSize: 12, color: 'var(--text)',
                  border: '1px solid var(--border)', lineHeight: 1.45,
                  transition: 'border-color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                "{ex}"
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  /* ─ Centered modal ─ */
  if (current.position === 'center') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{
          background: 'var(--surface2)', border: '1.5px solid var(--accent)',
          borderRadius: 16, padding: '24px 28px',
          maxWidth: 460, width: '100%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)', position: 'relative',
        }}>
          {!current.welcomeOnly && (
            <button onClick={handleClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          )}
          <TooltipBody />

          {current.ctaButtons ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                {current.ctaButtons.map(btn => (
                  <button key={btn.href} className={btn.primary ? 'btn btn-primary' : 'btn btn-outline'}
                    style={btn.primary ? { flex: 1 } : { flex: 1 }}
                    onClick={() => { handleClose(); router.push(btn.href) }}>
                    {btn.label}
                  </button>
                ))}
              </div>
              {current.finishNote && (
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 12 }}>{current.finishNote}</div>
              )}
            </>
          ) : current.welcomeOnly ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleNext}>Začít průvodce →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Přeskočit</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {step > 0 && <button className="btn btn-ghost btn-sm" onClick={handleBack}>← Zpět</button>}
                <button className="btn btn-primary btn-sm" onClick={handleNext}>{step === STEPS.length - 1 ? 'Dokončit' : 'Další →'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ─ Spotlight (with target) ─ */
  const hlRect = targetRect ?? null

  const hlStyle: React.CSSProperties = hlRect ? {
    position: 'fixed',
    top: hlRect.top - PAD,
    left: hlRect.left - PAD,
    width: hlRect.width + PAD * 2,
    height: hlRect.height + PAD * 2,
    borderRadius: 8,
    outline: '3px solid var(--accent)',
    boxShadow: '0 0 0 6px rgba(224,32,32,0.3), 0 0 0 9999px rgba(0,0,0,0.8)',
    zIndex: 99998,
    pointerEvents: 'none',
    transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
  } : {}

  const adjustedRect: Rect | null = hlRect
    ? { top: hlRect.top - PAD, left: hlRect.left - PAD, width: hlRect.width + PAD * 2, height: hlRect.height + PAD * 2 }
    : null

  const tooltipPos = adjustedRect
    ? computeTooltipPos(adjustedRect, current.position)
    : { top: '50%' as unknown as number, left: '50%' as unknown as number, transform: 'translate(-50%,-50%)' }

  const arrowStyle = getArrowStyle(current.position)

  return (
    <>
      {/* Fallback bg when target not yet found */}
      {!hlRect && <div style={{ position: 'fixed', inset: 0, zIndex: 99996, background: 'rgba(0,0,0,0.8)' }} />}

      {/* Click blocker */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99997, cursor: 'default' }} onClick={e => e.stopPropagation()} />

      {/* Spotlight */}
      {hlRect && <div style={hlStyle} />}

      {/* Tooltip */}
      <div key={step} style={{
        position: 'fixed', ...tooltipPos,
        zIndex: 99999,
        background: 'var(--surface2)',
        border: '1.5px solid var(--accent)',
        borderRadius: 16,
        padding: '24px 28px',
        minWidth: 400, maxWidth: 440,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        pointerEvents: 'all',
      }}>
        {/* Arrow */}
        {hlRect && <div style={arrowStyle} />}

        <TooltipBody />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            Přeskočit
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <button className="btn btn-ghost btn-sm" onClick={handleBack}>← Zpět</button>}
            <button className="btn btn-primary btn-sm" onClick={handleNext}>
              {step === STEPS.length - 1 ? 'Dokončit' : 'Další →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
