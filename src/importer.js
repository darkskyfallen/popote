// Import de recettes : découpage des lignes d'ingrédients et du texte collé
import { HUES } from './data.js'
import { cats } from './logic.js'

const plain = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/’/g, "'")
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s

/* ---------- Quantités ---------- */
const FRAC = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅕': .2 }
const QTY = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔⅛⅕])?|[½¼¾⅓⅔⅛⅕])`
const RANGE = new RegExp(String.raw`^(${QTY})(?:\s*(?:-|–|à|a|to|ou)\s*(${QTY}))?`, 'i')
function qtyValue(s) {
  s = s.trim()
  let m
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + +m[2] / +m[3]
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return +m[1] / +m[2]
  if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*([½¼¾⅓⅔⅛⅕])$/))) return parseFloat(m[1].replace(',', '.')) + FRAC[m[2]]
  if (FRAC[s]) return FRAC[s]
  return parseFloat(s.replace(',', '.'))
}

/* ---------- Unités ---------- */
// [motif, unité Popote, multiplicateur, mot gardé dans le nom]
const UNIT_RULES = [
  [/^(?:kg|kilos?|kilogrammes?)\b\.?/, 'kg', 1],
  [/^(?:g|gr|grs|grammes?)\b\.?/, 'g', 1],
  [/^(?:mg|milligrammes?)\b\.?/, 'g', .001],
  [/^(?:ml|millilitres?)\b\.?/, 'ml', 1],
  [/^(?:cl|centilitres?)\b\.?/, 'cl', 1],
  [/^(?:dl|decilitres?)\b\.?/, 'cl', 10],
  [/^(?:l|litres?|liters?)\b\.?/, 'l', 1],
  [/^(?:c\.?\s?a\.?\s?s\.?|cas|cs|cuil(?:l?ere)?s?\.?\s*(?:a|à)\s*soupe|c\.?\s*(?:a|à)\s*soupe|tbsp|tbs|tablespoons?)(?=\s|$|\.|\))\.?/, 'c. à s.', 1],
  [/^(?:c\.?\s?a\.?\s?c\.?|cac|cc|cuil(?:l?ere)?s?\.?\s*(?:a|à)\s*(?:cafe|the)|c\.?\s*(?:a|à)\s*(?:cafe|the)|tsp|teaspoons?)(?=\s|$|\.|\))\.?/, 'c. à c.', 1],
  [/^(?:pincees?|pinch(?:es)?)\b/, 'pincée', 1],
  [/^(?:gousses?|cloves?)\b/, 'gousse', 1],
  [/^(?:bottes?|bouquets?|bunch(?:es)?)\b/, 'botte', 1],
  [/^(?:boites?|conserves?|cans?|tins?)\b/, 'boîte', 1],
  [/^(?:tasses?|cups?|mugs?|bols?)\b/, 'ml', 240],
  [/^(?:verres?)\b/, 'ml', 200],
  [/^(?:oz|onces?|ounces?)\b\.?/, 'g', 28.35],
  [/^(?:lbs?|livres?|pounds?)\b\.?/, 'g', 453.6],
  [/^(?:sachets?|paquets?|packets?)\b/, 'pièce', 1, 'sachet'],
  [/^(?:tranches?|slices?)\b/, 'pièce', 1, 'tranche'],
  [/^(?:feuilles?|leaves)\b/, 'pièce', 1, 'feuille'],
  [/^(?:brins?|branches?|tiges?|sprigs?)\b/, 'pièce', 1, 'brin'],
  [/^(?:poignees?|handfuls?)\b/, 'pièce', 1, 'poignée'],
  [/^(?:noix|noisettes?)\s+(?=de\s)/, 'pièce', 1, 'noix'],
  [/^(?:pieces?|pcs?|unites?)\b\.?/, 'pièce', 1]
]

/* ---------- Rayons ---------- */
const AISLE_RULES = [
  [/surgele|congele|frozen|glace\b/, 'Surgelés'],
  [/en boite|en conserve|concasse|pulpe|coulis|concentre|passata|\bsec(?:he)?s?\b|bouillon|\bcubes?\b|epices?\b|sauce|moutarde|vinaigre|confiture|chocolat/, 'Épicerie'],
  [/\b(?:poulet|dinde|boeuf|veau|porc|agneau|jambon|lardons?|steaks?|viande|saucisses?|merguez|chorizo|bacon|canard|lapin|poissons?|saumon|thon|cabillaud|colin|crevettes?|moules?|calamars?|lieu|truite|sardines?|escalopes?|filets? de|blanc de|cuisses?|hache|beef|chicken|pork|lamb|turkey|salmon|tuna|shrimps?|fish)\b/, 'Boucherie & poisson'],
  [/lait(?! de coco)|creme(?! de marrons)|\bbeurre(?! de cacahuete)|\boeufs?\b|\begg|yaourt|fromage|gruyere|emmental|comte|parmesan|mozzarella|feta|chevre|ricotta|mascarpone|skyr|pate (?:brisee|feuilletee|sablee|a pizza)|tofu|milk|butter|cheese|cream\b/, 'Crèmerie & frais'],
  [/\b(?:pains?|baguettes?|brioches?|bread)\b/, 'Boulangerie'],
  [/courgette|carotte|tomate|poivron|oignon|echalote|\bail\b|salade|laitue|epinard|brocoli|chou|haricots? verts?|poireau|champignon|aubergine|concombre|pommes? de terre|patate|navet|potiron|courge|celeri|radis|asperge|fenouil|betterave|avocat|citron|orange|\bpommes?\b|poires?|bananes?|fraises?|framboises?|myrtilles?|fruits?\b|persil|basilic|coriandre|aneth|ciboulette|menthe|gingembre|legumes?|herbes? fraiches|onion|garlic|lemon|potato|carrot/, 'Fruits & légumes']
]
export function guessAisle(name, unit) {
  if (unit === 'boîte') return 'Épicerie'
  const p = plain(name)
  for (const [re, a] of AISLE_RULES) if (re.test(p)) return a
  return 'Épicerie'
}

/* ---------- Une ligne d'ingrédient ---------- */
export function parseIngredient(line) {
  let s = String(line).replace(/\s+/g, ' ').replace(/^[-•*·▪✓☐□]\s*/, '').trim()
  if (!s) return null
  let qty = null, unit = 'pièce', mult = 1, keep = null
  // Quantité au début (avec fourchette « 2 à 3 » : on garde la plus grande, pour ne pas manquer)
  const m = s.match(RANGE)
  if (m) {
    const a = qtyValue(m[1]), b = m[2] ? qtyValue(m[2]) : null
    qty = b ? Math.max(a, b) : a
    s = s.slice(m[0].length).trim()
  }
  // Unité juste après la quantité
  if (qty != null) {
    const p = plain(s)
    for (const [re, u, mul, word] of UNIT_RULES) {
      const um = p.match(re)
      if (um) {
        unit = u; mult = mul; keep = word || null
        s = s.slice(um[0].length).trim()
        break
      }
    }
  }
  s = s.replace(/^\((?:environ|env\.?|about|approx\.?)[^)]*\)\s*/i, '').trim()
  // « de », « d' », « des », « of »
  s = s.replace(/^(?:de\s+la\s+|de\s+l['’]\s*|de\s+|d['’]\s*|des\s+|du\s+|of\s+)/i, '').trim()
  // Précisions après une virgule (« 2 oignons, émincés ») : on garde l'ingrédient seul
  if (qty != null) {
    const c = s.indexOf(',')
    if (c > 2) s = s.slice(0, c).trim()
  }
  s = s.replace(/\s*\((?:environ|env\.?)[^)]*\)\s*/i, ' ').trim()
  // Adjectifs de taille en tête (« 3 gros oignons ») : on garde l'ingrédient
  s = s.replace(/^(?:tr[eè]s\s+)?(?:gros|grosses?|petite?s?|beaux|belles?|beau|moyens?|moyennes?|large|small|medium|big)\s+(?=\S{3})/i, '').trim()
  if (!s) return null
  let name = cap(s)
  if (keep) name += ` (${keep})`
  if (qty == null || !(qty > 0)) {
    // Sans quantité : une pincée pour l'assaisonnement, sinon une unité
    const isAroma = cats({ name: s })[0] === 'a' || /\b(?:sel|poivre|salt|pepper)\b/i.test(plain(s))
    qty = 1; unit = isAroma ? 'pincée' : 'pièce'
  }
  qty = qty * mult
  // Unités converties (tasses, onces…) : arrondi pratique
  if (mult !== 1 && unit === 'g') qty = qty >= 50 ? Math.round(qty / 5) * 5 : Math.round(qty)
  else if (mult !== 1 && unit === 'ml') qty = Math.round(qty / 10) * 10
  qty = Math.round(qty * 100) / 100
  if (unit === 'g' && qty >= 1000 && mult !== 1) { qty = Math.round(qty / 10) / 100; unit = 'kg' }
  return { name: name.slice(0, 80), qty, unit, aisle: guessAisle(name, unit) }
}

/* ---------- Durée et portions dans du texte ---------- */
export function minutesIn(s) {
  const p = plain(s)
  let m = p.match(/(\d+)\s*h(?:eures?|r?s?)?\.?\s*(\d+)?/)
  if (m) return +m[1] * 60 + (+m[2] || 0)
  m = p.match(/(\d+)\s*(?:min|mn|minutes?)\b/)
  return m ? +m[1] : null
}
export function servingsIn(s) {
  const p = plain(s)
  const m = p.match(/(?:pour|for|serves?|portions?\s*:?)\s*(\d+)/) || p.match(/(\d+)\s*(?:personnes?|pers\b|portions?|parts?|servings?|people)/)
  return m && +m[1] > 0 && +m[1] < 100 ? +m[1] : null
}

/* ---------- Texte collé ---------- */
const H_ING = /^(?:les\s+)?(?:ingr[eé]dients?|ingredients?)\b\s*:?/i
const H_STEP = /^(?:pr[eé]paration|[eé]tapes?|instructions?|m[eé]thode|r[eé]alisation|d[eé]roul[eé]|method|directions?|steps?)\b\s*:?/i
const H_SKIP = /^(?:astuces?|conseils?|notes?|nutrition|ustensiles?|mat[eé]riel|valeurs nutritionnelles)\b/i
const looksIngredient = l => new RegExp(`^(?:[-•*·▪✓☐□]\\s*)?${QTY}`).test(l) && !/^\d+\s*[.)]\s/.test(l) && l.length < 90

export function parseText(text) {
  const lines = String(text).split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (!lines.length) return null
  let name = '', servings = null, time = null, mode = null
  const ing = [], steps = []
  for (const l of lines) {
    const p = plain(l)
    if (H_ING.test(l)) { mode = 'ing'; const rest = l.replace(H_ING, '').trim(); const sv = servingsIn(rest); if (sv) servings = sv; continue }
    if (H_STEP.test(l) && l.length < 40) { mode = 'step'; continue }
    if (H_SKIP.test(l) && l.length < 40) { mode = 'skip'; continue }
    if (/^(?:temps|duree|total|preparation|cuisson|repos)\b.*\d/.test(p) && l.length < 60) {
      const mn = minutesIn(l)
      if (mn && (/total/.test(p) || time == null)) time = /total/.test(p) ? mn : (time || 0) + mn
      continue
    }
    if (!servings && /(?:personnes?|portions?|parts?|servings?)\b/.test(p) && l.length < 50) { const sv = servingsIn(l); if (sv) { servings = sv; continue } }
    if (!name && !mode && !looksIngredient(l) && l.length < 100) { name = l.replace(/^recette\s*(?:de|du|des)?\s*:?\s*/i, ''); continue }
    if (mode === 'skip') continue
    if (mode === 'ing' || (!mode && looksIngredient(l))) { ing.push(l); continue }
    if (mode === 'step' || l.length >= 40 || /^\d+\s*[.)]\s/.test(l)) {
      steps.push(l.replace(/^(?:[eé]tape\s*)?\d+\s*[.):-]\s*/i, '').replace(/^[-•*·]\s*/, ''))
      continue
    }
    ing.push(l)
  }
  return { name, servings, time, ingredients: ing, steps, nutrition: null, source: '' }
}

/* ---------- Brouillon de recette pour le formulaire ---------- */
export function toDraft(raw, count = 0) {
  if (!raw) return null
  const ingredients = (raw.ingredients || []).map(parseIngredient).filter(Boolean)
  const n = raw.nutrition
  return {
    name: raw.name || '',
    servings: raw.servings || 4,
    time: raw.time || 30,
    hue: HUES[[...(raw.name || String(count))].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length],
    ingredients,
    steps: raw.steps || [],
    nutri: n && n.kcal ? { kcal: n.kcal, p: n.p ?? 0, g: n.g ?? 0, l: n.l ?? 0, f: n.f ?? null } : null,
    tip: '',
    source: raw.source || ''
  }
}

export const firstUrl = s => { const m = String(s || '').match(/https?:\/\/[^\s<>"']+/i); return m ? m[0].replace(/[),.;!?]+$/, '') : '' }
