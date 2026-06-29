# CLAUDE_CONTEXT.md
> Aktualizováno: 2026-06-12. Slouží jako rychlý kontext pro nové Claude session.

---

## Projekt

**AI Laborator** — interní Next.js aplikace pro sledování a sdílení AI use cases, nástrojů a projektů ve firmě.

- **Repo:** `C:\Users\TIGO\desktop\lab-10.6` (Windows) = `/mnt/c/Users/TIGO/desktop/lab-10.6` (WSL2)
- **GitHub:** `https://github.com/katzithebeast/ai-laborator.git`
- **Vercel:** automatický deploy po push na `main`
- **Stack:** Next.js 16.2.4, React 18, TypeScript strict, Supabase (DB + Storage + Auth), Tailwind CSS

---

## Prostředí

- **WSL2 na Windows** — hot reload nefunguje (DrvFS / inotify), server restartovat ručně po každé změně
- **Spuštění serveru:** `node node_modules/next/dist/bin/next dev` (ne `npm run dev` — .cmd chybí)
- **Git push:** SSH nefunguje ve WSL2 → pushovat z Windows terminálu: `cd C:\Users\TIGO\desktop\lab-10.6 && git push origin main`
- **TypeScript check:** `node node_modules/typescript/bin/tsc --noEmit`

### .env.local (nikdy commitovat)
```
NEXT_PUBLIC_SUPABASE_URL=https://apernyqmipsxkrmmcuvy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        ← nutný pro server routes obcházející RLS
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
AI_WATCH_CRON_SECRET=...
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/jjtc5o5rud31fhe6wiwjwn7nqdjbttt6
NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL=https://hook.eu1.make.com/5iqvybpmcejnwp1n7eezdwq6ystoj95o
```

---

## Stránky aplikace (`/app/`)

| Stránka | Popis |
|---------|-------|
| `/app/` | Dashboard / přehled |
| `/app/inbox` | AI Watch inbox — nové AI nástroje ke zpracování |
| `/app/usecases` | Seznam use cases |
| `/app/my-work` | Moje use cases + nástroje |
| `/app/claimboard` | Claim board nástrojů |
| `/app/review` | Review use cases |
| `/app/approval` | Schválení use cases + auditů (admin/reviewer) |
| `/app/verify` | Verifikace |
| `/app/revision` | Revize |
| `/app/projects` | Projekty |
| `/app/ranking` | Žebříček |
| `/app/ai-watch` | AI Watch feed |
| `/app/chat` | Chat s AI |
| `/app/settings` | Nastavení profilu |
| `/app/admin` | Admin panel |
| `/app/tools-tested` | Otestované nástroje |

---

## API routes (`/api/`)

| Route | Popis |
|-------|-------|
| `/api/feedback` | Ukládá bug report do Supabase DB + uploaduje screenshot do Storage |
| `/api/webhook-publish` | Odešle use case na Make.com webhook při publishnutí |
| `/api/chat` | Claude/OpenAI chat |
| `/api/chat-db` | Chat s databázovým kontextem |
| `/api/extract` | Extrakce use case z textu |
| `/api/extract-project` | Extrakce projektu |
| `/api/categorize` | Kategorizace |
| `/api/deduplicate` | Deduplikace |
| `/api/discovery` | Discovery nástrojů |
| `/api/ai-watch/feed` | AI Watch feed |
| `/api/ai-watch/run` | Spuštění AI Watch |
| `/api/ai-watch/trigger` | Trigger AI Watch |
| `/api/admin/users` | Admin — správa uživatelů |

---

## Důležité soubory

| Soubor | Popis |
|--------|-------|
| `src/components/FeedbackWidget.tsx` | Bug reporting widget (WexiaFeedback) |
| `src/app/api/feedback/route.ts` | Server-side feedback API (service role) |
| `src/app/api/webhook-publish/route.ts` | Make.com webhook při publishnutí |
| `src/lib/supabase.ts` | Supabase klient (real + dummy fallback pro lokální vývoj) |
| `src/lib/useRole.ts` | Role-based access control hook |
| `public/feedback-widget.min.js` | WexiaFeedback widget (upraveno: okamžité zavření po success) |
| `src/app/globals.css` | Globální CSS včetně animace `.wf-launcher.minimal` hover efektu |
| `supabase/*.sql` | Migrace — spouštět ručně v Supabase SQL editoru |

