import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/manrope'
import './style.css'
import { registerSW } from 'virtual:pwa-register'
import * as Store from './store.js'
import { AISLES, AISLE_HUE, UNITS, DAYS, SLOTS, HUES, PROFILES, CATS, FIBRE_MEAL } from './data.js'
import {
  esc, norm, kf, initials, fmt, iso, weekDays, todayIso, mealKey, buildList,
  mealBudget, level, LV, profileOf, macroPct, compat, fitCls, fitLbl, dayState, cats, estimate, floorKcal
} from './logic.js'

const { state } = Store
registerSW({ immediate: true })

const UI = { tab: 'recettes', q: '', light: null, week: 0, sheet: null, addDay: 0, addSlot: 'soir', confirm: null, ingN: 0, install: null, busy: false, authMode: 'login', msg: '' }
const $ = id => document.getElementById(id)
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/* ---------- Icônes ---------- */
const ICON = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 11h2M20 11h2M9 7c0-1.2 1-1.6 1-3M14 7c0-1.2 1-1.6 1-3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L21 8H6.3"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  tick: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>'
}

/* ---------- Petits utilitaires ---------- */
const byId = id => state.recipes.find(r => r.id === id)
const days = () => weekDays(UI.week)
const dayIsos = () => days().map(iso)
const fd = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const lvTag = r => { const l = level(r, state.diet); return l ? `<span class="lv ${l}">${LV[l]}</span>` : '' }
const ctags = i => cats(i).map(c => `<span class="ctag c-${c}">${CATS[c]}</span>`).join('')
const thumb = r => `<div class="thumb" style="--h:${r.hue}">${esc(initials(r.name))}</div>`
const inWeek = id => dayIsos().some(d => SLOTS.some(([s]) => state.meals[mealKey(d, s)]?.recipe_id === id))
function dayKcal(day) {
  let k = 0, n = 0, miss = 0
  SLOTS.forEach(([s]) => { const m = state.meals[mealKey(day, s)], r = m && byId(m.recipe_id); if (!r) return; n++; if (r.nutri) k += r.nutri.kcal; else miss++ })
  return { k, n, miss }
}
let tt
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true }, 2400) }
function weekLabel() {
  if (UI.week === 0) return 'Cette semaine'
  if (UI.week === 1) return 'Semaine prochaine'
  if (UI.week === -1) return 'Semaine dernière'
  return 'Semaine du ' + fd(days()[0])
}
const weekNav = () => `<div class="weeknav"><button class="wbtn" data-action="wk" data-d="-1" aria-label="Semaine précédente">${ICON.prev}</button>
  <span>Du ${fd(days()[0])} au ${fd(days()[6])}</span><button class="wbtn" data-action="wk" data-d="1" aria-label="Semaine suivante">${ICON.next}</button>
  ${UI.week ? '<button class="btn sm" data-action="wk" data-d="0">Aujourd’hui</button>' : ''}</div>`

/* ---------- Rendu principal ---------- */
// Garde le champ en cours de saisie (focus, texte, curseur) quand l'écran est redessiné
function keepFocus(fn) {
  const a = document.activeElement, id = a?.id, val = a?.value, s = a?.selectionStart, e = a?.selectionEnd
  const saved = [...$('app').querySelectorAll('input[id], select[id]')].map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value, el.type])
  fn()
  saved.forEach(([i, v, t]) => { const el = $(i); if (!el || i === 'q') return; if (t === 'checkbox') { if (!el.dataset.key) el.checked = v } else el.value = v })
  if (!id) return
  const el = $(id); if (!el || el === a) return
  if (val != null && 'value' in el) el.value = val
  el.focus({ preventScroll: true })
  try { if (s != null) el.setSelectionRange(s, e) } catch { }
}

function render() {
  keepFocus(() => {
    const app = $('app')
    if (state.recovery) app.innerHTML = vRecovery()
    else if (state.phase === 'loading') app.innerHTML = vSplash()
    else if (state.phase === 'error') app.innerHTML = vError()
    else if (state.phase === 'auth') app.innerHTML = vAuth()
    else if (state.phase === 'household') app.innerHTML = vHousehold()
    else renderApp(app)
  })
  if (UI.sheet && ['detail', 'pick', 'account'].includes(UI.sheet.type)) renderSheet()
}

function renderApp(app) {
  const items = buildList(state, days())
  const left = items.filter(i => !state.checks[i.key]).length
  let status = ''
  if (state.mode === 'local') status = '<span class="chip">Local</span>'
  else if (!state.online) status = '<span class="chip warn">Hors ligne</span>'
  else if (state.pending) status = '<span class="chip">Synchro…</span>'
  const T = { recettes: 'Recettes', planning: weekLabel(), courses: 'Courses' }[UI.tab]
  const sub = { recettes: state.recipes.length + ' recette' + (state.recipes.length > 1 ? 's' : ''), planning: '', courses: left + ' article' + (left > 1 ? 's' : '') + ' à acheter' }[UI.tab]
  const body = UI.tab === 'recettes' ? vRecettes() : UI.tab === 'planning' ? vPlanning(items) : vCourses(items)
  app.innerHTML = `<header class="top"><div class="wrap">
    <div class="brand"><span class="logo" aria-hidden="true">${ICON.logo}</span><h1>Popote</h1></div>
    <div class="hright">${status}
      <button class="hbtn ${state.diet.on ? 'on' : ''}" data-action="diet" aria-label="Rééquilibrage alimentaire">${ICON.leaf}<span>Équilibre</span></button>
      <button class="ibtn" data-action="account" aria-label="Compte et foyer">${ICON.user}</button></div>
  </div></header>
  <main><div class="wrap">
    <div class="phead"><h2>${T}</h2>${sub ? `<p>${sub}</p>` : ''}${UI.tab !== 'recettes' ? weekNav() : ''}</div>
    ${body}
  </div></main>
  <nav class="tabs" aria-label="Navigation"><div class="tabs-in">
    ${[['recettes', 'Recettes', ICON.book], ['planning', 'Planning', ICON.cal], ['courses', 'Courses', ICON.cart]].map(([k, l, ic]) =>
      `<button class="tab" data-action="tab" data-tab="${k}" aria-current="${UI.tab === k ? 'page' : 'false'}">${ic}${l}${k === 'courses' && left ? `<span class="badge">${left}</span>` : ''}</button>`).join('')}
  </div></nav>`
  if (UI.tab === 'recettes') renderGrid()
}

