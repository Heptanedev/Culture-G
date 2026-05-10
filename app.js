/**
 * CURIOSA — Application principale
 * Vanilla JS · PWA · Mobile-first · Zéro dépendance
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   CATÉGORIES — table de correspondance slug ↔ label
══════════════════════════════════════════════════════════════ */
const CATEGORIES = {
  'histoire':     'Histoire',
  'espace':       'Espace',
  'sciences':     'Sciences',
  'animaux':      'Animaux',
  'geographie':   'Géographie',
  'corps':        'Corps humain',
  'psychologie':  'Psychologie',
  'inventions':   'Inventions',
  'technologies': 'Technologies',
  'civilisation': 'Civilisation',
  'records':      'Records',
};

/**
 * Convertit n'importe quelle chaîne catégorie (brute depuis data.json)
 * en slug canonique stable.
 * Ex: "géographie" → "geographie"  |  "corps humain" → "corps"
 */
function slugifyCat(raw) {
  if (!raw) return 'divers';
  // 1. Minuscules + suppression des accents
  const s = raw.toLowerCase().trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // 2. Correspondances explicites (ordre important)
  if (s.includes('geog') || s.includes('geo'))      return 'geographie';
  if (s.includes('corp') || s.includes('humain'))   return 'corps';
  if (s.includes('tech'))                            return 'technologies';
  if (s.includes('civil'))                           return 'civilisation';
  if (s.includes('psych'))                           return 'psychologie';
  if (s.includes('hist'))                            return 'histoire';
  if (s.includes('esp'))                             return 'espace';
  if (s.includes('sci'))                             return 'sciences';
  if (s.includes('anim'))                            return 'animaux';
  if (s.includes('inv'))                             return 'inventions';
  if (s.includes('rec'))                             return 'records';
  return s.replace(/\s+/g, '-');
}

/** Retourne le label lisible d'un slug. */
function catLabel(slug) {
  return CATEGORIES[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

/* ══════════════════════════════════════════════════════════════
   ÉTAT GLOBAL
══════════════════════════════════════════════════════════════ */
let allAnecdotes  = [];   // tableau complet normalisé
let filtered      = [];   // après filtre catégorie actif
let current       = null; // anecdote affichée
let activeCat     = 'all';
let deferredInstall = null;

/* ══════════════════════════════════════════════════════════════
   PERSISTANCE localStorage
══════════════════════════════════════════════════════════════ */
const Store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem('curiosa_' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem('curiosa_' + key, JSON.stringify(val)); } catch {}
  },
};

/* ══════════════════════════════════════════════════════════════
   RACCOURCIS DOM
══════════════════════════════════════════════════════════════ */
const el = id => document.getElementById(id);

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
   DÉMARRAGE
══════════════════════════════════════════════════════════════ */
async function init() {
  // 1. Thème
  applyTheme(Store.get('theme', 'dark'));

  // 2. Chargement + normalisation des données
  await loadData();

  // 3. Construire les pills de catégorie depuis les données réelles
  buildPills();

  // 4. Afficher une première anecdote
  filtered = [...allAnecdotes];
  showRandom();

  // 5. Swipe tactile
  initSwipe();

  // 6. Service Worker + PWA
  registerSW();
  initInstallPrompt();
}

/* ══════════════════════════════════════════════════════════════
   CHARGEMENT DES DONNÉES
══════════════════════════════════════════════════════════════ */
async function loadData() {
  try {
    const res  = await fetch('data.json');
    const json = await res.json();
    // Normalisation : on écrase la catégorie brute par le slug canonique
    allAnecdotes = json.anecdotes.map(a => ({
      ...a,
      slug: slugifyCat(a.categorie), // slug normalisé
    }));
  } catch {
    allAnecdotes = [{
      id: 0,
      titre: 'Hors-ligne',
      texte: "Vous êtes hors-ligne. Reconnectez-vous pour accéder aux anecdotes.",
      categorie: 'divers',
      slug: 'divers',
    }];
  }
}

/* ══════════════════════════════════════════════════════════════
   PILLS DE CATÉGORIE
══════════════════════════════════════════════════════════════ */
function buildPills() {
  // 1. Collecter les slugs présents dans les données (unicité garantie par Set)
  const slugsInData = [...new Set(allAnecdotes.map(a => a.slug))];

  // 2. Ordonner selon CATEGORIES (ordre d'insertion de l'objet)
  const ordered = Object.keys(CATEGORIES)
    .filter(slug => slugsInData.includes(slug))
    .concat(slugsInData.filter(slug => !CATEGORIES[slug])); // inconnus en fin

  // 3. Injecter dans le DOM
  DOM.pills.innerHTML =
    `<button class="pill active" data-cat="all">Toutes</button>` +
    ordered.map(slug =>
      `<button class="pill" data-cat="${slug}">${catLabel(slug)}</button>`
    ).join('');

  // 4. Délégation de clic (une seule fois, sur le conteneur)
  DOM.pills.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    setCategory(pill.dataset.cat);
  });
}

