import { createHash } from 'node:crypto'
import type { LangfuseTraceClient } from 'langfuse'
import type {
  AiWatchCategory,
  AiWatchConfidence,
  AiWatchItem,
  AiWatchPriority,
  AiWatchSkipList,
  AiWatchSourceType,
  OpenAiAiNewsPayload,
} from './types'
import { normalizeUrlForDedupe } from './storeHelpers'

export const AI_WATCH_PROMPT_VERSION = 'ai-watch-openai-web-search-v5'

export type AiWatchMode = 'news' | 'tools'

const CATEGORIES: AiWatchCategory[] = ['tool', 'breaking', 'hidden_gem', 'infra', 'tip']
const TOOLS_MODE_CATEGORIES: AiWatchCategory[] = ['tool', 'hidden_gem']
const PRIORITIES: AiWatchPriority[] = ['high', 'medium', 'low']
const CONFIDENCES: AiWatchConfidence[] = ['high', 'medium', 'low']
const SOURCE_TYPES: AiWatchSourceType[] = ['openai_web_search', 'github', 'huggingface', 'hn', 'reddit', 'blog', 'vendor', 'other']

export type BuildOpenAiAiNewsRequestOptions = {
  now: string
  skipList?: AiWatchSkipList
  model?: string
  maxItems?: number
  mode?: AiWatchMode
}

export type OpenAiAiNewsRequest = {
  model: string
  store: false
  max_output_tokens: number
  input: Array<{
    role: 'system' | 'user'
    content: Array<{ type: 'input_text'; text: string }>
  }>
  tools: Array<{ type: 'web_search' }>
  text: {
    format: {
      type: 'json_schema'
      name: 'ai_news_feed' | 'ai_tool_discovery'
      strict: true
      schema: Record<string, unknown>
    }
  }
}

function makeSchema(allowedCategories: AiWatchCategory[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      generatedAt: { type: 'string' },
      querySummary: { type: 'string' },
      items: {
        type: 'array',
        minItems: 0,
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            sourceUrl: { type: 'string' },
            sourceDomain: { type: ['string', 'null'] },
            sourceType: { type: ['string', 'null'] },
            category: { type: 'string', enum: allowedCategories },
            summary: { type: 'string' },
            whyItMatters: { type: ['string', 'null'] },
            apiIntegrations: { type: ['string', 'null'] },
            pricingLicense: { type: ['string', 'null'] },
            priority: { type: 'string', enum: PRIORITIES },
            confidence: { type: 'string', enum: CONFIDENCES },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            topicKeywords: { type: 'array', items: { type: 'string' }, maxItems: 6 },
            entityNames: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            publishedAt: { type: ['string', 'null'] },
          },
          required: [
            'title',
            'sourceUrl',
            'sourceDomain',
            'sourceType',
            'category',
            'summary',
            'whyItMatters',
            'apiIntegrations',
            'pricingLicense',
            'priority',
            'confidence',
            'tags',
            'topicKeywords',
            'entityNames',
            'publishedAt',
          ],
        },
      },
    },
    required: ['generatedAt', 'querySummary', 'items'],
  }
}

function formatSkipBlock(label: string, values: string[], cap: number): string {
  if (values.length === 0) return `${label}: (žádné)`
  const sample = values.slice(0, cap).join(', ')
  const suffix = values.length > cap ? ` (+${values.length - cap} dalších)` : ''
  return `${label}: ${sample}${suffix}`
}

