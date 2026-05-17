# AI Watch Local Feed Implementation Plan

Goal: dostat AI Watch novinky do aplikace `/Users/christian/Wexia/ai-lab` tak, aby šly lokálně otestovat bez přístupu k produkčnímu Supabase účtu. Supabase změny se připraví jako SQL migrace pro kolegu, ale MVP poběží lokálně přes file-backed JSON store.

## Kontext

- Aplikace je Next.js 16 App Router.
- App stránky jsou v `src/app/app/*`.
- Navigace je v `src/app/app/layout.tsx`.
- Role permissions jsou v `src/lib/useRole.ts`.
- Lokální Supabase klient je teď dummy fixture v `src/lib/supabase.ts`, takže appka už je lokálně odpojená od reálné Supabase.
- Firecrawl pro Hermes web tools běží lokálně na `http://localhost:3002` pouze jako vývojářský nástroj asistenta. Nesmí být runtime dependency produktu.

## Runtime boundary: žádná závislost na Hermes/asistentovi

Produktový AI Watch feed nesmí záviset na mně jako osobním asistentovi, Hermes cronech, Hermes web_search/web_extract ani Discord webhooku.

Runtime flow aplikace:

1. App server / scheduled endpoint stáhne kandidáty deterministicky ze zdrojových API/RSS/HTTP feedů.
2. OpenAI API server-side udělá normalizaci, dedupe pomoc, ranking, kategorizaci a české shrnutí do strict JSON.
3. Aplikace uloží výsledek do lokálního JSON store pro MVP, později do Supabase.
4. UI čte pouze uložený feed.

Hermes/asistent smí sloužit jen pro vývoj, debugging a ruční ověření. Ne pro produkční sběr, rozhodování, scheduling nebo doručování feedu.

## Architektura MVP

Nejdřív neřešit Supabase write path. Udělat čistý lokální feed:

1. `data/ai-watch/items.json` — lokální datastore pro feed itemy.
2. `data/ai-watch/runs.json` — lokální log ingest běhů.
3. `src/lib/ai-watch/types.ts` — sdílené typy.
4. `src/lib/ai-watch/localStore.ts` — server-only read/write JSON store.
5. `src/lib/ai-watch/sources.ts` — deterministic fetch kandidátů z GitHub/HN/HF.
6. `src/lib/ai-watch/openai.ts` — OpenAI normalizace/ranking do strict JSON.
7. `src/app/api/ai-watch/run/route.ts` — protected POST ingest route.
8. `src/app/api/ai-watch/feed/route.ts` — GET feed route pro UI.
9. `src/app/app/ai-watch/page.tsx` — nová stránka s feedem.
10. Upravit nav + role access.

Později se vymění jen store vrstva za Supabase implementaci.

## Proč nevolat OpenAI přímo z UI

- Page load má číst už uložené položky, ne spouštět research.
- OpenAI API key musí být jen server-side.
- Scheduled run má být idempotentní a dedupovat podle URL.
- Feed musí být auditovatelný: víme, odkud položka přišla a kdy ji job našel.

## Env

Doplnit do `.env.local.example`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
AI_WATCH_CRON_SECRET=change-me-long-random-string
AI_WATCH_STORE=local
```

`AI_WATCH_STORE=local` teď. Později `supabase`.

## Typy

`src/lib/ai-watch/types.ts`:

```ts
export type AiWatchCategory = 'tool' | 'breaking' | 'hidden_gem' | 'infra' | 'tip'
export type AiWatchPriority = 'high' | 'medium' | 'low'
export type AiWatchConfidence = 'high' | 'medium' | 'low'

export type RawAiWatchCandidate = {
  id: string
  title: string
  url: string
  sourceType: 'github' | 'huggingface' | 'hn' | 'reddit' | 'blog' | 'vendor' | 'other'
  sourceDomain?: string
  description?: string
  publishedAt?: string
  raw?: unknown
}

export type AiWatchItem = {
  id: string
  title: string
  sourceUrl: string
  sourceDomain?: string
  sourceType: RawAiWatchCandidate['sourceType']
  category: AiWatchCategory
  summary: string
  whyItMatters?: string
  apiIntegrations?: string
  pricingLicense?: string
  priority: AiWatchPriority
  confidence: AiWatchConfidence
  tags: string[]
  imageUrl?: string
  publishedAt?: string
  discoveredAt: string
  raw?: unknown
}