/* ---------- Écrans hors appli ---------- */
const vSplash = () => `<div class="center"><span class="logo big">${ICON.logo}</span><p class="meta">Chargement…</p></div>`
const vError = () => `<div class="center"><span class="logo big">${ICON.logo}</span><h2>Oups</h2><p class="meta">${esc(state.error || 'Une erreur est survenue.')}</p><button class="btn primary" data-action="retry">Réessayer</button></div>`

function vAuth() {
  const login = UI.authMode === 'login'
  return `<div class="center"><div class="authcard">
    <span class="logo big">${ICON.logo}</span>
    <h2>Popote</h2>
    <p class="meta">${login ? 'Connecte-toi pour retrouver tes recettes et ta liste partagée.' : 'Crée ton compte, puis invite ton proche dans ton foyer.'}</p>
    <form id="authform" novalidate>
      <label>Email<input id="a-email" type="email" autocomplete="email" inputmode="email" required></label>
      <label>Mot de passe<input id="a-pw" type="password" autocomplete="${login ? 'current-password' : 'new-password'}" minlength="6" required></label>
      <p class="err" id="a-err">${esc(UI.msg)}</p>
      <button class="btn primary block" type="submit" ${UI.busy ? 'disabled' : ''}>${UI.busy ? 'Un instant…' : login ? 'Se connecter' : 'Créer mon compte'}</button>
    </form>
    ${login ? '<button class="btn ghost block" data-action="forgot">Mot de passe oublié ?</button>' : ''}
    <button class="btn ghost block" data-action="authmode">${login ? 'Pas encore de compte ? Créer un compte' : "J'ai déjà un compte"}</button>
  </div></div>`
}

const vRecovery = () => `<div class="center"><div class="authcard">
    <span class="logo big">${ICON.logo}</span><h2>Nouveau mot de passe</h2>
    <p class="meta">Choisis un nouveau mot de passe pour ton compte.</p>
    <form id="pwform" novalidate><label>Nouveau mot de passe<input id="p-pw" type="password" autocomplete="new-password" minlength="6"></label>
    <p class="err" id="p-err">${esc(UI.msg)}</p><button class="btn primary block" type="submit" ${UI.busy ? 'disabled' : ''}>Enregistrer</button></form></div></div>`

function vHousehold() {
  return `<div class="center"><div class="authcard wide">
    <span class="logo big">${ICON.logo}</span>
    <h2>Ton foyer</h2>
    <p class="meta">Le foyer regroupe les personnes qui partagent recettes, planning et courses.</p>
    <form id="hcreate" class="hcard" novalidate><h3>Créer un foyer</h3>
      <label>Nom du foyer<input id="h-name" placeholder="ex. La maison" autocomplete="off"></label>
      <label class="check"><input type="checkbox" id="h-seed" checked> Ajouter les 8 recettes d'exemple</label>
      <button class="btn primary block" type="submit" ${UI.busy ? 'disabled' : ''}>Créer</button></form>
    <form id="hjoin" class="hcard" novalidate><h3>Rejoindre un foyer</h3>
      <label>Code d'invitation<input id="h-code" placeholder="ex. 4F9A2C" maxlength="6" autocapitalize="characters" autocomplete="off" class="code"></label>
      <button class="btn block" type="submit" ${UI.busy ? 'disabled' : ''}>Rejoindre</button></form>
    <p class="err" id="h-err">${esc(UI.msg)}</p>
    <button class="btn ghost block" data-action="signout-now">Se déconnecter</button>
  </div></div>`
}

/* ---------- Recettes ---------- */
function vRecettes() {
  const on = state.diet.on
  return `<div class="toolbar"><label class="sfield">${ICON.search}<input class="search" id="q" type="search" placeholder="Chercher une recette ou un ingrédient" value="${esc(UI.q)}" aria-label="Chercher"></label>
  <button class="btn primary" data-action="new-recipe">+ Recette</button></div>
  ${on ? `<div class="choose" style="margin-bottom:12px">
      <button class="opt" data-action="flt" data-f="all" aria-pressed="${!UI.light}">Toutes</button>
      <button class="opt" data-action="flt" data-f="light" aria-pressed="${UI.light === 'light'}">Légères & équilibrées</button>
      <button class="opt" data-action="flt" data-f="fit" aria-pressed="${UI.light === 'fit'}">Adaptées : ${profileOf(state.diet).name.toLowerCase()}</button>
      <span class="meta" style="align-self:center">Repère : ${kf(mealBudget(state.diet))} kcal par repas</span></div>`
    : `<button class="promo" data-action="diet"><b>Rééquilibrage alimentaire</b><span>Calories, équilibre des repas et astuces pour alléger tes recettes</span></button>`}
  <div class="grid" id="grid"></div>`
}
function renderGrid() {
  const g = $('grid'); if (!g) return
  const q = norm(UI.q), on = state.diet.on, D = state.diet
  const list = state.recipes
    .filter(r => !q || norm(r.name).includes(q) || r.ingredients.some(i => norm(i.name).includes(q)))
    .filter(r => { if (!on || !UI.light) return true; if (UI.light === 'fit') return (compat(r, D) ?? 0) >= 80; const l = level(r, D); return l === 'leger' || l === 'equi' })
    .sort((a, b) => on && UI.light === 'fit' ? (compat(b, D) ?? 0) - (compat(a, D) ?? 0) : 0)
  if (!state.recipes.length) { g.innerHTML = `<p class="empty" style="grid-column:1/-1">Aucune recette pour l'instant. Ajoute la première avec « + Recette ».</p>`; return }
  g.innerHTML = list.length ? list.map(r => {
    const m = r.nutri && macroPct(r.nutri), c = compat(r, D)
    return `<button class="card" data-action="open" data-id="${r.id}">
      <div class="thumb" style="--h:${r.hue}">${esc(initials(r.name))}${inWeek(r.id) ? '<span class="onmenu">Au menu</span>' : ''}</div>
      <div class="card-body"><h3>${esc(r.name)}</h3><span class="meta">${r.servings} pers. · ${r.time} min · ${r.ingredients.length} ingr.</span>
      ${on ? `<span class="kline">${r.nutri ? `<span class="meta">${kf(r.nutri.kcal)} kcal/portion</span>${lvTag(r)}` : '<span class="meta">kcal non renseignées</span>'}</span>
        ${m ? `<span class="mstrip" title="Protéines ${Math.round(m.p)} % · Glucides ${Math.round(m.g)} % · Lipides ${Math.round(m.l)} %"><i class="mp" style="width:${m.p}%"></i><i class="mg" style="width:${m.g}%"></i><i class="ml" style="width:${m.l}%"></i></span>
        <span class="meta fitline"><span class="${fitCls(c)}">${c} %</span> adapté · P ${Math.round(m.p)} / G ${Math.round(m.g)} / L ${Math.round(m.l)}</span>` : ''}` : ''}
      </div></button>`
  }).join('') : `<p class="empty" style="grid-column:1/-1">Aucune recette ne correspond.</p>`
}

