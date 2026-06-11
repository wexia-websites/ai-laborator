'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type State = 'closed' | 'picking' | 'open' | 'submitting' | 'success'

interface SelectedEl {
  selector: string
  html: string
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
  const [state, setState]       = useState<State>('closed')
  const [selected, setSelected] = useState<SelectedEl | null>(null)
  const [category, setCategory] = useState('bug')
  const [comment, setComment]   = useState('')
  const hovered = useRef<HTMLElement | null>(null)

  // Pick mode — crosshair + hover highlight + click to select
  useEffect(() => {
    if (state !== 'picking') return

    document.body.style.cursor = 'crosshair'

    const clearHover = (el: HTMLElement) => {
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
      if (hovered.current) clearHover(hovered.current)
      setSelected({ selector: buildSelector(t), html: t.outerHTML.slice(0, 2000) })
      setState('open')
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('click', onClick, true)

    return () => {
      document.body.style.cursor = ''
      if (hovered.current) { clearHover(hovered.current); hovered.current = null }
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('click', onClick, true)
    }
  }, [state])

  const reset = useCallback(() => {
    setState('closed')
    setSelected(null)
    setCategory('bug')
    setComment('')
  }, [])

  const submit = useCallback(async () => {
    if (!comment.trim()) return
    setState('submitting')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const feedbackData = {
        user_id:          user?.id,
        user_email:       user?.email,
        category,
        comment,
        element_selector: selected?.selector || '',
        element_html:     selected?.html     || '',
        screenshot:       null,
        screenshot_mime:  null,
        url:              window.location.href,
        user_agent:       navigator.userAgent,
        timestamp:        new Date().toISOString(),
      }
      supabase.from('feedback').insert(feedbackData)
        .then((res) => { if (res.error) console.error('Feedback DB error:', res.error) })
      const wh = process.env.NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL
      if (wh) fetch(wh, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(feedbackData) })
        .catch(err => console.error('Feedback webhook error:', err))
      setState('success')
      setTimeout(reset, 2500)
    } catch (err) {
      console.error('Feedback error:', err)
      setState('open')
    }
  }, [category, comment, selected, reset])

  // ── Floating button ────────────────────────────────────────────
  const btn = (
    <button
      onClick={() => setState('open')}
      title="Nahlásit chybu"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        width: 48, height: 48, borderRadius: '50%',
        background: '#e02020', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </button>
  )

  // ── Pick mode overlay hint ─────────────────────────────────────
  if (state === 'picking') return (
    <div id="fw-root">
      {btn}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        background: '#1a1a1a', color: '#fff', padding: '10px 20px',
        borderRadius: 8, zIndex: 10000, fontSize: 14, fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)', display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <span>Klikni na prvek který chceš nahlásit</span>
        <button onClick={() => setState('open')} style={{
          background: 'transparent', border: '1px solid #555', color: '#aaa',
          borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 13,
        }}>Zrušit</button>
      </div>
    </div>
  )

  // ── Success ────────────────────────────────────────────────────
  if (state === 'success') return (
    <div id="fw-root">
      {btn}
      <div style={{
        position: 'fixed', bottom: 84, right: 24, zIndex: 10000,
        background: '#16a34a', color: '#fff', padding: '14px 20px',
        borderRadius: 10, fontSize: 14, fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
        ✓ Feedback úspěšně odeslán
      </div>
    </div>
  )

  // ── Closed ─────────────────────────────────────────────────────
  if (state === 'closed') return <div id="fw-root">{btn}</div>

  // ── Form panel ────────────────────────────────────────────────
  const isSubmitting = state === 'submitting'
  return (
    <div id="fw-root">
      {btn}
      <div style={{
        position: 'fixed', bottom: 84, right: 24, zIndex: 10000,
        width: 320, background: '#1a1a1a', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
        fontFamily: 'inherit',
      }}>
        {/* Header */}
        <div style={{ background: '#e02020', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Nahlásit chybu</span>
          <button onClick={reset} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Označit prvek */}
          <div>
            <button
              onClick={() => setState('picking')}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                background: selected ? '#1f3a1f' : '#2a2a2a',
                border: `1px solid ${selected ? '#16a34a' : '#444'}`,
                color: selected ? '#4ade80' : '#ccc', fontSize: 13, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span>{selected ? '✓' : '⊕'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected ? selected.selector : 'Označit prvek na stránce'}
              </span>
              {selected && (
                <span
                  onClick={(e) => { e.stopPropagation(); setSelected(null) }}
                  style={{ color: '#888', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}
                  title="Zrušit označení"
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
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: '#2a2a2a', border: '1px solid #444', color: '#fff',
              fontSize: 13, cursor: 'pointer',
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
              width: '100%', padding: '8px 12px', borderRadius: 8, resize: 'vertical',
              background: '#2a2a2a', border: '1px solid #444', color: '#fff',
              fontSize: 13, boxSizing: 'border-box',
            }}
          />

          {/* Submit */}
          <button
            onClick={submit}
            disabled={isSubmitting || !comment.trim()}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: !comment.trim() || isSubmitting ? '#555' : '#e02020',
              color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: !comment.trim() || isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Odesílám...' : 'Odeslat'}
          </button>
        </div>
      </div>
    </div>
  )
}