---

## Supabase

- **URL:** `https://apernyqmipsxkrmmcuvy.supabase.co`
- **RLS:** všechny tabulky mají RLS `to authenticated` — server API routes MUSÍ používat `SUPABASE_SERVICE_ROLE_KEY`
- **Storage bucket:** `feedback-screenshots` (public) — pro screenshoty z FeedbackWidget
- **Tabulky:** `use_cases`, `tools`, `profiles`, `projects`, `feedback`, `tool_audits`, `app_settings`, `chat_sessions`

### Klíčové pravidlo pro server routes
```typescript
// SPRÁVNĚ — obchází RLS:
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ŠPATNĚ — anonymní klient na serveru bez session = RLS zablokuje SELECT:
import { supabase } from '@/lib/supabase'
```

---

## FeedbackWidget — aktuální stav

Widget `WexiaFeedback` (`/feedback-widget.min.js`) s vlastní screenshot logikou.

**Průběh při nahlášení chyby:**
1. Uživatel klikne na bug ikonu → widget otevře "pick mode" (`div.wf-overlay` v DOM)
2. `MutationObserver` detekuje overlay → připojí capture-phase click handler
3. Uživatel klikne na prvek → handler:
   - Přidá červený rámeček (`div` s `border: 4px solid #e02020`) přes prvek
   - Skryje widget panel (`visibility: hidden`)
   - Počká 300ms → `html2canvas(document.body, { scale: 1 })` → uloží base64
   - Obnoví widget panel (formulář je nyní viditelný)
4. Uživatel vyplní formulář a odešle
5. `onSubmit` → odstraní rámeček → pošle `savedScreenshotBase64` na `/api/feedback`
6. `/api/feedback` → upload do Supabase Storage → uloží URL do DB → odešle na Make.com webhook

**Poznámky:**
- `html2canvas` neumí renderovat CSS `outline` → používáme `border` na overlay divu
- Widget's vlastní screenshot (`payload.screenshot`) NEVYKRESLUJE červené označení (widget ho explicitně excluduje z `ignoreElements`)
- `payload.selectedElement?.selector` (ne `payload.element?.selector`)

---

## Make.com integrace

| Webhook | URL | Trigger |
|---------|-----|---------|
| `MAKE_WEBHOOK_URL` | `hook.eu1.make.com/jjtc5o5rud31...` | Publishnutí use case (`/api/webhook-publish`) |
| `NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL` | `hook.eu1.make.com/5iqvybpmcej...` | Odeslání bug reportu (z browseru i ze serveru) |

**Make.com → Google Drive:** screenshot (base64 → `toBinary(1.screenshot; "base64")`) + popis use case

---

## Poslední změny (červen 2026)

| Commit | Popis |
|--------|-------|
| `ede846d` | Fix webhook-publish: service role místo anon klienta (RLS fix) |
| `089d06e` | Feedback: screenshot při selekci prvku (ne při odeslání) — MutationObserver |
| `b617f86` | Feedback: overlay div místo CSS outline (html2canvas fix) |
| `bafc292` | Feedback: flash efekt + outline + 500ms delay |
| `cd5dd54` | Feedback: pokus použít widget screenshot z payload (nevyřešeno) |
| `9082f7a` | Feedback: scale 1 (ostrý obraz) |
| `a36f632` | globals.css: animace wf-launcher.minimal hover |
| `1724d8c` | Revert FeedbackWidget do původního stavu |
| `cad914e` | Sjednocení Kontrola+Verifikace do stránky Schválení |

---

## Otevřené problémy / TODO

- [ ] **FeedbackWidget screenshot** — červené označení prvku stále nemusí být 100% spolehlivé; ověřit na produkci po posledním pushu
- [ ] **Supabase migrace** — ověřit že `ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS screenshot_url text` bylo spuštěno v SQL editoru
- [ ] **Supabase Storage** — ověřit že bucket `feedback-screenshots` existuje a je public
- [ ] **Make.com webhook** — po fixu (`ede846d`) ověřit že use cases se opět posílají po publishnutí