function setCategory(cat) {
  activeCat = cat;
  // Mise à jour visuelle
  DOM.pills.querySelectorAll('.pill').forEach(p =>
    p.classList.toggle('active', p.dataset.cat === cat)
  );
  // Filtrage
  filtered = cat === 'all'
    ? [...allAnecdotes]
    : allAnecdotes.filter(a => a.slug === cat);
  showRandom();
}

/* ══════════════════════════════════════════════════════════════
   AFFICHAGE CARTE
══════════════════════════════════════════════════════════════ */
function showRandom(direction = 'in') {
  if (!filtered.length) return;
  // Pas de répétition immédiate
  const pool = filtered.length > 1
    ? filtered.filter(a => !current || a.id !== current.id)
    : filtered;
  current = pool[Math.floor(Math.random() * pool.length)];
  renderCard(current, direction);
  addToHistory(current);
}

function openAnecdote(anecdote) {
  current = anecdote;
  renderCard(anecdote, 'in');
  addToHistory(anecdote);
  showPanel(null); // retour à l'accueil
}

function renderCard(anecdote, direction = 'in') {
  const c = DOM.card;

  if (direction === 'left')  { c.classList.add('swipe-left');  }
  if (direction === 'right') { c.classList.add('swipe-right'); }

  const delay = (direction === 'left' || direction === 'right') ? 280 : 0;

  setTimeout(() => {
    c.classList.remove('swipe-left', 'swipe-right', 'card-enter');

    DOM.cardTitle.textContent  = anecdote.titre;
    DOM.cardText.textContent   = anecdote.texte;
    DOM.cardBadge.textContent  = catLabel(anecdote.slug);
    DOM.cardNumber.textContent = `#${anecdote.id}`;
    refreshFavBtn(anecdote.id);

    void c.offsetWidth; // force reflow
    c.classList.add('card-enter');
  }, delay);
}

function refreshFavBtn(id) {
  const favs  = Store.get('favs', []);
  const isFav = favs.some(f => f.id === id);
  DOM.btnFav.classList.toggle('active', isFav);
}

/* ══════════════════════════════════════════════════════════════
   HISTORIQUE
══════════════════════════════════════════════════════════════ */
function addToHistory(anecdote) {
  const hist = Store.get('hist', []);
  if (hist.length && hist[0].id === anecdote.id) return;
  hist.unshift({ id: anecdote.id, titre: anecdote.titre, slug: anecdote.slug });
  if (hist.length > 60) hist.pop();
  Store.set('hist', hist);
}

/* ══════════════════════════════════════════════════════════════
   FAVORIS
══════════════════════════════════════════════════════════════ */
function toggleFav(anecdote) {
  const favs = Store.get('favs', []);
  const idx  = favs.findIndex(f => f.id === anecdote.id);
  if (idx === -1) {
    favs.unshift({ id: anecdote.id, titre: anecdote.titre, texte: anecdote.texte, slug: anecdote.slug });
    toast('✦ Ajouté aux favoris');
  } else {
    favs.splice(idx, 1);
    toast('Retiré des favoris');
  }
  Store.set('favs', favs);
  refreshFavBtn(anecdote.id);
}

/* ══════════════════════════════════════════════════════════════
   THÈME
══════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  Store.set('theme', theme);
  document.getElementById('theme-meta')?.setAttribute('content',
    theme === 'dark' ? '#08080f' : '#f5f3ef'
  );
}

function toggleTheme() {
  const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  toast(next === 'dark' ? '🌙 Mode sombre' : '☀️ Mode clair');
}

/* ══════════════════════════════════════════════════════════════
   PARTAGE
══════════════════════════════════════════════════════════════ */
async function share(anecdote) {
  const text = `✦ ${anecdote.titre}\n\n${anecdote.texte}\n\n— Curiosa`;
  if (navigator.share) {
    try { await navigator.share({ title: anecdote.titre, text }); } catch {}
  } else {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = Object.assign(document.createElement('textarea'),
        { value: text, style: 'position:fixed;opacity:0' });
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      ta.remove();
    }
    toast('📋 Copié dans le presse-papier');
  }
}

