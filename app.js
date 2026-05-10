/**
 * CURIOSA — App principale
 * Vanilla JS · PWA · Mobile-first
 */

/* ══════════════════════════════════════════════════════════════
   STATE & CONSTANTS
══════════════════════════════════════════════════════════════ */

let anecdotes = [];        // Toutes les anecdotes chargées
let filtered  = [];        // Anecdotes après filtre catégorie
let current   = null;      // Anecdote affichée actuellement
let deferredInstall = null;// Prompt PWA install

// État persistant en localStorage
const STATE = {
  get favorites() { return JSON.parse(localStorage.getItem('curiosa_favs') || '[]'); },
  set favorites(v){ localStorage.setItem('curiosa_favs', JSON.stringify(v)); },

  get history()   { return JSON.parse(localStorage.getItem('curiosa_hist') || '[]'); },
  set history(v)  { localStorage.setItem('curiosa_hist', JSON.stringify(v)); },

  get theme()     { return localStorage.getItem('curiosa_theme') || 'dark'; },
  set theme(v)    { localStorage.setItem('curiosa_theme', v); },


};

/* ══════════════════════════════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const card        = $('anecdote-card');
const cardTitle   = $('card-title');
const cardText    = $('card-text');
const cardBadge   = $('card-badge');
const cardNumber  = $('card-number');
const btnNext     = $('btn-next');
const btnFav      = $('btn-favorite');
const btnShare    = $('btn-share');
const btnTheme    = $('btn-theme');
const btnMenu     = $('btn-menu');
const btnSearch   = $('btn-search');
const sideMenu    = $('side-menu');
const overlay     = $('overlay');
const searchModal = $('search-modal');
const searchInput = $('search-input');
const searchRes   = $('search-results');
const toast       = $('toast');
const catPills    = $('category-pills');

/* ══════════════════════════════════════════════════════════════
   CATEGORY CONFIG
   Canonical slug → label affiché
══════════════════════════════════════════════════════════════ */
const CAT_LABELS = {
  'histoire':    'Histoire',
  'espace':      'Espace',
  'sciences':    'Sciences',
  'animaux':     'Animaux',
  'geographie':  'Géographie',
  'corps':       'Corps humain',
  'psychologie': 'Psychologie',
  'inventions':  'Inventions',
  'technologies':'Technologies',
  'civilisation':'Civilisation',
  'records':     'Records',
};

// Normalise une catégorie brute (depuis data.json) vers son slug canonique
function normalizeCat(raw) {
  const s = raw.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // supprime accents
    .replace(/\s+/g, ' ');
  if (s.includes('geogr') || s.includes('géogr')) return 'geographie';
  if (s.includes('corps') || s.includes('humain')) return 'corps';
  if (s.includes('techn')) return 'technologies';
  if (s.includes('civ'))   return 'civilisation';
  if (s.includes('psych')) return 'psychologie';
  if (s.includes('hist'))  return 'histoire';
  if (s.includes('esp'))   return 'espace';
  if (s.includes('sci'))   return 'sciences';
  if (s.includes('ani'))   return 'animaux';
  if (s.includes('inv'))   return 'inventions';
  if (s.includes('rec'))   return 'records';
  return s; // fallback : garder le slug brut
}

// Construire les pills dynamiquement depuis les catégories présentes dans les données
function buildCategoryPills() {
  const slugs = [...new Set(anecdotes.map(a => normalizeCat(a.categorie)))];
  // Ordre défini par CAT_LABELS, puis alphabétique pour les éventuels inconnus
  const ordered = Object.keys(CAT_LABELS).filter(s => slugs.includes(s))
    .concat(slugs.filter(s => !CAT_LABELS[s]));

  catPills.innerHTML = `<button class="pill active" data-cat="all">Toutes</button>`;
  ordered.forEach(slug => {
    const label = CAT_LABELS[slug] || capitalize(slug);
    catPills.innerHTML += `<button class="pill" data-cat="${slug}">${label}</button>`;
  });
}
async function init() {
  // 1. Thème sauvegardé
  applyTheme(STATE.theme);

  // 2. Charger les anecdotes
  await loadAnecdotes();

  // 3. Afficher l'anecdote du jour ou une aléatoire
  filtered = [...anecdotes];
  showRandom();

  // 4. Swipe mobile
  initSwipe();

  // 5. Enregistrer Service Worker
  registerSW();

  // 6. Install prompt PWA
  initInstallPrompt();
}

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════════════════════════ */
async function loadAnecdotes() {
  try {
    const res  = await fetch('data.json');
    const data = await res.json();
    // Normaliser les catégories au chargement pour garantir la cohérence
    anecdotes = data.anecdotes.map(a => ({
      ...a,
      categorie: normalizeCat(a.categorie)
    }));
  } catch(e) {
    // Fallback si offline et données non cachées
    anecdotes = [{
      id: 0,
      titre: "Mode hors-ligne",
      texte: "Vous êtes hors-ligne. Les anecdotes se chargeront dès que vous serez reconnecté(e).",
      categorie: "info"
    }];
  }
}

