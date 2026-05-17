import { test } from 'node:test'
import { strict as assert } from 'node:assert'

import {
  buildOpenAiAiNewsRequest,
  dropLowQuality,
  extractResponseText,
  isArticleLevelUrl,
  isPrimarySourceDomain,
  looksLikePlaceholderUrl,
  parseAiNewsPayload,
  shouldLiveCheck,
} from '../src/lib/ai-watch/openai'
import { aiWatchItemToInboxTool, deriveInboxToolName, isTestableCompanyTool, mergeAiWatchToolsIntoInbox } from '../src/lib/ai-watch/inboxTools'
import { mergeAiWatchItems } from '../src/lib/ai-watch/storeHelpers'
import type { AiWatchItem, AiWatchSkipList } from '../src/lib/ai-watch/types'

function makeItem(overrides: Partial<AiWatchItem> = {}): AiWatchItem {
  return {
    id: 'base',
    title: 'Base',
    sourceUrl: 'https://example.com/base',
    sourceDomain: 'example.com',
    sourceType: 'openai_web_search',
    category: 'tool',
    summary: 'base summary',
    whyItMatters: 'neuvedeno',
    apiIntegrations: 'neuvedeno',
    pricingLicense: 'neuvedeno',
    priority: 'medium',
    confidence: 'medium',
    tags: [],
    topicKeywords: [],
    entityNames: [],
    imageUrl: null,
    publishedAt: null,
    discoveredAt: '2026-05-11T08:00:00.000Z',
    archivedAt: null,
    userRating: null,
    ...overrides,
  }
}

test('buildOpenAiAiNewsRequest uses only OpenAI web search and structured JSON', () => {
  // Použité entityNames jsou záměrně exotické, abychom prokázali, že NEPRO_TÉkají do promptu
  // (v systémové sekci se objevují jen examples "Google, Anthropic, OpenAI…").
  const skipList: AiWatchSkipList = {
    topicKeywords: ['gemini-4-launch', 'mcp-spec-update'],
    entityNames: ['AcmeWidgetCorp', 'Quuxlabs'],
    urls: ['https://old.example/news/specific-article-2026'],
  }
  const request = buildOpenAiAiNewsRequest({ now: '2026-05-11T08:00:00.000Z', skipList })

  assert.equal(request.store, false)
  assert.equal(Array.isArray(request.tools), true)
  assert.deepEqual(request.tools, [{ type: 'web_search' }])
  assert.equal(request.text.format.type, 'json_schema')
  assert.equal(request.text.format.name, 'ai_news_feed')
  assert.equal(request.text.format.strict, true)

  const serialized = JSON.stringify(request)
  assert.match(serialized, /AI-first/i)
  assert.match(serialized, /gemini-4-launch/)
  assert.match(serialized, /mcp-spec-update/)
  assert.match(serialized, /old\.example\/news\/specific-article-2026/)
  // Entity names se už neposílají jako skip signal:
  assert.doesNotMatch(serialized, /AcmeWidgetCorp/)
  assert.doesNotMatch(serialized, /Quuxlabs/)
  assert.doesNotMatch(serialized, /SOFT-SKIP/)
  // Zákaz homepages/aggregátorů musí být v promptu:
  assert.match(serialized, /newsletter|aggregator|primary source/i)
  assert.doesNotMatch(serialized, /Hermes|Firecrawl|Discord/i)
})