const NEWS_SYSTEM_PROMPT = (maxItems: number) => [
  'You are the daily AI news curator for an AI-first Czech company.',
  'Goal: keep the team aware of what an AI-first company should know — both mainstream industry moves (big model releases, regulations, major launches) AND lesser-known practical tools, papers, agents/MCP, voice/OCR/automation finds.',
  '',
  'QUALITY OVER QUANTITY. Hard rules:',
  '- Return at most ' + maxItems + ' items, but FEWER is better. Empty array is a valid, expected answer on quiet days.',
  '- Each item must justify why an AI-first company should care today. If you cannot, skip it.',
  '- No fundraising/IPO noise unless it materially changes capability or pricing for builders.',
  '- No reheated stories — if a topic_keyword in the skip list is already covered, do not return it again unless there is a genuinely new substantive update (and even then, summarize the new angle, not the old story).',
  '- No SEO listicles, no waitlists without product access, no pure model hype.',
  '',
  'SOURCE URL RULES (critical, common failure mode):',
  '- sourceUrl MUST point to a REAL, VERIFIED article/announcement/repo URL that you found via web_search and confirmed is reachable. Never invent URLs.',
  '- NEVER use placeholders like "your-repo", "your-org", "<username>", "owner/repo", "example-org/example-app". If you do not have the actual GitHub username or repo name, SKIP the item.',
  '- NEVER use newsletter homepages, podcast feed pages, weekly digest URLs, aggregator homepages, "/stories", "/news", "/blog" index pages, or any URL whose path is the site root.',
  '- If the only source you can find is a newsletter or aggregator, find the PRIMARY SOURCE it links to and use that URL. If no primary source exists, skip the item.',
  '- The URL must have a specific article-level path. CONCRETE EXAMPLES of valid shapes (do NOT copy these literally, find real ones):',
  '    blog.google/products/ai/gemini-3-release/, anthropic.com/news/claude-projects, github.com/anthropics/claude-code (real org + real repo).',
  '',
  'For each item provide:',
  '- topicKeywords: 2-5 canonical slug-style keywords identifying the topic. Examples: gemini-4-launch, mcp-spec-update, claude-projects. Use lowercase, hyphen-separated, durable identifiers (not date-bound). PRIMARY anti-duplicity signal — keep them specific to the story, not the company.',
  '- entityNames: 1-3 organizations or product names (proper case). Examples: Google, Anthropic, OpenAI, Mistral, Hugging Face, Cursor. Metadata for UI filtering; NOT used for skip.',
  '- category: tool | hidden_gem (concrete app/library a team can try) | breaking (industry-wide news) | infra (runtimes, eval, observability) | tip (technique/paper/playbook).',
  '- priority: high (must-know today), medium (worth seeing), low (background).',
  '- confidence: high if vendor/primary source, medium for reputable secondary, low otherwise.',
  '- Czech title and Czech summary with natural diacritics. Keep summary short and useful.',
  '- whyItMatters: practical "co s tím v naší AI lab firmě" sentence.',
  '- Use "neuvedeno" for unknown pricing/license/API.',
].join('\n')