/* ══════════════════════════════════════════════════════════════
   NAVIGATION / PANELS
══════════════════════════════════════════════════════════════ */
function showPanel(name) {
  // Fermer le menu latéral
  DOM.sideMenu.classList.remove('open');
  DOM.overlay.classList.remove('active');
  document.body.style.overflow = '';

  // Fermer tous les panels
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('open'));

  if (!name) return; // retour accueil

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
   RENDU DES LISTES
══════════════════════════════════════════════════════════════ */
function renderAll() {
  el('all-count').textContent = allAnecdotes.length;
  renderCardList(el('list-all'), allAnecdotes, false);
}

function renderFavorites() {
  const favs = Store.get('favs', []);
  el('fav-count').textContent = favs.length;
  if (!favs.length) {
    el('list-favorites').innerHTML = emptyState('💫', 'Aucun favori.<br>Appuyez sur ♡ pour en sauvegarder.');
    return;
  }
  // Reconstruire depuis allAnecdotes pour avoir le texte complet
  const items = favs.map(f => allAnecdotes.find(a => a.id === f.id) || f);
  renderCardList(el('list-favorites'), items, true);
}

function renderHistory() {
  const hist = Store.get('hist', []);
  if (!hist.length) {
    el('list-history').innerHTML = emptyState('📖', 'Aucune anecdote lue encore.');
    return;
  }
  const items = hist
    .map(h => allAnecdotes.find(a => a.id === h.id))
    .filter(Boolean);
  renderCardList(el('list-history'), items, false);
}

function renderCardList(container, items, isFav) {
  container.innerHTML = items.map(a => `
    <div class="list-card${isFav ? ' fav-card' : ''}" data-id="${a.id}">
      <div class="list-card-cat">${catLabel(a.slug || slugifyCat(a.categorie || ''))}</div>
      <div class="list-card-title">${a.titre}</div>
      <div class="list-card-text">${a.texte || ''}</div>
    </div>`).join('');

  container.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => {
      const found = allAnecdotes.find(a => a.id === +card.dataset.id);
      if (found) openAnecdote(found);
    });
  });
}

function emptyState(icon, msg) {
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
    ? allAnecdotes.filter(a =>
        a.titre.toLowerCase().includes(query) ||
        a.texte.toLowerCase().includes(query) ||
        catLabel(a.slug).toLowerCase().includes(query)
      )
    : allAnecdotes.slice(0, 30);

  if (!results.length) {
    DOM.searchRes.innerHTML = emptyState('🔍', `Aucun résultat pour « ${q} »`);
    return;
  }

  DOM.searchRes.innerHTML = results.map(a => `
    <div class="list-card" data-id="${a.id}">
      <div class="list-card-cat">${catLabel(a.slug)}</div>
      <div class="list-card-title">${hl(a.titre, query)}</div>
      <div class="list-card-text">${hl(a.texte.slice(0, 110) + (a.texte.length > 110 ? '…' : ''), query)}</div>
    </div>`).join('');

  DOM.searchRes.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => {
      const found = allAnecdotes.find(a => a.id === +card.dataset.id);
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
   SWIPE TACTILE
══════════════════════════════════════════════════════════════ */
function initSwipe() {
  const c = DOM.card;
  const THRESHOLD = 75;
  let sx = 0, sy = 0, dragging = false;

  // Touch
  c.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    dragging = false;
  }, { passive: true });

  c.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      dragging = true;
      c.style.cssText = `transform:translateX(${dx}px) rotate(${dx * 0.05}deg);transition:none`;
      c.querySelector('.swipe-glow-left').style.opacity  = dx < 0 ? Math.min(1, -dx / THRESHOLD) : 0;
      c.querySelector('.swipe-glow-right').style.opacity = dx > 0 ? Math.min(1, dx / THRESHOLD)  : 0;
    }
  }, { passive: true });

  c.addEventListener('touchend', e => {
    if (!dragging) return;
    const dx = e.changedTouches[0].clientX - sx;
    c.style.cssText = '';
    c.querySelector('.swipe-glow-left').style.opacity  = 0;
    c.querySelector('.swipe-glow-right').style.opacity = 0;
    if (Math.abs(dx) >= THRESHOLD) showRandom(dx < 0 ? 'left' : 'right');
  }, { passive: true });

  // Mouse drag (desktop)
  let mx = 0, mDrag = false;
  c.addEventListener('mousedown', e => { mx = e.clientX; mDrag = false; c.style.cursor = 'grabbing'; });
  window.addEventListener('mousemove', e => {
    if (!c.style.cursor.includes('grabbing')) return;
    mDrag = true;
    const dx = e.clientX - mx;
    c.style.cssText = `transform:translateX(${dx}px) rotate(${dx * 0.04}deg);transition:none;cursor:grabbing`;
  });
  window.addEventListener('mouseup', e => {
    if (!c.style.cursor.includes('grabbing')) return;
    c.style.cssText = '';
    const dx = e.clientX - mx;
    if (mDrag && Math.abs(dx) >= THRESHOLD) showRandom(dx < 0 ? 'left' : 'right');
  });
}

