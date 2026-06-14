'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SCRIPT_ID = 'wexia-feedback-script'

// Sdílený stav mezi reinity widgetu
let savedScreenshotBase64: string | null = null
let pickBorderEl: HTMLDivElement | null = null
let pickObserver: MutationObserver | null = null

function showToast(message: string) {
  document.getElementById('feedback-toast')?.remove()
  const el = document.createElement('div')
  el.id = 'feedback-toast'
  el.textContent = message
  el.style.cssText = [
    'position:fixed',
    'top:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:#16a34a',
    'color:#fff',
    'padding:14px 28px',
    'border-radius:10px',
    'font-size:15px',
    'font-weight:600',
    'z-index:2147483647',
    'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
    'pointer-events:none',
  ].join(';')
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3500)
}

// Spustí se po initWidget — sleduje kdy widget přejde do pick mode (div.wf-overlay)
// a hned při kliknutí pořídí screenshot s červeným rámečkem
function setupPickInterception() {
  pickObserver?.disconnect()
  pickObserver = null

  const widgetRoot = document.getElementById('wexia-feedback-root')
  if (!widgetRoot) return

  pickObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement) || !node.classList.contains('wf-overlay')) continue

        // Capture phase — náš handler před widget onclick, widget onclick=form show
        node.addEventListener('click', async (e: MouseEvent) => {
          // Najdi skutečný element pod overlay (vyfiltruj widget elementy)
          const els = document.elementsFromPoint(e.clientX, e.clientY)
          const target = els.find(el =>
            !el.closest('#wexia-feedback-root') &&
            el.tagName !== 'HTML' &&
            el.tagName !== 'BODY'
          ) as HTMLElement | null

          if (!target) return

          // Odstraň starý rámeček
          pickBorderEl?.remove()

          // Červený rámeček nad označeným prvkem (border funguje v html2canvas, outline ne)
          const rect = target.getBoundingClientRect()
          pickBorderEl = document.createElement('div')
          Object.assign(pickBorderEl.style, {
            position:   'fixed',
            left:       `${rect.left - 4}px`,
            top:        `${rect.top - 4}px`,
            width:      `${rect.width + 8}px`,
            height:     `${rect.height + 8}px`,
            border:     '4px solid #e02020',
            borderRadius: '4px',
            background: 'rgba(224,32,32,0.07)',
            zIndex:     '2147480000',
            pointerEvents: 'none',
            boxSizing:  'border-box',
          })
          document.body.appendChild(pickBorderEl)

          // Skryj widget před screenshotem — widget form se zobrazí ale zůstane skrytý
          // dokud screenshot nedokončíme (300ms)
          const widgetEl = document.getElementById('wexia-feedback-root')
          if (widgetEl) widgetEl.style.visibility = 'hidden'

          // 300ms = rámeček se vyrenderuje, widget zůstává skrytý
          await new Promise(r => setTimeout(r, 300))

          savedScreenshotBase64 = null
          try {
            const html2canvas = (await import('html2canvas')).default
            const canvas = await html2canvas(document.body, { scale: 2, useCORS: true, logging: false })
            savedScreenshotBase64 = canvas.toDataURL('image/png').split(',')[1]
          } catch (err) {
            console.warn('Pick screenshot failed:', err)
          }

          // Obnov widget — uživatel teď uvidí formulář
          if (widgetEl) widgetEl.style.visibility = 'visible'
        }, true) // capture = před widget onclick
      }
    }
  })

  pickObserver.observe(widgetRoot, { childList: true, subtree: true })
}

function initWidget() {
  if (!window.WexiaFeedback) return

  window.WexiaFeedback.destroy?.()
  window.WexiaFeedback.init({
    branding: {
      accentColor: '#e02020',
      buttonIcon: 'bug',
      buttonLabel: 'Nahlásit',
      panelTitle: 'Nahlásit chybu',
      position: 'bottom-right',
      locale: 'cs',
      showLabel: false,
      launcherStyle: 'minimal'
    },
    categories: [
      { value: 'bug', label: 'Bug' },
      { value: 'design', label: 'Design' },
      { value: 'text', label: 'Text' },
      { value: 'feature', label: 'Funkce' },
      { value: 'ux', label: 'UX/Usability' }
    ],
    labels: {
      pickHint: 'Klikni na prvek který chceš nahlásit',
      category: 'Kategorie',
      comment: 'Komentář',
      commentPlaceholder: 'Co je špatně?',
      send: 'Odeslat',
      cancel: 'Zrušit',
      sending: 'Odesílám...',
      sent: 'Odesláno ✓',
      missingComment: 'Prosím napiš komentář'
    },
    screenshot: { enabled: true, maxScale: 2 },
    onSubmit: async (payload: any) => {
      showToast('✓ Feedback úspěšně odeslán')

      // Odstraň červený rámeček
      pickBorderEl?.remove()
      pickBorderEl = null

      try {
        const { data: { user } } = await supabase.auth.getUser()

        const selector = payload.selectedElement?.selector as string | undefined

        const feedbackData = {
          user_id:           user?.id,
          user_email:        user?.email,
          category:          payload.category || 'bug',
          comment:           payload.comment  || '',
          element_selector:  selector         || '',
          screenshot_base64: savedScreenshotBase64, // ze selekce prvku, ne z odeslání
          url:               window.location.href,
          user_agent:        navigator.userAgent,
          timestamp:         new Date().toISOString(),
        }

        savedScreenshotBase64 = null

        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackData),
        }).catch(err => console.error('Feedback API error:', err))

        const webhookUrl = process.env.NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData),
          }).catch(err => console.error('Feedback webhook error:', err))
        }
      } catch (err) {
        console.error('Feedback submission error:', err)
      }
    }
  })

  setupPickInterception()
}

export function FeedbackWidget() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) {
      initWidget()
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = '/feedback-widget.min.js'
    script.async = true
    script.onload = initWidget
    document.body.appendChild(script)

    return () => {
      window.WexiaFeedback?.destroy?.()
      pickObserver?.disconnect()
      pickBorderEl?.remove()
    }
  }, [])

  return null
}

declare global {
  interface Window {
    WexiaFeedback?: {
      init: (config: any) => void
      destroy: () => void
      autoInit: () => void
      VERSION: string
    }
  }
}
