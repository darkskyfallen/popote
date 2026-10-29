// État de l'appli + synchronisation Supabase
// - Mode local (sans Supabase) : tout est gardé dans le navigateur.
// - Mode cloud : mise à jour immédiate de l'écran, écriture en file d'attente (rejouée quand le réseau revient),
//   copie locale pour un démarrage instantané et hors-ligne, temps réel entre les membres du foyer.
import { supabase, hasSupabase } from './supabase.js'
import { SEED_RECIPES, defDiet } from './data.js'
import { uid, mealKey, iso, weekDays } from './logic.js'

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } },
  del(k) { try { localStorage.removeItem(k) } catch { } }
}

export const state = {
  mode: hasSupabase ? 'cloud' : 'local',
  phase: 'loading', // loading | auth | household | ready | error
  user: null, household: null,
  recipes: [], meals: {}, items: [], checks: {},
  diet: defDiet(),
  online: navigator.onLine, pending: 0, error: null, recovery: false
}
const subs = new Set()
export const subscribe = f => { subs.add(f); return () => subs.delete(f) }
const emit = () => subs.forEach(f => f())

/* ---------- Copie locale ---------- */
const dataKey = () => state.mode === 'local' ? 'popote-local' : `popote-cache-${state.household?.id}`
const dietKey = () => state.mode === 'local' ? 'popote-diet' : `popote-diet-${state.user?.id}`
function persist() {
  if (state.mode === 'local' || state.household) LS.set(dataKey(), { recipes: state.recipes, meals: state.meals, items: state.items, checks: state.checks })
}
function loadCache() {
  const c = LS.get(dataKey(), null)
  Object.assign(state, { recipes: c?.recipes || [], meals: c?.meals || {}, items: c?.items || [], checks: c?.checks || {} })
  return !!c
}
const loadDiet = () => { state.diet = { ...defDiet(), ...LS.get(dietKey(), {}) }; state.diet.prof = { ...defDiet().prof, ...state.diet.prof } }

/* ---------- File d'écriture ---------- */
const QKEY = 'popote-queue'
let queue = LS.get(QKEY, [])
state.pending = queue.length
let flushing = false
const isNetwork = e => !navigator.onLine || /fetch|network|load failed|timeout/i.test(e?.message || '')

function enqueue(op) {
  if (state.mode !== 'cloud') return
  queue.push(op); LS.set(QKEY, queue); state.pending = queue.length
  flush()
}
function exec(op) {
  const t = supabase.from(op.table)
  if (op.t === 'upsert') return t.upsert(op.row)
  let q = t.delete()
  for (const [k, v] of Object.entries(op.match || {})) q = q.eq(k, v)
  for (const [k, v] of Object.entries(op.like || {})) q = q.like(k, v)
  return q
}
export async function flush() {
  if (flushing || !supabase || !queue.length || !navigator.onLine) return
  flushing = true
  try {
    while (queue.length) {
      let res
      try { res = await exec(queue[0]) } catch (e) { res = { error: e } }
      if (res.error) {
        if (isNetwork(res.error)) break
        // Colonne « source » pas encore ajoutée dans Supabase : on enregistre la recette sans le lien d'origine
        if (queue[0].table === 'recipes' && queue[0].row && 'source' in queue[0].row && /source/i.test(res.error.message || '')) {
          delete queue[0].row.source; LS.set(QKEY, queue); continue
        }
        console.warn('Popote : modification refusée par le serveur', queue[0], res.error)
        state.error = res.error.message
      }
      queue.shift(); LS.set(QKEY, queue); state.pending = queue.length
    }
  } finally { flushing = false; emit() }
}

