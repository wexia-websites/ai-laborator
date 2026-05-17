import { createClient } from '@supabase/supabase-js'

// Real Supabase is used whenever NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
// are present. The dummy client is only a local/dev fallback so this repo can run without
// access to the production Supabase project.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const useDummySupabase =
  process.env.NEXT_PUBLIC_USE_DUMMY_SUPABASE === 'true' ||
  (!supabaseUrl || !supabaseAnonKey)

const FAKE_USER_ID = 'dummy-user-1'
const FAKE_EMAIL = 'katzithebeast@gmail.com' // matches SUPER_ADMIN_EMAIL → super_admin role
const FAKE_USER = {
  id: FAKE_USER_ID,
  email: FAKE_EMAIL,
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}
const FAKE_SESSION = { user: FAKE_USER, access_token: 'dummy-token', refresh_token: 'dummy', expires_at: 9_999_999_999, token_type: 'bearer' }

const now = () => new Date().toISOString()
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()

const FIXTURES: Record<string, any[]> = {
  profiles: [
    {
      id: FAKE_USER_ID,
      full_name: 'Demo User',
      first_name: 'Demo',
      last_name: 'User',
      phone: '+420 777 123 456',
      company: 'Wexia',
      position: 'AI Lead',
      bio: 'Dummy uživatel pro lokální vývoj.',
      linkedin_url: null,
      avatar_url: null,
      role: 'super_admin',
      team: 'AI Lab',
      email: FAKE_EMAIL,
      profile_completed: true,
      created_at: now(),
    },
  ],
  tools: [
    { id: 't1', name: 'Cursor',     vendor: 'Anysphere', website_url: 'https://cursor.com',     description: 'AI-first IDE.',                category: 'Vývoj',        tags: ['IDE', 'kódování'], status: 'new',        legit_score: 9, fit_score: 9, novelty_score: 7, source: 'discovery', claimed_by: null,           claimed_at: null, created_at: now() },
    { id: 't2', name: 'Claude',     vendor: 'Anthropic', website_url: 'https://claude.ai',      description: 'LLM asistent od Anthropicu.',  category: 'LLM',          tags: ['chat', 'asistent'], status: 'new',        legit_score: 10, fit_score: 9, novelty_score: 5, source: 'discovery', claimed_by: null,           claimed_at: null, created_at: now() },
    { id: 't3', name: 'Perplexity', vendor: 'Perplexity', website_url: 'https://perplexity.ai', description: 'AI vyhledávač s citacemi.',     category: 'Vyhledávání',  tags: ['search'],          status: 'claimed',     legit_score: 8, fit_score: 7, novelty_score: 6, source: 'discovery', claimed_by: FAKE_USER_ID, claimed_at: now(), created_at: now() },
    { id: 't4', name: 'Notion AI',  vendor: 'Notion',    website_url: 'https://notion.so',      description: 'AI přímo v Notionu.',           category: 'Produktivita', tags: ['psaní'],           status: 'completed',  legit_score: 8, fit_score: 8, novelty_score: 4, source: 'manual',    claimed_by: FAKE_USER_ID, claimed_at: now(), created_at: now() },
  ],
  use_cases: [
    {
      id: 'uc1', title: 'Generování shrnutí porad', description: 'Použití Claude pro shrnutí poznámek z porad.',
      tool_id: 't2', tool_name: 'Claude', team: 'AI Lab', problem: 'Manuální shrnutí trvá dlouho.', solution: 'Claude vytvoří shrnutí z přepisu.',
      benefits: 'Úspora 30 min na poradu.', risks: null, effort: 'low', impact: 'medium', status: 'published',
      confidence_score: 8, tags: ['meeting'], author_id: FAKE_USER_ID, author_name: 'Demo User', chat_history: [],
      created_at: now(), updated_at: now(), purpose: 'Shrnutí', similar_tools: 'ChatGPT', best_for_roles: 'PM',
      time_saved: '30 min/porada', aha_moment: 'Funguje i česky.', output_quality: 'Vysoká', hallucinates: 'Občas jména.',
      weaknesses: null, security_risks: null, limitations: null, recommended: 'Ano', pricing: '$20/měsíc',
      ui_intuitive: 'Ano', onboarding_score: 9, rating: 5, category: 'Produktivita',
      published_at: now(), revision_due_at: daysFromNow(30), revision_status: 'ok',
    },
    {
      id: 'uc2', title: 'Code review pomocí Cursor', description: 'Cursor jako asistent na code review.',
      tool_id: 't1', tool_name: 'Cursor', team: 'Engineering', problem: 'Pomalý review.', solution: 'Cursor doporučí změny.',
      benefits: 'Rychlejší review.', risks: 'Občas špatné rady.', effort: 'medium', impact: 'high', status: 'review',
      confidence_score: 7, tags: ['code'], author_id: FAKE_USER_ID, author_name: 'Demo User', chat_history: [],
      created_at: now(), updated_at: now(), purpose: 'Code review', similar_tools: 'Copilot', best_for_roles: 'Dev',
      time_saved: '1h/PR', aha_moment: null, output_quality: 'Dobrá', hallucinates: 'Občas.',
      weaknesses: null, security_risks: null, limitations: null, recommended: 'Ano', pricing: '$20/měsíc',
      ui_intuitive: 'Ano', onboarding_score: 8, rating: 4, category: 'Vývoj',
      published_at: null, revision_due_at: null, revision_status: null,
    },
    {
      id: 'uc3', title: 'Research s Perplexity', description: 'Rychlá rešerše s citacemi.',
      tool_id: 't3', tool_name: 'Perplexity', team: 'AI Lab', problem: 'Rychlá rešerše bez halucinací.', solution: 'Perplexity vrací odkazy.',
      benefits: 'Důvěryhodné zdroje.', risks: null, effort: 'low', impact: 'medium', status: 'draft',
      confidence_score: 6, tags: ['research'], author_id: FAKE_USER_ID, author_name: 'Demo User', chat_history: [],
      created_at: now(), updated_at: now(), purpose: 'Research', similar_tools: 'Google', best_for_roles: 'Vše',
      time_saved: '20 min', aha_moment: null, output_quality: 'Dobrá', hallucinates: 'Málo.',
      weaknesses: null, security_risks: null, limitations: null, recommended: 'Ano', pricing: 'Free / $20',
      ui_intuitive: 'Ano', onboarding_score: 9, rating: 4, category: 'Vyhledávání',
      published_at: null, revision_due_at: null, revision_status: null,
    },
  ],
  projects: [
    { id: 'p1', name: 'AI onboarding chatbot', description: 'Chatbot pro nové zaměstnance.', status: 'published',
      author_id: FAKE_USER_ID, author_name: 'Demo User', team: 'HR',
      tools_used: ['Claude'], outcome: 'Snížení času onboardingu o 40 %.',
      lessons_learned: 'Důležitý kvalitní knowledge base.', created_at: now(), updated_at: now() },
    { id: 'p2', name: 'Generátor reportů', description: 'Automatická tvorba měsíčních reportů.', status: 'review',
      author_id: FAKE_USER_ID, author_name: 'Demo User', team: 'Data',
      tools_used: ['Cursor', 'Claude'], outcome: 'WIP', lessons_learned: null, created_at: now(), updated_at: now() },
  ],
  app_settings: [
    { key: 'revision_days', value: '90', updated_at: now() },
  ],
  chat_sessions: [
    { id: 'cs1', user_id: FAKE_USER_ID, title: 'Demo chat', messages: [], created_at: now(), updated_at: now() },
  ],
}

