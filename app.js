/**
 * CURIOSA — Application
 * Vanilla JS · PWA · Mobile-first
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   CATÉGORIES — slug (dans data.json) → label affiché
══════════════════════════════════════════════════════════════ */
const CATEGORIES = {
  histoire:     'Histoire',
  espace:       'Espace',
  sciences:     'Sciences',
  animaux:      'Animaux',
  geographie:   'Géographie',
  corps:        'Corps humain',
  psychologie:  'Psychologie',
  inventions:   'Inventions',
  technologies: 'Technologies',
  civilisation: 'Civilisation',
  records:      'Records',
};

function catLabel(slug) {
  return CATEGORIES[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1));
}

/* ══════════════════════════════════════════════════════════════
   ÉTAT GLOBAL
══════════════════════════════════════════════════════════════ */
let all      = [];    // toutes les anecdotes
let filtered = [];    // après filtre catégorie
let current  = null;  // anecdote affichée
let activeCat = 'all';
let deferredInstall = null;

/* ══════════════════════════════════════════════════════════════
   PERSISTANCE
══════════════════════════════════════════════════════════════ */
const Store = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem('curiosa_' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem('curiosa_' + key, JSON.stringify(val)); } catch {}
  },
};

/* ══════════════════════════════════════════════════════════════
   DOM
══════════════════════════════════════════════════════════════ */
const el  = id => document.getElementById(id);
const DOM = {
  card:        el('anecdote-card'),
  cardTitle:   el('card-title'),
  cardText:    el('card-text'),
  cardBadge:   el('card-badge'),
  cardNumber:  el('card-number'),
  btnNext:     el('btn-next'),
  btnFav:      el('btn-favorite'),
  btnShare:    el('btn-share'),
  btnTheme:    el('btn-theme'),
  btnMenu:     el('btn-menu'),
  btnSearch:   el('btn-search'),
  btnInstall:  el('btn-install'),
  sideMenu:    el('side-menu'),
  overlay:     el('overlay'),
  searchModal: el('search-modal'),
  searchInput: el('search-input'),
  searchRes:   el('search-results'),
  pills:       el('category-pills'),
  toast:       el('toast'),
};

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
async function init() {
  applyTheme(Store.get('theme', 'dark'));
  await loadData();
  buildPills();
  filtered = [...all];
  showRandom();
  initSwipe();
  registerSW();
  initInstallPrompt();
}

/* ══════════════════════════════════════════════════════════════
   CHARGEMENT DONNÉES
   Les catégories dans data.json sont déjà des slugs directs
   (animaux, corps, geographie, etc.) — aucune transformation.
══════════════════════════════════════════════════════════════ */
async function loadData() {
  try {
    const res  = await fetch('data.json');
    const json = await res.json();
    all = json.anecdotes; // on prend tel quel
  } catch {
    all = [{
      id: 0,
      titre: 'Hors-ligne',
      texte: 'Reconnectez-vous pour accéder aux anecdotes.',
      categorie: 'divers',
    }];
  }
}

/* ══════════════════════════════════════════════════════════════
   PILLS CATÉGORIES
══════════════════════════════════════════════════════════════ */
function buildPills() {
  // Slugs présents dans les données (Set = unicité garantie)
  const inData = new Set(all.map(a => a.categorie));

  // Ordre défini par CATEGORIES, puis inconnus en fin
  const ordered = [
    ...Object.keys(CATEGORIES).filter(s => inData.has(s)),
    ...[...inData].filter(s => !CATEGORIES[s]),
  ];

  DOM.pills.innerHTML =
    `<button class="pill active" data-cat="all">Toutes</button>` +
    ordered.map(s =>
      `<button class="pill" data-cat="${s}">${catLabel(s)}</button>`
    ).join('');

  DOM.pills.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (pill) setCategory(pill.dataset.cat);
  });
}

function setCategory(cat) {
  activeCat = cat;
  DOM.pills.querySelectorAll('.pill').forEach(p =>
    p.classList.toggle('active', p.dataset.cat === cat)
  );
  filtered = cat === 'all' ? [...all] : all.filter(a => a.categorie === cat);
  showRandom();
}

/* ══════════════════════════════════════════════════════════════
   AFFICHAGE CARTE
══════════════════════════════════════════════════════════════ */
function showRandom(dir = 'in') {
  if (!filtered.length) return;
  const pool = filtered.length > 1
    ? filtered.filter(a => !current || a.id !== current.id)
    : filtered;
  current = pool[Math.floor(Math.random() * pool.length)];
  renderCard(current, dir);
  addToHistory(current);
}

function openAnecdote(anecdote) {
  current = anecdote;
  renderCard(anecdote, 'in');
  addToHistory(anecdote);
  showPanel(null);
}