test('isArticleLevelUrl accepts article-level paths and rejects homepages/section indexes', () => {
  // Article-level — pass
  assert.equal(isArticleLevelUrl('https://blog.google/products/ai/gemini-3-release/'), true)
  assert.equal(isArticleLevelUrl('https://github.com/owner/repo'), true)
  assert.equal(isArticleLevelUrl('https://anthropic.com/news/claude-projects'), true)
  assert.equal(isArticleLevelUrl('https://example.com/agent-kit'), true) // slug-like (hyphen)
  assert.equal(isArticleLevelUrl('https://example.com/2026-best-tools'), true) // has digit
  assert.equal(isArticleLevelUrl('https://example.com/products/agent'), true) // 2 segments
  assert.equal(isArticleLevelUrl('https://theverge.com/news/12345/openai-launches'), true) // /news/<slug> on news outlets OK

  // Homepages — reject
  assert.equal(isArticleLevelUrl('https://signal24.ai'), false)
  assert.equal(isArticleLevelUrl('https://signal24.ai/'), false)
  assert.equal(isArticleLevelUrl('https://news.promptgoblins.ai'), false)

  // Generic single-segment index — reject
  assert.equal(isArticleLevelUrl('https://7min.ai/stories'), false)
  assert.equal(isArticleLevelUrl('https://example.com/news'), false)
  assert.equal(isArticleLevelUrl('https://example.com/blog'), false)
  assert.equal(isArticleLevelUrl('https://example.com/podcasts'), false)

  // First-segment category/tag/topic — reject (real bugs from production)
  assert.equal(isArticleLevelUrl('https://smartarena.sk/category/umela-inteligencia/ai-novinky'), false)
  assert.equal(isArticleLevelUrl('https://novinky.cz/sekce/internet-a-pc-ai-388'), false)
  assert.equal(isArticleLevelUrl('https://example.com/tag/openai/article-1'), false)
  assert.equal(isArticleLevelUrl('https://example.com/topic/ai'), false)
  assert.equal(isArticleLevelUrl('https://example.com/zpravicky/tyden/2026-18'), false)

  // Digest keyword in any segment — reject
  assert.equal(isArticleLevelUrl('https://aizi.pl/blog/przeglad-ai-27-30-kwietnia-2026'), false)
  assert.equal(isArticleLevelUrl('https://vibecoding.cz/zpravicky/tyden/2026-18'), false)
  assert.equal(isArticleLevelUrl('https://example.com/blog/weekly-recap-2026-05'), false)
  assert.equal(isArticleLevelUrl('https://example.com/posts/ai-roundup-may'), false)
  assert.equal(isArticleLevelUrl('https://example.com/posts/best-of-2026'), false)

  // Short non-slug single segment — reject
  assert.equal(isArticleLevelUrl('https://example.com/about'), false)
  assert.equal(isArticleLevelUrl('https://example.com/agent'), false)

  // Bad inputs
  assert.equal(isArticleLevelUrl('not-a-url'), false)
  assert.equal(isArticleLevelUrl('ftp://example.com/article'), false)
})

test('looksLikePlaceholderUrl catches LLM-invented GitHub paths', () => {
  // Real hallucinations from production:
  assert.equal(looksLikePlaceholderUrl('https://github.com/your-repo/concordterminal'), true)
  assert.equal(looksLikePlaceholderUrl('https://github.com/your-repo/whaleai'), true)
  assert.equal(looksLikePlaceholderUrl('https://github.com/your-org/some-app'), true)
  assert.equal(looksLikePlaceholderUrl('https://github.com/owner/repo'), true)
  assert.equal(looksLikePlaceholderUrl('https://example.com/<username>/repo'), true)
  assert.equal(looksLikePlaceholderUrl('https://github.com/example-org/example-app'), true)
  assert.equal(looksLikePlaceholderUrl('https://npmjs.com/package/your-package'), true)
  // Real URLs must pass through
  assert.equal(looksLikePlaceholderUrl('https://github.com/anthropics/claude-code'), false)
  assert.equal(looksLikePlaceholderUrl('https://github.com/openai/openai-python'), false)
  assert.equal(looksLikePlaceholderUrl('https://huggingface.co/mistralai/Mistral-7B-v0.1'), false)
})

test('shouldLiveCheck targets repo/package domains where hallucination is common', () => {
  assert.equal(shouldLiveCheck('github.com'), true)
  assert.equal(shouldLiveCheck('huggingface.co'), true)
  assert.equal(shouldLiveCheck('pypi.org'), true)
  assert.equal(shouldLiveCheck('npmjs.com'), true)
  assert.equal(shouldLiveCheck('www.github.com'), true)
  assert.equal(shouldLiveCheck('anthropic.com'), false) // vendor blogs not checked
  assert.equal(shouldLiveCheck('theverge.com'), false)
  assert.equal(shouldLiveCheck(''), false)
  assert.equal(shouldLiveCheck(null), false)
})