/* ---------- Planning ---------- */
function vPlanning(items) {
  const ds = days(), t = todayIso(), on = state.diet.on, D = state.diet
  const meals = ds.flatMap(d => SLOTS.map(([s]) => state.meals[mealKey(iso(d), s)]).filter(Boolean))
  let diet = ''
  if (on) {
    const all = meals.map(m => byId(m.recipe_id)).filter(Boolean), known = all.filter(r => r.nutri)
    const avg = known.length ? known.reduce((a, r) => a + r.nutri.kcal, 0) / known.length : 0
    const heavy = all.filter(r => level(r, D) === 'copieux').length, lowP = known.filter(r => r.nutri.p < 15).length
    diet = `<div class="dsum"><div class="dsum-top"><div><span class="meta">Objectif</span><strong>${kf(D.target)} kcal/jour</strong></div><button class="btn sm" data-action="diet">Réglages</button></div>
      <div class="dsum-grid"><div><span class="meta">Moyenne par repas</span><b>${known.length ? kf(avg) + ' kcal' : '–'}</b><span class="meta">repère ${kf(mealBudget(D))}</span></div>
      <div><span class="meta">Repas copieux</span><b class="${heavy ? 't-warn' : ''}">${heavy}</b><span class="meta">sur ${all.length}</span></div>
      <div><span class="meta">Peu protéinés</span><b class="${lowP ? 't-warn' : ''}">${lowP}</b><span class="meta">à compléter</span></div></div></div>`
  }
  return `${diet}<div class="summary"><div><strong>${meals.length} repas prévus</strong><div class="meta">${items.length} articles sur la liste de courses</div></div>
    <button class="btn sm" data-action="tab" data-tab="courses">Voir la liste</button></div>
  <div class="days">${ds.map((dt, i) => {
    const d = iso(dt), today = d === t
    let dk = ''
    if (on) { const x = dayKcal(d); if (x.n) dk = `<span class="dk ${dayState(x.k, x.n, D)}" title="Déjeuner + dîner prévus / repère">${kf(x.k)}<small> / ${kf(x.n * mealBudget(D))} kcal${x.miss ? ' *' : ''}</small></span>` }
    return `<section class="day ${today ? 'today' : ''}">
      <div class="day-h"><span class="dbub"><b>${dt.getDate()}</b><small>${DAYS[i].slice(0, 3)}</small></span><div class="dtitle"><h3>${DAYS[i]}</h3><span class="date">${dt.toLocaleDateString('fr-FR', { month: 'long' })}</span></div>${today ? '<span class="pill">Aujourd’hui</span>' : ''}${dk}</div>
      ${SLOTS.map(([s, l]) => {
        const m = state.meals[mealKey(d, s)], r = m && byId(m.recipe_id)
        return `<div class="slot"><span class="slot-l">${l}</span>${r ? `<div class="meal">${thumb(r)}
          <div class="meal-mid"><button class="meal-name" data-action="open" data-id="${r.id}" data-srv="${m.servings}">${esc(r.name)}${on && r.nutri ? `<small class="${level(r, D)}">${kf(r.nutri.kcal)} kcal · ${LV[level(r, D)].toLowerCase()}</small>` : ''}</button>
          <span class="stepper"><button data-action="pdec" data-d="${d}" data-s="${s}" aria-label="Moins de portions">−</button><span>${m.servings} p.</span><button data-action="pinc" data-d="${d}" data-s="${s}" aria-label="Plus de portions">+</button></span></div>
          <button class="x" data-action="prem" data-d="${d}" data-s="${s}" aria-label="Retirer ce repas">×</button></div>`
          : `<button class="add-slot" data-action="pick" data-d="${d}" data-s="${s}">+ Choisir une recette</button>`}</div>`
      }).join('')}</section>`
  }).join('')}</div>`
}