type AnyRow = Record<string, any>

function applyFilter(rows: AnyRow[], col: string, op: string, val: any): AnyRow[] {
  switch (op) {
    case 'eq':   return rows.filter(r => r[col] === val)
    case 'neq':  return rows.filter(r => r[col] !== val)
    case 'gt':   return rows.filter(r => r[col] >  val)
    case 'gte':  return rows.filter(r => r[col] >= val)
    case 'lt':   return rows.filter(r => r[col] <  val)
    case 'lte':  return rows.filter(r => r[col] <= val)
    case 'in':   return rows.filter(r => Array.isArray(val) && val.includes(r[col]))
    case 'is':   return rows.filter(r => r[col] === val || (val === null && (r[col] === null || r[col] === undefined)))
    case 'ilike': {
      const re = new RegExp('^' + String(val).replace(/%/g, '.*') + '$', 'i')
      return rows.filter(r => re.test(String(r[col] ?? '')))
    }
    default: return rows
  }
}

function makeQuery(table: string) {
  const tableRows = FIXTURES[table] ?? (FIXTURES[table] = [])
  let rows: AnyRow[] = tableRows.map(r => ({ ...r }))
  let mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  let pendingPayload: any = null
  let countMode = false
  let headOnly = false
  let singleMode: 'single' | 'maybeSingle' | null = null

  const createDummyId = () =>
    globalThis.crypto?.randomUUID?.() ?? `dummy-${Date.now()}-${Math.random().toString(16).slice(2)}`

  const normalizePayloadRows = (payload: any): AnyRow[] => {
    const payloadRows = Array.isArray(payload) ? payload : [payload]
    return payloadRows.map(row => ({
      id: row.id ?? createDummyId(),
      created_at: row.created_at ?? now(),
      updated_at: row.updated_at ?? now(),
      ...row,
    }))
  }

  const result = () => {
    if (mode === 'insert') {
      const inserted = normalizePayloadRows(pendingPayload)
      tableRows.push(...inserted)
      rows = inserted.map(r => ({ ...r }))
    } else if (mode === 'update') {
      const ids = new Set(rows.map(r => r.id))
      rows = tableRows
        .filter(r => ids.has(r.id))
        .map(r => Object.assign(r, pendingPayload, { updated_at: now() }))
        .map(r => ({ ...r }))
    } else if (mode === 'delete') {
      const ids = new Set(rows.map(r => r.id))
      const deleted = tableRows.filter(r => ids.has(r.id)).map(r => ({ ...r }))
      for (let i = tableRows.length - 1; i >= 0; i--) {
        if (ids.has(tableRows[i].id)) tableRows.splice(i, 1)
      }
      rows = deleted
    } else if (mode === 'upsert') {
      const upserts = normalizePayloadRows(pendingPayload)
      const written: AnyRow[] = []
      for (const row of upserts) {
        const existing = tableRows.find(r => r.id === row.id)
        if (existing) {
          Object.assign(existing, row, { updated_at: now() })
          written.push({ ...existing })
        } else {
          tableRows.push(row)
          written.push({ ...row })
        }
      }
      rows = written
    }

    let data: any = rows
    if (singleMode) data = rows[0] ?? null
    if (headOnly) data = null
    return { data, error: null, count: countMode ? rows.length : null, status: 200, statusText: 'OK' }
  }

  const builder: any = {
    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      mode = 'select'
      if (opts?.count) countMode = true
      if (opts?.head) headOnly = true
      return builder
    },
    insert(payload: any)  { mode = 'insert'; pendingPayload = payload; return builder },
    update(payload: any)  { mode = 'update'; pendingPayload = payload; return builder },
    upsert(payload: any)  { mode = 'upsert'; pendingPayload = payload; return builder },
    delete()              { mode = 'delete'; return builder },
    eq:    (c: string, v: any) => { rows = applyFilter(rows, c, 'eq', v);    return builder },
    neq:   (c: string, v: any) => { rows = applyFilter(rows, c, 'neq', v);   return builder },
    gt:    (c: string, v: any) => { rows = applyFilter(rows, c, 'gt', v);    return builder },
    gte:   (c: string, v: any) => { rows = applyFilter(rows, c, 'gte', v);   return builder },
    lt:    (c: string, v: any) => { rows = applyFilter(rows, c, 'lt', v);    return builder },
    lte:   (c: string, v: any) => { rows = applyFilter(rows, c, 'lte', v);   return builder },
    in:    (c: string, v: any) => { rows = applyFilter(rows, c, 'in', v);    return builder },
    is:    (c: string, v: any) => { rows = applyFilter(rows, c, 'is', v);    return builder },
    ilike: (c: string, v: any) => { rows = applyFilter(rows, c, 'ilike', v); return builder },
    not:   () => builder,
    or:    () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single()      { singleMode = 'single';      return builder },
    maybeSingle() { singleMode = 'maybeSingle'; return builder },
    then(resolve: (r: any) => any, reject?: (e: any) => any) {
      try { return Promise.resolve(result()).then(resolve, reject) }
      catch (e) { return reject ? reject(e) : Promise.reject(e) }
    },
  }
  return builder
}