test('parseAiNewsPayload rejects items with placeholder URLs', () => {
  const parsed = parseAiNewsPayload(JSON.stringify({
    items: [
      {
        title: 'Hallucinated tool',
        sourceUrl: 'https://github.com/your-repo/fake-tool',
        sourceDomain: 'github.com', sourceType: 'github', category: 'tool',
        summary: 'Should be dropped', whyItMatters: null, apiIntegrations: null, pricingLicense: null,
        priority: 'medium', confidence: 'high',
        tags: [], topicKeywords: ['fake'], entityNames: [], publishedAt: null,
      },
      {
        title: 'Real tool',
        sourceUrl: 'https://github.com/anthropics/claude-code',
        sourceDomain: 'github.com', sourceType: 'github', category: 'tool',
        summary: 'Real Anthropic repo', whyItMatters: null, apiIntegrations: null, pricingLicense: null,
        priority: 'medium', confidence: 'high',
        tags: [], topicKeywords: ['claude-code'], entityNames: ['Anthropic'], publishedAt: null,
      },
    ],
  }), '2026-05-11T12:00:00.000Z')
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].title, 'Real tool')
})

test('isPrimarySourceDomain whitelists vendor blogs / official docs', () => {
  assert.equal(isPrimarySourceDomain('openai.com'), true)
  assert.equal(isPrimarySourceDomain('www.openai.com'), true)
  assert.equal(isPrimarySourceDomain('anthropic.com'), true)
  assert.equal(isPrimarySourceDomain('blog.google'), true)
  assert.equal(isPrimarySourceDomain('github.com'), true)
  assert.equal(isPrimarySourceDomain('arxiv.org'), true)
  assert.equal(isPrimarySourceDomain('blog.cloudflare.com'), true)
  assert.equal(isPrimarySourceDomain('consilium.europa.eu'), true)

  assert.equal(isPrimarySourceDomain('techrepublic.com'), false)
  assert.equal(isPrimarySourceDomain('ct24.ceskatelevize.cz'), false)
  assert.equal(isPrimarySourceDomain('echo24.cz'), false)
  assert.equal(isPrimarySourceDomain('e15.cz'), false)
  assert.equal(isPrimarySourceDomain(''), false)
  assert.equal(isPrimarySourceDomain(null), false)
})

test('parseAiNewsPayload caps confidence to medium for non-primary domains', () => {
  const parsed = parseAiNewsPayload(JSON.stringify({
    items: [
      {
        title: 'OpenAI launches X',
        sourceUrl: 'https://openai.com/blog/openai-launches-x',
        sourceDomain: 'openai.com',
        sourceType: 'vendor', category: 'tool',
        summary: 'OpenAI announces new product.',
        whyItMatters: null, apiIntegrations: null, pricingLicense: null,
        priority: 'high', confidence: 'high',
        tags: [], topicKeywords: ['openai-x-launch'], entityNames: ['OpenAI'],
        publishedAt: null,
      },
      {
        title: 'TechRepublic recap',
        sourceUrl: 'https://techrepublic.com/article/ai-power-plays-and-shifts',
        sourceDomain: 'techrepublic.com',
        sourceType: 'blog', category: 'breaking',
        summary: 'Weekly recap on AI from a secondary outlet.',
        whyItMatters: null, apiIntegrations: null, pricingLicense: null,
        priority: 'medium', confidence: 'high', // model claims high
        tags: [], topicKeywords: ['apple-google-ai'], entityNames: ['Apple'],
        publishedAt: null,
      },
    ],
  }), '2026-05-11T12:00:00.000Z')

  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].confidence, 'high', 'primary source keeps high')
  assert.equal(parsed[1].confidence, 'medium', 'secondary outlet capped to medium')
})