const TOOLS_SYSTEM_PROMPT = (maxItems: number) => [
  'You are a tool/library scout for an AI-first Czech company. The team wants concrete things they can DOWNLOAD, SIGN UP FOR, INSTALL, or CLONE — and test in their workflow this week.',
  '',
  'WHAT YOU RETURN (strict):',
  '- ONLY concrete, testable items: SaaS apps with sign-up, browser extensions, CLI tools, GitHub repositories, MCP servers, libraries (npm/pypi/cargo/pip), JetBrains/VS Code plugins, Chrome extensions, Hugging Face spaces, AI-powered desktop apps, no-code platforms with free tier.',
  '- category MUST be either "tool" (well-known/popular app) or "hidden_gem" (less mainstream but practical).',
  '- Return at most ' + maxItems + ' items. FEWER is better. Empty array `items: []` is a valid expected answer when nothing genuinely new and testable exists.',
  '',
  'HARD BLACKLIST — DO NOT RETURN:',
  '- News stories, regulation updates, IPO/funding/M&A news, layoffs, geopolitics, opinion pieces.',
  '- Vendor announcements that are NOT a downloadable/usable product (e.g. "Company X announces partnership with Y").',
  '- Pre-release waitlists with no public access.',
  '- Pure model releases (GPT-X, Claude-X, Gemini-X) unless there is a concrete new tool/SDK/app a team can integrate today.',
  '- Newsletter homepages, podcast feeds, aggregators, "/stories", "/news", "/blog" index pages.',
  '- Anything where you cannot point to a specific download/sign-up/clone URL.',
  '',
  'SOURCE URL RULES (critical — past runs failed here):',
  '- sourceUrl MUST be the REAL URL where someone can actually GET the tool: GitHub repo, npm/pypi package page, Chrome Web Store listing, vendor pricing/signup page, Hugging Face space, marketplace listing.',
  '- The URL must be one you FOUND via web_search and that actually loads. Never invent or guess GitHub usernames or repo names.',
  '- NEVER use placeholders: no "your-repo", "your-org", "owner/repo", "<username>", "example-org/...", "yourname". If you cannot find the real owner/repo, SKIP the item.',
  '- NEVER newsletter/aggregator/listing URLs. Specific article-level path required.',
  '- The runtime verifies github.com / huggingface.co / pypi.org / npmjs.com URLs with a HEAD request. Made-up URLs will be dropped.',
  '',
  'For each item provide:',
  '- topicKeywords: 2-5 canonical slug-style keywords (e.g. browser-use-agent, mcp-server-postgres, ocr-mistral-7b). PRIMARY anti-duplicity signal.',
  '- entityNames: 1-3 vendor/product names. Metadata; NOT used for skip.',
  '- category: "tool" or "hidden_gem" — those are the ONLY allowed values in this scan.',
  '- priority: high (try this week), medium (worth bookmarking), low (background interest).',
  '- confidence: high if vendor/repo direct, medium for reputable secondary, low otherwise.',
  '- Czech title (jméno nástroje + krátký popis) a Czech summary. Diacritics natural.',
  '- whyItMatters: konkrétní use case ve firmě — co tým otestuje, na jakém procesu.',
  '- apiIntegrations: API/SDK/MCP support if any, otherwise "neuvedeno".',
  '- pricingLicense: free/paid/open-source/license, otherwise "neuvedeno".',
].join('\n')

export function buildOpenAiAiNewsRequest(options: BuildOpenAiAiNewsRequestOptions): OpenAiAiNewsRequest {
  const maxItems = options.maxItems ?? 8
  const mode: AiWatchMode = options.mode ?? 'news'
  const skip = options.skipList ?? { topicKeywords: [], entityNames: [], urls: [] }
  const skipUrls = skip.urls.map(normalizeUrlForDedupe)

  const allowedCategories = mode === 'tools' ? TOOLS_MODE_CATEGORIES : CATEGORIES
  const systemText = mode === 'tools' ? TOOLS_SYSTEM_PROMPT(maxItems) : NEWS_SYSTEM_PROMPT(maxItems)
  const userTopText = mode === 'tools'
    ? `Aktuální čas: ${options.now}\nNajdi konkrétní AI tooly / repa / pluginy / SaaS / knihovny vydané nebo aktualizované za posledních 7–14 dní, které si tým může otestovat tento týden.`
    : `Aktuální čas: ${options.now}\nNajdi AI novinky z posledních cca 7 dní (pro průměrný cron běh) až 14 dní (pokud byl dlouhý odstup).`
  const userBottomText = mode === 'tools'
    ? `Použij sourceType jeden z: ${SOURCE_TYPES.join(', ')}.\nPoužij category jen tool nebo hidden_gem.\nPoužij priority high jen pro tooly, které by tým měl vyzkoušet hned tento týden.`
    : `Použij sourceType jeden z: ${SOURCE_TYPES.join(', ')}.\nPoužij category jeden z: ${CATEGORIES.join(', ')}.\nPoužij priority high jen pro věci, které by tým měl vidět hned dnes.`

  return {
    model: options.model ?? 'gpt-5.4',
    store: false,
    max_output_tokens: 8000,
    tools: [{ type: 'web_search' }],
    text: {
      format: {
        type: 'json_schema',
        name: mode === 'tools' ? 'ai_tool_discovery' : 'ai_news_feed',
        strict: true,
        schema: makeSchema(allowedCategories),
      },
    },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemText }],
      },
      {
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            userTopText,
            '',
            'ANTI-DUPLICITY SKIP LIST (z naší databáze, posledních 90 dní):',
            formatSkipBlock('SKIP topic_keywords (už jsme reportovali, NEvracej znova)', skip.topicKeywords, 60),
            formatSkipBlock('SKIP URLs (už uložené konkrétní články)', skipUrls, 30),
            '',
            mode === 'tools'
              ? 'Pokud po vyloučení skip listu není žádný skutečně nový a testovatelný tool, vrať items: []. Lepší prázdný výsledek než news/announcement balast.'
              : 'Pokud po vyloučení skip listu nezbyde nic skutečně nového a kvalitního, vrať items: []. Lepší prázdný den než spam.',
            '',
            userBottomText,
          ].join('\n'),
        }],
      },
    ],
  }
}

