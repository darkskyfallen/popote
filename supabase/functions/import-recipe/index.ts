// Popote : fonction Supabase « import-recipe »
// Télécharge une page de recette et en extrait la fiche structurée (schema.org/Recipe),
// présente sur la plupart des sites de cuisine. L'appli ne peut pas le faire elle-même
// car un navigateur n'a pas le droit de lire les pages d'un autre site (règle CORS).
//
// Appel : POST { url } avec la session de l'utilisateur (seuls les comptes connectés peuvent l'utiliser).
// Réponse : { recipe: { name, servings, time, ingredients[], steps[], nutrition, image, source } }
//        ou { error: "message en français" }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const MAX_BYTES = 4 * 1024 * 1024
const TIMEOUT_MS = 12000
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
const fail = (error, status = 200) => json({ error }, status)

/* ---------- Sécurité : on ne va chercher que des pages web publiques ---------- */
export function isPublicUrl(u) {
  let url
  try { url = new URL(u) } catch { return false }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!h.includes('.') && !h.includes(':')) return false
  if (h === 'localhost' || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(h)) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 198 && (b === 18 || b === 19)) return false
  }
  if (h.includes(':')) {
    if (h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:')) return false
  }
  return true
}

async function download(start) {
  let url = start
  for (let hop = 0; hop < 5; hop++) {
    if (!isPublicUrl(url)) throw new Error('Cette adresse ne peut pas être importée.')
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let res
    try {
      res = await fetch(url, {
        redirect: 'manual', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7' }
      })
    } catch (e) {
      clearTimeout(t)
      throw new Error(e?.name === 'AbortError' ? 'Le site met trop de temps à répondre.' : 'Impossible de joindre ce site.')
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(t); url = new URL(res.headers.get('location'), url).href; continue
    }
    if (res.status === 403 || res.status === 429) { clearTimeout(t); throw new Error('Ce site refuse les lectures automatiques. Copie le texte de la recette et utilise « Coller le texte ».') }
    if (res.status === 404) { clearTimeout(t); throw new Error("Cette page n'existe pas (erreur 404). Vérifie le lien.") }
    if (!res.ok) { clearTimeout(t); throw new Error(`Le site a répondu par une erreur (${res.status}).`) }
    const type = res.headers.get('content-type') || ''
    if (type && !/html|xml/i.test(type)) { clearTimeout(t); throw new Error("Ce lien ne mène pas à une page web de recette.") }
    const reader = res.body.getReader(), chunks = []
    let size = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > MAX_BYTES) { reader.cancel(); break }
        chunks.push(value)
      }
    } finally { clearTimeout(t) }
    const buf = new Uint8Array(size > MAX_BYTES ? MAX_BYTES : size)
    let o = 0
    for (const c of chunks) { if (o + c.length > buf.length) { buf.set(c.subarray(0, buf.length - o), o); break } buf.set(c, o); o += c.length }
    const charset = (type.match(/charset=([\w-]+)/i) || [])[1]
    let html = new TextDecoder(charset && /^(utf-?8|iso-8859-1|windows-1252|latin1)$/i.test(charset) ? charset : 'utf-8').decode(buf)
    if (!charset) {
      const meta = (html.slice(0, 4000).match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1]
      if (meta && /^(iso-8859-1|windows-1252|latin1)$/i.test(meta)) html = new TextDecoder(meta).decode(buf)
    }
    return { html, finalUrl: url }
  }
  throw new Error('Trop de redirections.')
}

/* ---------- Nettoyage du texte ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', euml: 'ë', oelig: 'œ', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»' }
export function clean(s) {
  if (s == null) return ''
  return String(s)
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+\d*);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
}

/* ---------- Lecture de la fiche schema.org ---------- */
const isType = (o, t) => { const v = o && o['@type']; return Array.isArray(v) ? v.some(x => String(x).toLowerCase() === t) : String(v || '').toLowerCase() === t }

export function findRecipe(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r } return null }
  if (isType(node, 'recipe')) return node
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item', 'hasPart']) {
    const r = findRecipe(node[k], depth + 1); if (r) return r
  }
  return null
}

function parseJsonLd(html) {
  const out = []
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    let txt = m[1].trim().replace(/^<!--|-->$/g, '').replace(/^\s*\/\/\s*<!\[CDATA\[|\/\/\s*\]\]>\s*$/g, '')
    try { out.push(JSON.parse(txt)) } catch {
      try { out.push(JSON.parse(txt.replace(/[\u0000-\u001f]+/g, ' '))) } catch { }
    }
  }
  return out
}

// Durée ISO 8601 (PT1H30M, P0DT45M…) en minutes
export function isoMinutes(d) {
  if (!d) return 0
  if (typeof d === 'number') return d
  const m = String(d).match(/P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?/i)
  if (!m || !m[0] || m[0] === 'P') { const n = parseInt(d); return isNaN(n) ? 0 : n }
  return Math.round((+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) + (+m[4] || 0) / 60)
}

export function yieldCount(y) {
  const list = Array.isArray(y) ? y : [y]
  for (const v of list) {
    if (typeof v === 'number' && v > 0) return Math.round(v)
    const n = String(v ?? '').match(/\d+/)
    if (n && +n[0] > 0 && +n[0] < 100) return +n[0]
  }
  return null
}