function renderCard(a, dir = 'in') {
  const c = DOM.card;
  if (dir === 'left')  c.classList.add('swipe-left');
  if (dir === 'right') c.classList.add('swipe-right');

  setTimeout(() => {
    c.classList.remove('swipe-left', 'swipe-right', 'card-enter');
    DOM.cardTitle.textContent  = a.titre;
    DOM.cardText.textContent   = a.texte;
    DOM.cardBadge.textContent  = catLabel(a.categorie);
    DOM.cardNumber.textContent = `#${a.id}`;
    refreshFavBtn(a.id);
    void c.offsetWidth;
    c.classList.add('card-enter');
  }, (dir === 'left' || dir === 'right') ? 280 : 0);
}

function refreshFavBtn(id) {
  const isFav = Store.get('favs', []).some(f => f.id === id);
  DOM.btnFav.classList.toggle('active', isFav);
}

/* ══════════════════════════════════════════════════════════════
   HISTORIQUE
══════════════════════════════════════════════════════════════ */
function addToHistory(a) {
  const hist = Store.get('hist', []);
  if (hist.length && hist[0].id === a.id) return;
  hist.unshift({ id: a.id, titre: a.titre, categorie: a.categorie });
  if (hist.length > 60) hist.pop();
  Store.set('hist', hist);
}

/* ══════════════════════════════════════════════════════════════
   FAVORIS
══════════════════════════════════════════════════════════════ */
function toggleFav(a) {
  const favs = Store.get('favs', []);
  const idx  = favs.findIndex(f => f.id === a.id);
  if (idx === -1) {
    favs.unshift({ id: a.id, titre: a.titre, texte: a.texte, categorie: a.categorie });
    toast('✦ Ajouté aux favoris');
  } else {
    favs.splice(idx, 1);
    toast('Retiré des favoris');
  }
  Store.set('favs', favs);
  refreshFavBtn(a.id);
}

/* ══════════════════════════════════════════════════════════════
   THÈME
══════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  Store.set('theme', theme);
  el('theme-meta')?.setAttribute('content', theme === 'dark' ? '#08080f' : '#f5f3ef');
}
function toggleTheme() {
  const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  toast(next === 'dark' ? '🌙 Mode sombre' : '☀️ Mode clair');
}

/* ══════════════════════════════════════════════════════════════
   PARTAGE
══════════════════════════════════════════════════════════════ */
async function share(a) {
  const text = `✦ ${a.titre}\n\n${a.texte}\n\n— Curiosa`;
  if (navigator.share) {
    try { await navigator.share({ title: a.titre, text }); } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement('textarea'),
        { value: text, style: 'position:fixed;opacity:0' });
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast('📋 Copié dans le presse-papier');
  }
}

/* ══════════════════════════════════════════════════════════════
   NAVIGATION / PANELS
══════════════════════════════════════════════════════════════ */
function showPanel(name) {
  closeMenu();
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('open'));
  if (!name) return;
  const panel = el('panel-' + name);
  if (!panel) return;
  panel.classList.add('open');
  if (name === 'all')       renderAll();
  if (name === 'favorites') renderFavorites();
  if (name === 'history')   renderHistory();
}

function openMenu() {
  DOM.sideMenu.classList.add('open');
  DOM.overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  DOM.sideMenu.classList.remove('open');
  DOM.overlay.classList.remove('active');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════════════════
   LISTES
══════════════════════════════════════════════════════════════ */
function renderAll() {
  el('all-count').textContent = all.length;
  renderList(el('list-all'), all, false);
}

function renderFavorites() {
  const favs = Store.get('favs', []);
  el('fav-count').textContent = favs.length;
  if (!favs.length) {
    el('list-favorites').innerHTML = emptyHTML('💫', 'Aucun favori.<br>Appuyez sur ♡ pour en sauvegarder.');
    return;
  }
  const items = favs.map(f => all.find(a => a.id === f.id) || f);
  renderList(el('list-favorites'), items, true);
}

function renderHistory() {
  const hist = Store.get('hist', []);
  if (!hist.length) {
    el('list-history').innerHTML = emptyHTML('📖', 'Aucune anecdote lue encore.');
    return;
  }
  const items = hist.map(h => all.find(a => a.id === h.id)).filter(Boolean);
  renderList(el('list-history'), items, false);
}

function renderList(container, items, isFav) {
  container.innerHTML = items.map(a => `
    <div class="list-card${isFav ? ' fav-card' : ''}" data-id="${a.id}">
      <div class="list-card-cat">${catLabel(a.categorie)}</div>
      <div class="list-card-title">${a.titre}</div>
      <div class="list-card-text">${a.texte || ''}</div>
    </div>`).join('');

  container.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => {
      const found = all.find(a => a.id === +card.dataset.id);
      if (found) openAnecdote(found);
    });
  });
}