export type AiWatchRun = {
  id: string
  status: 'running' | 'success' | 'failed'
  startedAt: string
  finishedAt?: string
  model?: string
  promptVersion: string
  sourceCount: number
  insertedCount: number
  error?: string
}
```

## Master prompt

`src/lib/ai-watch/prompt.ts`:

- Czech summaries.
- Use only provided candidates.
- Do not invent pricing/license/API support.
- If unknown: `neuvedeno`.
- Prioritize practical AI tools, workflow automation, APIs, MCP, OCR/doc AI, voice/call AI, browser/computer-use, eval/observability.
- Filter generic wrappers, waitlists, pure model hype.
- Return JSON only.

## Local store

`src/lib/ai-watch/localStore.ts`:

- `readItems()`
- `upsertItems(items)` dedupe by normalized `sourceUrl`
- `listItems({ category, limit })`
- `appendRun(run)` / `updateRun(run)`

Use `server-only`, `fs/promises`, `path.join(process.cwd(), 'data/ai-watch')`.

## Source collection MVP

`src/lib/ai-watch/sources.ts`:

Start with three reliable public APIs:

1. GitHub search:
   - queries like `agent created:>YYYY-MM-DD stars:>3`, `mcp created:>YYYY-MM-DD stars:>3`, `llm created:>YYYY-MM-DD stars:>3`
   - use GitHub REST search unauthenticated for MVP, but handle rate limit gracefully.
2. HN Algolia:
   - `search_by_date` with `numericFilters=created_at_i>cutoff`
   - terms: `AI`, `LLM`, `agent`, `MCP`, `OCR`, `benchmark`.
3. Hugging Face blog RSS/API:
   - `https://huggingface.co/blog/feed.xml`

Each source returns `RawAiWatchCandidate[]`. Do not write to store here.

## OpenAI curation

`src/lib/ai-watch/openai.ts`:

- Use `openai` package.
- Model env: `OPENAI_MODEL || 'gpt-4.1-mini'`.
- Input: candidates + recent seen URLs.
- Output: validated `AiWatchItem[]`.
- Keep max output around 8-12 items per run.

Fallback if `OPENAI_API_KEY` missing:
- store top candidates with rough deterministic summaries and `confidence='low'`, so UI can still be tested locally.

## API routes

### `POST /api/ai-watch/run`

- Require `Authorization: Bearer ${AI_WATCH_CRON_SECRET}`.
- If missing secret in local dev, allow only when `NODE_ENV !== 'production'` and log warning.
- Collect raw candidates.
- Curate with OpenAI.
- Upsert into local JSON store.
- Return `{ ok, runId, sourceCount, insertedCount }`.

### `GET /api/ai-watch/feed`

- Query params: `category`, `limit`.
- Read local store.
- Return latest items ordered by `discoveredAt desc`.

## UI

`src/app/app/ai-watch/page.tsx`:

- Client component is fine for first MVP.
- Fetch `/api/ai-watch/feed` on mount.
- Add filters: Vše, Nástroje, Breaking, Hidden gems, Infra.
- Cards display:
  - title
  - category / priority / confidence
  - summary
  - proč to řešit
  - API/integrace
  - cena/licence
  - tags
  - source link
  - discovered date
- Add button `Spustit refresh`, calls `/api/ai-watch/run` with dev secret from server is tricky from browser; safer for MVP: button calls a local-only `/api/ai-watch/run-dev` or omit button and use curl.

Recommended for now: omit browser trigger, use curl/manual scheduler.

## Nav

`src/app/app/layout.tsx`:

Add under `AI NÁSTROJE`:

```ts
{ id: 'ai-watch', label: 'AI Watch', icon: '◌', href: '/app/ai-watch' },
```

`src/lib/useRole.ts`:

```ts
'ai-watch': ['admin', 'analyst', 'viewer'],
```

## Supabase later

Prepare SQL migration but do not depend on it locally:

`supabase/migration_ai_watch.sql` with tables:

- `ai_watch_runs`
- `ai_watch_items`

Same fields as local types, snake_case.

When colleague imports Supabase changes:

1. Add `SUPABASE_SERVICE_ROLE_KEY` to hosting env.
2. Implement `src/lib/ai-watch/supabaseStore.ts`.
3. Add `src/lib/ai-watch/store.ts` that selects local/supabase by `AI_WATCH_STORE`.
4. Set `AI_WATCH_STORE=supabase` in production.

## Local verification

Install OpenAI SDK:

```bash
npm install openai
```

Run app:

```bash
npm run dev
```

Trigger ingest:

```bash
curl -s -X POST http://127.0.0.1:3000/api/ai-watch/run \
  -H "Authorization: Bearer $AI_WATCH_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Open:

```text
http://127.0.0.1:3000/app/ai-watch
```

Expected:

- Feed page shows stored items.
- Re-running ingest does not duplicate same `sourceUrl`.
- App works without production Supabase.
- If OpenAI key is missing, deterministic fallback still populates test data.

## Scheduler later

For production use one of:

1. Vercel Cron calling `/api/ai-watch/run` with supported cron auth.
2. GitHub Actions schedule with curl + bearer secret.
3. Existing Hermes cron temporarily calling the endpoint.

For this project, GitHub Actions/external cron with bearer header is easiest because the route protection stays explicit.