const dummySupabase: any = {
  auth: {
    async getUser(_token?: string) { return { data: { user: FAKE_USER }, error: null } },
    async getSession()              { return { data: { session: FAKE_SESSION }, error: null } },
    onAuthStateChange(_cb: any)     { return { data: { subscription: { unsubscribe() {} } } } },
    async signOut()                 { return { error: null } },
    async signInWithPassword(_a: any) { return { data: { user: FAKE_USER, session: FAKE_SESSION }, error: null } },
    async signUp(_a: any)             { return { data: { user: FAKE_USER, session: FAKE_SESSION }, error: null } },
    async verifyOtp(_a: any)          { return { data: { user: FAKE_USER, session: FAKE_SESSION }, error: null } },
    async resetPasswordForEmail(_a: any) { return { data: {}, error: null } },
    async updateUser(_a: any)            { return { data: { user: FAKE_USER }, error: null } },
  },
  from(table: string) { return makeQuery(table) },
  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, _file: any) { return { data: { path }, error: null } },
        async remove(_paths: string[])         { return { data: [], error: null } },
        getPublicUrl(path: string)             { return { data: { publicUrl: `/dummy/${path}` } } },
      }
    },
  },
  channel(_name: string) {
    const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} }
    return ch
  },
  removeChannel(_c: any) {},
}