function emptyHTML(icon, msg) {
  return `<div class="empty-state"><span>${icon}</span><p>${msg}</p></div>`;
}

/* ══════════════════════════════════════════════════════════════
   RECHERCHE
══════════════════════════════════════════════════════════════ */
function openSearch() {
  DOM.searchModal.classList.add('open');
  setTimeout(() => DOM.searchInput.focus(), 120);
  renderSearch('');
}
function closeSearch() {
  DOM.searchModal.classList.remove('open');
  DOM.searchInput.value = '';
}
function renderSearch(q) {
  const query = q.trim().toLowerCase();
  const results = query
    ? all.filter(a =>
        a.titre.toLowerCase().includes(query) ||
        a.texte.toLowerCase().includes(query) ||
        catLabel(a.categorie).toLowerCase().includes(query)
      )
    : all.slice(0, 30);

  if (!results.length) {
    DOM.searchRes.innerHTML = emptyHTML('🔍', `Aucun résultat pour « ${q} »`);
    return;
  }
  DOM.searchRes.innerHTML = results.map(a => `
    <div class="list-card" data-id="${a.id}">
      <div class="list-card-cat">${catLabel(a.categorie)}</div>
      <div class="list-card-title">${hl(a.titre, query)}</div>
      <div class="list-card-text">${hl(a.texte.slice(0, 110) + (a.texte.length > 110 ? '…' : ''), query)}</div>
    </div>`).join('');

  DOM.searchRes.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => {
      const found = all.find(a => a.id === +card.dataset.id);
      if (found) { closeSearch(); openAnecdote(found); }
    });
  });
}
function hl(text, q) {
  if (!q) return text;
  return text.replace(
    new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
    '<mark style="background:var(--accent-glow);color:var(--accent2);border-radius:2px">$1</mark>'
  );
}

/* ══════════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════════ */
let toastTimer;
function toast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 2600);
}

/* ══════════════════════════════════════════════════════════════
   SWIPE
══════════════════════════════════════════════════════════════ */
function initSwipe() {
  const c = DOM.card;
  const THRESHOLD = 75;
  let sx = 0, dragging = false;

  c.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    dragging = false;
  }, { passive: true });

  c.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - e.touches[0].clientY;
    if (Math.abs(dx) > 8) {
      dragging = true;
      c.style.cssText = `transform:translateX(${dx}px) rotate(${dx * 0.05}deg);transition:none`;
      const gl = c.querySelector('.swipe-glow-left');
      const gr = c.querySelector('.swipe-glow-right');
      if (gl) gl.style.opacity = dx < 0 ? Math.min(1, -dx / THRESHOLD) : 0;
      if (gr) gr.style.opacity = dx > 0 ? Math.min(1,  dx / THRESHOLD) : 0;
    }
  }, { passive: true });

  c.addEventListener('touchend', e => {
    if (!dragging) return;
    const dx = e.changedTouches[0].clientX - sx;
    c.style.cssText = '';
    const gl = c.querySelector('.swipe-glow-left');
    const gr = c.querySelector('.swipe-glow-right');
    if (gl) gl.style.opacity = 0;
    if (gr) gr.style.opacity = 0;
    if (Math.abs(dx) >= THRESHOLD) showRandom(dx < 0 ? 'left' : 'right');
  }, { passive: true });

  // Mouse drag
  let mx = 0, mDrag = false;
  c.addEventListener('mousedown', e => { mx = e.clientX; mDrag = false; });
  window.addEventListener('mousemove', e => {
    if (!mx) return;
    mDrag = true;
    const dx = e.clientX - mx;
    c.style.cssText = `transform:translateX(${dx}px) rotate(${dx * 0.04}deg);transition:none;cursor:grabbing`;
  });
  window.addEventListener('mouseup', e => {
    if (!mx) return;
    c.style.cssText = '';
    const dx = e.clientX - mx;
    mx = 0;
    if (mDrag && Math.abs(dx) >= THRESHOLD) showRandom(dx < 0 ? 'left' : 'right');
    mDrag = false;
  });
}

/* ══════════════════════════════════════════════════════════════
   CTA RIPPLE
══════════════════════════════════════════════════════════════ */
function ctaRipple() {
  DOM.btnNext.classList.remove('ripple');
  void DOM.btnNext.offsetWidth;
  DOM.btnNext.classList.add('ripple');
  setTimeout(() => DOM.btnNext.classList.remove('ripple'), 600);
}

/* ══════════════════════════════════════════════════════════════
   SERVICE WORKER
══════════════════════════════════════════════════════════════ */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(r => console.log('[SW] scope:', r.scope))
      .catch(e => console.warn('[SW] erreur:', e));
  });
}