/* ══════════════════════════════════════════════════════════════
   RIPPLE BOUTON CTA
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
      .then(r => console.log('[Curiosa] SW scope:', r.scope))
      .catch(e => console.warn('[Curiosa] SW:', e));
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
  m.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);padding:16px';
  m.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:24px;padding:28px 24px 32px;width:100%;max-width:420px;box-shadow:0 -8px 40px rgba(0,0,0,.5);animation:slide-up .35s cubic-bezier(.34,1.56,.64,1) forwards">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <span style="font-family:var(--font-display);font-size:18px;font-weight:600;color:var(--text)">✦ Installer Curiosa</span>
        <button id="install-close" style="width:32px;height:32px;border-radius:50%;background:var(--pill-bg);border:1px solid var(--border);color:var(--text2);font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer">×</button>
      </div>
      ${ios ? `
        <div style="display:flex;flex-direction:column;gap:16px">
          ${['Appuyez sur le bouton <strong>Partager</strong> (□↑) en bas de Safari',
             'Faites défiler et appuyez sur <span style="color:var(--accent2);font-weight:600">"Sur l\'écran d\'accueil"</span>',
             'Confirmez en appuyant sur <span style="color:var(--accent2);font-weight:600">"Ajouter"</span>'
            ].map((txt, i) => `
            <div style="display:flex;align-items:flex-start;gap:14px">
              <div style="min-width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:var(--accent2)">${i+1}</div>
              <p style="color:var(--text);font-size:14px;padding-top:8px;line-height:1.5">${txt}</p>
            </div>`).join('')}
        </div>
        <p style="margin-top:16px;font-size:12px;color:var(--text3);text-align:center">⚠️ Fonctionne uniquement depuis Safari</p>
      ` : `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;align-items:flex-start;gap:14px">
            <div style="min-width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:var(--accent2)">1</div>
            <p style="color:var(--text);font-size:14px;padding-top:8px">Ouvrez le menu de votre navigateur <strong>(⋮)</strong></p>
          </div>
          <div style="display:flex;align-items:flex-start;gap:14px">
            <div style="min-width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:var(--accent2)">2</div>
            <p style="color:var(--text);font-size:14px;padding-top:8px">Sélectionnez <span style="color:var(--accent2);font-weight:600">"Ajouter à l'écran d'accueil"</span> ou <span style="color:var(--accent2);font-weight:600">"Installer"</span></p>
          </div>
        </div>
      `}
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  el('install-close').addEventListener('click', () => m.remove());
}

/* ══════════════════════════════════════════════════════════════
   ÉVÉNEMENTS
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Insérer les glows de swipe dans la carte
  DOM.card.insertAdjacentHTML('beforeend',
    '<div class="swipe-glow-left"></div><div class="swipe-glow-right"></div>');

  // Carte principale
  DOM.btnNext.addEventListener('click', () => { ctaRipple(); showRandom('right'); });
  DOM.btnFav.addEventListener('click', () => { if (current) toggleFav(current); });
  DOM.btnShare.addEventListener('click', () => { if (current) share(current); });

  // Header
  DOM.btnTheme.addEventListener('click', toggleTheme);
  DOM.btnMenu.addEventListener('click', openMenu);
  DOM.btnSearch.addEventListener('click', openSearch);

  // Menu latéral
  DOM.overlay.addEventListener('click', closeMenu);
  el('btn-close-menu').addEventListener('click', closeMenu);
  DOM.btnInstall.addEventListener('click', triggerInstall);

  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      showPanel(item.dataset.view);
    });
  });

  // Boutons retour des panels
  document.querySelectorAll('.back-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el('nav-main')?.classList.add('active');
      showPanel(null);
    })
  );

  // Recherche
  DOM.btnSearch.addEventListener('click', openSearch);
  el('btn-close-search').addEventListener('click', closeSearch);
  DOM.searchInput.addEventListener('input', e => renderSearch(e.target.value));
  DOM.searchModal.addEventListener('click', e => { if (e.target === DOM.searchModal) closeSearch(); });

  // Effacer historique
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
    if ((e.key === 'ArrowRight' || e.key === ' ') && !DOM.searchModal.classList.contains('open')) {
      e.preventDefault();
      showRandom('right');
    }
  });

  // Démarrer
  init();
});