export function extractResponseText(response: unknown): string {
  if (!response || typeof response !== 'object') return ''
  const maybe = response as { output_text?: unknown; output?: unknown }
  if (typeof maybe.output_text === 'string') return maybe.output_text

  if (!Array.isArray(maybe.output)) return ''
  const chunks: string[] = []
  for (const output of maybe.output) {
    if (!output || typeof output !== 'object') continue
    const content = (output as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') chunks.push(text)
    }
  }
  return chunks.join('\n').trim()
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

function nullableText(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return 'neuvedeno'
  return value.trim()
}

function stableId(url: string): string {
  return `aiw_${createHash('sha1').update(normalizeUrlForDedupe(url)).digest('hex').slice(0, 16)}`
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// Banned only when the path is exactly one segment matching these (a homepage/listing).
// Multi-segment paths starting with `/news/<article-slug>` are still legitimate (e.g. theverge.com).
const SINGLE_SEGMENT_ONLY_BAN = new Set([
  'stories', 'news', 'blog', 'posts', 'articles', 'archive', 'feed',
  'latest', 'all', 'podcasts', 'podcast', 'newsletter', 'updates',
  'press', 'releases', 'home', 'about', 'contact',
])

// Banned when this is the FIRST path segment, even if more segments follow.
// These are always category/index pages, never article pages, regardless of trailing slug.
const INDEX_FIRST_SEGMENT_BAN = new Set([
  'category', 'categories', 'cat',
  'tag', 'tags', 'topic', 'topics',
  'sekce', 'sekcie', 'rubrika', 'rubriky',
  'zpravicky',
])

// Banned when this substring appears in ANY path segment.
// These keywords indicate weekly/monthly digests, roundups, or best-of recaps.
const DIGEST_KEYWORD_SUBSTRINGS = [
  'weekly', 'tyden', 'tydne', 'prehled', 'przeglad',
  'roundup', 'recap', 'digest', 'monthly', 'najlepsze', 'best-of',
]

/**
 * Returns true when the URL looks like a specific article/repo/release page,
 * not a homepage, aggregator listing, section index, or weekly digest.
 */
export function isArticleLevelUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const path = parsed.pathname.replace(/\/+$/, '')
  if (!path || path === '/') return false

  const segments = path.split('/').filter(Boolean).map(s => s.toLowerCase())
  if (segments.length === 0) return false

  // First segment is a known section/category index — reject regardless of trailing path
  if (INDEX_FIRST_SEGMENT_BAN.has(segments[0])) return false

  // Any segment contains digest keyword (weekly roundup, monthly recap, etc.)
  for (const seg of segments) {
    if (DIGEST_KEYWORD_SUBSTRINGS.some(k => seg.includes(k))) return false
  }

  if (segments.length === 1) {
    const seg = segments[0]
    if (SINGLE_SEGMENT_ONLY_BAN.has(seg)) return false
    // single-segment paths are OK only if they look slug-like (hyphen/digit) or are long
    if (seg.length < 8 && !/[-\d]/.test(seg)) return false
  }

  return true
}

// Vendor blogs, official press, dev docs, paper archives. Anything not here is treated
// as secondary (mainstream news / aggregator) and confidence is capped to 'medium'.
const PRIMARY_SOURCE_DOMAINS = new Set([
  'openai.com', 'platform.openai.com',
  'anthropic.com', 'docs.anthropic.com',
  'blog.google', 'deepmind.com', 'ai.google.dev', 'developers.googleblog.com', 'cloud.google.com',
  'github.com', 'raw.githubusercontent.com',
  'huggingface.co',
  'arxiv.org',
  'mistral.ai', 'cohere.com', 'stability.ai', 'x.ai',
  'blog.cloudflare.com', 'blog.mozilla.org',
  'microsoft.com', 'blogs.microsoft.com', 'techcommunity.microsoft.com', 'devblogs.microsoft.com',
  'apple.com', 'developer.apple.com',
  'aws.amazon.com',
  'replicate.com', 'vercel.com', 'perplexity.ai',
  'ai.meta.com', 'about.fb.com',
  'langchain.com', 'blog.langchain.dev',
  'consilium.europa.eu', 'commission.europa.eu', 'europarl.europa.eu', 'digital-strategy.ec.europa.eu',
])

export function isPrimarySourceDomain(domain: string | null | undefined): boolean {
  if (!domain) return false
  return PRIMARY_SOURCE_DOMAINS.has(domain.toLowerCase().replace(/^www\./, ''))
}

// Patterns that scream "the LLM made this URL up". Caught in parser (cheap, sync).
const PLACEHOLDER_URL_PATTERNS: RegExp[] = [
  /\byour[-_]?(?:repo|repository|org|username|name|user|account|company|company-name|namespace|package|project|app|service)\b/i,
  /\b(owner|placeholder|example[-_]?(?:org|repo|user|company))\b/i,
  /<[a-z][a-z0-9_-]{0,20}>/i,                                 // <username>, <repo>, <org>
  /\/(yourname|yourorg|me|user1|test-user|sample-user|demo-user|fake)\b/i,
  /\/(example|placeholder|sample|demo|test|fake)-[a-z-]+\b/i, // /example-app, /test-tool, /fake-repo, …
  /\bgithub\.com\/(owner|user|username|org|company)\//i,      // /owner/repo placeholder pattern
]

export function looksLikePlaceholderUrl(url: string): boolean {
  return PLACEHOLDER_URL_PATTERNS.some(p => p.test(url))
}

// Domains where the LLM most often hallucinates exact repo paths. We verify these with HEAD.
const LIVE_CHECK_DOMAINS = new Set([
  'github.com', 'gitlab.com', 'huggingface.co',
  'pypi.org', 'npmjs.com', 'crates.io',
])

export function shouldLiveCheck(domain: string | null | undefined): boolean {
  if (!domain) return false
  return LIVE_CHECK_DOMAINS.has(domain.toLowerCase().replace(/^www\./, ''))
}

export async function verifyUrlIsLive(url: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // Try HEAD first (cheap), then GET fallback for servers that disallow HEAD
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' }).catch(() => null)
    if (!res || res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' }).catch(() => null)
    }
    if (!res) return false
    return res.status >= 200 && res.status < 400
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function nullableDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value.trim())
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function sanitizeKeyword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_./]/g, '')
  if (trimmed.length < 2 || trimmed.length > 60) return null
  return trimmed
}