function stepsOf(ins) {
  const out = []
  const walk = (x, depth = 0) => {
    if (x == null || depth > 6) return
    if (typeof x === 'string') {
      const t = clean(x)
      if (!t) return
      // Une seule chaîne contenant toutes les étapes : on coupe par ligne ou par numéro
      const parts = t.includes('\n') ? t.split('\n') : t.split(/(?:^|\s)(?=\d+[.)]\s)/)
      parts.map(p => p.replace(/^\s*(?:étape\s*)?\d+\s*[.):-]\s*/i, '').trim()).filter(Boolean).forEach(p => out.push(p))
      return
    }
    if (Array.isArray(x)) { x.forEach(v => walk(v, depth + 1)); return }
    if (typeof x === 'object') {
      if (x.itemListElement) { walk(x.itemListElement, depth + 1); return }
      const t = x.text ?? x.name ?? x.description
      if (t) walk(String(t), depth + 1)
    }
  }
  walk(ins)
  return out.filter(s => s.length > 1).slice(0, 60)
}

const num = v => { const m = String(v ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/); return m ? +m[0] : null }
function nutritionOf(n) {
  if (!n || typeof n !== 'object') return null
  let kcal = num(n.calories)
  if (kcal != null && /kj/i.test(String(n.calories)) && !/kcal/i.test(String(n.calories))) kcal = Math.round(kcal / 4.184)
  if (!kcal) return null
  const g = k => { const v = num(n[k]); return v == null ? null : Math.round(v) }
  return { kcal: Math.round(kcal), p: g('proteinContent'), g: g('carbohydrateContent'), l: g('fatContent'), f: g('fiberContent') }
}

function imageOf(img) {
  if (!img) return ''
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return imageOf(img[0])
  return img.url || img.contentUrl || ''
}

export function normalize(r, source) {
  const ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : r.recipeIngredient ? [r.recipeIngredient] : [])
    .map(clean).filter(Boolean).slice(0, 80)
  const total = isoMinutes(r.totalTime) || (isoMinutes(r.prepTime) + isoMinutes(r.cookTime))
  return {
    name: clean(r.name || r.headline).slice(0, 120),
    servings: yieldCount(r.recipeYield ?? r.yield),
    time: total || null,
    ingredients,
    steps: stepsOf(r.recipeInstructions),
    nutrition: nutritionOf(r.nutrition),
    image: imageOf(r.image),
    source
  }
}

// Secours pour les sites sans JSON-LD mais avec les attributs itemprop (microdonnées)
function microdata(html, source) {
  if (!/itemprop=["']?recipeIngredient|itemprop=["']?ingredients/i.test(html)) return null
  const grab = prop => {
    const out = [], re = new RegExp(`<(\\w+)[^>]*itemprop=["']?${prop}["']?[^>]*?(?:content=["']([^"']*)["'])?[^>]*>([\\s\\S]*?)</\\1>`, 'gi')
    let m
    while ((m = re.exec(html)) && out.length < 80) out.push(clean(m[2] || m[3]))
    const re2 = new RegExp(`<meta[^>]*itemprop=["']?${prop}["']?[^>]*content=["']([^"']*)["']`, 'gi')
    while ((m = re2.exec(html)) && out.length < 80) out.push(clean(m[1]))
    return out.filter(Boolean)
  }
  const ing = grab('recipeIngredient').concat(grab('ingredients'))
  if (!ing.length) return null
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]
  return {
    name: clean(grab('name')[0] || title).slice(0, 120), servings: yieldCount(grab('recipeYield')), time: isoMinutes(grab('totalTime')[0]) || null,
    ingredients: ing, steps: stepsOf(grab('recipeInstructions')), nutrition: null, image: '', source
  }
}

export function extract(html, source) {
  for (const data of parseJsonLd(html)) {
    const r = findRecipe(data)
    if (r) { const n = normalize(r, source); if (n.ingredients.length || n.steps.length) return n }
  }
  return microdata(html, source)
}

/* ---------- Compte : seuls les utilisateurs connectés de Popote peuvent importer ---------- */
async function signedIn(req) {
  const auth = req.headers.get('authorization') || ''
  if (!/^Bearer\s+\S+\.\S+\.\S+/.test(auth)) return false
  const base = Deno.env.get('SUPABASE_URL')
  const key = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY')
  if (!base || !key) return true
  try {
    const r = await fetch(base + '/auth/v1/user', { headers: { Authorization: auth, apikey: key } })
    return r.ok
  } catch { return false }
}

/* ---------- Point d'entrée ---------- */
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail('Méthode non autorisée.', 405)
  if (!(await signedIn(req))) return fail('Connecte-toi à Popote pour importer une recette.', 401)
  let body
  try { body = await req.json() } catch { return fail('Requête invalide.', 400) }
  const raw = String(body?.url || '').trim()
  const found = raw.match(/https?:\/\/[^\s<>"']+/i)
  if (!found) return fail('Colle un lien qui commence par https://')
  const url = found[0].replace(/[),.;!?]+$/, '')
  if (!isPublicUrl(url)) return fail('Cette adresse ne peut pas être importée.')
  try {
    const { html, finalUrl } = await download(url)
    const recipe = extract(html, finalUrl)
    if (!recipe) return fail("Aucune fiche de recette trouvée sur cette page. Copie le texte de la recette et utilise « Coller le texte ».")
    return json({ recipe })
  } catch (e) {
    return fail(e?.message || 'Import impossible.')
  }
})
