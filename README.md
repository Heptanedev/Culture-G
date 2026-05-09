# ✦ Curiosa — Culture Générale PWA

> Une anecdote de culture générale à chaque instant.  
> Application mobile premium · PWA · 100% offline · Prête pour Netlify.

---

## 🚀 Déploiement sur Netlify (2 minutes)

### Option A — Glisser-déposer
1. Allez sur [app.netlify.com](https://app.netlify.com)
2. Faites glisser le dossier `curiosa/` dans la zone de déploiement
3. C'est fait ! ✓

### Option B — Via GitHub
1. Poussez ce dossier sur un repo GitHub
2. Connectez le repo à Netlify
3. Build command : *(laisser vide)*
4. Publish directory : `.` (racine)
5. Déployez

---

## 📁 Structure des fichiers

```
curiosa/
├── index.html          ← Application principale (SPA)
├── style.css           ← Design system complet (dark/light)
├── app.js              ← Logique applicative (vanilla JS)
├── data.json           ← 100 anecdotes structurées
├── manifest.json       ← Configuration PWA
├── service-worker.js   ← Cache offline & push notifications
├── netlify.toml        ← Headers & redirects pour Netlify
├── icons/
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-192.png    ← Icône principale Android/PWA
│   ├── icon-512.png    ← Splash screen PWA
│   └── icon-180.png    ← Apple Touch Icon
└── README.md
```

---

## ✨ Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| 🎲 **Aléatoire** | Anecdote aléatoire sans répétition immédiate |
| 👆 **Swipe** | Swipe gauche/droite pour changer d'anecdote |
| 💛 **Favoris** | Sauvegarde locale (localStorage) |
| 📖 **Historique** | 50 dernières anecdotes consultées |
| 🔍 **Recherche** | Filtrage par mot-clé en temps réel |
| 📋 **Liste complète** | Toutes les 100 anecdotes navigables |
| 🏷️ **Catégories** | 11 catégories filtrables par pills |
| 🌙 **Dark/Light mode** | Thème sauvegardé automatiquement |
| 📊 **Statistiques** | Anecdotes lues, favoris, streak quotidien |
| 🔗 **Partage** | Web Share API + fallback presse-papier |
| 📴 **Offline** | Fonctionne sans connexion internet |
| 📱 **Installable** | Ajout à l'écran d'accueil iOS/Android |
| 🔥 **Streak** | Compteur de jours consécutifs |

---

## 📱 Catégories d'anecdotes

- 🏛️ Histoire
- 🚀 Espace
- 🔬 Sciences
- 🐾 Animaux
- 🗺️ Géographie
- 🧠 Corps humain
- 💭 Psychologie
- 💡 Inventions
- 💻 Technologies
- 🏆 Records
- 🏺 Civilisation

---

## ✏️ Ajouter / modifier des anecdotes

Ouvrez `data.json` et suivez ce format :

```json
{
  "id": 101,
  "titre": "Votre titre accrocheur",
  "texte": "Le texte complet de l'anecdote, aussi long que nécessaire.",
  "categorie": "histoire"
}
```

**Catégories disponibles :** `histoire`, `espace`, `sciences`, `animaux`, `géographie`, `corps humain`, `psychologie`, `inventions`, `technologies`, `records`, `civilisation`

---

## 🛠️ Développement local

```bash
# Python (recommandé)
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code
# → Installer l'extension "Live Server"
```

Ouvrez `http://localhost:8080`

> ⚠️ Le service worker ne fonctionne qu'en HTTPS ou localhost.

---

## 📲 Installation sur mobile

### Android (Chrome)
1. Ouvrir dans Chrome
2. Menu ⋮ → *Ajouter à l'écran d'accueil*
3. Ou attendre le banner automatique

### iPhone (Safari)
1. Ouvrir dans Safari
2. Bouton partage → *Sur l'écran d'accueil*

---

## 🎨 Personnalisation

### Couleurs (style.css)
```css
:root {
  --accent:  #c9a96e;  /* Or principal */
  --accent2: #e8c68a;  /* Or clair     */
  --bg:      #08080f;  /* Fond sombre  */
}
```

### Police d'affichage
Remplacer `Playfair Display` dans le `@import` Google Fonts par toute autre police serif.

---

## 📄 Stack technique

- **HTML5** — Structure sémantique, meta PWA
- **CSS3** — Variables, animations, glassmorphism, responsive
- **JavaScript ES6+** — Vanilla, aucune dépendance
- **PWA** — Manifest + Service Worker (Cache-first)
- **localStorage** — Persistance côté client

---

## 📜 Licence

Libre d'utilisation personnelle et éducative.

---

*Fait avec ✦ par Curiosa*
