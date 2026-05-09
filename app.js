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

  get readCount() { return parseInt(localStorage.getItem('curiosa_read') || '0'); },
  set readCount(v){ localStorage.setItem('curiosa_read', String(v)); },

  get lastDate()  { return localStorage.getItem('curiosa_last_date') || ''; },
  set lastDate(v) { localStorage.setItem('curiosa_last_date', v); },

  get streak()    { return parseInt(localStorage.getItem('curiosa_streak') || '0'); },
  set streak(v)   { localStorage.setItem('curiosa_streak', String(v)); },
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
const statRead    = $('stat-read');
const statFav     = $('stat-fav');
const statStreak  = $('stat-streak');

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
async function init() {
  // 1. Thème sauvegardé
  applyTheme(STATE.theme);

  // 2. Charger les anecdotes
  await loadAnecdotes();

  // 3. Afficher l'anecdote du jour ou une aléatoire
  filtered = [...anecdotes];
  showRandom();

  // 4. Mise à jour stats header
  updateStats();

  // 5. Swipe mobile
  initSwipe();

  // 6. Streak quotidien
  updateStreak();

  // 7. Enregistrer Service Worker
  registerSW();

  // 8. Install prompt PWA
  initInstallPrompt();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════════════════════════ */
async function loadAnecdotes() {
  try {
    const res  = await fetch('data.json');
    const data = await res.json();
    anecdotes  = data.anecdotes;
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
  updateStats();
}

function showAnecdote(anecdote) {
  current = anecdote;
  renderCard(anecdote, 'fade');
  recordRead(anecdote);
  updateStats();
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
    cardBadge.textContent  = capitalize(anecdote.categorie);
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
  // Incrément global
  STATE.readCount = STATE.readCount + 1;

  // Historique (max 50, sans doublons consécutifs)
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
  updateStats();
}

function updateFavBtn(id) {
  const isFav = STATE.favorites.some(f => f.id === id);
  btnFav.classList.toggle('active', isFav);
  btnFav.setAttribute('aria-label', isFav ? 'Retirer des favoris' : 'Ajouter aux favoris');
}

/* ══════════════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════════════ */
function updateStats() {
  statRead.textContent   = STATE.readCount;
  statFav.textContent    = STATE.favorites.length;
  statStreak.textContent = `🔥 ${STATE.streak}`;
}

function updateStreak() {
  const today    = new Date().toDateString();
  const lastDate = STATE.lastDate;
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (lastDate === today) return;
  if (lastDate === yesterday) {
    STATE.streak   = STATE.streak + 1;
  } else if (lastDate !== today) {
    STATE.streak   = 1;
  }
  STATE.lastDate = today;
  updateStats();
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
  // Mise à jour pills
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
  if (view === 'stats')     renderStats();
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
      <div class="list-card-cat">${capitalize(a.categorie)}</div>
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

/* ── Render stats panel ──────────────────────────────────────── */
function renderStats() {
  const favCount  = STATE.favorites.length;
  const readCount = STATE.readCount;
  const streak    = STATE.streak;
  const histItems = STATE.history.map(h => anecdotes.find(a => a.id === h.id)).filter(Boolean);

  // Catégories lues
  const catCounts = {};
  histItems.forEach(a => {
    catCounts[a.categorie] = (catCounts[a.categorie] || 0) + 1;
  });
  const maxCat = Math.max(...Object.values(catCounts), 1);
  const catBars = Object.entries(catCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, n]) => `
      <div class="cat-bar-item">
        <div class="cat-bar-label">
          <span>${capitalize(cat)}</span>
          <span>${n}</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width: ${Math.round(n/maxCat*100)}%"></div>
        </div>
      </div>
    `).join('');

  $('stats-panel').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-icon">📚</div>
      <div class="stat-card-info">
        <div class="stat-card-value">${readCount}</div>
        <div class="stat-card-label">Anecdotes lues (total)</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">💛</div>
      <div class="stat-card-info">
        <div class="stat-card-value">${favCount}</div>
        <div class="stat-card-label">Favoris enregistrés</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">🔥</div>
      <div class="stat-card-info">
        <div class="stat-card-value">${streak}</div>
        <div class="stat-card-label">Jours de suite</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">🌐</div>
      <div class="stat-card-info">
        <div class="stat-card-value">${anecdotes.length}</div>
        <div class="stat-card-label">Anecdotes disponibles</div>
      </div>
    </div>
    ${catBars ? `<div class="cat-bar-list"><h4>Catégories les plus lues</h4>${catBars}</div>` : ''}
  `;
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
    ? anecdotes.filter(a =>
        a.titre.toLowerCase().includes(q) ||
        a.texte.toLowerCase().includes(q)  ||
        a.categorie.toLowerCase().includes(q)
      )
    : anecdotes.slice(0, 20);

  if (!results.length) {
    searchRes.innerHTML = `<div class="empty-state"><span>🔍</span><p>Aucun résultat pour "${query}"</p></div>`;
    return;
  }

  searchRes.innerHTML = results.map(a => `
    <div class="list-card" data-id="${a.id}" style="margin-bottom:0">
      <div class="list-card-cat">${capitalize(a.categorie)}</div>
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
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .catch(e => console.log('SW registration failed:', e));
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   PWA INSTALL
══════════════════════════════════════════════════════════════ */
function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    // Afficher bouton install dans le menu
    const btnInstall = $('btn-install');
    if (btnInstall) btnInstall.style.display = 'flex';
    // Afficher banner si pas déjà installé
    if (!localStorage.getItem('curiosa_install_dismissed')) {
      showInstallBanner();
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    showToast('🎉 Application installée !');
    localStorage.setItem('curiosa_install_dismissed', '1');
    const btnInstall = $('btn-install');
    if (btnInstall) btnInstall.style.display = 'none';
  });
}

function showInstallBanner() {
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-banner-text">
      <strong>✦ Installer Curiosa</strong>
      <p>Accès rapide · Fonctionne hors-ligne</p>
    </div>
    <button class="install-btn">Installer</button>
    <button class="install-close">×</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector('.install-btn').addEventListener('click', async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      const { outcome } = await deferredInstall.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('curiosa_install_dismissed', '1');
      }
    }
    banner.remove();
  });
  banner.querySelector('.install-close').addEventListener('click', () => {
    localStorage.setItem('curiosa_install_dismissed', '1');
    banner.remove();
  });
  // Auto-dismiss après 10s
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 10000);
}

async function triggerInstall() {
  if (deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
  } else {
    showToast('Utilisez le menu "Ajouter à l\'écran d\'accueil"');
  }
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
