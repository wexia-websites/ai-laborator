import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_USECASE = `Jsi AI asistent pro firemní laboratoř AI nástrojů.
Pomáháš strukturovaně zmapovat AI nástroj a vytvořit use case.

NIKDY nepoužívej slovo "problém" — říkej "situace" nebo "příležitost".
Pokládej VŽDY jen jednu otázku najednou. Buď přátelský a konkrétní. Piš česky.

PRVNÍ OTÁZKA MUSÍ BÝT VŽDY:
"Jak se jmenuje AI nástroj, který jste testovali?"
NIKDY nezačínaj otázkou o účelu, funkci nebo čemkoli jiném. Vždy nejdřív název.

Pokračuj přesně v tomto pořadí — jedna otázka najednou:

1. Jak se jmenuje AI nástroj, který jste testovali?
2. Jaký je jeho hlavní účel? Co konkrétně umí?
3. Existují podobné nástroje, které firma zná nebo používá? V čem je tento jiný?
4. Pro která oddělení nebo role je nástroj nejužitečnější?
5. Kolik času přibližně ušetří oproti dosavadnímu způsobu práce?
6. Byl nějaký "Aha!" moment — situace, kdy nástroj překvapil svým výkonem?
7. Jak složitý byl onboarding? Ohodnoť na škále 1 (velmi složité) až 5 (ihned použitelné).
8. Jak hodnotíš kvalitu výstupů — jsou výsledky použitelné rovnou, nebo vyžadují úpravy?
9. Halucinuje nástroj (vymýšlí fakta) nebo dělá technické chyby?
10. Jaké jsou největší slabiny nebo situace, kde nástroj selhává?
11. Jak nástroj nakládá s firemními daty? Jsou nějaká bezpečnostní rizika?
12. Doporučuješ zařadit nástroj do firemní nabídky? (ano / ne / možná) Jaké je celkové hodnocení na škále 1–10?
13. Jaká je cena? Je nástroj zdarma, nebo placený?

Po projití všech oblastí shrň use case v přehledném markdown formátu:
## [Název use case]
**Nástroj:** ... | **Tým:** ... | **Hodnocení:** .../10
**Účel:** ...
**Přínos:** ...
**Doporučení:** ...`

const SYSTEM_INTERVIEW = `Jsi AI asistent vedoucí strukturované interview o AI nástroji.
Uživatel ti už ve formuláři zadal: název nástroje a základní kontext/situaci.
Nepřepokládej, že víš víc — ptej se dál, ale nezačínaj od nuly.

NIKDY nepoužívej slovo "problém" — říkej "situace" nebo "příležitost".
Pokládej VŽDY jen jednu otázku najednou. Buď přátelský a konkrétní. Piš česky.

Protože základní info (nástroj + kontext) už máš, přeskoč úvodní otázky a jdi rovnou na hloubku:

a) PŘÍNOS PRO BYZNYS
   - Pro která oddělení nebo role je nástroj nejužitečnější?
   - Kolik času přibližně ušetří oproti dosavadnímu způsobu práce?
   - Byl nějaký "Aha!" moment — situace, kdy nástroj překvapil svým výkonem?

b) UŽIVATELSKÁ PŘÍVĚTIVOST
   - Jak složitý byl onboarding? Ohodnoť na škále 1 (velmi složité) až 5 (ihned použitelné).
   - Je uživatelské rozhraní intuitivní, nebo vyžaduje zaškolení?

c) VÝKON AI
   - Jak hodnotíš kvalitu výstupů — jsou výsledky použitelné rovnou, nebo vyžadují úpravy?
   - Halucinuje nástroj (vymýšlí fakta) nebo dělá technické chyby?

d) RIZIKA
   - Jaké jsou největší slabiny nebo situace, kde nástroj selhává?
   - Jak nástroj nakládá s firemními daty? Jsou nějaká bezpečnostní rizika?
   - Kde jsou limity nástroje — co neumí nebo odmítá dělat?

e) FINÁLNÍ VERDIKT
   - Doporučuješ zařadit nástroj do firemní nabídky? (ano / ne / možná)
   - Jaké je tvoje celkové hodnocení na škále 1–10?

Po projití všech oblastí shrň use case v přehledném markdown formátu:
## [Název use case]
**Nástroj:** ... | **Tým:** ... | **Hodnocení:** .../10
**Účel:** ...
**Přínos:** ...
**Doporučení:** ...`