/* ══════════════════════════════════════════════════════════════
   INSTALLATION PWA
══════════════════════════════════════════════════════════════ */
function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
}

function initInstallPrompt() {
  if (isStandalone()) { DOM.btnInstall.style.display = 'none'; return; }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    DOM.btnInstall.style.display = 'none';
    toast('🎉 Application installée !');
  });
}

async function triggerInstall() {
  closeMenu();
  if (deferredInstall) {
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') { deferredInstall = null; toast('🎉 Installation en cours…'); }
    return;
  }
  if (isIos() && !isStandalone()) { showInstallModal(true); return; }
  if (!isStandalone())            { showInstallModal(false); return; }
  toast('✓ Application déjà installée');
}

function showInstallModal(ios) {
  el('ios-install-modal')?.remove();
  const m = document.createElement('div');
  m.id = 'ios-install-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);padding:16px';
  const steps = ios
    ? ['Appuyez sur le bouton <strong>Partager</strong> (□↑) en bas de Safari',
       'Faites défiler et appuyez sur <span style="color:var(--accent2);font-weight:600">"Sur l\'écran d\'accueil"</span>',
       'Confirmez en appuyant sur <span style="color:var(--accent2);font-weight:600">"Ajouter"</span>']
    : ['Ouvrez le menu de votre navigateur <strong>(⋮)</strong>',
       'Sélectionnez <span style="color:var(--accent2);font-weight:600">"Installer"</span> ou <span style="color:var(--accent2);font-weight:600">"Ajouter à l\'écran d\'accueil"</span>'];

  m.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:24px;padding:28px 24px 32px;width:100%;max-width:420px;box-shadow:0 -8px 40px rgba(0,0,0,.5);animation:slide-up .35s cubic-bezier(.34,1.56,.64,1) forwards">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <span style="font-family:var(--font-display);font-size:18px;font-weight:600;color:var(--text)">✦ Installer Curiosa</span>
        <button id="install-close" style="width:32px;height:32px;border-radius:50%;background:var(--pill-bg);border:1px solid var(--border);color:var(--text2);font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer">×</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${steps.map((txt, i) => `
          <div style="display:flex;align-items:flex-start;gap:14px">
            <div style="min-width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--accent2)">${i+1}</div>
            <p style="color:var(--text);font-size:14px;padding-top:8px;line-height:1.5">${txt}</p>
          </div>`).join('')}
      </div>
      ${ios ? '<p style="margin-top:16px;font-size:12px;color:var(--text3);text-align:center">⚠️ Fonctionne uniquement depuis Safari</p>' : ''}
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  el('install-close').addEventListener('click', () => m.remove());
}

/* ══════════════════════════════════════════════════════════════
   ÉVÉNEMENTS — attachés après chargement du DOM
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Glows swipe
  DOM.card.insertAdjacentHTML('beforeend',
    '<div class="swipe-glow-left"></div><div class="swipe-glow-right"></div>');

  // Carte
  DOM.btnNext.addEventListener('click',  () => { ctaRipple(); showRandom('right'); });
  DOM.btnFav.addEventListener('click',   () => { if (current) toggleFav(current); });
  DOM.btnShare.addEventListener('click', () => { if (current) share(current); });

  // Header
  DOM.btnTheme.addEventListener('click',  toggleTheme);
  DOM.btnMenu.addEventListener('click',   openMenu);
  DOM.btnSearch.addEventListener('click', openSearch);

  // Menu latéral
  DOM.overlay.addEventListener('click',          closeMenu);
  el('btn-close-menu').addEventListener('click', closeMenu);
  DOM.btnInstall.addEventListener('click',       triggerInstall);

  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const view = item.dataset.view;
      if (view === 'main') showPanel(null);
      else showPanel(view);
    });
  });

  // Retour depuis les panels
  document.querySelectorAll('.back-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el('nav-main')?.classList.add('active');
      showPanel(null);
    })
  );

  // Recherche
  el('btn-close-search').addEventListener('click', closeSearch);
  DOM.searchInput.addEventListener('input', e => renderSearch(e.target.value));
  DOM.searchModal.addEventListener('click', e => {
    if (e.target === DOM.searchModal) closeSearch();
  });

  // Historique
  el('btn-clear-history').addEventListener('click', () => {
    Store.set('hist', []);
    renderHistory();
    toast('Historique effacé');
  });

  // Clavier
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (DOM.searchModal.classList.contains('open')) closeSearch();
      else showPanel(null);
    }
    if ((e.key === 'ArrowRight' || e.key === ' ')
        && !DOM.searchModal.classList.contains('open')) {
      e.preventDefault();
      showRandom('right');
    }
  });

  init();
});