export const supabase: any = useDummySupabase
  ? dummySupabase
  : createClient(supabaseUrl!, supabaseAnonKey!)

export type Tool = {
  id: string
  name: string
  vendor: string
  website_url: string
  description: string
  category: string
  tags: string[]
  status: 'new' | 'claimed' | 'in_progress' | 'completed' | 'archived'
  legit_score: number
  fit_score: number
  novelty_score: number
  source: string
  claimed_by: string | null
  claimed_at: string | null
  created_at: string
  is_new?: boolean
}

export type UseCase = {
  id: string
  title: string
  description: string | null
  tool_id: string | null
  tool_name: string | null
  team: string | null
  problem: string | null
  solution: string | null
  benefits: string | null
  risks: string | null
  effort: 'low' | 'medium' | 'high' | null
  impact: 'low' | 'medium' | 'high' | null
  status: 'draft' | 'review' | 'published' | 'archived'
  confidence_score: number
  tags: string[]
  author_id: string | null
  author_name: string | null
  chat_history: Message[]
  created_at: string
  updated_at: string
  purpose: string | null
  similar_tools: string | null
  best_for_roles: string | null
  time_saved: string | null
  aha_moment: string | null
  output_quality: string | null
  hallucinates: string | null
  weaknesses: string | null
  security_risks: string | null
  limitations: string | null
  recommended: string | null
  pricing: string | null
  ui_intuitive: string | null
  onboarding_score: number | null
  rating: number | null
  category: string | null
  published_at: string | null
  revision_due_at: string | null
  revision_status: 'ok' | 'due' | null
}

export type Profile = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  company: string | null
  position: string | null
  bio: string | null
  linkedin_url: string | null
  avatar_url: string | null
  role: string | null
  team: string | null
  email: string | null
  profile_completed: boolean
  created_at: string
}

export type AppSettings = {
  key: string
  value: string
  updated_at: string
}

export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export type ToolAuditStatus = 'draft' | 'pending_review' | 'needs_revision' | 'approved' | 'rejected'

export type ToolAudit = {
  id: string
  tool_id: string
  author_id: string | null
  author_name: string | null
  status: ToolAuditStatus
  // audit content
  purpose: string | null
  best_for_roles: string | null
  output_quality: string | null
  hallucinates: string | null
  weaknesses: string | null
  security_risks: string | null
  limitations: string | null
  recommended: string | null
  pricing: string | null
  ui_intuitive: string | null
  onboarding_score: number | null
  rating: number | null
  time_saved: string | null
  aha_moment: string | null
  notes: string | null
  // review
  reviewer_id: string | null
  reviewer_name: string | null
  reviewer_note: string | null
  reviewed_at: string | null
  // timestamps
  submitted_at: string | null
  created_at: string
  updated_at: string
}
