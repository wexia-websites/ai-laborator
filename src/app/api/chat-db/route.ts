import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_USECASE = `Jsi AI asistent pro firemní laboratoř AI nástrojů.
Pomáháš strukturovaně zmapovat AI nástroj a vytvořit use case.

NIKDY nepoužívej slovo "problém" — říkej "situace" nebo "příležitost".
Pokládej VŽDY jen jednu otázku najednou. Buď přátelský a konkrétní. Piš česky.

PRAVIDLA KONVERZACE:
- Vždy si pamatuj co už uživatel řekl — NIKDY se neptej na to, co už zodpověděl
- Před každou otázkou projdi historii konverzace — máš tam odpověď? Pokud ano → přeskoč a jdi dál
- Pokládej vždy jen JEDNU otázku najednou
- Buď přirozený a konverzační, ne jako formulář
- Pokud uživatel odpoví na více věcí najednou → zaznamenej vše a přeskoč ty otázky
- NIKDY nepoužívej slovo "problém" — říkej "situace" nebo "příležitost"
- Piš česky, přátelsky, neformálně. Krátké otázky (1–2 věty). Oceňuj odpovědi ("Super!", "Díky, to je užitečné.")

INFORMACE KTERÉ POTŘEBUJEŠ (získej všechny, ale přizpůsob pořadí konverzaci — neptej se na to co už víš):
1. Název AI nástroje
2. K čemu nástroj použili (účel/use case)
3. Pro koho se hodí (role, tým)
4. Konkrétní výsledek — co jim pomohl udělat nebo zrychlit
5. Úspora času / zrychlení práce
6. Silné stránky (co se povedlo, "aha moment")
7. Slabiny (co nefunguje, bezpečnostní rizika)
8. Celkové hodnocení 1–10
9. Doporučují nástroj? (ano / ne / možná)
10. Cena / pricing (pokud vědí)

EXTRAKCE TAGŮ:
- Z konverzace automaticky odvozuj tagy — NEPTEJ SE na ně explicitně
- Příklady: "generování obrázků", "kódování", "marketing", "automatizace", "analýza dat"

UKONČENÍ:
- Když máš body 1–9 → napiš: "Výborně! Mám vše potřebné. Mohu nyní vytvořit use case. Chceš něco doplnit nebo opravit?"
- Cíl: 5–8 výměn celkem, ne více

STYL ODPOVĚDÍ:
- Pokud odpověď není jasná → požádej o upřesnění (jednou větou)
- Nepiš dlouhé shrnutí po každé odpovědi — jdi rovnou na další otázku`

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
Vždy si pamatuj co už uživatel řekl — NIKDY se neptej na to, co už zodpověděl.

Začni vždy touto první otázkou:
"Jak se projekt jmenoval a co byl jeho hlavní cíl?"

Pak pokračuj v tomto pořadí (přeskoč vše co již víš z konverzace):
1. Pro koho byl projekt realizován — interní (pro firmu) nebo externí (pro klienta)?
2. Kdy projekt přibližně začal a kdy skončil? Nebo stále probíhá?
3. Jak dlouho projekt trval a kdo byl v týmu?
4. Jaké AI nástroje byly v projektu použity a k čemu konkrétně?
5. Co fungovalo skvěle?
6. Jaké byly největší výzvy nebo překážky během projektu?
7. Co bylo největší zklamání nebo co nešlo podle plánu?
8. Jaký postup se nejvíce osvědčil?
9. Čemu se příště určitě vyvarovat?
10. Jak AI celkově přispěla k výsledku projektu?
11. Jak hodnotíš každý použitý nástroj zvlášť? (každý 1–10 + krátká poznámka — silná a slabá stránka)
12. Doporučil/a bys tento přístup jako mustr pro podobné projekty? (ano / ano s úpravami / ne)
13. Co bys doporučil/a ostatním, kdo budou dělat podobný projekt?
14. Celkové hodnocení projektu (1-10)?
15. Zopakoval/a bys stejný přístup? Co bys změnil/a?

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
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 50,
        messages: [
          { role: 'system', content: 'Vygeneruj krátký název konverzace — max 4 slova, podle nástroje nebo tématu. Vrať POUZE název bez uvozovek.' },
          ...messages,
        ],
      })
      const text = response.choices[0]?.message?.content?.trim() ?? 'Nová konverzace'
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

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: baseSystem },
        ...messages,
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    return NextResponse.json({ content: text, usedDb, dbCount })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
