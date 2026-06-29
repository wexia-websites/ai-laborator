# Feedback Widget - Popis a Specifikace

## Přehled
Feedback widget je malá komponenta v pravém dolním rohu aplikace, která umožňuje uživatelům nahlášení problémů nebo návrhů přímo z jakékoliv stránky aplikace.

## Vizuální Vlastnosti

### Tlačítko (Launcher Button)
- **Pozice**: Pevně ukotveno v pravém dolním rohu (`position: fixed; bottom-right`)
- **Barva**: Červená (#e02020 - accent color aplikace)
- **Ikona**: Výkřičník "!"
- **Velikost**: Malé - přibližně 48px × 48px
- **Styl**: `launcherStyle: 'minimal'` - bez textu, jen ikona
- **Z-index**: Vysoko (aby byl vidět přes ostatní obsah)

### Panel (Feedback Form)
Když uživatel klikne na tlačítko, otevře se panel s formulářem:

**Struktura panelu:**
1. **Nadpis**: "Nahlásit chybu"
2. **Instrukce**: "Klikni na problematický prvek."
3. **Kategorie** (dropdown):
   - Bug
   - Design
   - Text
   - Funkce
   - UX/Usability
4. **Pole pro komentář** (textarea):
   - Placeholder: "Co je špatně?"
5. **Screenshot** (preview):
   - Automaticky pořídí screenshot vybraného prvku
   - Možnost zoomu (maxScale: 2)
6. **Tlačítka**:
   - "Zrušit" - zavře panel bez odeslání
   - "Odeslat" - pošle feedback do Supabase

### Barvy a Styling
- **Accent color**: #e02020 (červená)
- **Lokalizace**: Čeština (locale: 'cs')
- **Responsive**: Adaptuje se na mobilní zařízení
- **Shadow/pozadí**: Cihlový/tmavý pozadí s průhledností

## Technické Detaily

### Konfigurace
```javascript
{
  branding: {
    accentColor: '#e02020',
    buttonIcon: '!',
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
  screenshot: { enabled: true, maxScale: 2 },
  onSubmit: async (payload) => { /* uložení do Supabase */ }
}
```

### Data která se ukládají
Když uživatel odešle feedback, aplikace uloží:
- `category` - kategorie problému
- `comment` - text komentáře
- `element_selector` - CSS selektor vybraného prvku
- `element_html` - HTML kód prvku
- `screenshot` - base64 obrázek prvku
- `url` - URL stránky kde byl feedback odeslán
- `user_agent` - informace o prohlížeči
- `user_id` - ID přihlášeného uživatele (pokud přihlášen)
- `timestamp` - čas vytvoření

## Soubory

### Komponenta
- **Soubor**: `src/components/FeedbackWidget.tsx`
- **Typ**: Client Component (uses `'use client'`)
- **Inicializace**: V `src/app/layout.tsx`

### Widget Script
- **Soubor**: `public/feedback-widget.min.js`
- **Zdroj**: Wexia UI Tools (@wexia/feedback-widget v0.2.1)
- **Funkce**: Renderuje UI a spravuje interakci

### Databáze
- **Tabulka**: `feedback` v Supabase
- **Migrace**: `supabase/migrations/20260528_feedback_table.sql`

## Jak na Něj Odkazovat AI

Když chceš AI říci, co má změnit, můžeš říci např.:

> "Změň design feedback widgetu - chci aby:
> - Tlačítko bylo větší (60px × 60px)
> - Mělo zaoblené rohy s shadow efektem
> - Ikona byla +/plus místo výkřičníku
> - Panel měl tmavé pozadí s efektem skla (glassmorphism)
> - Kategorie byly zobrazeny jako barevné badges namísto dropdownu
> - Komentář mělo placeholder 'Napiš zprávu...' místo 'Co je špatně?'"

Nebo konkrétněji:

> "Udělej feedback widget v designu podobném jako chat input field - minimalistický, se zaoblením, se subtilním stínem. Tlačítko ať bude ikonou '!' s hover efektem (zvýšení se a změna barvy). Když se otevře panel, měl by se zobrazit skrz glas efekt."

## Current State
✅ Widget je funkční a integrovaný  
✅ Screenshot funkcionalita funguje  
✅ Data se ukládají do Supabase (pokud jsou nakonfigurované kredenciály)  
✅ UI je jednoduché a minimalistické  
⏳ Připraveno na vizuální úpravy