function sanitizeEntity(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length < 2 || trimmed.length > 60) return null
  return trimmed
}

function uniq<T>(values: (T | null | undefined)[]): T[] {
  const seen = new Set<T>()
  const out: T[] = []
  for (const v of values) {
    if (v == null) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function parseAiNewsPayload(text: string, discoveredAt: string): AiWatchItem[] {
  let parsed: OpenAiAiNewsPayload
  try {
    parsed = JSON.parse(text) as OpenAiAiNewsPayload
  } catch {
    return []
  }

  if (!parsed || !Array.isArray(parsed.items)) return []

  const items: AiWatchItem[] = []
  for (const raw of parsed.items) {
    if (!raw || typeof raw !== 'object') continue
    if (typeof raw.title !== 'string' || raw.title.trim().length < 2) continue
    if (typeof raw.sourceUrl !== 'string') continue

    const normalizedUrl = normalizeUrlForDedupe(raw.sourceUrl)
    const domain = domainFromUrl(normalizedUrl)
    if (!domain) continue
    if (!isArticleLevelUrl(normalizedUrl)) continue
    if (looksLikePlaceholderUrl(normalizedUrl)) continue

    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
    if (summary.length < 3) continue

    const topicKeywords = uniq(Array.isArray(raw.topicKeywords) ? raw.topicKeywords.map(sanitizeKeyword) : []).slice(0, 6)
    const entityNames = uniq(Array.isArray(raw.entityNames) ? raw.entityNames.map(sanitizeEntity) : []).slice(0, 5)
    const finalSourceDomain = typeof raw.sourceDomain === 'string' && raw.sourceDomain.trim() ? raw.sourceDomain.trim() : domain
    // Cap confidence to 'medium' for non-primary sources — vendor blogs/official docs keep 'high',
    // mainstream news/aggregators are demoted regardless of what the model said.
    const rawConfidence = asEnum(raw.confidence, CONFIDENCES, 'medium')
    const cappedConfidence: AiWatchConfidence = rawConfidence === 'high' && !isPrimarySourceDomain(finalSourceDomain)
      ? 'medium'
      : rawConfidence

    items.push({
      id: stableId(normalizedUrl),
      title: raw.title.trim(),
      sourceUrl: normalizedUrl,
      sourceDomain: finalSourceDomain,
      sourceType: asEnum(raw.sourceType, SOURCE_TYPES, 'openai_web_search'),
      category: asEnum(raw.category, CATEGORIES, 'tool'),
      summary,
      whyItMatters: nullableText(raw.whyItMatters),
      apiIntegrations: nullableText(raw.apiIntegrations),
      pricingLicense: nullableText(raw.pricingLicense),
      priority: asEnum(raw.priority, PRIORITIES, 'medium'),
      confidence: cappedConfidence,
      tags: Array.isArray(raw.tags) ? raw.tags.filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim()).slice(0, 5) : [],
      topicKeywords,
      entityNames,
      imageUrl: null,
      publishedAt: nullableDate(raw.publishedAt),
      discoveredAt,
      archivedAt: null,
      userRating: null,
    })
  }

  return items
}

export function dropLowQuality(items: AiWatchItem[]): { kept: AiWatchItem[]; dropped: AiWatchItem[] } {
  const kept: AiWatchItem[] = []
  const dropped: AiWatchItem[] = []
  for (const item of items) {
    if (item.priority === 'low' && item.confidence === 'low') {
      dropped.push(item)
    } else {
      kept.push(item)
    }
  }
  return { kept, dropped }
}

export type OpenAiUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number }