test('buildOpenAiAiNewsRequest allows empty result on quiet days', () => {
  const request = buildOpenAiAiNewsRequest({ now: '2026-05-11T08:00:00.000Z' })
  const userMsg = JSON.stringify(request.input[1])
  assert.match(userMsg, /items:\s*\[\]/i)
})

test('buildOpenAiAiNewsRequest tolerates missing skip list', () => {
  const request = buildOpenAiAiNewsRequest({ now: '2026-05-11T08:00:00.000Z' })
  const userMsg = JSON.stringify(request.input[1])
  assert.match(userMsg, /žádné/)
})

test('extractResponseText supports Responses API output_text arrays and output_text shortcut', () => {
  assert.equal(extractResponseText({ output_text: '{"items":[]}' }), '{"items":[]}')
  assert.equal(
    extractResponseText({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"items":[]}' }] }] }),
    '{"items":[]}',
  )
})

test('parseAiNewsPayload normalizes valid OpenAI items and drops invalid rows', () => {
  const parsed = parseAiNewsPayload(JSON.stringify({
    items: [
      {
        title: '  Browser Agent Kit  ',
        sourceUrl: 'https://example.com/products/agent?utm_source=x',
        sourceDomain: 'example.com',
        sourceType: 'tool',
        category: 'tool',
        summary: 'Nový browser agent pro operace v interních systémech.',
        whyItMatters: 'Může zkrátit ruční back-office práci.',
        apiIntegrations: 'REST API',
        pricingLicense: 'neuvedeno',
        priority: 'high',
        confidence: 'medium',
        tags: ['agent', 'browser', 'automation', 'extra', 'ignored', 'sixth'],
        topicKeywords: ['Browser Agent Kit', 'workflow-automation', 'WORKFLOW-AUTOMATION', 'a'],
        entityNames: ['Example Inc.', 'Example Inc.'],
        publishedAt: '2026-05-11T08:00:00Z',
      },
      {
        title: 'Bad date tool',
        sourceUrl: 'https://example.org/news/bad-date-story',
        sourceDomain: null,
        sourceType: null,
        category: 'tip',
        summary: 'Valid item with invalid publishedAt should still render safely.',
        whyItMatters: null,
        apiIntegrations: null,
        pricingLicense: null,
        priority: 'low',
        confidence: 'low',
        tags: [],
        topicKeywords: [],
        entityNames: [],
        publishedAt: 'not-a-date',
      },
      // Tyto všechny mají být DROPpnuté:
      { title: '', sourceUrl: 'not-a-url', summary: '' },
      // homepage — OpenAI v praxi vrací newsletter homepages
      { title: 'Newsletter homepage', sourceUrl: 'https://signal24.ai', sourceDomain: 'signal24.ai', sourceType: 'blog', category: 'breaking', summary: 'Sumář týdne, ne primární zdroj.', whyItMatters: null, apiIntegrations: null, pricingLicense: null, priority: 'medium', confidence: 'low', tags: [], topicKeywords: [], entityNames: [], publishedAt: null },
      // section index
      { title: 'Section page', sourceUrl: 'https://7min.ai/stories', sourceDomain: '7min.ai', sourceType: 'blog', category: 'breaking', summary: 'Index page, ne článek.', whyItMatters: null, apiIntegrations: null, pricingLicense: null, priority: 'medium', confidence: 'low', tags: [], topicKeywords: [], entityNames: [], publishedAt: null },
    ],
  }), '2026-05-11T12:00:00.000Z')

  assert.equal(parsed.length, 2, 'should accept 2 article-level URLs and drop homepage/section/invalid')
  assert.equal(parsed[0].title, 'Browser Agent Kit')
  assert.equal(parsed[0].sourceUrl, 'https://example.com/products/agent')
  assert.equal(parsed[0].sourceDomain, 'example.com')
  assert.deepEqual(parsed[0].tags, ['agent', 'browser', 'automation', 'extra', 'ignored'])
  assert.deepEqual(parsed[0].topicKeywords, ['browser-agent-kit', 'workflow-automation'])
  assert.deepEqual(parsed[0].entityNames, ['Example Inc.'])
  assert.equal(parsed[0].publishedAt, '2026-05-11T08:00:00.000Z')
  assert.equal(parsed[0].discoveredAt, '2026-05-11T12:00:00.000Z')
  assert.equal(parsed[1].publishedAt, null)
})

test('dropLowQuality removes priority=low + confidence=low items', () => {
  const items = [
    makeItem({ id: 'a', priority: 'high', confidence: 'high' }),
    makeItem({ id: 'b', priority: 'low', confidence: 'low' }),
    makeItem({ id: 'c', priority: 'low', confidence: 'medium' }),
    makeItem({ id: 'd', priority: 'medium', confidence: 'low' }),
  ]
  const { kept, dropped } = dropLowQuality(items)
  assert.deepEqual(kept.map(i => i.id), ['a', 'c', 'd'])
  assert.deepEqual(dropped.map(i => i.id), ['b'])
})

test('mergeAiWatchItems dedupes by normalized URL and keeps newest first', () => {
  const oldItem = makeItem({
    id: 'old',
    title: 'Old Tool',
    sourceUrl: 'https://example.com/tool?utm_campaign=old',
    discoveredAt: '2026-05-05T12:00:00.000Z',
  })
  const newItem = makeItem({
    id: 'new',
    title: 'Newer duplicate',
    sourceUrl: 'https://example.com/tool?utm_source=new',
    discoveredAt: '2026-05-06T12:00:00.000Z',
  })
  const otherItem = makeItem({
    id: 'other',
    title: 'Other Tool',
    sourceUrl: 'https://other.example/tool',
    sourceDomain: 'other.example',
    discoveredAt: '2026-05-06T11:00:00.000Z',
  })

  const result = mergeAiWatchItems([oldItem], [newItem, otherItem])

  assert.equal(result.insertedCount, 1)
  assert.deepEqual(result.items.map(item => item.id), ['other', 'old'])
})

test('aiWatchItemToInboxTool maps OpenAI feed items into testable inbox tool cards', () => {
  const item = makeItem({
    id: 'aiw_1',
    title: 'Browser Agent Kit',
    sourceUrl: 'https://example.com/agent?utm_source=feed',
    sourceType: 'openai_web_search',
    category: 'hidden_gem',
    summary: 'Nový agent pro testování browser workflow.',
    whyItMatters: 'Hodí se pro interní automatizace.',
    apiIntegrations: 'REST API',
    pricingLicense: 'Free tier',
    priority: 'high',
    confidence: 'high',
    tags: ['agent', 'browser'],
    publishedAt: '2026-05-06T08:00:00.000Z',
    discoveredAt: '2026-05-06T12:00:00.000Z',
  })

  const tool = aiWatchItemToInboxTool(item)

  assert.equal(tool.id, 'ai-watch-aiw_1')
  assert.equal(tool.name, 'Browser Agent Kit')
  assert.equal(tool.vendor, 'example.com')
  assert.equal(tool.website_url, 'https://example.com/agent?utm_source=feed')
  assert.equal(tool.status, 'new')
  assert.equal(tool.source, 'ai_watch')
  assert.equal(tool.legit_score, 90)
  assert.equal(tool.fit_score, 95)
  assert.equal(tool.novelty_score, 90)
  assert.deepEqual(tool.tags, ['agent', 'browser'])
  assert.match(tool.description, /^Co otestovat: /)
  assert.match(tool.description, /interní automatizace/)
  assert.doesNotMatch(tool.description, /API\/integrace|Cena\/licence|Proč testovat/)
})

test('isTestableCompanyTool accepts dev-tool domains (github, huggingface) immediately', () => {
  const base = makeItem({
    title: 'Free CLI Tool for Claude Code',
    sourceUrl: 'https://github.com/youfocal/free-claude-code',
    sourceDomain: 'github.com',
    category: 'tool',
    summary: 'CLI tool bringing Claude Code capabilities to terminal.',
    whyItMatters: 'neuvedeno',
  })
  assert.equal(isTestableCompanyTool(base), true, 'github.com domain should auto-accept')

  const hf = makeItem({
    title: 'ml-intern',
    sourceUrl: 'https://huggingface.co/youfocal/ml-intern',
    sourceDomain: 'huggingface.co',
    category: 'tool',
    summary: 'Open-source ML engineer that runs ML tasks.',
    whyItMatters: 'neuvedeno',
  })
  assert.equal(isTestableCompanyTool(hf), true, 'huggingface.co domain should auto-accept')
})

test('isTestableCompanyTool only admits app/tool candidates, not general news items', () => {
  const base = makeItem({
    id: 'tool-1',
    title: 'Agent App',
    sourceUrl: 'https://example.com/app',
    summary: 'Aplikace pro interní workflow.',
    whyItMatters: 'Může pomoct týmu.',
    tags: ['workflow'],
  })

  assert.equal(isTestableCompanyTool(base), true)
  assert.equal(isTestableCompanyTool({ ...base, category: 'hidden_gem' }), true)
  assert.equal(isTestableCompanyTool({ ...base, category: 'breaking', title: 'OpenAI launches new model' }), false)
  assert.equal(isTestableCompanyTool({ ...base, category: 'tip', title: 'Prompting tip' }), false)
  assert.equal(isTestableCompanyTool({ ...base, category: 'infra', title: 'CUDA benchmark' }), false)
  assert.equal(isTestableCompanyTool({ ...base, title: 'Cerebras podává žádost o IPO s příjmy 510 milionů dolarů', summary: 'Finanční zpráva bez testovatelné aplikace.' }), false)
  assert.equal(isTestableCompanyTool({ ...base, title: 'Anthropic uvádí nový model Claude Mythos', summary: 'Model release bez samostatné aplikace pro interní workflow.' }), false)
  assert.equal(isTestableCompanyTool({ ...base, title: 'Microsoft uvádí Agent Governance Toolkit pro podnikové AI', summary: 'Toolkit pro governance AI agentů ve firmách.' }), true)
  assert.equal(isTestableCompanyTool({ ...base, title: 'Google Cloud Next 2026: Škálování AI agentů', summary: 'Google představil nové nástroje a infrastrukturu pro škálování AI agentů.' }), false)
})

test('deriveInboxToolName turns announcement headlines into plain tool names', () => {
  assert.equal(deriveInboxToolName('Microsoft uvádí Agent Governance Toolkit pro podnikové AI'), 'Agent Governance Toolkit')
  assert.equal(deriveInboxToolName('Google Cloud Next 2026: Představuje Gemini Enterprise Agent Platformu'), 'Gemini Enterprise Agent Platformu')
  assert.equal(deriveInboxToolName('Anthropic uvádí Project Glasswing s modelem Claude Mythos'), 'Project Glasswing')
  assert.equal(deriveInboxToolName('OpenClaw 2026.4.24 přidává integraci s Google Meet'), 'OpenClaw')
})

test('mergeAiWatchToolsIntoInbox hides AI Watch suggestions already present in tools table', () => {
  const existing = [{ id: 't1', website_url: 'https://example.com/agent?ref=old' }]
  const base = makeItem({
    id: 'a',
    title: 'Agent',
    sourceUrl: 'https://example.com/agent?utm_source=x',
    summary: 'Aplikace pro interní workflow a automatizaci.',
    whyItMatters: 'Tým může otestovat automatizaci procesu.',
  })
  const suggestions = [
    base,
    makeItem({ ...base, id: 'b', title: 'Other', sourceUrl: 'https://other.example/tool', sourceDomain: 'other.example' }),
    makeItem({ ...base, id: 'c', title: 'Model release news', sourceUrl: 'https://news.example/model', sourceDomain: 'news.example', category: 'breaking' }),
  ]

  const merged = mergeAiWatchToolsIntoInbox(existing, suggestions)

  assert.equal(merged.length, 1)
  assert.equal(merged[0].website_url, 'https://other.example/tool')
})
