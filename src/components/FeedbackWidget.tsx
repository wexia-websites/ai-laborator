'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type State = 'closed' | 'picking' | 'open' | 'submitting' | 'success'

interface SelectedEl {
  selector: string
  html: string
  domRef: HTMLElement
}

const CATEGORIES = [
  { value: 'bug',     label: 'Bug' },
  { value: 'design',  label: 'Design' },
  { value: 'text',    label: 'Text' },
  { value: 'feature', label: 'Funkce' },
  { value: 'ux',      label: 'UX/Usability' },
]

function buildSelector(el: Element): string {
  let sel = el.tagName.toLowerCase()
  if (el.id) sel += `#${el.id}`
  el.classList.forEach(c => { sel += `.${c}` })
  return sel
}

export function FeedbackWidget() {
  const [state, setState]         = useState<State>('closed')
  const [selected, setSelected]   = useState<SelectedEl | null>(null)
  const [category, setCategory]   = useState('bug')
  const [comment, setComment]     = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')
  const hovered = useRef<HTMLElement | null>(null)

  // Udržuje červený outline na vybraném prvku
  useEffect(() => {
    if (!selected) return
    selected.domRef.style.outline = '2px solid #e02020'
    selected.domRef.style.outlineOffset = '2px'
    return () => {
      selected.domRef.style.outline = ''
      selected.domRef.style.outlineOffset = ''
    }
  }, [selected])

  // Pick mode — crosshair + hover highlight
  useEffect(() => {
    if (state !== 'picking') return
    document.body.style.cursor = 'crosshair'

    const clearHover = (el: HTMLElement) => {
      if (selected && el === selected.domRef) return
      el.style.outline = ''
      el.style.outlineOffset = ''
    }

    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('#fw-root')) return
      if (hovered.current && hovered.current !== t) clearHover(hovered.current)
      hovered.current = t
      t.style.outline = '2px solid #e02020'
      t.style.outlineOffset = '2px'
    }

    const onOut = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('#fw-root')) return
      clearHover(t)
    }

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('#fw-root')) return
      e.preventDefault()
      e.stopPropagation()
      if (hovered.current) { hovered.current = null }
      setSelected({ selector: buildSelector(t), html: t.outerHTML.slice(0, 2000), domRef: t })
      setState('open')
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('click', onClick, true)
    return () => {
      document.body.style.cursor = ''
      if (hovered.current && (!selected || hovered.current !== selected.domRef)) {
        hovered.current.style.outline = ''
        hovered.current = null
      }
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('click', onClick, true)
    }
  }, [state, selected])

  const reset = useCallback(() => {
    setState('closed')
    setSelected(null)
    setCategory('bug')
    setComment('')
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(null)
  }, [])

  const submit = useCallback(async () => {
    if (!comment.trim()) return
    setState('submitting')

    const widgetEl = document.getElementById('fw-root')
    let screenshotBase64: string | null = null

    // ── Screenshot ─────────────────────────────────────────────
    try {
      setLoadingMsg('Pořizuji screenshot...')
      console.log('Starting screenshot...')

      if (selected?.domRef) {
        selected.domRef.style.outline = '3px solid red'
        selected.domRef.style.outlineOffset = '2px'
      }

      if (widgetEl) widgetEl.style.display = 'none'
      await new Promise(r => setTimeout(r, 80))

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 0.5,
      })

      if (widgetEl) widgetEl.style.display = ''
      if (selected?.domRef) {
        selected.domRef.style.outline = ''
        selected.domRef.style.outlineOffset = ''
      }

      // Získej base64 (bez data: prefixu) — pošleme na server
      screenshotBase64 = canvas.toDataURL('image/png').split(',')[1]
      console.log('Screenshot done, size:', screenshotBase64.length, 'chars')
    } catch (screenshotErr) {
      console.error('Screenshot failed:', screenshotErr)
      if (widgetEl) widgetEl.style.display = ''
      if (selected?.domRef) {
        selected.domRef.style.outline = ''
        selected.domRef.style.outlineOffset = ''
      }
    }

    // ── Odešli na server API (upload + DB insert) ───────────────
    try {
      setLoadingMsg('Nahrávám screenshot...')
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        screenshot_base64: screenshotBase64,
        user_id:           user?.id,
        user_email:        user?.email,
        category,
        comment,
        element_selector:  selected?.selector || '',
        url:               window.location.href,
        user_agent:        navigator.userAgent,
        timestamp:         new Date().toISOString(),
      }

      console.log('Saving feedback with screenshot:', !!screenshotBase64)
      setLoadingMsg('Ukládám feedback...')

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()

      if (!res.ok) {
        console.error('Feedback API error:', result.error)
      } else {
        console.log('Upload complete, url:', result.screenshot_url)
      }

      // Webhook
      const wh = process.env.NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL
      if (wh) fetch(wh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, screenshot_url: result.screenshot_url }),
      }).catch(err => console.error('Webhook error:', err))

      setState('success')
      setTimeout(reset, 2500)
    } catch (err) {
      console.error('Feedback submit error:', err)
      setState('open')
    }
  }, [category, comment, selected, reset])

  // ── Floating bug button ────────────────────────────────────────
  const triggerBtn = (
    <button
      onClick={() => setState(state === 'open' ? 'closed' : 'open')}
      title="Nahlásit chybu"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        width: 48, height: 48, borderRadius: '50%',
        background: '#e02020', border: 'none', cursor: 'pointer',
        fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      🐛
    </button>
  )

  // ── Pick mode hint ─────────────────────────────────────────────
  if (state === 'picking') return (
    <div id="fw-root">
      {triggerBtn}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        background: '#1a1a1a', color: '#fff', padding: '10px 20px',
        borderRadius: 8, zIndex: 10000, fontSize: 14, fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)', display: 'flex', gap: 12, alignItems: 'center',
        border: '1px solid #333',
      }}>
        <span style={{ color: '#e02020' }}>●</span>
        <span>Klikni na prvek který chceš nahlásit</span>
        <button onClick={() => setState('open')} style={{
          background: 'transparent', border: '1px solid #555', color: '#aaa',
          borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 13,
        }}>Zrušit</button>
      </div>
    </div>
  )

  // ── Closed ─────────────────────────────────────────────────────
  if (state === 'closed') return <div id="fw-root">{triggerBtn}</div>

  // ── Success ────────────────────────────────────────────────────
  if (state === 'success') return (
    <div id="fw-root">
      {triggerBtn}
      <div style={{
        position: 'fixed', bottom: 84, right: 24, zIndex: 10000,
        background: '#16a34a', color: '#fff', padding: '16px 24px',
        borderRadius: 12, fontSize: 15, fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
        ✓ Feedback úspěšně odeslán
      </div>
    </div>
  )

  // ── Form panel ────────────────────────────────────────────────
  const isSubmitting = state === 'submitting'
  return (
    <div id="fw-root">
      {triggerBtn}
      <div style={{
        position: 'fixed', bottom: 84, right: 24, zIndex: 10000,
        width: 320, background: '#1a1a1a', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid #2a2a2a',
        fontFamily: 'inherit',
      }}>
        {/* Header */}
        <div style={{
          background: '#e02020', padding: '12px 16px',
          borderRadius: '12px 12px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>🐛 Nahlásit chybu</span>
          <button onClick={reset} style={{
            background: 'none', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px',
          }}>×</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Označit prvek */}
          <div>
            <button
              onClick={() => setState('picking')}
              disabled={isSubmitting}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8, cursor: isSubmitting ? 'default' : 'pointer',
                background: selected ? '#1c2e1c' : '#242424',
                border: `1px solid ${selected ? '#16a34a' : '#3a3a3a'}`,
                color: selected ? '#4ade80' : '#aaa',
                fontSize: 13, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 15 }}>{selected ? '✓' : '⊕'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected ? selected.selector : 'Označit prvek na stránce'}
              </span>
              {selected && (
                <span
                  onClick={e => { e.stopPropagation(); clearSelection() }}
                  title="Zrušit označení"
                  style={{ color: '#666', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}
                >×</span>
              )}
            </button>
          </div>

          {/* Kategorie */}
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            disabled={isSubmitting}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              background: '#242424', border: '1px solid #3a3a3a', color: '#e5e5e5',
              fontSize: 13, cursor: 'pointer', outline: 'none',
            }}
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          {/* Komentář */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Co je špatně?"
            disabled={isSubmitting}
            rows={4}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, resize: 'vertical',
              background: '#242424', border: '1px solid #3a3a3a', color: '#e5e5e5',
              fontSize: 13, boxSizing: 'border-box', outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          {/* Loading stav */}
          {isSubmitting && loadingMsg && (
            <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>{loadingMsg}</div>
          )}

          {/* Submit */}
          <button
            onClick={submit}
            disabled={isSubmitting || !comment.trim()}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: !comment.trim() || isSubmitting ? '#3a3a3a' : '#e02020',
              color: !comment.trim() || isSubmitting ? '#666' : '#fff',
              fontWeight: 600, fontSize: 14,
              cursor: !comment.trim() || isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {isSubmitting ? loadingMsg || 'Odesílám...' : 'Odeslat'}
          </button>
        </div>
      </div>
    </div>
  )
}