/* ══════════════════════════════════════════════════════════════
   CORE — DISPLAY ANECDOTE
══════════════════════════════════════════════════════════════ */
function showRandom(direction = 'fade') {
  if (!filtered.length) return;

  // Éviter la répétition immédiate
  let pool = filtered.filter(a => !current || a.id !== current.id);
  if (!pool.length) pool = filtered;

  current = pool[Math.floor(Math.random() * pool.length)];
  renderCard(current, direction);
  recordRead(current);
}

function showAnecdote(anecdote) {
  current = anecdote;
  renderCard(anecdote, 'fade');
  recordRead(anecdote);
  showView('main');
}

function renderCard(anecdote, direction = 'fade') {
  // Sortie de la carte actuelle
  if (direction === 'left')  { card.classList.add('swipe-left'); }
  if (direction === 'right') { card.classList.add('swipe-right'); }

  setTimeout(() => {
    // Reset classes de transition
    card.classList.remove('swipe-left', 'swipe-right', 'card-enter');

    // Mettre à jour le contenu
    cardTitle.textContent  = anecdote.titre;
    cardText.textContent   = anecdote.texte;
    cardBadge.textContent  = CAT_LABELS[anecdote.categorie] || capitalize(anecdote.categorie);
    cardNumber.textContent = `#${anecdote.id}`;

    // Mise à jour bouton favori
    updateFavBtn(anecdote.id);

    // Animation d'entrée
    void card.offsetWidth; // reflow pour déclencher l'animation
    card.classList.add('card-enter');
  }, direction === 'fade' ? 0 : 300);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ══════════════════════════════════════════════════════════════
   HISTORY & READ COUNT
══════════════════════════════════════════════════════════════ */
function recordRead(anecdote) {
  const hist = STATE.history;
  if (!hist.length || hist[0].id !== anecdote.id) {
    hist.unshift({ id: anecdote.id, titre: anecdote.titre, categorie: anecdote.categorie, ts: Date.now() });
    if (hist.length > 50) hist.pop();
    STATE.history = hist;
  }
}

/* ══════════════════════════════════════════════════════════════
   FAVORITES
══════════════════════════════════════════════════════════════ */
function toggleFavorite(anecdote) {
  const favs = STATE.favorites;
  const idx  = favs.findIndex(f => f.id === anecdote.id);
  if (idx === -1) {
    favs.unshift({ id: anecdote.id, titre: anecdote.titre, texte: anecdote.texte, categorie: anecdote.categorie });
    showToast('✦ Ajouté aux favoris');
  } else {
    favs.splice(idx, 1);
    showToast('Retiré des favoris');
  }
  STATE.favorites = favs;
  updateFavBtn(anecdote.id);
}

function updateFavBtn(id) {
  const isFav = STATE.favorites.some(f => f.id === id);
  btnFav.classList.toggle('active', isFav);
  btnFav.setAttribute('aria-label', isFav ? 'Retirer des favoris' : 'Ajouter aux favoris');
}

/* ══════════════════════════════════════════════════════════════
   THEME
══════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const meta = document.getElementById('theme-meta');
  meta.setAttribute('content', theme === 'dark' ? '#08080f' : '#f5f3ef');
}

function toggleTheme() {
  const next = STATE.theme === 'dark' ? 'light' : 'dark';
  STATE.theme = next;
  applyTheme(next);
  showToast(next === 'dark' ? '🌙 Mode sombre' : '☀️ Mode clair');
}

/* ══════════════════════════════════════════════════════════════
   SHARE
══════════════════════════════════════════════════════════════ */
async function shareAnecdote(anecdote) {
  const text = `✦ ${anecdote.titre}\n\n${anecdote.texte}\n\n— Curiosa`;
  if (navigator.share) {
    try {
      await navigator.share({ title: anecdote.titre, text });
    } catch(e) { /* user cancelled */ }
  } else {
    await copyToClipboard(text);
    showToast('📋 Copié dans le presse-papier');
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch(e) {
    // Fallback textarea
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/* ══════════════════════════════════════════════════════════════
   CATEGORY FILTER
══════════════════════════════════════════════════════════════ */
function filterByCategory(cat) {
  catPills.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === cat);
  });
  filtered = cat === 'all' ? [...anecdotes] : anecdotes.filter(a => a.categorie === cat);
  showRandom();
}

/* ══════════════════════════════════════════════════════════════
   VIEWS / NAVIGATION
══════════════════════════════════════════════════════════════ */
function showView(view) {
  closeSideMenu();
  // Cacher tous les panels
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('open'));

  if (view === 'main') return;

  const panel = $(`panel-${view}`);
  if (!panel) return;
  panel.classList.add('open');

  // Populate
  if (view === 'all')       renderList('all');
  if (view === 'favorites') renderList('favorites');
  if (view === 'history')   renderList('history');
}