/* ---------- Courses ---------- */
function vCourses(items) {
  const done = items.filter(i => state.checks[i.key]).length, pct = items.length ? Math.round(done / items.length * 100) : 0
  const groups = AISLES.map(a => [a, items.filter(i => (AISLES.includes(i.aisle) ? i.aisle : 'Autres') === a)]).filter(([, l]) => l.length)
  return `<div class="progress"><div class="progress-top"><strong>${done} / ${items.length}</strong><span class="meta">dans le caddie</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
  <form class="addline" id="addline"><input class="search" id="m-name" placeholder="Ajouter un article (ex. lessive)" aria-label="Article" autocomplete="off">
    <select id="m-aisle" aria-label="Rayon">${AISLES.map(a => `<option${a === 'Autres' ? ' selected' : ''}>${a}</option>`).join('')}</select>
    <button class="btn primary" type="submit">Ajouter</button></form>
  ${items.length ? groups.map(([a, l]) => {
    l.sort((x, y) => (!!state.checks[x.key] - !!state.checks[y.key]) || x.name.localeCompare(y.name, 'fr'))
    return `<section class="aisle"><h2><span><i class="adot" style="--h:${AISLE_HUE[a]}"></i>${a}</span><span>${l.filter(i => !state.checks[i.key]).length}</span></h2><div class="list">${l.map(it => {
      const c = !!state.checks[it.key], id = 'c-' + it.key.replace(/[^a-z0-9]/gi, '_')
      return `<div class="item ${c ? 'done' : ''}"><label for="${id}"><input type="checkbox" id="${id}" data-key="${esc(it.key)}" ${c ? 'checked' : ''}><span class="box">${ICON.tick}</span>
        <span class="item-txt"><span class="item-name">${esc(it.name)}</span>${it.merged ? '<span class="merged">fusionné</span>' : ''}<div class="item-src">${esc(it.src.join(' · '))}</div></span>
        ${it.qty ? `<span class="qty">${esc(it.qty)}</span>` : ''}</label>${it.manual ? `<button class="x" data-action="mdel" data-id="${it.id}" aria-label="Supprimer ${esc(it.name)}">×</button>` : ''}</div>`
    }).join('')}</div></section>`
  }).join('') : '<p class="empty">Ta liste est vide. Ajoute des repas au planning de cette semaine pour la remplir automatiquement.</p>'}
  ${done ? '<button class="btn ghost block" data-action="uncheck">Tout décocher</button>' : ''}`
}

/* ---------- Feuilles ---------- */
function openSheet(s) { UI.sheet = s; UI.confirm = null; renderSheet(); $('sheet-wrap').hidden = false }
function closeSheet() { UI.sheet = null; $('sheet-wrap').hidden = true }