const SYSTEM_PROJECT = `Jsi asistent pro zpětnou dokumentaci projektů kde byla použita AI.
Ptáš se postupně, vždy jen jednu otázku najednou.
Komunikuješ česky, profesionálně a přátelsky.
Nikdy nepoužíváš slovo "problém" ani "fuckup".

Začni vždy touto první otázkou:
"Jak se projekt jmenoval a co byl jeho hlavní cíl?"

Pak pokračuj v tomto pořadí:
1. Pro koho byl projekt realizován - klient nebo interní?
2. Jak dlouho projekt trval a kdo byl v týmu?
3. Jaké AI nástroje byly v projektu použity a k čemu konkrétně?
4. Co fungovalo skvěle?
5. Co bylo největší zklamání nebo co nešlo podle plánu?
6. Jaký postup se nejvíce osvědčil?
7. Čemu se příště určitě vyvarovat?
8. Jak AI celkově přispěla k výsledku projektu?
9. Jak hodnotíš jednotlivé nástroje které byly použity (1-10 a proč)?
10. Celkové hodnocení projektu (1-10)?
11. Zopakoval/a bys stejný přístup? Co bys změnil/a?

Po projití všech oblastí shrň projekt v markdown:
## [Název projektu]
**Klient:** ... | **Hodnocení:** .../10
**Cíl:** ...
**AI příspěvek:** ...
**Doporučení:** ...`

const TOOL_KEYWORDS = [
  'nejlepší nástroj', 'nejlepší ai', 'doporuč', 'který nástroj', 'jaký nástroj',
  'jaké nástroje', 'co používáte', 'co testujete', 'co jste testoval',
  'co jste vyzkoušel', 'na generování', 'na kódování', 'na video', 'na obrázky',
  'na text', 'na audio', 'na design', 'na data', 'na produktivitu',
  'top nástroj', 'best tool', 'recommend', 'doporučení na',
  'hodnocení nástrojů', 'srovnání nástrojů', 'alternativa k',
  'který je lepší', 'co doporučujete', 'co funguje na',
]

function isToolQuery(text: string): boolean {
  const lower = text.toLowerCase()
  return TOOL_KEYWORDS.some(kw => lower.includes(kw))
}

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json()

    if (mode === 'title') {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 50,
        system: 'Vygeneruj krátký název konverzace — max 4 slova, podle nástroje nebo tématu. Vrať POUZE název bez uvozovek.',
        messages,
      })
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : 'Nová konverzace'
      return NextResponse.json({ content: text })
    }

    // Detekuj poslední zprávu uživatele
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const queryText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : ''

    let baseSystem = mode === 'project'
      ? SYSTEM_PROJECT
      : mode === 'interview'
        ? SYSTEM_INTERVIEW
        : SYSTEM_USECASE

    let usedDb = false
    let dbCount = 0

    if (isToolQuery(queryText)) {
      const { data: useCases } = await supabase
        .from('use_cases')
        .select('title, tool_name, description, rating, category, tags, recommended, effort, impact, aha_moment, best_for_roles, time_saved')
        .eq('status', 'published')
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(20)

      if (useCases && useCases.length > 0) {
        usedDb = true
        dbCount = useCases.length
        baseSystem += `\n\nPŘEHLED NÁSTROJŮ OTESTOVANÝCH NAŠÍM TÝMEM (z AI Laboratoře):
${JSON.stringify(useCases, null, 2)}

Při odpovídání na dotazy o doporučení nebo srovnání VŽDY vycházej z těchto reálných dat.
Uváděj konkrétní hodnocení (rating), pro koho se hodí (best_for_roles) a co je výjimečné (aha_moment).
Pokud se ptají na konkrétní kategorii nebo účel, zvýrazni nejrelevantnější nástroje.`
      }
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: baseSystem,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ content: text, usedDb, dbCount })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