/* ── Render list (all | favorites | history) ─────────────────── */
function renderList(type) {
  let items = [];
  if (type === 'all')       items = anecdotes;
  if (type === 'favorites') items = STATE.favorites;
  if (type === 'history')   items = STATE.history.map(h => anecdotes.find(a => a.id === h.id)).filter(Boolean);

  const container = $(`list-${type}`);
  const countEl   = type === 'all' ? $('all-count') : type === 'favorites' ? $('fav-count') : null;
  if (countEl) countEl.textContent = items.length;

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">
      <span>${type === 'favorites' ? '💫' : '📖'}</span>
      <p>${type === 'favorites' ? 'Aucun favori pour l\'instant.<br>Appuyez sur ♡ pour en sauvegarder.' : 'Aucune anecdote dans l\'historique.'}</p>
    </div>`;
    return;
  }

  container.innerHTML = items.map(a => `
    <div class="list-card ${type === 'favorites' ? 'fav-card' : ''}" data-id="${a.id}">
      <div class="list-card-cat">${CAT_LABELS[a.categorie] || capitalize(a.categorie)}</div>
      <div class="list-card-title">${a.titre}</div>
      <div class="list-card-text">${a.texte}</div>
    </div>
  `).join('');

  // Click → ouvrir sur la carte principale
  container.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const anecdote = anecdotes.find(a => a.id === id);
      if (anecdote) showAnecdote(anecdote);
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════════════════════ */
function openSearch() {
  searchModal.classList.add('open');
  setTimeout(() => searchInput.focus(), 100);
  renderSearchResults('');
}

function closeSearch() {
  searchModal.classList.remove('open');
  searchInput.value = '';
}

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  const results = q
    ? anecdotes.filter(a => {
        const label = (CAT_LABELS[a.categorie] || a.categorie).toLowerCase();
        return a.titre.toLowerCase().includes(q) ||
               a.texte.toLowerCase().includes(q)  ||
               a.categorie.toLowerCase().includes(q) ||
               label.includes(q);
      })
    : anecdotes.slice(0, 20);

  if (!results.length) {
    searchRes.innerHTML = `<div class="empty-state"><span>🔍</span><p>Aucun résultat pour "${query}"</p></div>`;
    return;
  }

  searchRes.innerHTML = results.map(a => `
    <div class="list-card" data-id="${a.id}" style="margin-bottom:0">
      <div class="list-card-cat">${CAT_LABELS[a.categorie] || capitalize(a.categorie)}</div>
      <div class="list-card-title">${highlight(a.titre, q)}</div>
      <div class="list-card-text">${highlight(a.texte.slice(0,120) + (a.texte.length > 120 ? '…' : ''), q)}</div>
    </div>
  `).join('');

  searchRes.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const anecdote = anecdotes.find(a => a.id === id);
      if (anecdote) {
        closeSearch();
        showAnecdote(anecdote);
      }
    });
  });
}

function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background:var(--accent-glow);color:var(--accent2);border-radius:2px;">$1</mark>');
}

/* ══════════════════════════════════════════════════════════════
   SIDE MENU
══════════════════════════════════════════════════════════════ */
function openSideMenu() {
  sideMenu.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeSideMenu() {
  sideMenu.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
══════════════════════════════════════════════════════════════ */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ══════════════════════════════════════════════════════════════
   SWIPE GESTURE (mobile)
══════════════════════════════════════════════════════════════ */
function initSwipe() {
  let startX = 0, startY = 0, isDragging = false;
  const THRESHOLD = 80; // px

  // Touch
  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = false;
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      isDragging = true;
      const rot = dx * 0.06;
      card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
      card.style.transition = 'none';
      // Glow feedback
      const glowL = card.querySelector('.swipe-glow-left');
      const glowR = card.querySelector('.swipe-glow-right');
      if (glowL) glowL.style.opacity = dx < 0 ? Math.min(1, Math.abs(dx)/THRESHOLD) : 0;
      if (glowR) glowR.style.opacity = dx > 0 ? Math.min(1, Math.abs(dx)/THRESHOLD) : 0;
    }
  }, { passive: true });

  card.addEventListener('touchend', e => {
    if (!isDragging) return;
    const dx = e.changedTouches[0].clientX - startX;
    card.style.transform = '';
    card.style.transition = '';
    const glowL = card.querySelector('.swipe-glow-left');
    const glowR = card.querySelector('.swipe-glow-right');
    if (glowL) glowL.style.opacity = 0;
    if (glowR) glowR.style.opacity = 0;

    if (Math.abs(dx) >= THRESHOLD) {
      showRandom(dx < 0 ? 'left' : 'right');
      triggerCTARipple();
    }
  }, { passive: true });

  // Mouse drag (desktop)
  let mouseStartX = 0, isMouseDragging = false;
  card.addEventListener('mousedown', e => {
    mouseStartX = e.clientX;
    isMouseDragging = false;
    card.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!card.classList.contains('dragging')) return;
    const dx = e.clientX - mouseStartX;
    isMouseDragging = true;
    const rot = dx * 0.05;
    card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
    card.style.transition = 'none';
  });
  window.addEventListener('mouseup', e => {
    if (!card.classList.contains('dragging')) return;
    card.classList.remove('dragging');
    const dx = e.clientX - mouseStartX;
    card.style.transform = '';
    card.style.transition = '';
    if (isMouseDragging && Math.abs(dx) >= THRESHOLD) {
      showRandom(dx < 0 ? 'left' : 'right');
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   CTA BUTTON RIPPLE
══════════════════════════════════════════════════════════════ */
function triggerCTARipple() {
  btnNext.classList.remove('ripple');
  void btnNext.offsetWidth;
  btnNext.classList.add('ripple');
  setTimeout(() => btnNext.classList.remove('ripple'), 600);
}

/* ══════════════════════════════════════════════════════════════
   SERVICE WORKER
══════════════════════════════════════════════════════════════ */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(reg => {
        console.log('[Curiosa] SW enregistré, scope:', reg.scope);
        // Vérifier les mises à jour toutes les heures
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch(err => console.warn('[Curiosa] SW échec:', err));
  });
}

/* ══════════════════════════════════════════════════════════════
   PWA INSTALL
══════════════════════════════════════════════════════════════ */
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function initInstallPrompt() {
  const btnInstall = $('btn-install');

  // Si déjà installée en mode standalone, cacher le bouton
  if (isInStandaloneMode()) {
    if (btnInstall) btnInstall.style.display = 'none';
    return;
  }

  // Android / Chrome / Edge : écouter l'événement natif
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    if (btnInstall) {
      btnInstall.style.display = 'flex';
      btnInstall.querySelector('span') && (btnInstall.querySelector('span').textContent = 'Ajouter sur l\'écran d\'accueil');
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    showToast('🎉 Application installée !');
    if (btnInstall) btnInstall.style.display = 'none';
  });

  // iOS Safari : afficher instructions manuelles
  if (isIos() && !isInStandaloneMode()) {
    if (btnInstall) btnInstall.style.display = 'flex';
  }
}

async function triggerInstall() {
  // Android/Chrome : prompt natif
  if (deferredInstall) {
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') {
      deferredInstall = null;
      showToast('🎉 Installation en cours…');
    }
    closeSideMenu();
    return;
  }

  // iOS Safari : instructions dans un modal dédié
  if (isIos() && !isInStandaloneMode()) {
    closeSideMenu();
    showIosInstallModal();
    return;
  }

  // Déjà installé ou navigateur non supporté
  if (isInStandaloneMode()) {
    showToast('✓ Application déjà installée');
  } else {
    closeSideMenu();
    showIosInstallModal(); // modal générique avec instructions
  }
}

function showIosInstallModal() {
  // Supprimer un éventuel modal existant
  const old = document.getElementById('ios-install-modal');
  if (old) old.remove();

  const isIosDev = isIos();
  const modal = document.createElement('div');
  modal.id = 'ios-install-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9000;
    display:flex;align-items:flex-end;justify-content:center;
    background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);
    padding:16px;
  `;
  modal.innerHTML = `
    <div style="
      background:var(--surface);border:1px solid var(--border2);
      border-radius:24px;padding:28px 24px 32px;
      width:100%;max-width:420px;
      box-shadow:0 -8px 40px rgba(0,0,0,0.5);
      animation:slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <span style="font-family:var(--font-display);font-size:18px;font-weight:600;color:var(--text)">
          ✦ Installer Curiosa
        </span>
        <button id="ios-modal-close" style="
          width:32px;height:32px;border-radius:50%;
          background:var(--pill-bg);border:1px solid var(--border);
          color:var(--text2);font-size:18px;
          display:flex;align-items:center;justify-content:center;cursor:pointer;
        ">×</button>
      </div>
      ${isIosDev ? `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">1</div>
          <div>
            <p style="color:var(--text);font-size:14px;font-weight:500;margin-bottom:4px">Appuyez sur le bouton Partager</p>
            <p style="color:var(--text2);font-size:13px">L'icône <strong>□↑</strong> en bas de Safari</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">2</div>
          <div>
            <p style="color:var(--text);font-size:14px;font-weight:500;margin-bottom:4px">Faites défiler et appuyez sur</p>
            <p style="color:var(--accent2);font-size:13px;font-weight:500">"Sur l'écran d'accueil"</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">3</div>
          <div>
            <p style="color:var(--text);font-size:14px;font-weight:500;margin-bottom:4px">Confirmez en appuyant sur</p>
            <p style="color:var(--accent2);font-size:13px;font-weight:500">"Ajouter"</p>
          </div>
        </div>
      </div>
      <p style="margin-top:18px;font-size:12px;color:var(--text3);text-align:center">⚠️ Fonctionne uniquement depuis Safari</p>
      ` : `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">1</div>
          <p style="color:var(--text);font-size:14px;padding-top:8px">Ouvrez le menu de votre navigateur (⋮ ou ···)</p>
        </div>
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--pill-active);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">2</div>
          <p style="color:var(--text);font-size:14px;padding-top:8px">Sélectionnez <span style="color:var(--accent2);font-weight:500">"Ajouter à l'écran d'accueil"</span> ou <span style="color:var(--accent2);font-weight:500">"Installer"</span></p>
        </div>
      </div>
      `}
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('ios-modal-close').addEventListener('click', () => modal.remove());
}

/* ══════════════════════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════════════════════ */

// Bouton principal
btnNext.addEventListener('click', () => {
  triggerCTARipple();
  showRandom('right');
});

// Favori
btnFav.addEventListener('click', () => {
  if (current) toggleFavorite(current);
});

// Partage
btnShare.addEventListener('click', () => {
  if (current) shareAnecdote(current);
});

// Thème
btnTheme.addEventListener('click', toggleTheme);

// Menu latéral
btnMenu.addEventListener('click', openSideMenu);
overlay.addEventListener('click', closeSideMenu);
$('btn-close-menu').addEventListener('click', closeSideMenu);

// Navigation menu
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    showView(item.dataset.view);
  });
});

// Bouton install dans le menu
$('btn-install').addEventListener('click', triggerInstall);

// Retour depuis les panels
document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => showView('main'));
});

// Recherche
btnSearch.addEventListener('click', openSearch);
$('btn-close-search').addEventListener('click', closeSearch);
searchInput.addEventListener('input', e => renderSearchResults(e.target.value));
searchModal.addEventListener('click', e => {
  if (e.target === searchModal) closeSearch();
});

// Catégorie pills
catPills.addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (pill) filterByCategory(pill.dataset.cat);
});

// Effacer historique
$('btn-clear-history').addEventListener('click', () => {
  STATE.history = [];
  renderList('history');
  showToast('Historique effacé');
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (searchModal.classList.contains('open')) closeSearch();
    else showView('main');
  }
  if (e.key === 'ArrowRight' || e.key === ' ') {
    if (!searchModal.classList.contains('open')) showRandom('right');
  }
});

// Ajouter glows swipe dans la carte
card.insertAdjacentHTML('beforeend', '<div class="swipe-glow-left"></div><div class="swipe-glow-right"></div>');

/* ══════════════════════════════════════════════════════════════
   START
══════════════════════════════════════════════════════════════ */
init();