function renderSheet() {
  const s = UI.sheet, b = $('sheet-body'); if (!s) return
  const D = state.diet
  if (s.type === 'detail') {
    const r = byId(s.id); if (!r) return closeSheet()
    const f = s.srv / r.servings, ds = days()
    b.innerHTML = `<div class="sheet-head">${thumb(r)}<div><h2>${esc(r.name)}</h2><div class="meta">${r.time} min · recette pour ${r.servings}</div></div></div>
    <div class="srv-row"><span><b>Portions</b><div class="meta">Les quantités s'adaptent</div></span>
      <span class="stepper"><button data-action="sdec" aria-label="Moins">−</button><span>${s.srv} pers.</span><button data-action="sinc" aria-label="Plus">+</button></span></div>
    ${D.on ? vNutrition(r) : ''}
    <div class="sec"><h3>Ingrédients</h3><div class="clegend">${Object.entries(CATS).map(([c, l]) => `<span class="ctag c-${c}">${l}</span>`).join('')}</div>
      <ul class="ings">${r.ingredients.map(g => `<li><span class="iname"><span>${esc(g.name)}</span><span class="ctags">${ctags(g)}</span></span><span class="qty">${esc(fmt(g.qty * f, g.unit, 'recipe'))}</span></li>`).join('')}</ul></div>
    ${r.steps.length ? `<div class="sec"><h3>Préparation</h3><ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
    <div class="sec"><h3>Ajouter au planning · ${weekLabel().toLowerCase()}</h3>
      <div class="choose">${ds.map((d, i) => `<button class="opt" data-action="aday" data-i="${i}" aria-pressed="${UI.addDay === i}">${DAYS[i].slice(0, 3)} ${d.getDate()}</button>`).join('')}</div>
      <div class="choose">${SLOTS.map(([k, l]) => `<button class="opt" data-action="aslot" data-s="${k}" aria-pressed="${UI.addSlot === k}">${l}</button>`).join('')}</div>
      <button class="btn primary block" data-action="addplan">Ajouter ${DAYS[UI.addDay].toLowerCase()} ${UI.addSlot} · ${s.srv} pers.</button></div>
    <div class="actions"><button class="btn ghost" data-action="close">Fermer</button><span style="flex:1"></span>
      <button class="btn sm" data-action="edit-recipe">Modifier</button>
      <button class="btn sm ${UI.confirm === 'del' ? 'danger' : 'ghost'}" data-action="delrecipe">${UI.confirm === 'del' ? 'Confirmer la suppression' : 'Supprimer'}</button></div>`
  }
  if (s.type === 'pick') {
    const dt = new Date(s.d + 'T12:00:00')
    b.innerHTML = `<h2 class="stitle">${DAYS[(dt.getDay() + 6) % 7]} ${dt.getDate()} · ${s.s}</h2><p class="meta" style="margin:0 0 14px">Choisis le repas</p>
    ${state.recipes.length ? `<div class="picker">${state.recipes.map(r => `<button class="pick" data-action="choose" data-id="${r.id}">${thumb(r)}<span><b>${esc(r.name)}</b><span class="meta">${r.servings} pers. · ${r.time} min${D.on && r.nutri ? ' · ' + kf(r.nutri.kcal) + ' kcal' : ''}</span></span></button>`).join('')}</div>`
      : '<p class="empty">Aucune recette. Crée d’abord une recette dans l’onglet Recettes.</p>'}
    <div class="actions"><button class="btn ghost block" data-action="close">Annuler</button></div>`
  }
  if (s.type === 'diet') b.innerHTML = vDietSheet()
  if (s.type === 'form') { b.innerHTML = vForm(s.id ? byId(s.id) : null) }
  if (s.type === 'account') b.innerHTML = vAccount()
}

function vNutrition(r) {
  const D = state.diet
  if (!r.nutri) return `<div class="sec"><h3>Nutrition</h3><p class="meta" style="margin:0">Calories non renseignées. Ajoute-les avec « Modifier ».</p></div>`
  const n = r.nutri, m = macroPct(n), P = profileOf(D), c = compat(r, D), B = mealBudget(D), pct = Math.round(n.kcal / B * 100)
  const src = k => r.ingredients.filter(i => cats(i).includes(k)).map(i => i.name.toLowerCase())
  const srcLine = k => { const s = src(k); return s.length ? `<div class="msrc">Apporté par ${esc(s.join(', '))}</div>` : '' }
  const rows = m ? [['p', 'Protéines', 4, 'mp'], ['g', 'Glucides', 4, 'mg'], ['l', 'Lipides', 9, 'ml']].map(([k, lbl, kc, cls]) => {
    const tg = Math.round(B * P[k] / 100 / kc), d = Math.round(m[k] - P[k]), ok = Math.abs(d) <= 5
    return `<div class="mrow"><div class="mrow-h"><span>${lbl}</span><b>${Math.round(m[k])} %<small> / ${P[k]} %</small></b></div>
      <div class="mtrack"><i class="${cls}" style="width:${Math.min(100, m[k])}%"></i><em style="left:${P[k]}%" aria-hidden="true"></em></div>
      <div class="meta mrow-f"><span>${n[k]} g · repère ${tg} g</span><span class="${ok ? 'd-ok' : 'd-off'}">${ok ? 'dans la cible' : (d > 0 ? '+' : '') + d + ' pts'}</span></div>${srcLine(k)}</div>`
  }).join('') : ''
  const fib = n.f != null ? `<div class="mrow"><div class="mrow-h"><span>Fibres</span><b>${n.f} g<small> / ${FIBRE_MEAL} g</small></b></div>
    <div class="mtrack"><i class="mf" style="width:${Math.min(100, n.f / FIBRE_MEAL * 100)}%"></i></div>${srcLine('f')}</div>` : ''
  return `<div class="sec"><h3>Nutrition · 1 portion</h3><div class="nut">
    <div class="nut-top"><div><strong>${kf(n.kcal)}</strong> kcal</div>${lvTag(r)}</div>
    <p class="meta" style="margin:0 0 12px">${pct} % de ton repère repas (${kf(B)} kcal)${n.p < 15 ? ' · peu de protéines' : ''}</p>
    ${m ? `<button class="fitbox" data-action="diet"><span>Profil <b>${P.name}</b></span><span class="fitscore ${fitCls(c)}">${c} % · ${fitLbl(c)}</span></button>` : ''}
    ${rows}${fib}
    ${m ? '<p class="meta legend"><em aria-hidden="true"></em> repère de ton profil · % des calories apportées par chaque nutriment</p>' : ''}
    ${r.tip ? `<div class="tip"><b>Pour alléger</b>${esc(r.tip)}</div>` : ''}</div></div>`
}

function vDietSheet() {
  const d = state.diet, p = d.prof, est = estimate(p), t35 = Math.round(d.target * .35 / 10) * 10
  return `<h2 class="stitle">Rééquilibrage alimentaire</h2>
  <p class="meta" style="margin:0 0 14px">Affiche les calories et l'équilibre de chaque repas, avec des astuces pour alléger tes recettes. Ces réglages sont personnels : ton proche a les siens.</p>
  <div class="srv-row"><span><b>Activer le suivi</b><div class="meta">Recettes, planning et repères</div></span>
    <button class="switch" role="switch" aria-checked="${d.on}" data-action="dtoggle" aria-label="Activer le rééquilibrage"><i></i></button></div>
  <form id="dform" novalidate>
  <div class="sec"><h3>Profil d'équilibre</h3><div class="profs">${Object.entries(PROFILES).map(([k, P]) => `<button type="button" class="prof" data-action="dprof" data-p="${k}" aria-pressed="${(d.profile || 'equi') === k}">
    <span class="prof-h"><b>${P.name}</b><span class="meta">P ${P.p} · G ${P.g} · L ${P.l} %</span></span><span class="mstrip"><i class="mp" style="width:${P.p}%"></i><i class="mg" style="width:${P.g}%"></i><i class="ml" style="width:${P.l}%"></i></span><span class="meta">${P.desc}</span></button>`).join('')}</div></div>
  <div class="sec"><h3>Estimer mon objectif</h3>
    <div class="choose">${[['F', 'Femme'], ['H', 'Homme']].map(([k, l]) => `<button type="button" class="opt" data-action="dsexe" data-s="${k}" aria-pressed="${p.sexe === k}">${l}</button>`).join('')}</div>
    <div class="row3"><label>Âge<input id="d-age" type="number" min="16" max="100" value="${p.age}" inputmode="numeric"></label>
    <label>Taille (cm)<input id="d-taille" type="number" min="120" max="230" value="${p.taille}" inputmode="numeric"></label>
    <label>Poids (kg)<input id="d-poids" type="number" min="35" max="300" step="0.1" value="${p.poids}" inputmode="decimal"></label></div>
    <label>Activité<select id="d-act">${[['1.2', 'Sédentaire (bureau, peu de marche)'], ['1.375', 'Légère (sport 1 à 3 fois/sem.)'], ['1.55', 'Modérée (sport 3 à 5 fois/sem.)'], ['1.725', 'Élevée (sport quotidien, métier physique)']].map(([v, l]) => `<option value="${v}"${p.act === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="est" id="d-est">${estText(est)}</div>
    <button type="button" class="btn sm" data-action="duse" id="d-use">Utiliser ${kf(est.target)} kcal comme objectif</button>
  </div>
  <div class="sec"><h3>Objectif quotidien</h3>
    <label>Calories par jour<input id="d-target" type="number" min="1200" max="4000" step="50" value="${d.target}" inputmode="numeric"></label>
    <div class="split"><div><b>${kf(t35)}</b><span class="meta">Déjeuner</span></div><div><b>${kf(t35)}</b><span class="meta">Dîner</span></div><div><b>${kf(Math.round(d.target * .3 / 10) * 10)}</b><span class="meta">Petit-déj. + collations</span></div></div>
  </div>
  <p class="meta" style="margin:16px 0 0">Repères indicatifs, valeurs estimées pour les recettes d'exemple. Le déficit reste modéré (perte visée autour de 0,5 kg par semaine) et l'objectif ne descend jamais sous 1 200 kcal (femme) ou 1 500 kcal (homme). Pour un suivi personnalisé, parles-en à ton médecin ou à un diététicien.</p>
  <div class="actions"><button type="button" class="btn ghost" data-action="close">Fermer</button><span style="flex:1"></span><button class="btn primary" type="submit">Enregistrer</button></div></form>`
}
const estText = e => `Dépense estimée : <b>${kf(e.tdee)} kcal/jour</b>. Objectif conseillé : <b>${kf(e.target)} kcal/jour</b>.`

function vForm(r) {
  UI.ingN = 0
  const n = r?.nutri || {}
  return `<form id="rform" novalidate><h2 class="stitle">${r ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
    <label>Nom<input id="f-name" placeholder="ex. Gratin dauphinois" value="${esc(r?.name || '')}"></label>
    <div class="row2"><label>Portions<input id="f-serv" type="number" min="1" value="${r?.servings || 4}" inputmode="numeric"></label><label>Temps (min)<input id="f-time" type="number" min="0" value="${r?.time ?? 30}" inputmode="numeric"></label></div>
    <fieldset><legend>Ingrédients</legend><div id="ing-rows"></div><button type="button" class="btn sm" data-action="addrow">+ Ingrédient</button></fieldset>
    <fieldset><legend>Nutrition par portion (optionnel)</legend><div class="row4">
      <label>kcal<input id="f-kcal" type="number" min="0" inputmode="numeric" value="${n.kcal ?? ''}"></label><label>Protéines (g)<input id="f-p" type="number" min="0" inputmode="numeric" value="${n.p ?? ''}"></label>
      <label>Glucides (g)<input id="f-g" type="number" min="0" inputmode="numeric" value="${n.g ?? ''}"></label><label>Lipides (g)<input id="f-l" type="number" min="0" inputmode="numeric" value="${n.l ?? ''}"></label>
      <label>Fibres (g)<input id="f-f" type="number" min="0" inputmode="numeric" value="${n.f ?? ''}"></label></div></fieldset>
    <label>Étapes (une par ligne)<textarea id="f-steps" placeholder="Éplucher les pommes de terre…">${esc((r?.steps || []).join('\n'))}</textarea></label>
    <label>Astuce pour alléger (optionnel)<input id="f-tip" value="${esc(r?.tip || '')}"></label>
    <p class="err" id="f-err"></p>
    <div class="actions"><button type="button" class="btn ghost" data-action="close">Annuler</button><span style="flex:1"></span><button class="btn primary" type="submit">Enregistrer</button></div></form>`
}
function addRow(g) {
  const n = UI.ingN++, box = $('ing-rows'), d = document.createElement('div'); d.className = 'ing-row'
  d.innerHTML = `<input class="q" id="iq-${n}" type="number" min="0" step="any" placeholder="Qté" aria-label="Quantité" value="${g?.qty ?? ''}">
  <select class="u" id="iu-${n}" aria-label="Unité">${UNITS.map(u => `<option${u === (g?.unit || 'g') ? ' selected' : ''}>${u}</option>`).join('')}</select>
  <input class="n" id="in-${n}" placeholder="Ingrédient" aria-label="Ingrédient" value="${esc(g?.name || '')}">
  <select class="a" id="ia-${n}" aria-label="Rayon">${AISLES.map(a => `<option${a === (g?.aisle || 'Épicerie') ? ' selected' : ''}>${a}</option>`).join('')}</select>
  <select class="c" id="ic-${n}" aria-label="Apport principal"><option value="">Apport : auto</option>${Object.entries(CATS).map(([c, l]) => `<option value="${c}"${g?.cat === c ? ' selected' : ''}>${l}</option>`).join('')}</select>
  <button type="button" class="x" data-action="delrow" aria-label="Retirer">×</button>`
  box.appendChild(d)
}

function vAccount() {
  const cloud = state.mode === 'cloud', h = state.household
  let install = ''
  if (isStandalone()) install = '<p class="meta" style="margin:0">Popote est installée sur cet appareil.</p>'
  else if (UI.install) install = '<button class="btn primary block" data-action="install">Installer Popote sur cet appareil</button>'
  else if (isIOS()) install = '<p class="meta" style="margin:0">Dans Safari, touche le bouton Partager puis « Sur l’écran d’accueil ».</p>'
  else install = '<p class="meta" style="margin:0">Dans le menu du navigateur, choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p>'
  return `<h2 class="stitle">${cloud ? 'Compte et foyer' : 'Réglages'}</h2>
  ${cloud ? `<div class="sec"><h3>Foyer</h3><div class="nut">
      <div class="nut-top"><div><b style="font-size:18px">${esc(h?.name || '')}</b><div class="meta">${esc(state.user?.email || '')}</div></div></div>
      <p class="meta" style="margin:12px 0 6px">Code d'invitation à donner à ton proche. Il crée son compte, puis choisit « Rejoindre un foyer ».</p>
      <div class="invite"><span class="code-big" id="invite">${esc(h?.invite_code || '')}</span><button class="btn sm" data-action="copy">Copier</button></div>
    </div></div>
    <div class="sec"><h3>Synchronisation</h3><p class="meta" style="margin:0">${!state.online ? 'Hors ligne. Tes modifications seront envoyées au retour du réseau.' : state.pending ? state.pending + ' modification(s) en cours d’envoi…' : 'Tout est à jour.'}</p></div>`
    : `<div class="sec"><h3>Mode local</h3><p class="meta" style="margin:0 0 10px">Les données restent sur cet appareil. Configure Supabase (voir le guide) pour partager avec ton proche.</p>
      <button class="btn sm ${UI.confirm === 'reset' ? 'danger' : ''}" data-action="reset">${UI.confirm === 'reset' ? 'Confirmer : remettre les exemples' : 'Remettre les recettes d’exemple'}</button></div>`}
  <div class="sec"><h3>Installation</h3>${install}</div>
  <div class="actions"><button class="btn ghost" data-action="close">Fermer</button><span style="flex:1"></span>
  ${cloud ? `<button class="btn sm ${UI.confirm === 'out' ? 'danger' : ''}" data-action="signout">${UI.confirm === 'out' ? 'Confirmer la déconnexion' : 'Se déconnecter'}</button>` : ''}</div>`
}

/* ---------- Lecture des formulaires ---------- */
function readProf() {
  const p = state.diet.prof
  ;['age', 'taille', 'poids'].forEach(k => { const el = $('d-' + k); if (el) p[k] = parseFloat(el.value) || p[k] })
  const a = $('d-act'); if (a) p.act = a.value
}
function readTarget() {
  const el = $('d-target'); if (!el) return
  state.diet.target = Math.min(4000, Math.max(floorKcal(state.diet.prof.sexe), Math.round((parseFloat(el.value) || state.diet.target) / 10) * 10))
}

/* ---------- Événements ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-action]'); if (!t) return
  const a = t.dataset.action, ds = t.dataset
  if (!['reset', 'delrecipe', 'signout'].includes(a)) UI.confirm = null
  switch (a) {
    case 'tab': UI.tab = ds.tab; closeSheet(); render(); scrollTo(0, 0); break
    case 'wk': UI.week = ds.d === '0' ? 0 : UI.week + (+ds.d); render(); break
    case 'open': { const r = byId(ds.id); UI.addDay = UI.week === 0 ? (new Date().getDay() + 6) % 7 : 0; openSheet({ type: 'detail', id: ds.id, srv: +ds.srv || r.servings }); break }
    case 'close': closeSheet(); render(); break
    case 'sdec': UI.sheet.srv = Math.max(1, UI.sheet.srv - 1); renderSheet(); break
    case 'sinc': UI.sheet.srv = Math.min(30, UI.sheet.srv + 1); renderSheet(); break
    case 'aday': UI.addDay = +ds.i; renderSheet(); break
    case 'aslot': UI.addSlot = ds.s; renderSheet(); break
    case 'addplan': {
      const d = dayIsos()[UI.addDay], had = state.meals[mealKey(d, UI.addSlot)]
      Store.setMeal(d, UI.addSlot, { recipe_id: UI.sheet.id, servings: UI.sheet.srv })
      closeSheet(); render(); toast((had ? 'Remplacé : ' : 'Ajouté : ') + DAYS[UI.addDay].toLowerCase() + ' ' + UI.addSlot); break
    }
    case 'pick': openSheet({ type: 'pick', d: ds.d, s: ds.s }); break
    case 'choose': { const r = byId(ds.id), s = UI.sheet; Store.setMeal(s.d, s.s, { recipe_id: r.id, servings: r.servings }); closeSheet(); render(); toast(r.name + ' ajouté'); break }
    case 'pdec': { const m = state.meals[mealKey(ds.d, ds.s)]; Store.setMeal(ds.d, ds.s, { ...m, servings: Math.max(1, m.servings - 1) }); break }
    case 'pinc': { const m = state.meals[mealKey(ds.d, ds.s)]; Store.setMeal(ds.d, ds.s, { ...m, servings: Math.min(30, m.servings + 1) }); break }
    case 'prem': Store.setMeal(ds.d, ds.s, null); break
    case 'mdel': Store.deleteItem(ds.id); break
    case 'uncheck': Store.clearChecks(dayIsos()[0]); break
    case 'flt': UI.light = ds.f === 'all' ? null : ds.f; render(); break
    case 'new-recipe': openSheet({ type: 'form' }); addRow(); addRow(); addRow(); setTimeout(() => $('f-name')?.focus(), 60); break
    case 'edit-recipe': { const r = byId(UI.sheet.id); openSheet({ type: 'form', id: r.id }); r.ingredients.forEach(addRow); addRow(); break }
    case 'addrow': addRow(); break
    case 'delrow': t.closest('.ing-row').remove(); break
    case 'delrecipe':
      if (UI.confirm !== 'del') { UI.confirm = 'del'; renderSheet(); break }
      { const n = byId(UI.sheet.id)?.name; Store.deleteRecipe(UI.sheet.id); UI.confirm = null; closeSheet(); render(); toast(n + ' supprimée') } break
    case 'diet': openSheet({ type: 'diet' }); break
    case 'dtoggle': readProf(); readTarget(); Store.saveDiet({ ...state.diet, on: !state.diet.on }); renderSheet(); render(); toast(state.diet.on ? 'Rééquilibrage activé' : 'Rééquilibrage désactivé'); break
    case 'dprof': readProf(); readTarget(); Store.saveDiet({ ...state.diet, profile: ds.p }); renderSheet(); render(); break
    case 'dsexe': readProf(); readTarget(); state.diet.prof.sexe = ds.s; renderSheet(); break
    case 'duse': { readProf(); const est = estimate(state.diet.prof); $('d-target').value = est.target; toast('Objectif : ' + kf(est.target) + ' kcal'); break }
    case 'account': openSheet({ type: 'account' }); break
    case 'copy': {
      const code = state.household?.invite_code || ''
      try { await navigator.clipboard.writeText(code); toast('Code copié') }
      catch { const r = document.createRange(); r.selectNodeContents($('invite')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Code sélectionné, copie-le') }
      break
    }
    case 'install': if (UI.install) { UI.install.prompt(); const c = await UI.install.userChoice; UI.install = null; if (c.outcome === 'accepted') toast('Popote installée'); renderSheet() } break
    case 'reset':
      if (UI.confirm !== 'reset') { UI.confirm = 'reset'; renderSheet(); break }
      Store.seedLocal(); UI.confirm = null; closeSheet(); render(); toast('Exemples restaurés'); break
    case 'signout':
      if (UI.confirm !== 'out') { UI.confirm = 'out'; renderSheet(); break }
      UI.confirm = null; closeSheet(); await Store.signOut(); break
    case 'signout-now': await Store.signOut(); break
    case 'authmode': UI.authMode = UI.authMode === 'login' ? 'signup' : 'login'; UI.msg = ''; render(); break
    case 'retry': Store.retry(); break
    case 'forgot': {
      const email = $('a-email').value.trim()
      if (!email) { $('a-err').textContent = 'Saisis ton email ci-dessus, puis touche « Mot de passe oublié ? ».'; break }
      await busy(async () => { await Store.sendReset(email); throw new Error('Email envoyé. Ouvre le lien reçu pour choisir un nouveau mot de passe.') }, 'a-err')
      break
    }
  }
})

document.addEventListener('change', e => {
  const k = e.target.dataset?.key; if (k == null) return
  Store.setCheck(k, e.target.checked)
})

document.addEventListener('input', e => {
  if (e.target.id === 'q') { UI.q = e.target.value; renderGrid() }
  if (/^d-(age|taille|poids|act)$/.test(e.target.id)) {
    readProf(); const est = estimate(state.diet.prof)
    $('d-est').innerHTML = estText(est); $('d-use').textContent = 'Utiliser ' + kf(est.target) + ' kcal comme objectif'
  }
})

async function busy(fn, errId) {
  UI.busy = true; UI.msg = ''; render()
  try { await fn() } catch (err) { UI.msg = err.message || String(err) }
  UI.busy = false; render()
  if (UI.msg && $(errId)) $(errId).textContent = UI.msg
}

document.addEventListener('submit', async e => {
  e.preventDefault()
  const id = e.target.id
  if (id === 'authform') {
    const email = $('a-email').value.trim(), pw = $('a-pw').value
    if (!email || pw.length < 6) { $('a-err').textContent = 'Saisis ton email et un mot de passe de 6 caractères minimum.'; return }
    await busy(async () => {
      if (UI.authMode === 'login') await Store.signIn(email, pw)
      else if (await Store.signUp(email, pw) === 'confirm') { UI.authMode = 'login'; throw new Error('Compte créé. Ouvre le lien de confirmation reçu par email, puis connecte-toi.') }
    }, 'a-err')
  }
  if (id === 'pwform') {
    const pw = $('p-pw').value
    if (pw.length < 6) { $('p-err').textContent = 'Au moins 6 caractères.'; return }
    await busy(async () => { await Store.setPassword(pw); toast('Mot de passe modifié') }, 'p-err')
  }
  if (id === 'hcreate') await busy(() => Store.createHousehold($('h-name').value.trim(), $('h-seed').checked), 'h-err')
  if (id === 'hjoin') {
    const code = $('h-code').value.trim()
    if (code.length !== 6) { $('h-err').textContent = 'Le code fait 6 caractères.'; return }
    await busy(() => Store.joinHousehold(code), 'h-err')
  }
  if (id === 'addline') {
    const n = $('m-name').value.trim(); if (!n) return
    Store.addItem(n, $('m-aisle').value); $('m-name').value = ''; $('m-name').focus(); toast(n + ' ajouté à la liste')
  }
  if (id === 'dform') {
    readProf()
    const floor = floorKcal(state.diet.prof.sexe), typed = parseFloat($('d-target').value) || 0
    readTarget()
    Store.saveDiet({ ...state.diet, on: true }); closeSheet(); render()
    toast(typed && typed < floor ? 'Objectif relevé au minimum de ' + kf(floor) + ' kcal' : 'Objectif enregistré : ' + kf(state.diet.target) + ' kcal/jour')
  }
  if (id === 'rform') {
    const err = $('f-err'), name = $('f-name').value.trim()
    const ings = [...document.querySelectorAll('.ing-row')].map(r => ({
      name: r.querySelector('.n').value.trim(), qty: parseFloat(String(r.querySelector('.q').value).replace(',', '.')),
      unit: r.querySelector('.u').value, aisle: r.querySelector('.a').value, ...(r.querySelector('.c').value ? { cat: r.querySelector('.c').value } : {})
    })).filter(i => i.name && i.qty > 0)
    if (!name) { err.textContent = 'Donne un nom à la recette.'; return }
    if (!ings.length) { err.textContent = 'Ajoute au moins un ingrédient avec une quantité.'; return }
    const old = UI.sheet.id ? byId(UI.sheet.id) : null
    const nv = k => Math.max(0, parseFloat($(k).value) || 0), kc = nv('f-kcal')
    const r = {
      id: old?.id, name, servings: Math.max(1, parseInt($('f-serv').value) || 4), time: Math.max(0, parseInt($('f-time').value) || 0),
      hue: old?.hue ?? HUES[state.recipes.length % HUES.length], ingredients: ings,
      steps: $('f-steps').value.split('\n').map(s => s.trim()).filter(Boolean),
      nutri: kc ? { kcal: kc, p: nv('f-p'), g: nv('f-g'), l: nv('f-l'), f: nv('f-f') } : null, tip: $('f-tip').value.trim()
    }
    const saved = Store.saveRecipe(r)
    render(); openSheet({ type: 'detail', id: saved.id, srv: saved.servings }); toast(old ? 'Recette mise à jour' : 'Recette enregistrée')
  }
})

document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.sheet) { closeSheet(); render() } })
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); UI.install = e; if (UI.sheet?.type === 'account') renderSheet() })

Store.subscribe(render)
render()
Store.init()