/* ---------- Lecture depuis Supabase ---------- */
const fromRecipe = r => ({ id: r.id, name: r.name, servings: r.servings, time: r.time, hue: r.hue, ingredients: r.ingredients || [], steps: r.steps || [], nutri: r.nutri, tip: r.tip || '', source: r.source || '' })
const toRecipe = r => ({ id: r.id, household_id: state.household?.id, name: r.name, servings: r.servings, time: r.time, hue: r.hue, ingredients: r.ingredients, steps: r.steps, nutri: r.nutri || null, tip: r.tip || null, ...(r.source ? { source: r.source } : {}), updated_at: new Date().toISOString() })

async function refresh() {
  if (state.mode !== 'cloud' || !state.household || !navigator.onLine) return
  await flush()
  if (queue.length) return // encore hors-ligne : on garde la copie locale
  const h = state.household.id
  try {
    const [r, m, i, c] = await Promise.all([
      supabase.from('recipes').select('*').eq('household_id', h).order('created_at', { ascending: false }),
      supabase.from('meals').select('*').eq('household_id', h),
      supabase.from('shopping_items').select('*').eq('household_id', h).order('created_at'),
      supabase.from('shopping_checks').select('key').eq('household_id', h)
    ])
    const err = r.error || m.error || i.error || c.error
    if (err) throw err
    state.recipes = r.data.map(fromRecipe)
    state.meals = Object.fromEntries(m.data.map(x => [mealKey(x.day, x.slot), { recipe_id: x.recipe_id, servings: x.servings }]))
    state.items = i.data.map(x => ({ id: x.id, name: x.name, aisle: x.aisle, qty: x.qty || '' }))
    state.checks = Object.fromEntries(c.data.map(x => [x.key, true]))
    persist(); emit()
  } catch (e) { if (!isNetwork(e)) console.warn('Popote : lecture impossible', e) }
}
let refreshTimer
const scheduleRefresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 250) }

