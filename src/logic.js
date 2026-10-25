// Calculs purs : unités, quantités, dates, liste de courses, nutrition
import { SLOTS, PROFILES, ICAT_RAW, CRULES } from './data.js'

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) }))
export const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').trim().replace(/s$/, '')
export const nf = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR')
export const kf = n => Math.round(n).toLocaleString('fr-FR')
export const initials = n => n.split(/[\s&']+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('') || n[0].toUpperCase()

/* ---------- Unités ---------- */
const COUNT = new Set(['pièce', 'gousse', 'botte', 'boîte', 'pincée'])
const SPOON = new Set(['c. à s.', 'c. à c.'])
export function base(u) {
  switch (u) {
    case 'g': return ['g', 1]; case 'kg': return ['g', 1000]
    case 'ml': return ['ml', 1]; case 'cl': return ['ml', 10]; case 'l': return ['ml', 1000]
    default: return [u, 1]
  }
}
// mode 'recipe' : arrondi au demi ; mode 'shop' : unités entières à acheter
export function fmt(q, unit, mode) {
  const [bu, m] = base(unit); let v = q * m
  if (bu === 'g') { if (v >= 1000) return nf(Math.round(v / 50) * 50 / 1000) + ' kg'; v = v >= 50 ? Math.round(v / 5) * 5 : Math.round(v); return nf(Math.max(v, 1)) + ' g' }
  if (bu === 'ml') { if (v >= 1000) return nf(Math.round(v / 50) * 50 / 1000) + ' L'; return nf(Math.max(Math.round(v / 10), 1)) + ' cl' }
  if (COUNT.has(unit)) { v = mode === 'shop' ? Math.ceil(v - 0.01) : Math.max(0.5, Math.round(v * 2) / 2); return nf(v) + (unit === 'pièce' ? '' : ' ' + unit + (v > 1 ? 's' : '')) }
  if (SPOON.has(unit)) { v = Math.max(0.5, Math.round(v * 2) / 2); return nf(v) + ' ' + unit }
  return nf(Math.round(v * 10) / 10) + (unit ? ' ' + unit : '')
}

/* ---------- Dates (semaine du lundi au dimanche, en heure locale) ---------- */
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function weekDays(offset = 0) {
  const d = new Date(); d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x })
}
export const todayIso = () => iso(new Date())
export const mealKey = (day, slot) => `${day}|${slot}`

/* ---------- Liste de courses ---------- */
// Additionne les ingrédients des repas de la semaine, fusionne par nom normalisé + unité de base
export function buildList(state, days) {
  const map = new Map(), byId = id => state.recipes.find(r => r.id === id)
  const week = iso(days[0])
  days.forEach(d => SLOTS.forEach(([s]) => {
    const m = state.meals[mealKey(iso(d), s)]; if (!m) return
    const r = byId(m.recipe_id); if (!r) return
    const f = m.servings / r.servings
    r.ingredients.forEach(g => {
      const [bu, mul] = base(g.unit), k = norm(g.name) + '|' + bu
      let e = map.get(k)
      if (!e) { e = { key: k, name: g.name, unit: bu, qty: 0, aisle: g.aisle || 'Autres', src: new Set() }; map.set(k, e) }
      e.qty += g.qty * mul * f; e.src.add(r.name)
    })
  }))
  const items = [...map.values()].map(e => ({ key: week + '|' + e.key, name: e.name, aisle: e.aisle, qty: fmt(e.qty, e.unit, 'shop'), src: [...e.src], merged: e.src.size > 1 }))
  state.items.forEach(m => items.push({ key: 'm:' + m.id, id: m.id, name: m.name, aisle: m.aisle, qty: m.qty || '', src: ['Ajout manuel'], manual: true }))
  return items
}

/* ---------- Nutrition ---------- */
export const mealBudget = diet => Math.round(diet.target * 0.35 / 10) * 10
export function level(r, diet) { const k = r.nutri?.kcal; if (!k) return null; const b = mealBudget(diet); return k <= b * .8 ? 'leger' : k <= b * 1.1 ? 'equi' : 'copieux' }
export const LV = { leger: 'Léger', equi: 'Équilibré', copieux: 'Copieux' }
export const profileOf = diet => PROFILES[diet?.profile] || PROFILES.equi
export function macroPct(n) { const t = n.p * 4 + n.g * 4 + n.l * 9; if (!t) return null; return { p: n.p * 4 / t * 100, g: n.g * 4 / t * 100, l: n.l * 9 / t * 100 } }
export function compat(r, diet) {
  const m = r.nutri && macroPct(r.nutri); if (!m) return null
  const P = profileOf(diet)
  return Math.max(0, Math.round(100 - (Math.abs(m.p - P.p) + Math.abs(m.g - P.g) + Math.abs(m.l - P.l))))
}
export const fitCls = c => c >= 80 ? 'fit-hi' : c >= 60 ? 'fit-mid' : 'fit-lo'
export const fitLbl = c => c >= 80 ? 'Très adapté' : c >= 60 ? 'Correct' : 'Peu adapté'
export const dayState = (k, n, diet) => { const b = n * mealBudget(diet); return k > b * 1.1 ? 'over' : k < b * .75 ? 'under' : 'ok' }

const ICAT = {}; Object.entries(ICAT_RAW).forEach(([k, v]) => { ICAT[norm(k)] = v })
export function cats(i) {
  if (i.cat) return i.cat.split(',')
  const k = norm(i.name)
  if (ICAT[k]) return ICAT[k].split(',')
  for (const [re, c] of CRULES) if (re.test(k)) return c.split(',')
  return []
}

// Métabolisme de base (Mifflin-St Jeor) × activité, déficit modéré plafonné à 500 kcal, plancher de sécurité
export const floorKcal = sexe => sexe === 'H' ? 1500 : 1200
export function estimate(p) {
  const a = +p.age || 35, h = +p.taille || 165, w = +p.poids || 70
  const tdee = (10 * w + 6.25 * h - 5 * a + (p.sexe === 'H' ? 5 : -161)) * (+p.act || 1.375)
  return { tdee: Math.round(tdee / 10) * 10, target: Math.max(floorKcal(p.sexe), Math.round((tdee - Math.min(500, tdee * .2)) / 50) * 50) }
}
