import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type DiscoveredTool = {
  name: string
  vendor?: string
  url?: string
  website_url?: string
  description?: string
  category?: string
  tags?: string[]
}

const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
const isDuplicate = (a: string, b: string) => {
  const na = normalize(a)
  const nb = normalize(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

export async function POST() {
  console.log('DISCOVERY CALLED', new Date().toISOString())
  try {
    console.log('1. Starting discovery')
    console.log('2. Tavily key exists:', !!process.env.TAVILY_API_KEY)

    // 1. Load existing tools from DB
    const { data: existing } = await supabase.from('tools').select('name')
    const existingNames = existing?.map((t: { name: string }) => t.name.toLowerCase()) || []

    // 2. Tavily search for new AI tools — randomize query to get variety
    const queries = [
      'new AI SaaS tools launched 2025',
      'AI startup product launch 2025 site:producthunt.com',
      'best new AI tools for business 2025',
      'AI tools recently released 2025 site:techcrunch.com OR site:venturebeat.com',
      'new AI productivity tools 2025 review',
    ]
    const query = queries[Math.floor(Math.random() * queries.length)]
    console.log('Tavily query:', query)

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: 20,
        include_answer: true,
      }),
    })

    console.log('3. Tavily status:', tavilyRes.status)

    if (!tavilyRes.ok) {
      const errText = await tavilyRes.text()
      throw new Error(`Tavily error ${tavilyRes.status}: ${errText}`)
    }

    const tavilyData = await tavilyRes.json()
    console.log('4. Tavily data:', JSON.stringify(tavilyData).slice(0, 500))

    if (!tavilyData.results?.length) {
      return NextResponse.json({ added: 0, error: 'Tavily returned no results' })
    }

    // 3. Send Tavily results to Claude for structured extraction
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a data extractor. Your ONLY job is to extract AI tool names from the text given to you.
STRICT RULES:
- Extract ONLY tools explicitly named in the SEARCH RESULTS below
- Do NOT use your training data to add tools not mentioned in the text
- Do NOT invent tools, vendors, or URLs
- Use the URL from the search result that mentioned the tool
- If you cannot find a tool's vendor in the text, leave vendor as empty string`,
      messages: [{
        role: 'user',
        content: `Extract AI tools explicitly named in these search results.
Skip any tool already in our database.

ALREADY IN DATABASE (skip these): ${existingNames.join(', ')}

SEARCH RESULTS TO EXTRACT FROM:
${tavilyData.results.map((r: { title: string; url: string; content: string }) =>
  `SOURCE: ${r.url}\nTITLE: ${r.title}\nCONTENT: ${r.content}`
).join('\n---\n')}

Return ONLY a JSON array of tools found in the text above. Use the SOURCE url for each tool.
Format: [{"name":"...","vendor":"...","description":"...","tags":["..."],"url":"..."}]`,
      }],
    })

    console.log('5. Claude response received')
    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const discovered: DiscoveredTool[] = JSON.parse(text.replace(/```json|```/g, '').trim())

    if (!Array.isArray(discovered)) {
      return NextResponse.json({ added: 0 })
    }

    // 4. Insert non-duplicate tools
    let added = 0
    for (const tool of discovered) {
      if (!tool.name) continue

      const alreadyExists = existingNames.some((n: string) => isDuplicate(n, tool.name))
      if (alreadyExists) continue

      console.log('Ukládám nástroj:', tool.name)
      await supabase.from('tools').insert({
        name: tool.name,
        vendor: tool.vendor ?? null,
        website_url: tool.url ?? tool.website_url ?? null,
        description: tool.description ?? null,
        category: tool.category ?? null,
        tags: Array.isArray(tool.tags) ? tool.tags : [],
        status: 'new',
        source: 'discovery',
        is_new: true,
      })
      added++
    }

    return NextResponse.json({ added })
  } catch (error: unknown) {
    console.error('DISCOVERY ERROR:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