let channel = null
function listen() {
  if (channel) supabase.removeChannel(channel)
  const h = state.household.id
  channel = supabase.channel('popote-' + h)
  for (const table of ['recipes', 'meals', 'shopping_items', 'shopping_checks']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${h}` }, scheduleRefresh)
  }
  channel.subscribe()
}

async function loadSettings() {
  try {
    const { data } = await supabase.from('user_settings').select('diet').eq('user_id', state.user.id).maybeSingle()
    if (data?.diet) { state.diet = { ...defDiet(), ...data.diet }; LS.set(dietKey(), state.diet); emit() }
  } catch { }
}

/* ---------- Démarrage et session ---------- */
export async function init() {
  window.addEventListener('online', () => { state.online = true; emit(); refresh() })
  window.addEventListener('offline', () => { state.online = false; emit() })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleRefresh() })

  if (!hasSupabase) {
    if (!loadCache()) seedLocal()
    loadDiet(); state.phase = 'ready'; emit(); return
  }
  const { data: { session } } = await supabase.auth.getSession()
  await onSession(session?.user || null)
  supabase.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') { state.recovery = true; emit() }
    const u = session?.user || null
    if ((u?.id || null) !== (state.user?.id || null)) setTimeout(() => onSession(u), 0)
  })
}

async function onSession(u) {
  state.user = u; state.error = null
  if (!u) {
    if (channel) { supabase.removeChannel(channel); channel = null }
    Object.assign(state, { household: null, recipes: [], meals: {}, items: [], checks: {}, phase: 'auth' }); emit(); return
  }
  loadDiet()
  const hKey = 'popote-household-' + u.id
  const cached = LS.get(hKey, null)
  if (cached) { state.household = cached; loadCache(); state.phase = 'ready' } else state.phase = 'loading'
  emit()
  try {
    const { data, error } = await supabase.from('household_members')
      .select('joined_at, households(id, name, invite_code)').eq('user_id', u.id).order('joined_at').limit(1)
    if (error) throw error
    const h = data?.[0]?.households
    if (!h) { LS.del(hKey); state.household = null; state.phase = 'household'; emit(); return }
    await setHousehold(h)
    loadSettings()
  } catch (e) {
    if (!cached) { state.phase = 'error'; state.error = isNetwork(e) ? 'Pas de connexion. Popote a besoin du réseau pour le premier démarrage.' : e.message; emit() }
  }
}

async function setHousehold(h) {
  const changed = state.household?.id !== h.id
  state.household = h
  LS.set('popote-household-' + state.user.id, h)
  if (changed) loadCache()
  state.phase = 'ready'; emit()
  listen()
  await refresh()
}
export const retry = () => onSession(state.user)

/* ---------- Compte et foyer ---------- */
const AUTH_MSG = [
  [/invalid login credentials/i, 'Email ou mot de passe incorrect.'],
  [/email not confirmed/i, "Ton email n'est pas encore confirmé. Ouvre le lien reçu par mail."],
  [/already registered|already exists/i, 'Un compte existe déjà avec cet email. Connecte-toi.'],
  [/password should be at least/i, 'Le mot de passe doit faire au moins 6 caractères.'],
  [/unable to validate email|invalid email/i, "Cette adresse email n'est pas valide."],
  [/rate limit|too many/i, 'Trop de tentatives. Réessaie dans quelques minutes.'],
  [/fetch|network/i, 'Pas de connexion internet.'],
  [/code introuvable/i, "Ce code d'invitation n'existe pas. Vérifie les 6 caractères."]
]
export const frError = e => { const m = e?.message || String(e); return (AUTH_MSG.find(([re]) => re.test(m)) || [, m])[1] }

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(frError(error))
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } })
  if (error) throw new Error(frError(error))
  return data.session ? 'ok' : 'confirm'
}
export async function sendReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] })
  if (error) throw new Error(frError(error))
}
export async function setPassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(frError(error))
  state.recovery = false; emit()
}
export async function signOut() {
  await supabase.auth.signOut()
}
export async function createHousehold(name, withSeed) {
  const { data, error } = await supabase.rpc('create_household', { p_name: name })
  if (error) throw new Error(frError(error))
  const h = Array.isArray(data) ? data[0] : data
  if (withSeed) {
    const rows = SEED_RECIPES.map(r => ({ ...r, id: uid(), household_id: h.id }))
    const { error: e2 } = await supabase.from('recipes').insert(rows)
    if (e2) console.warn('Popote : recettes d’exemple non ajoutées', e2)
  }
  await setHousehold({ id: h.id, name: h.name, invite_code: h.invite_code })
}
export async function joinHousehold(code) {
  const { data, error } = await supabase.rpc('join_household', { p_code: code })
  if (error) throw new Error(frError(error))
  const h = Array.isArray(data) ? data[0] : data
  await setHousehold({ id: h.id, name: h.name, invite_code: h.invite_code })
}

/* ---------- Modifications ---------- */
const commit = () => { persist(); emit() }
const H = () => state.household?.id

export function saveRecipe(r) {
  if (!r.id) r.id = uid()
  const i = state.recipes.findIndex(x => x.id === r.id)
  if (i >= 0) state.recipes[i] = r; else state.recipes.unshift(r)
  commit()
  enqueue({ t: 'upsert', table: 'recipes', row: toRecipe(r) })
  return r
}
export function deleteRecipe(id) {
  state.recipes = state.recipes.filter(r => r.id !== id)
  for (const [k, m] of Object.entries(state.meals)) if (m.recipe_id === id) delete state.meals[k]
  commit()
  enqueue({ t: 'delete', table: 'recipes', match: { id } })
}
export function setMeal(day, slot, meal) {
  const k = mealKey(day, slot)
  if (meal) state.meals[k] = meal; else delete state.meals[k]
  commit()
  if (meal) enqueue({ t: 'upsert', table: 'meals', row: { household_id: H(), day, slot, recipe_id: meal.recipe_id, servings: meal.servings } })
  else enqueue({ t: 'delete', table: 'meals', match: { household_id: H(), day, slot } })
}
export function addItem(name, aisle, qty = '') {
  const it = { id: uid(), name, aisle, qty }
  state.items.push(it); commit()
  enqueue({ t: 'upsert', table: 'shopping_items', row: { ...it, household_id: H() } })
}
export function deleteItem(id) {
  state.items = state.items.filter(i => i.id !== id); delete state.checks['m:' + id]; commit()
  enqueue({ t: 'delete', table: 'shopping_items', match: { id } })
  enqueue({ t: 'delete', table: 'shopping_checks', match: { household_id: H(), key: 'm:' + id } })
}
export function setCheck(key, on) {
  if (on) state.checks[key] = true; else delete state.checks[key]
  commit()
  if (on) enqueue({ t: 'upsert', table: 'shopping_checks', row: { household_id: H(), key } })
  else enqueue({ t: 'delete', table: 'shopping_checks', match: { household_id: H(), key } })
}
export function clearChecks(week) {
  for (const k of Object.keys(state.checks)) if (k.startsWith(week + '|') || k.startsWith('m:')) delete state.checks[k]
  commit()
  enqueue({ t: 'delete', table: 'shopping_checks', match: { household_id: H() }, like: { key: week + '|%' } })
  enqueue({ t: 'delete', table: 'shopping_checks', match: { household_id: H() }, like: { key: 'm:%' } })
}
export function saveDiet(d) {
  state.diet = d; LS.set(dietKey(), d); emit()
  if (state.user) enqueue({ t: 'upsert', table: 'user_settings', row: { user_id: state.user.id, diet: d, updated_at: new Date().toISOString() } })
}

/* ---------- Mode local : exemples ---------- */
export function seedLocal() {
  state.recipes = SEED_RECIPES.map(r => ({ ...JSON.parse(JSON.stringify(r)), id: uid() }))
  const d = weekDays(0).map(iso), R = n => state.recipes.find(r => r.name.startsWith(n))
  const plan = [[0, 'soir', 'Spaghetti', 4], [1, 'soir', 'Ratatouille', 4], [2, 'midi', 'Quiche', 3], [3, 'soir', 'Curry', 4], [4, 'soir', 'Saumon', 2], [6, 'midi', 'Crêpes', 6]]
  state.meals = {}
  plan.forEach(([i, s, n, sv]) => { state.meals[mealKey(d[i], s)] = { recipe_id: R(n).id, servings: sv } })
  state.items = [{ id: uid(), name: 'Café moulu', aisle: 'Épicerie', qty: '250 g' }, { id: uid(), name: 'Essuie-tout', aisle: 'Autres', qty: '' }]
  state.checks = {}
  commit()
}

/* ---------- Import depuis un site ---------- */
export async function importUrl(url) {
  if (!supabase) throw new Error("L'import par lien demande la synchronisation Supabase. Utilise « Coller le texte ».")
  if (!navigator.onLine) throw new Error('Pas de connexion internet.')
  let res
  try { res = await supabase.functions.invoke('import-recipe', { body: { url } }) } catch (e) { throw new Error('Import impossible : ' + (e?.message || e)) }
  const { data, error } = res
  if (error) {
    const st = error.context?.status
    let msg = ''
    try { msg = (await error.context?.json?.())?.error || '' } catch { }
    if (msg) throw new Error(msg)
    if (st === 404) throw new Error("La fonction d'import n'est pas encore installée dans Supabase (voir le guide).")
    if (st === 401) throw new Error("Supabase a refusé l'accès à la fonction d'import. Désactive « Verify JWT » dans ses réglages (voir le guide), ou reconnecte-toi.")
    if (/fetch|network|failed to send/i.test(error.message || '')) throw new Error("Impossible de joindre la fonction d'import. Vérifie ta connexion, ou qu'elle est bien installée dans Supabase.")
    throw new Error('Import impossible : ' + error.message)
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.recipe) throw new Error('Aucune recette trouvée sur cette page.')
  return data.recipe
}