export async function fetchAiNewsFromOpenAI(options: {
  apiKey: string
  skipList: AiWatchSkipList
  now?: string
  model?: string
  mode?: AiWatchMode
  trace?: LangfuseTraceClient | null
}): Promise<{ items: AiWatchItem[]; rawText: string; usage: OpenAiUsage }> {
  const now = options.now ?? new Date().toISOString()
  const mode: AiWatchMode = options.mode ?? 'news'
  const request = buildOpenAiAiNewsRequest({ now, skipList: options.skipList, model: options.model ?? process.env.OPENAI_MODEL, mode })

  const generation = options.trace?.generation({
    name: mode === 'tools' ? 'openai_tools_discovery' : 'openai_responses_web_search',
    model: request.model,
    input: request.input,
    metadata: {
      promptVersion: AI_WATCH_PROMPT_VERSION,
      tools: request.tools.map(t => t.type),
      schemaName: request.text.format.name,
      skipList: {
        topicKeywords: options.skipList.topicKeywords.length,
        entityNames: options.skipList.entityNames.length,
        urls: options.skipList.urls.length,
      },
    },
  })

  const startedAt = Date.now()
  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
  } catch (err) {
    generation?.end({ output: null, level: 'ERROR', statusMessage: err instanceof Error ? err.message : String(err) })
    throw err
  }

  if (!response.ok) {
    const errorText = await response.text()
    const message = `OpenAI Responses API error ${response.status}: ${errorText.slice(0, 500)}`
    generation?.end({ output: errorText.slice(0, 1000), level: 'ERROR', statusMessage: message })
    throw new Error(message)
  }

  const data = await response.json()
  const rawText = extractResponseText(data)

  // Detect API-level truncation flagged by OpenAI itself
  const apiStatus = (data as { status?: string; incomplete_details?: { reason?: string } }).status
  const incompleteReason = (data as { incomplete_details?: { reason?: string } }).incomplete_details?.reason

  // Try to parse strictly before silently dropping items; if the JSON is truncated,
  // surface a clear error so the run is marked failed (not no_news).
  let parseError: string | null = null
  try {
    JSON.parse(rawText)
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err)
  }

  const apiUsage = (data as { usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }).usage
  const usage: OpenAiUsage = {
    inputTokens: apiUsage?.input_tokens,
    outputTokens: apiUsage?.output_tokens,
    totalTokens: apiUsage?.total_tokens,
  }

  if (apiStatus === 'incomplete' || parseError) {
    const reasonParts: string[] = []
    if (apiStatus === 'incomplete') reasonParts.push(`OpenAI status=incomplete (reason: ${incompleteReason ?? 'unknown'})`)
    if (parseError) reasonParts.push(`JSON.parse: ${parseError}`)
    const message = `OpenAI Responses returned malformed output — ${reasonParts.join('; ')}. raw length=${rawText.length}, last 120 chars: ${JSON.stringify(rawText.slice(-120))}`
    generation?.end({
      output: rawText.slice(-2000),
      level: 'ERROR',
      statusMessage: message,
      usage: apiUsage ? { input: apiUsage.input_tokens, output: apiUsage.output_tokens, total: apiUsage.total_tokens, unit: 'TOKENS' } : undefined,
      metadata: { latencyMs: Date.now() - startedAt, candidateCount: 0, apiStatus, incompleteReason },
    })
    throw new Error(message)
  }

  const parsedItems = parseAiNewsPayload(rawText, now)

  // Liveness check: for github/hf/npm/pypi/gitlab/crates verify URL actually exists.
  // Run in parallel, drop 404s and unreachable URLs. ~5s timeout per URL.
  const liveChecks = await Promise.all(parsedItems.map(async item => {
    if (!shouldLiveCheck(item.sourceDomain)) return { item, alive: true }
    const alive = await verifyUrlIsLive(item.sourceUrl)
    return { item, alive }
  }))
  const items = liveChecks.filter(r => r.alive).map(r => r.item)
  const droppedDead = liveChecks.filter(r => !r.alive).map(r => r.item.sourceUrl)

  generation?.end({
    output: rawText,
    usage: apiUsage ? { input: apiUsage.input_tokens, output: apiUsage.output_tokens, total: apiUsage.total_tokens, unit: 'TOKENS' } : undefined,
    metadata: {
      latencyMs: Date.now() - startedAt,
      candidateCount: items.length,
      parsedCount: parsedItems.length,
      droppedDeadLinks: droppedDead.length,
      droppedDeadUrls: droppedDead.slice(0, 10),
      apiStatus,
    },
  })

  return { items, rawText, usage }
}
