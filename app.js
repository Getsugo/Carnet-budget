/* ---------- Constantes ---------- */
// Clés utilisées pour sauvegarder chaque partie des données dans le stockage du téléphone (localStorage)
const LS_KEYS = { tx: "carnet:tx", budgets: "carnet:budgets", settings: "carnet:settings", cats: "carnet:cats", assets: "carnet:assets", catIcons: "carnet:catIcons", onboarded: "carnet:onboarded", recurring: "carnet:recurring", pin: "carnet:pin" };
// Catégories fournies par défaut au tout premier lancement de l'appli (l'utilisateur peut les modifier/supprimer ensuite)
const DEFAULT_CATS = {
  depenses: ["courses", "loisirs", "voiture", "gasoil", "salle", "cadeaux", "groupama", "resto", "canal", "maman", "autres"],
  revenus: ["salaire", "caf", "maman", "cpam", "wtw", "mamy"],
};
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
// Couleurs utilisées pour colorer automatiquement les catégories. Générées à intervalles réguliers sur la roue
// chromatique (12 teintes espacées de 30°, dans un ordre entrelacé) plutôt que choisies à l'œil, pour garantir
// que deux catégories voisines dans la liste (voir hashColor) aient toujours des couleurs bien distinctes.
const PALETTE = ["#DA6262","#62DADA","#9EDA62","#9E62DA","#DA9E62","#629EDA","#62DA62","#DA62DA","#DADA62","#6262DA","#62DA9E","#DA629E"];
// Emoji par défaut pour chaque catégorie connue. L'utilisateur peut les remplacer (voir state.catIcons ci-dessous).
const CATEGORY_ICONS = {
  courses: "🛒", loisirs: "🎉", voiture: "🚗", gasoil: "⛽", salle: "🏋️", cadeaux: "🎁",
  groupama: "🛡️", resto: "🍽️", canal: "📺", maman: "❤️", autres: "💳", bricolage: "🔨",
  internet: "📶", salaire: "💼", caf: "👶", cpam: "🏥", wtw: "📄", mamy: "❤️",
};
// Renvoie l'icône à afficher pour une catégorie donnée :
// 1) l'icône personnalisée choisie par l'utilisateur si elle existe (state.catIcons)
// 2) sinon l'icône par défaut (CATEGORY_ICONS)
// 3) sinon une icône générique de secours (💳)
function categoryIcon(cat) {
  const key = (cat || "").toLowerCase();
  return (state.catIcons && state.catIcons[key]) || CATEGORY_ICONS[key] || "💳";
}

/* ---------- Etat ---------- */
// "state" contient TOUTES les données de l'appli en mémoire pendant qu'elle tourne.
// À chaque modification importante, on appelle persist() pour l'écrire dans le stockage du téléphone.
let state = {
  tx: [], // liste de toutes les transactions : {id, type: "depense"|"revenu", date, montant, description, categorie}
  budgets: {}, // budget prévu par mois : { "2026-07": { depenses: {courses: 250, ...}, revenus: {...} } }
  settings: { objectif: 60000, soldeInitial: 0, dateObjectif: "" }, // réglages généraux (objectif d'épargne, solde de départ du compte, date cible)
  cats: JSON.parse(JSON.stringify(DEFAULT_CATS)), // liste des catégories existantes (copie pour ne pas modifier DEFAULT_CATS par erreur)
  catIcons: {}, // surcharge des icônes par catégorie choisie par l'utilisateur : { "courses": "🥖" }
  assets: [], // comptes/livrets/investissements saisis manuellement : {id, nom, montant}
  recurring: [], // transactions récurrentes (loyer, abonnements, salaire...) : {id, type, montant, description, categorie, jour, dernierMoisApplique}
  month: new Date().toISOString().slice(0, 7), // mois actuellement affiché, format "AAAA-MM"
  tab: "dashboard", // onglet actuellement affiché
};

/* ---------- Utils ---------- */
const fmtEUR = (n) => (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MOIS_FR[m - 1]} ${y}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
// Attribue une couleur à chaque catégorie. Avant : un hash du nom -> avec seulement 10 couleurs dans la palette et
// une dizaine de catégories, deux noms différents tombaient souvent sur la même couleur par pur hasard (ex : "autres"
// et "groupama" pouvaient être identiques). Maintenant : la couleur dépend du RANG de la catégorie dans la liste
// alphabétique de toutes les catégories connues (dépenses + revenus confondues) -> tant qu'il y a 10 catégories ou
// moins (la taille de PALETTE), chacune a une couleur garantie différente de ses voisines.
const hashColor = (s) => {
  const dep = (state.cats && state.cats.depenses) || [];
  const rev = (state.cats && state.cats.revenus) || [];
  const allCats = [...new Set([...dep, ...rev])].sort();
  let idx = allCats.indexOf(s);
  if (idx === -1) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); idx = Math.abs(h); } // catégorie inconnue/supprimée : on retombe sur un hash
  return PALETTE[idx % PALETTE.length];
};
const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Stockage local ---------- */
// Recharge toutes les données sauvegardées depuis le stockage du téléphone au démarrage de l'appli.
// Chaque bloc try/catch est indépendant : si une donnée est corrompue, les autres se chargent quand même.
function loadState() {
  try { const v = localStorage.getItem(LS_KEYS.tx); if (v) state.tx = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.budgets); if (v) state.budgets = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.settings); if (v) state.settings = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.cats); if (v) state.cats = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.assets); if (v) state.assets = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.catIcons); if (v) state.catIcons = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.recurring); if (v) state.recurring = JSON.parse(v); } catch (e) {}
  if (state.settings.dateObjectif === undefined) state.settings.dateObjectif = ""; // rétrocompatibilité si le réglage n'existait pas encore
  // Au démarrage, on se place automatiquement sur le mois de la transaction la plus récente (plutôt que le mois calendaire actuel)
  if (state.tx.length) { const months = state.tx.map((t) => monthKey(t.date)).sort(); state.month = months[months.length - 1]; }
}
// Sauvegarde l'état dans le stockage du téléphone.
// "part" permet de ne sauvegarder qu'un seul morceau (ex: persist("tx") après avoir modifié une transaction),
// ou tout sauvegarder d'un coup si "part" n'est pas précisé.
function persist(part) {
  if (part === "tx" || !part) localStorage.setItem(LS_KEYS.tx, JSON.stringify(state.tx));
  if (part === "budgets" || !part) localStorage.setItem(LS_KEYS.budgets, JSON.stringify(state.budgets));
  if (part === "settings" || !part) localStorage.setItem(LS_KEYS.settings, JSON.stringify(state.settings));
  if (part === "cats" || !part) localStorage.setItem(LS_KEYS.cats, JSON.stringify(state.cats));
  if (part === "assets" || !part) localStorage.setItem(LS_KEYS.assets, JSON.stringify(state.assets));
  if (part === "catIcons" || !part) localStorage.setItem(LS_KEYS.catIcons, JSON.stringify(state.catIcons));
  if (part === "recurring" || !part) localStorage.setItem(LS_KEYS.recurring, JSON.stringify(state.recurring));
}

/* ---------- Dérivées ---------- */
// Renvoie uniquement les transactions du mois actuellement affiché (state.month, format "AAAA-MM")
function getMonthTx() { return state.tx.filter((t) => monthKey(t.date) === state.month); }
// Renvoie le budget prévu (dépenses/revenus par catégorie) saisi pour le mois affiché, ou un objet vide si rien n'a encore été saisi
function getMonthBudget() { return state.budgets[state.month] || { depenses: {}, revenus: {} }; }
// Calcule les totaux réels du mois : somme par catégorie (depReel/revReel), totaux généraux, et ce qu'il "reste" (revenus - dépenses)
function getTotals() {
  const mtx = getMonthTx();
  const depReel = {}, revReel = {};
  mtx.forEach((t) => { const b = t.type === "depense" ? depReel : revReel; b[t.categorie] = (b[t.categorie] || 0) + t.montant; });
  const totalDep = Object.values(depReel).reduce((a, b) => a + b, 0);
  const totalRev = Object.values(revReel).reduce((a, b) => a + b, 0);
  return { depReel, revReel, totalDep, totalRev, reste: totalRev - totalDep };
}
// Regroupe TOUTES les transactions (tous mois confondus) pour construire la série utilisée par le graphique "Reste par mois" (onglet Année)
function getYearlySeries() {
  const map = {};
  state.tx.forEach((t) => {
    const mk = monthKey(t.date);
    map[mk] = map[mk] || { revenus: 0, depenses: 0 };
    if (t.type === "revenu") map[mk].revenus += t.montant; else map[mk].depenses += t.montant;
  });
  // Trie les mois dans l'ordre chronologique (les clés "AAAA-MM" se trient bien en texte) et calcule le "reste" de chaque mois
  return Object.keys(map).sort().map((mk) => ({ mois: mk, label: monthLabel(mk).slice(0, 3), reste: map[mk].revenus - map[mk].depenses }));
}
// Solde du compte courant = solde de départ réglé dans les paramètres + somme de toutes les transactions jamais enregistrées (tous mois)
function getCompteActuel() {
  const cumul = state.tx.reduce((acc, t) => acc + (t.type === "revenu" ? t.montant : -t.montant), 0);
  return state.settings.soldeInitial + cumul;
}
// Patrimoine total = compte courant (calculé automatiquement) + somme des comptes ajoutés à la main (Livret A, assurance-vie, etc.)
function getPatrimoineTotal() {
  const autres = state.assets.reduce((acc, a) => acc + (Number(a.montant) || 0), 0);
  return getCompteActuel() + autres;
}
// Combien de mois restent avant la date objectif (mois calendaires, arrondi à l'entier supérieur)
function getMoisRestants() {
  if (!state.settings.dateObjectif) return null;
  const [ty, tm] = state.settings.dateObjectif.split("-").map(Number);
  const now = new Date();
  const diff = (ty - now.getFullYear()) * 12 + (tm - (now.getMonth() + 1));
  return diff;
}

/* ---------- Rendu ---------- */
// Fonction centrale appelée après CHAQUE changement de données ou d'onglet : elle redessine tout l'écran actif.
// Le contenu de #view est entièrement régénéré (innerHTML) puis les écouteurs de clic sont ré-attachés (attachViewHandlers),
// car le DOM ayant été recréé, les anciens écouteurs ne pointent plus vers rien.
function render() {
  document.getElementById("monthLabel").textContent = monthLabel(state.month);
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  const view = document.getElementById("view");
  if (state.tab === "dashboard") view.innerHTML = renderDashboard();
  else if (state.tab === "transactions") view.innerHTML = renderTransactions();
  else if (state.tab === "budget") view.innerHTML = renderBudget();
  else if (state.tab === "annee") view.innerHTML = renderAnnee();
  // Astuce pour rejouer l'animation d'apparition à chaque changement d'onglet :
  // on retire la classe, on force le navigateur à "lire" le DOM (offsetWidth), puis on la remet.
  view.classList.remove("view-anim");
  void view.offsetWidth;
  view.classList.add("view-anim");
  attachViewHandlers();
  animateCounts();
}

// Construit l'onglet "Tableau de bord" : le bandeau "reste à vivre" en haut, la comparaison prévu/réel par catégorie,
// et le donut de répartition des dépenses.
function renderDashboard() {
  const totals = getTotals();
  const mb = getMonthBudget();
  // On combine les catégories qui ont un budget prévu ET celles qui ont des dépenses réelles (même sans budget prévu)
  const allCats = new Set([...Object.keys(mb.depenses || {}), ...Object.keys(totals.depReel)]);
  const rows = [...allCats].map((cat) => {
    const prevu = (mb.depenses || {})[cat] || 0;
    const reel = totals.depReel[cat] || 0;
    return { cat, prevu, reel };
  }).sort((a, b) => b.reel - a.reel);

  // Construit le donut de répartition avec un dégradé conique CSS : chaque catégorie occupe une portion
  // du cercle proportionnelle à son montant, en cumulant les angles de départ/fin (acc = angle cumulé).
  // On insère aussi un petit espace (couleur de fond) juste avant chaque part suivante : ça crée une frontière
  // nette entre les parts, visible même dans le cas où deux couleurs se ressembleraient.
  const pieData = Object.entries(totals.depReel);
  let gradient = "", acc = 0;
  const total = pieData.reduce((s, [, v]) => s + v, 0) || 1;
  const gapDeg = pieData.length > 1 ? 1.5 : 0;
  pieData.forEach(([name, v]) => {
    const start = (acc / total) * 360; acc += v; const end = (acc / total) * 360;
    const cut = Math.max(start, end - gapDeg);
    gradient += `${hashColor(name)} ${start}deg ${cut}deg, var(--surface-2) ${cut}deg ${end}deg, `;
  });
  gradient = gradient ? gradient.slice(0, -2) : "var(--paper-dim) 0deg 360deg";

  // Petite courbe (sparkline) des 6 derniers mois affichée dans le bandeau du haut
  const spark = getYearlySeries().slice(-6);
  const sparkSvg = spark.length >= 2 ? renderSparkline(spark) : "";

  return `
    <div class="card dark hero">
      <div class="hero-top">
        <div>
          <div class="hero-label">Reste à vivre — ${esc(monthLabel(state.month))}</div>
          <div class="hero-amount font-mono" style="color:${totals.reste >= 0 ? "#37D399" : "#FB7A8A"}"><span class="count-anim" data-count-target="${totals.reste}">${fmtEUR(totals.reste)}</span></div>
        </div>
        <div class="hero-stats">
          <div><div class="stat-label">Revenus</div><div class="stat-value" style="color:#37D399">${fmtEUR(totals.totalRev)}</div></div>
          <div><div class="stat-label">Dépenses</div><div class="stat-value" style="color:#FB7A8A">${fmtEUR(totals.totalDep)}</div></div>
        </div>
      </div>
      ${sparkSvg ? `
      <div class="sparkline-wrap">
        <span class="sparkline-label">6 derniers mois</span>
        ${sparkSvg}
      </div>` : ""}
    </div>

    <div class="grid-2">
      <div class="card card-pad">
        <h3 class="section-title">Prévu vs réel</h3>
        ${rows.length === 0 ? `<div class="empty">Aucune dépense ce mois-ci pour l'instant.</div>` : rows.map((r) => {
          const max = Math.max(r.prevu, r.reel, 1);
          const over = r.reel > r.prevu && r.prevu > 0;
          return `
          <div class="cat-row">
            <div class="cat-row-top">
              <span class="name"><span class="cat-icon">${categoryIcon(r.cat)}</span>${esc(r.cat)}</span>
              <span class="amounts ${over ? "over" : ""}">${fmtEUR(r.reel)}${r.prevu > 0 ? ` <span style="color:var(--ink40)">/ ${fmtEUR(r.prevu)}</span>` : ""}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${over ? "over" : ""}" style="width:${Math.min(100, (r.reel / max) * 100)}%"></div>
              ${r.prevu > 0 ? `<div class="bar-marker" style="left:${Math.min(100, (r.prevu / max) * 100)}%"></div>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>

      <div class="card card-pad">
        <h3 class="section-title">Répartition des dépenses</h3>
        ${pieData.length === 0 ? `<div class="empty">Rien à afficher pour ce mois.</div>` : `
        <div class="donut-wrap">
          <div class="donut-pos">
            <div class="donut" style="background:conic-gradient(${gradient})"></div>
            <div class="donut-center"><div class="amt">${fmtEUR(total).replace(",00", "")}</div><div class="lbl">total</div></div>
          </div>
          <div class="legend">
            ${pieData.map(([name]) => `<span class="legend-item"><span class="legend-dot" style="background:${hashColor(name)}"></span>${categoryIcon(name)} ${esc(name)}</span>`).join("")}
          </div>
        </div>`}
      </div>
    </div>
  `;
}

// Génère un mini graphique SVG (aire + ligne) pour visualiser une tendance sur quelques mois
function renderSparkline(series, w = 130, h = 34) {
  const vals = series.map((s) => s.reste);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 0);
  const range = max - min || 1;
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - ((v - min) / range) * h]);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = vals[vals.length - 1];
  const color = last >= 0 ? "#37D399" : "#FB7A8A";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible;flex-shrink:0;">
    <polygon points="${area}" fill="${color}" opacity="0.15" />
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

// Courbe lissée avec dégradé pour l'évolution du "reste" mois par mois (onglet Année)
function renderTrendChart(series) {
  const SAGE = "#37D399", RUST = "#FB7A8A", LINE = "rgba(255,255,255,0.10)", INK40 = "rgba(243,245,248,0.35)";
  const w = Math.max(320, series.length * 50);
  const h = 170, padTop = 14, padBottom = 26;
  const vals = series.map((s) => s.reste);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 0);
  const range = max - min || 1;
  const innerH = h - padTop - padBottom;
  const stepX = series.length > 1 ? w / (series.length - 1) : 0;
  const pts = vals.map((v, i) => [i * stepX, padTop + innerH - ((v - min) / range) * innerH]);
  const zeroY = padTop + innerH - ((0 - min) / range) * innerH;

  let path = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    path += ` C ${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const areaPath = `${path} L ${pts[pts.length - 1][0].toFixed(1)},${h - padBottom} L ${pts[0][0].toFixed(1)},${h - padBottom} Z`;
  const dots = pts.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${vals[i] >= 0 ? SAGE : RUST}" stroke="#fff" stroke-width="1.5" />`).join("");
  const labels = series.map((s, i) => `<text x="${(i * stepX).toFixed(1)}" y="${h - 8}" font-size="10" fill="${INK40}" text-anchor="middle" font-family="ui-monospace,monospace">${esc(s.label)}</text>`).join("");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;">
    <defs>
      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${SAGE}" stop-opacity="0.28" />
        <stop offset="100%" stop-color="${SAGE}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <line x1="0" y1="${zeroY.toFixed(1)}" x2="${w}" y2="${zeroY.toFixed(1)}" stroke="${LINE}" stroke-width="1" stroke-dasharray="3,3" />
    <path d="${areaPath}" fill="url(#trendGrad)" />
    <path d="${path}" fill="none" stroke="${SAGE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    ${dots}
    ${labels}
  </svg>`;
}

// Anime l'apparition des montants (compteur) et des barres de progression après un rendu
function animateCounts() {
  document.querySelectorAll(".count-anim").forEach((el) => {
    const target = parseFloat(el.dataset.countTarget);
    if (Number.isNaN(target)) return;
    const t0 = performance.now();
    const dur = 650;
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtEUR(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmtEUR(target);
    }
    requestAnimationFrame(step);
  });
  document.querySelectorAll("[data-goal-width]").forEach((el) => {
    const w = parseFloat(el.dataset.goalWidth) || 0;
    requestAnimationFrame(() => { el.style.width = `${w}%`; });
  });
}

// Construit l'onglet "Transactions" : liste du mois affiché, bouton import CSV, détection de doublons,
// et chaque ligne (data-edit-id) est cliquable pour ouvrir la fiche d'édition (voir attachViewHandlers)
// État de la recherche/filtre de l'onglet Transactions. Volontairement en dehors de "state" (donc pas sauvegardé) :
// c'est un réglage temporaire d'affichage, pas une donnée à conserver d'une session à l'autre.
let txFilterState = { query: "", allMonths: false };

// Renvoie les transactions à afficher compte tenu du filtre actuel (recherche texte + mois courant ou tous les mois),
// triées de la plus récente à la plus ancienne.
function getFilteredTx() {
  const q = txFilterState.query.toLowerCase().trim();
  let list = txFilterState.allMonths ? state.tx.slice() : getMonthTx();
  if (q) list = list.filter((t) => (t.description || "").toLowerCase().includes(q) || (t.categorie || "").toLowerCase().includes(q));
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

// Construit uniquement le HTML des lignes de la liste (pas le reste de l'onglet), pour pouvoir la rafraîchir
// seule à chaque frappe dans la recherche sans perdre le focus du champ (voir updateTxList)
function renderTxRowsHTML() {
  const list = getFilteredTx();
  if (list.length === 0) {
    return `<div class="empty">${txFilterState.query ? "Aucune transaction ne correspond à ta recherche." : "Aucune transaction ce mois-ci. Ajoute-en une pour commencer."}</div>`;
  }
  return list.map((t) => `
    <div class="tx-row" data-edit-id="${t.id}">
      <div class="tx-left">
        <span class="tx-icon" style="background:${hashColor(t.categorie)}22;">${categoryIcon(t.categorie)}</span>
        <div style="min-width:0;">
          <div class="tx-desc">${esc(t.description) || esc(t.categorie)}</div>
          <div class="tx-meta"><span>${new Date(t.date).toLocaleDateString("fr-FR")}</span>${txFilterState.allMonths ? `<span>${esc(monthLabel(monthKey(t.date)))}</span>` : ""}<span>${esc(t.categorie)}</span></div>
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${t.type === "revenu" ? "rev" : ""}">${t.type === "revenu" ? "+" : "−"}${fmtEUR(t.montant)}</span>
        <button class="tx-del" data-del="${t.id}">✕</button>
      </div>
    </div>
  `).join("");
}
// Construit le bandeau "recatégoriser en masse" : n'apparaît que si une recherche est active et trouve des résultats.
// Permet de changer la catégorie de TOUTES les transactions correspondant à la recherche en une seule fois
// (ex : chercher "Oxytif" puis choisir "salle" pour corriger d'un coup toutes les transactions mal catégorisées).
function renderBulkBarHTML() {
  const q = txFilterState.query.trim();
  if (!q) return "";
  const list = getFilteredTx();
  if (list.length === 0) return "";
  const allCats = [...new Set([...state.cats.depenses, ...state.cats.revenus])];
  return `
    <div class="bulk-cat-bar">
      <div class="bulk-cat-bar-row">
        <span class="bulk-cat-count">${list.length} transaction${list.length > 1 ? "s" : ""} trouvée${list.length > 1 ? "s" : ""}</span>
        <select id="bulkCatSelect">${allCats.map((c) => `<option value="${esc(c)}">${categoryIcon(c)} ${esc(c)}</option>`).join("")}</select>
        <button type="button" class="btn btn-solid" id="bulkApplyBtn">Recatégoriser</button>
      </div>
      ${!txFilterState.allMonths ? `<p class="hint" style="margin:8px 0 0;">Astuce : coche « Tous les mois » ci-dessus pour corriger aussi les mois précédents, pas seulement celui-ci.</p>` : ""}
    </div>
  `;
}
// Applique le changement de catégorie choisi dans le bandeau ci-dessus à toutes les transactions actuellement filtrées
function attachBulkBarHandlers() {
  const btn = document.getElementById("bulkApplyBtn");
  if (!btn) return;
  btn.onclick = () => {
    const newCat = document.getElementById("bulkCatSelect").value;
    const list = getFilteredTx();
    if (!confirm(`Recatégoriser ${list.length} transaction(s) en « ${newCat} » ?`)) return;
    const ids = new Set(list.map((t) => t.id));
    state.tx.forEach((t) => { if (ids.has(t.id)) t.categorie = newCat; });
    persist("tx");
    render();
  };
}
// Rafraîchit uniquement la liste des transactions (appelée à chaque frappe dans la recherche, ou au changement
// du filtre "tous les mois"), sans reconstruire toute la page — ça évite de perdre le focus du champ de recherche.
function updateTxList() {
  const inner = document.getElementById("txListInner");
  const bulkWrap = document.getElementById("bulkBarWrap");
  if (!inner) return;
  inner.innerHTML = renderTxRowsHTML();
  attachTxRowHandlers();
  if (bulkWrap) { bulkWrap.innerHTML = renderBulkBarHTML(); attachBulkBarHandlers(); }
}

function renderTransactions() {
  const dupCount = countDuplicates();
  return `
    <div class="tx-toolbar">
      <h2 class="section-title" style="margin:0;">Transactions</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input type="file" id="csvInput" accept=".csv,.txt" style="display:none;" />
        <button class="btn btn-outline" id="importBtn">⇧ Importer un CSV</button>
        <button class="btn btn-solid" id="addBtnInline">+ Ajouter</button>
      </div>
    </div>
    ${dupCount > 0 ? `
    <div class="hint" style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--gold-light);color:#F7DA9A;padding:10px 12px;border-radius:12px;margin-bottom:12px;">
      <span>⚠ ${dupCount} doublon(s) potentiel(s) détecté(s) dans tout l'historique (même date, montant et libellé).</span>
      <button class="btn btn-outline" id="cleanDupBtn" style="flex-shrink:0;">Nettoyer</button>
    </div>` : ""}
    <div id="importErrorBox"></div>
    <p class="hint">Import automatique reconnu : export <strong>Crédit Agricole</strong> (Date, Libellé, Débit euros, Crédit euros) — catégorisation auto, doublons ignorés automatiquement. Ou format générique : <span class="font-mono">date, montant, description, categorie, type</span>.</p>
    <div class="tx-filter-bar">
      <input type="text" id="txSearch" class="tx-search" placeholder="🔍 Rechercher (description ou catégorie)" autocomplete="off" value="${esc(txFilterState.query)}" />
      <label class="tx-filter-toggle"><input type="checkbox" id="txAllMonths" ${txFilterState.allMonths ? "checked" : ""} /> Tous les mois</label>
    </div>
    <div id="bulkBarWrap">${renderBulkBarHTML()}</div>
    <div class="card">
      <div class="receipt-edge"></div>
      <div class="tx-list" id="txListInner">${renderTxRowsHTML()}</div>
      <div class="receipt-edge bottom"></div>
    </div>
  `;
}

// Supprime une catégorie de la liste (type = "depenses" ou "revenus").
// Les transactions déjà enregistrées avec cette catégorie ne sont PAS supprimées ni modifiées :
// elles garderont juste l'ancien nom de catégorie (elle n'apparaîtra plus dans le formulaire pour les nouvelles transactions).
// On retire aussi son montant prévu de tous les mois du budget, pour ne pas laisser de ligne fantôme.
function removeCategory(type, cat) {
  state.cats[type] = state.cats[type].filter((c) => c !== cat);
  Object.keys(state.budgets).forEach((mk) => { if (state.budgets[mk] && state.budgets[mk][type]) delete state.budgets[mk][type][cat]; });
  persist("cats"); persist("budgets");
}

/* ---------- Transactions récurrentes ---------- */
// Crée automatiquement, pour chaque règle récurrente (loyer, abonnement, salaire...), la transaction du mois
// calendaire réel actuel — mais une seule fois par mois : on retient dans "dernierMoisApplique" le dernier mois
// déjà généré pour cette règle, pour ne jamais la dupliquer même si l'appli est ouverte plusieurs fois dans le mois.
function applyRecurringTransactions() {
  if (!state.recurring.length) return;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let changed = false;
  state.recurring.forEach((r) => {
    if (r.dernierMoisApplique === currentMonthKey) return;
    // On borne le jour à 28 pour que la règle marche aussi pour les mois courts (février)
    const jour = Math.min(Math.max(parseInt(r.jour, 10) || 1, 1), 28);
    const date = `${currentMonthKey}-${String(jour).padStart(2, "0")}`;
    state.tx.push({ id: uid(), type: r.type, date, montant: Number(r.montant) || 0, description: r.description || "", categorie: r.categorie || "autres" });
    r.dernierMoisApplique = currentMonthKey;
    changed = true;
  });
  if (changed) persist(); // enregistre à la fois les nouvelles transactions et la mise à jour des règles récurrentes
}

// Calcule, pour chaque catégorie de dépense, le total réel dépensé mois par mois, sur les N derniers mois
// où il existe au moins une transaction — pour les comparer côte à côte dans un tableau (onglet Budget prévu).
function getMonthlyComparison(monthsBack = 6) {
  const allMonths = [...new Set(state.tx.map((t) => monthKey(t.date)))].sort();
  const months = allMonths.slice(-monthsBack);
  const cats = [...new Set(state.tx.filter((t) => t.type === "depense").map((t) => t.categorie))].sort();
  const table = cats.map((cat) => ({
    cat,
    values: months.map((mk) => state.tx.filter((t) => t.type === "depense" && t.categorie === cat && monthKey(t.date) === mk).reduce((s, t) => s + t.montant, 0)),
  }));
  const totals = months.map((mk, i) => table.reduce((s, row) => s + row.values[i], 0));
  return { months, table, totals };
}

// Construit l'onglet "Budget prévu" : deux colonnes (dépenses/revenus) où on saisit le montant prévu par catégorie,
// avec pour chaque catégorie une icône cliquable (changer l'emoji) et un bouton ✕ (supprimer la catégorie)
function renderBudget() {
  const mb = getMonthBudget();
  // Construit une colonne de catégories (dépenses ou revenus) : icône cliquable + nom + champ montant prévu + bouton supprimer
  const col = (type, list) => list.map((cat) => `
    <div class="budget-row">
      <span class="cat-icon-btn" data-icon-edit="${type}|${esc(cat)}" title="Changer l'icône">${categoryIcon(cat)}</span>
      <span class="name">${esc(cat)}</span>
      <div class="budget-input-wrap">
        <input type="number" step="0.01" placeholder="0" data-prevu="${type}|${esc(cat)}" value="${(mb[type] || {})[cat] !== undefined ? (mb[type] || {})[cat] : ""}" />
        <span style="color:var(--ink40)">€</span>
      </div>
      <button type="button" class="cat-del-btn" data-cat-del="${type}|${esc(cat)}" title="Supprimer cette catégorie">✕</button>
    </div>`).join("");

  const cmp = getMonthlyComparison(6);

  return `
    <div class="grid-2" style="margin-top:0;">
      <div class="card card-pad">
        <h3 class="section-title">Dépenses prévues</h3>
        ${col("depenses", state.cats.depenses)}
      </div>
      <div class="card card-pad">
        <h3 class="section-title">Revenus prévus</h3>
        ${col("revenus", state.cats.revenus)}
      </div>
    </div>
    <p class="hint" style="margin-top:14px;">Astuce : tape sur l'icône d'une catégorie pour la changer, ou sur ✕ pour la supprimer (les transactions déjà enregistrées avec cette catégorie ne sont pas touchées).</p>

    <div class="card card-pad" style="margin-top:20px;">
      <h3 class="section-title">Comparaison sur plusieurs mois</h3>
      ${cmp.months.length < 2 ? `<div class="empty">Pas encore assez de mois différents dans tes transactions pour comparer.</div>` : `
      <div class="cmp-table-wrap">
        <table class="cmp-table">
          <thead><tr><th>Catégorie</th>${cmp.months.map((mk) => `<th>${esc(monthLabel(mk).slice(0, 3))}</th>`).join("")}</tr></thead>
          <tbody>
            ${cmp.table.map((row) => `<tr><td>${categoryIcon(row.cat)} ${esc(row.cat)}</td>${row.values.map((v) => `<td class="font-mono">${v > 0 ? fmtEUR(v).replace(",00", "") : "—"}</td>`).join("")}</tr>`).join("")}
            <tr class="cmp-total-row"><td>Total</td>${cmp.totals.map((v) => `<td class="font-mono">${fmtEUR(v).replace(",00", "")}</td>`).join("")}</tr>
          </tbody>
        </table>
      </div>`}
    </div>

    <div class="card card-pad" style="margin-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <h3 class="section-title" style="margin:0;">Transactions récurrentes</h3>
        <button type="button" class="btn btn-outline" id="addRecurringBtn">+ Ajouter</button>
      </div>
      <p class="hint" style="margin:6px 0 14px;">Une transaction (loyer, abonnement, salaire...) qui se recrée automatiquement chaque mois, au jour indiqué.</p>
      ${state.recurring.length === 0 ? `<div class="empty">Aucune transaction récurrente.</div>` : state.recurring.map((r) => `
        <div class="recurring-item" data-recurring-id="${r.id}">
          <div class="recurring-item-row">
            <select data-rec-field="type" class="rec-select">
              <option value="depense" ${r.type === "depense" ? "selected" : ""}>Dépense</option>
              <option value="revenu" ${r.type === "revenu" ? "selected" : ""}>Revenu</option>
            </select>
            <button type="button" class="tx-del" data-rec-del="${r.id}">✕</button>
          </div>
          <input type="text" data-rec-field="description" class="rec-input" placeholder="Nom (ex : Loyer)" value="${esc(r.description || "")}" />
          <div class="recurring-item-row">
            <select data-rec-field="categorie" class="rec-select">
              ${(r.type === "depense" ? state.cats.depenses : state.cats.revenus).map((c) => `<option value="${esc(c)}" ${c === r.categorie ? "selected" : ""}>${esc(c)}</option>`).join("")}
            </select>
            <div class="budget-input-wrap"><input type="number" step="0.01" data-rec-field="montant" value="${r.montant !== undefined ? r.montant : ""}" placeholder="0" /><span style="color:var(--ink40)">€</span></div>
          </div>
          <div class="recurring-item-row">
            <span class="hint" style="margin:0;">Chaque mois, le jour</span>
            <input type="number" min="1" max="28" data-rec-field="jour" value="${r.jour !== undefined ? r.jour : 1}" style="width:60px;text-align:center;padding:6px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper-dim);" />
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// Construit l'onglet "Année & objectif" : barres vert/rouge du reste par mois, objectif d'épargne (patrimoine total),
// liste des comptes ajoutés manuellement (Livret A, etc.) et réglages (objectif, date, solde de départ)
function renderAnnee() {
  const series = getYearlySeries();
  const compteActuel = getCompteActuel();
  const patrimoine = getPatrimoineTotal();
  const pct = Math.min(100, Math.max(0, (patrimoine / (state.settings.objectif || 1)) * 100));
  const maxAbs = Math.max(...series.map((s) => Math.abs(s.reste)), 1);
  const moisRestants = getMoisRestants();
  const manque = Math.max(0, state.settings.objectif - patrimoine);

  let planHtml = "";
  if (manque <= 0) {
    planHtml = `<div class="goal-plan" style="color:#37D399;">🎉 Objectif atteint !</div>`;
  } else if (state.settings.dateObjectif) {
    if (moisRestants === null) { /* no date */ }
    else if (moisRestants <= 0) {
      planHtml = `<div class="goal-plan" style="color:#FB7A8A;">La date objectif est déjà passée — ajuste-la dans les réglages.</div>`;
    } else {
      const parMois = manque / moisRestants;
      planHtml = `<div class="goal-plan">Il te reste <b>${fmtEUR(manque)}</b> à épargner d'ici <span style="text-transform:capitalize;">${esc(monthLabel(state.settings.dateObjectif))}</span> (${moisRestants} mois) → soit environ <b>${fmtEUR(parMois)}</b> / mois.</div>`;
    }
  }

  return `
    <div class="card card-pad">
      <h3 class="section-title">Reste par mois</h3>
      ${series.length === 0 ? `<div class="empty">Pas encore assez de données.</div>` : `
      <div class="yearly-bars-wrap">
        <div class="yearly-bars">
          ${series.map((s) => `
            <div class="yearly-bar-col">
              <div class="yearly-bar-value font-mono">${s.reste >= 0 ? "+" : ""}${Math.round(s.reste)}€</div>
              <div class="yearly-bar ${s.reste < 0 ? "neg" : ""}" style="height:${Math.max(3, (Math.abs(s.reste) / maxAbs) * 130)}px"></div>
              <div class="yearly-bar-label">${esc(s.label)}</div>
            </div>
          `).join("")}
        </div>
      </div>`}
    </div>

    <div class="card dark card-pad" style="margin-top:20px;">
      <div class="hero-label">🎯 Objectif d'épargne — patrimoine total</div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:6px 0;">
        <div class="hero-amount font-mono" style="font-size:30px;"><span class="count-anim" data-count-target="${patrimoine}">${fmtEUR(patrimoine)}</span></div>
        <div class="font-mono" style="font-size:13px;opacity:0.7;">sur ${fmtEUR(state.settings.objectif)}</div>
      </div>
      <div class="goal-progress"><div class="goal-fill" style="width:0%" data-goal-width="${pct}"></div></div>
      <div class="goal-pct">${pct.toFixed(1)}%</div>
      ${planHtml}
    </div>

    <div class="card card-pad" style="margin-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <h3 class="section-title" style="margin:0;">Mon patrimoine</h3>
        <button class="btn btn-outline" id="addAssetBtn">+ Ajouter un compte</button>
      </div>
      <p class="hint" style="margin:6px 0 14px;">Ton compte courant est calculé automatiquement depuis tes transactions. Ajoute ici tes livrets, PEA / Trade République, assurance-vie, épargne BNP... et mets leur montant à jour toi-même quand tu veux.</p>

      <div class="budget-row" style="padding:8px 0;border-bottom:1px dashed var(--line);">
        <span class="name" style="text-transform:none;font-weight:600;">🏦 Compte courant <span style="font-weight:400;color:var(--ink40);">(auto)</span></span>
        <span class="font-mono" style="font-size:14px;">${fmtEUR(compteActuel)}</span>
      </div>

      ${state.assets.length === 0 ? `<div class="empty" style="padding:16px 0 4px;">Aucun autre compte ajouté.</div>` : state.assets.map((a) => `
        <div class="asset-row" data-asset-id="${a.id}">
          <input type="text" class="asset-name" data-asset-field="nom" placeholder="Nom (ex : Livret A, Trade République...)" value="${esc(a.nom)}" />
          <div class="budget-input-wrap">
            <input type="number" step="0.01" class="asset-amount" data-asset-field="montant" value="${a.montant !== undefined ? a.montant : ""}" placeholder="0" />
            <span style="color:var(--ink40);">€</span>
          </div>
          <button class="tx-del" data-asset-del="${a.id}">✕</button>
        </div>
      `).join("")}

      <div class="budget-row" style="padding-top:10px;border-top:1px solid var(--line);margin-top:6px;">
        <span class="name" style="font-weight:600;">Total patrimoine</span>
        <span class="font-mono" style="font-weight:600;">${fmtEUR(patrimoine)}</span>
      </div>
    </div>

    <div class="card card-pad" style="margin-top:20px;">
      <h3 class="section-title">Réglages</h3>
      <div class="settings-grid">
        <div class="field">
          <label>Objectif d'épargne (€)</label>
          <input type="number" id="setObjectif" value="${state.settings.objectif}" />
        </div>
        <div class="field">
          <label>Date butoir de l'objectif</label>
          <div class="date-field-wrap"><input type="month" id="setDateObjectif" value="${state.settings.dateObjectif || ""}" /></div>
        </div>
        <div class="field">
          <label>Solde de départ du compte courant (€)</label>
          <input type="number" id="setSolde" value="${state.settings.soldeInitial}" />
        </div>
      </div>
      <p class="hint" style="margin-top:14px;">Le compte courant est calculé automatiquement : solde de départ + somme de tous les revenus et dépenses enregistrés. Le patrimoine total additionne ce compte courant et les comptes que tu ajoutes toi-même ci-dessus.</p>
    </div>
  `;
}

/* ---------- Sauvegarde / restauration (export-import manuel) ---------- */
// Regroupe toutes les données de l'appli dans un seul objet, puis déclenche le téléchargement d'un fichier .json
// (c'est ce fichier qu'on transfère à la main vers un autre appareil pour "synchroniser")
function exportData() {
  const payload = {
    _app: "le-carnet", _version: 1, _exportedAt: new Date().toISOString(),
    tx: state.tx, budgets: state.budgets, cats: state.cats, assets: state.assets,
    settings: state.settings, catIcons: state.catIcons, recurring: state.recurring,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `le-carnet-sauvegarde-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Exporte toutes les transactions dans un fichier .csv lisible directement dans Excel/Google Sheets
// (séparateur ";" et virgule décimale, comme les exports bancaires français ; un BOM UTF-8 est ajouté
// en tête de fichier pour qu'Excel affiche correctement les accents).
function exportCSV() {
  // Met une valeur entre guillemets si elle contient le séparateur, un guillemet ou un retour à la ligne (règle CSV standard)
  const csvField = (v) => {
    const s = String(v !== undefined && v !== null ? v : "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [["date", "type", "montant", "description", "categorie"]];
  [...state.tx].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
    const montantFr = Number(t.montant).toFixed(2).replace(".", ",");
    rows.push([t.date, t.type, montantFr, t.description || "", t.categorie]);
  });
  const csv = rows.map((r) => r.map(csvField).join(";")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `le-carnet-transactions-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Lit un fichier de sauvegarde .json (créé par exportData ci-dessus) et REMPLACE toutes les données actuelles
// par celles du fichier. Une confirmation est demandée avant, car c'est une action destructive et irréversible.
function importDataFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(String(reader.result)); }
    catch (e) { alert("Ce fichier n'est pas une sauvegarde valide."); return; }
    if (!data || typeof data !== "object" || !Array.isArray(data.tx)) {
      alert("Ce fichier n'est pas une sauvegarde valide du Carnet.");
      return;
    }
    if (!confirm("Importer cette sauvegarde va REMPLACER toutes les données actuellement sur cet appareil. Continuer ?")) return;
    state.tx = data.tx || [];
    state.budgets = data.budgets || {};
    state.cats = data.cats || DEFAULT_CATS;
    state.assets = data.assets || [];
    state.settings = { ...state.settings, ...(data.settings || {}) };
    state.catIcons = data.catIcons || {};
    state.recurring = data.recurring || [];
    persist();
    render();
    alert("Sauvegarde importée avec succès.");
  };
  reader.readAsText(file);
}

/* ---------- Handlers de vue ---------- */
// Câble le clic sur ✕ (supprimer) et sur la ligne (éditer) pour toutes les lignes de transaction affichées.
// Fonction séparée de attachViewHandlers() pour pouvoir la relancer seule quand seule la liste est rafraîchie
// (recherche/filtre dans l'onglet Transactions), sans reconstruire tout le reste de l'écran.
function attachTxRowHandlers() {
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); state.tx = state.tx.filter((t) => t.id !== btn.dataset.del); persist("tx"); render(); };
  });
  document.querySelectorAll("[data-edit-id]").forEach((row) => {
    row.onclick = () => {
      const t = state.tx.find((x) => x.id === row.dataset.editId);
      if (t) openTxModal(t);
    };
  });
}

function attachViewHandlers() {
  // Supprimer / éditer une transaction (voir attachTxRowHandlers ci-dessous, réutilisée aussi quand on filtre la liste)
  attachTxRowHandlers();
  attachBulkBarHandlers();
  // Barre de recherche/filtre des transactions : à chaque frappe ou changement de case, on met à jour txFilterState
  // puis on redessine seulement la liste (updateTxList), pas toute la page, pour ne pas perdre le focus du champ.
  const txSearchInput = document.getElementById("txSearch");
  if (txSearchInput) txSearchInput.oninput = () => { txFilterState.query = txSearchInput.value; updateTxList(); };
  const txAllMonthsInput = document.getElementById("txAllMonths");
  if (txAllMonthsInput) txAllMonthsInput.onchange = () => { txFilterState.allMonths = txAllMonthsInput.checked; updateTxList(); };
  // Supprimer une catégorie (bouton ✕ à côté d'une catégorie dans l'onglet Budget prévu)
  document.querySelectorAll("[data-cat-del]").forEach((btn) => {
    btn.onclick = () => {
      const [type, cat] = btn.dataset.catDel.split("|");
      if (confirm(`Supprimer la catégorie "${cat}" ? (les transactions déjà enregistrées avec cette catégorie ne seront pas modifiées)`)) {
        removeCategory(type, cat);
        render();
      }
    };
  });
  // Changer l'icône d'une catégorie (clic sur l'emoji dans l'onglet Budget prévu)
  document.querySelectorAll("[data-icon-edit]").forEach((btn) => {
    btn.onclick = () => {
      const [, cat] = btn.dataset.iconEdit.split("|");
      const nouvelle = prompt(`Nouvel emoji pour "${cat}" (copie-colle un emoji, ex : 🥖)`, categoryIcon(cat));
      if (nouvelle && nouvelle.trim()) {
        state.catIcons[cat.toLowerCase()] = nouvelle.trim();
        persist("catIcons");
        render();
      }
    };
  });
  const addBtnInline = document.getElementById("addBtnInline");
  if (addBtnInline) addBtnInline.onclick = () => openTxModal(null);

  const cleanDupBtn = document.getElementById("cleanDupBtn");
  if (cleanDupBtn) cleanDupBtn.onclick = () => {
    const n = removeDuplicates();
    render();
    const box = document.getElementById("importErrorBox");
    if (box) box.innerHTML = `<div class="hint" style="color:var(--sage);margin-bottom:12px;">✓ ${n} doublon(s) supprimé(s).</div>`;
  };

  const importBtn = document.getElementById("importBtn");
  const csvInput = document.getElementById("csvInput");
  if (importBtn && csvInput) {
    importBtn.onclick = () => csvInput.click();
    csvInput.onchange = (e) => { if (e.target.files[0]) handleImport(e.target.files[0]); };
  }

  document.querySelectorAll("[data-prevu]").forEach((input) => {
    input.onchange = () => {
      const [type, cat] = input.dataset.prevu.split("|");
      const cur = state.budgets[state.month] || { depenses: {}, revenus: {} };
      cur[type] = cur[type] || {};
      cur[type][cat] = parseFloat(input.value) || 0;
      state.budgets[state.month] = cur;
      persist("budgets");
    };
  });

  const setObjectif = document.getElementById("setObjectif");
  const setSolde = document.getElementById("setSolde");
  const setDateObjectif = document.getElementById("setDateObjectif");
  if (setObjectif) setObjectif.onchange = () => { state.settings.objectif = parseFloat(setObjectif.value) || 0; persist("settings"); render(); };
  if (setSolde) setSolde.onchange = () => { state.settings.soldeInitial = parseFloat(setSolde.value) || 0; persist("settings"); render(); };
  if (setDateObjectif) setDateObjectif.onchange = () => { state.settings.dateObjectif = setDateObjectif.value || ""; persist("settings"); render(); };

  const addAssetBtn = document.getElementById("addAssetBtn");
  if (addAssetBtn) addAssetBtn.onclick = () => {
    state.assets.push({ id: uid(), nom: "", montant: 0 });
    persist("assets");
    render();
    const lastInput = document.querySelector(`[data-asset-id="${state.assets[state.assets.length - 1].id}"] .asset-name`);
    if (lastInput) lastInput.focus();
  };
  document.querySelectorAll("[data-asset-field]").forEach((input) => {
    input.onchange = () => {
      const row = input.closest("[data-asset-id]");
      const id = row.dataset.assetId;
      const asset = state.assets.find((a) => a.id === id);
      if (!asset) return;
      const field = input.dataset.assetField;
      asset[field] = field === "montant" ? (parseFloat(input.value) || 0) : input.value;
      persist("assets");
      if (field === "montant") render();
    };
  });
  document.querySelectorAll("[data-asset-del]").forEach((btn) => {
    btn.onclick = () => { state.assets = state.assets.filter((a) => a.id !== btn.dataset.assetDel); persist("assets"); render(); };
  });

  // Transactions récurrentes (onglet Budget prévu) : ajout, modification des champs, suppression
  const addRecurringBtn = document.getElementById("addRecurringBtn");
  if (addRecurringBtn) addRecurringBtn.onclick = () => {
    state.recurring.push({ id: uid(), type: "depense", description: "", categorie: state.cats.depenses[0] || "autres", montant: 0, jour: 1, dernierMoisApplique: null });
    persist("recurring");
    render();
  };
  document.querySelectorAll("[data-recurring-id]").forEach((item) => {
    const rule = state.recurring.find((r) => r.id === item.dataset.recurringId);
    if (!rule) return;
    item.querySelectorAll("[data-rec-field]").forEach((input) => {
      input.onchange = () => {
        const field = input.dataset.recField;
        if (field === "montant") rule.montant = parseFloat(input.value) || 0;
        else if (field === "jour") rule.jour = Math.min(28, Math.max(1, parseInt(input.value, 10) || 1));
        else rule[field] = input.value;
        persist("recurring");
        // Si le type change, la liste de catégories proposées change aussi -> on redessine tout l'onglet
        if (field === "type") render();
      };
    });
  });
  document.querySelectorAll("[data-rec-del]").forEach((btn) => {
    btn.onclick = () => { state.recurring = state.recurring.filter((r) => r.id !== btn.dataset.recDel); persist("recurring"); render(); };
  });
}

/* ---------- Import (parseur minimal, sans dépendance externe) ---------- */
// Tokenizer CSV respectueux des guillemets, y compris les champs contenant des retours à la ligne
function tokenizeCSV(text, delim) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { inQ = false; }
      } else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\r") { /* ignore */ }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}
// Devine si le CSV utilise "," ou ";" comme séparateur, en comptant les occurrences de chaque sur un échantillon du fichier
// (les exports bancaires français utilisent presque toujours ";" à cause de la virgule décimale)
function detectDelim(text) {
  const sample = text.slice(0, 3000);
  const semi = (sample.match(/;/g) || []).length;
  const comma = (sample.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

// Convertit une date en format ISO "AAAA-MM-JJ" (celui utilisé partout dans l'appli), à partir soit d'une date déjà ISO,
// soit d'une date française "JJ/MM/AAAA" (format des exports bancaires). Si le format est inconnu, renvoie la date du jour.
function toISODate(str) {
  if (!str) return new Date().toISOString().slice(0, 10);
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return new Date().toISOString().slice(0, 10);
}

// Règles de catégorisation automatique à l'import CSV : chaque ligne associe une expression régulière (mots-clés
// repérés dans le libellé de la transaction, insensible à la casse grâce au "i") à une catégorie de dépense.
// La première règle qui correspond gagne — c'est pour ça que l'ordre peut avoir une petite importance.
const CATEGORY_RULES_DEP = [
  [/leclerc|carrefour|\bcrf\b|monoprix|lidl|franprix|super\s?u|intermarch|casino|auchan/i, "courses"],
  [/uber\s?\*?eats|deliveroo|just\s?eat|restaurant|brasserie|bistro/i, "resto"],
  [/total\s?access|totalenergies|station|essence|\besso\b|\bbp\b|avia/i, "gasoil"],
  [/canal\s?\+|netflix|spotify|disney/i, "canal"],
  [/groupama|maif|\baxa\b|allianz|matmut|assurance/i, "groupama"],
  [/fitness\s?park|basic\s?fit|keepcool|vitaligym|salle\s?de\s?sport|club-?employ/i, "salle"],
  [/weezevent|ankama|premium events|billetterie|cinema|ugc|path[eé]|concert|fnac spectacles|viparis|sumup/i, "loisirs"],
  [/cadeau|fleurs|bijouterie/i, "cadeaux"],
  [/brico\s?depot|brico\s?d[ée]p[oô]t|castorama|leroy\s?merlin/i, "bricolage"],
  [/orange|\bfree\b|\bsfr\b|bouygues telecom|box\s?internet/i, "internet"],
];
// Même principe que CATEGORY_RULES_DEP mais pour les revenus (crédits)
const CATEGORY_RULES_REV = [
  [/salaire|\bpaie\b|virement.*salaire/i, "salaire"],
  [/\bcaf\b/i, "caf"],
];
// Applique les règles ci-dessus au texte du libellé ; si aucune règle ne matche, la catégorie par défaut est "autres"
// (l'utilisateur peut ensuite la corriger manuellement en tapant sur la transaction — voir openTxModal)
function guessCategory(text, type) {
  const rules = type === "depense" ? CATEGORY_RULES_DEP : CATEGORY_RULES_REV;
  for (const [re, cat] of rules) if (re.test(text)) return cat;
  return "autres";
}

// Extrait une description lisible à partir du libellé brut Crédit Agricole (souvent multi-ligne)
function cleanLibelle(libRaw) {
  const lines = String(libRaw || "").split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return "";
  const first = lines[0];
  let kind = "autre";
  if (/^paiement par carte$/i.test(first)) kind = "carte";
  else if (/^pr[ée]l[eè]vement$/i.test(first)) kind = "prelevement";
  else if (/^virement en votre faveur$/i.test(first)) kind = "virement";
  let body = lines.length > 1 ? lines[1] : first;

  if (kind === "carte") {
    body = body.replace(/^X\d+\s*/i, "");
    const parts = body.split(" - ");
    body = parts.length > 1 ? parts[parts.length - 1] : body.replace(/\b\d{1,2}\/\d{1,2}\b\s*$/, "");
  } else if (kind === "prelevement") {
    const parts = body.split(" - ");
    body = parts.length >= 2 ? parts[1] : parts[0];
  } else if (kind === "virement") {
    const parts = body.split(" - ");
    body = parts[0].replace(/^DE\s+/i, "");
  }
  body = body.replace(/\s+[A-Z0-9]{6,}\s*$/, "").replace(/\s{2,}/g, " ").trim();
  return body || first;
}

// Construit une "empreinte" unique pour une transaction (date + montant + type + description).
// Deux transactions avec la même empreinte sont considérées comme des doublons (typiquement : ré-import du même CSV).
function txKey(t) {
  return `${t.date}|${Number(t.montant).toFixed(2)}|${t.type}|${String(t.description || "").toLowerCase().trim()}`;
}
// Compte le nombre de transactions en double dans tout l'historique (utilisé pour afficher le bandeau d'alerte)
function countDuplicates() {
  const seen = new Set();
  let count = 0;
  state.tx.forEach((t) => { const k = txKey(t); if (seen.has(k)) count++; else seen.add(k); });
  return count;
}
// Supprime les transactions en double (garde la première occurrence de chaque empreinte), appelé par le bouton "Nettoyer"
function removeDuplicates() {
  const seen = new Set();
  const before = state.tx.length;
  state.tx = state.tx.filter((t) => {
    const k = txKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  persist("tx");
  return before - state.tx.length;
}

// Lit un fichier CSV importé par l'utilisateur et l'ajoute aux transactions.
// Deux formats sont reconnus automatiquement :
// 1) Export Crédit Agricole : préambule + tableau avec colonnes Date/Libellé/Débit euros/Crédit euros
// 2) Format générique : colonnes date, montant, description, categorie, type
// Dans les deux cas : catégorisation automatique (format CA), déduplication, et fusion avec les catégories existantes.
function handleImport(file) {
  const box = document.getElementById("importErrorBox");
  box.innerHTML = "";
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result);
      const delim = detectDelim(text);
      const rows = tokenizeCSV(text, delim).filter((r) => r.some((c) => c.trim().length > 0));
      if (rows.length === 0) {
        box.innerHTML = `<div class="err-box">⚠ Le fichier semble vide.</div>`;
        return;
      }

      // Cherche la ligne d'en-tête réelle (l'export Crédit Agricole a un préambule avant le tableau)
      let headerIdx = -1, dateKey = -1, libKey = -1, debKey = -1, credKey = -1;
      for (let i = 0; i < rows.length; i++) {
        const cellsLower = rows[i].map((c) => c.toLowerCase().trim());
        const dIdx = cellsLower.findIndex((c) => c === "date");
        const lIdx = cellsLower.findIndex((c) => /libell/.test(c));
        if (dIdx !== -1 && lIdx !== -1) {
          headerIdx = i; dateKey = dIdx; libKey = lIdx;
          debKey = cellsLower.findIndex((c) => /d[ée]bit/.test(c));
          credKey = cellsLower.findIndex((c) => /cr[ée]dit/.test(c));
          break;
        }
      }

      let parsed = [];
      let isCAFormat = false;
      if (headerIdx !== -1 && (debKey !== -1 || credKey !== -1)) {
        isCAFormat = true;
        const dataRows = rows.slice(headerIdx + 1).filter((r) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test((r[dateKey] || "").trim()));
        parsed = dataRows.map((r) => {
          const debitRaw = (r[debKey] || "").replace(/[€\s]/g, "").replace(",", ".");
          const creditRaw = (r[credKey] || "").replace(/[€\s]/g, "").replace(",", ".");
          const debit = parseFloat(debitRaw) || 0;
          const credit = parseFloat(creditRaw) || 0;
          const type = credit > 0 ? "revenu" : "depense";
          const montant = credit > 0 ? credit : debit;
          const libRaw = r[libKey] || "";
          const flat = libRaw.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim();
          return {
            id: uid(),
            date: toISODate(r[dateKey]),
            montant,
            description: cleanLibelle(libRaw),
            categorie: guessCategory(flat, type),
            type,
          };
        }).filter((r) => r.montant > 0 && !/taux\s*[\d,.]+\s*%/i.test(r.description) && !/d[ée]compte/i.test(r.description));
      } else {
        const headers = rows[0].map((h) => h.toLowerCase().trim());
        const required = ["date", "montant", "categorie", "type"];
        if (!required.every((r) => headers.includes(r))) {
          box.innerHTML = `<div class="err-box">⚠ Colonnes non reconnues. Formats acceptés : export Crédit Agricole (Date, Libellé, Débit euros, Crédit euros), ou générique (date, montant, description, categorie, type).</div>`;
          return;
        }
        const idx = (name) => headers.indexOf(name);
        parsed = rows.slice(1).map((cells) => {
          const montantRaw = String(cells[idx("montant")] || "").replace(/[€\s]/g, "").replace(",", ".");
          return {
            id: uid(),
            date: toISODate(cells[idx("date")]),
            montant: Math.abs(parseFloat(montantRaw)) || 0,
            description: cells[idx("description")] || "",
            categorie: (cells[idx("categorie")] || "autres").toLowerCase().trim(),
            type: (cells[idx("type")] || "depense").toLowerCase().trim() === "revenu" ? "revenu" : "depense",
          };
        }).filter((r) => r.montant > 0);
      }

      // Ignore les transactions déjà présentes (même date, montant, type, libellé) — évite les doublons si le même fichier/période est réimporté
      const existingKeys = new Set(state.tx.map(txKey));
      const seenInBatch = new Set();
      const deduped = [];
      let skipped = 0;
      parsed.forEach((t) => {
        const k = txKey(t);
        if (existingKeys.has(k) || seenInBatch.has(k)) { skipped++; return; }
        seenInBatch.add(k);
        deduped.push(t);
      });
      parsed = deduped;

      if (parsed.length === 0) {
        box.innerHTML = skipped > 0
          ? `<div class="hint" style="margin-bottom:12px;">Toutes les opérations de ce fichier étaient déjà importées (${skipped} doublon(s) ignoré(s)).</div>`
          : `<div class="err-box">⚠ Aucune opération valide trouvée dans le fichier.</div>`;
        return;
      }

      state.tx = state.tx.concat(parsed);
      const setDep = new Set(state.cats.depenses), setRev = new Set(state.cats.revenus);
      parsed.forEach((p) => (p.type === "depense" ? setDep : setRev).add(p.categorie));
      state.cats = { depenses: [...setDep], revenus: [...setRev] };
      persist();
      const months = parsed.map((t) => monthKey(t.date)).sort();
      state.month = months[months.length - 1];
      render();

      const skipNote = skipped > 0 ? ` (${skipped} doublon(s) ignoré(s))` : "";
      const importBoxAfter = document.getElementById("importErrorBox");
      if (importBoxAfter) {
        importBoxAfter.innerHTML = isCAFormat
          ? `<div class="hint" style="color:var(--sage);margin-bottom:12px;">✓ Format Crédit Agricole détecté — ${parsed.length} opération(s) importée(s) avec catégorisation automatique${skipNote}. Vérifie et corrige les catégories si besoin.</div>`
          : `<div class="hint" style="color:var(--sage);margin-bottom:12px;">✓ ${parsed.length} opération(s) importée(s)${skipNote}.</div>`;
      }
    } catch (e) {
      box.innerHTML = `<div class="err-box">⚠ Le fichier n'a pas pu être lu (${esc(e.message || "erreur inconnue")}).</div>`;
    }
  };
  reader.readAsText(file, "ISO-8859-1");
}

/* ---------- Modal d'ajout / édition ---------- */
function openTxModal(existing) {
  const isEdit = !!existing;
  const root = document.getElementById("modalRoot");
  let type = existing ? existing.type : "depense";
  const todayISO = new Date().toISOString().slice(0, 10);

  // Renvoie la liste des catégories disponibles selon le type sélectionné (dépense ou revenu)
  function optionsFor(t) { return (t === "depense" ? state.cats.depenses : state.cats.revenus); }

  // (Re)dessine tout le contenu de la fenêtre modale — appelée à l'ouverture, et à chaque fois qu'on change
  // le type (dépense/revenu) puisque la liste des catégories proposées change
  function paint() {
    const currentCat = existing ? existing.categorie : "";
    const catList = optionsFor(type);
    root.innerHTML = `
      <div class="modal-backdrop" id="backdrop">
        <form class="modal" id="addForm">
          <div class="modal-head">
            <h3>${isEdit ? "Modifier la transaction" : "Nouvelle transaction"}</h3>
            <button type="button" id="closeModal">✕</button>
          </div>
          <div class="type-switch">
            <button type="button" data-type="depense" class="${type === "depense" ? "active-dep" : ""}">Dépense</button>
            <button type="button" data-type="revenu" class="${type === "revenu" ? "active-rev" : ""}">Revenu</button>
          </div>
          <div class="field"><label>Montant (€)</label><input type="number" step="0.01" min="0" required id="fMontant" placeholder="0,00" value="${existing ? existing.montant : ""}" /></div>
          <div class="field"><label>Date</label><div class="date-field-wrap"><input type="date" id="fDate" value="${existing ? existing.date : todayISO}" /></div></div>
          <div class="field"><label>Description (optionnel)</label><input type="text" id="fDesc" placeholder="ex : courses Leclerc" value="${existing ? esc(existing.description || "") : ""}" /></div>
          <div class="field cat-field-wrap">
            <label>Catégorie</label>
            <!-- Champ texte + liste de suggestions "maison" (pas de <datalist> natif : mal supporté et peu fiable
                 sur les claviers Android). Le filtrage se fait nous-mêmes en JS ci-dessous, à chaque frappe. -->
            <input type="text" id="fCat" autocomplete="off" placeholder="tape pour chercher ou créer une catégorie" value="${esc(currentCat)}" />
            <div class="cat-suggestions" id="fCatSuggestions"></div>
          </div>
          <button type="submit" class="submit-btn">${isEdit ? "Enregistrer les modifications" : "Enregistrer"}</button>
          ${isEdit ? `<button type="button" class="link-btn" id="deleteTxBtn" style="width:100%;margin-top:10px;text-align:center;color:var(--rust);border-color:var(--rust-light);padding:10px;">Supprimer cette transaction</button>` : ""}
        </form>
      </div>
    `;
    document.getElementById("backdrop").onclick = (e) => { if (e.target.id === "backdrop") root.innerHTML = ""; };
    document.getElementById("closeModal").onclick = () => (root.innerHTML = "");
    document.querySelectorAll(".type-switch button").forEach((b) => {
      b.onclick = () => { type = b.dataset.type; paint(); };
    });
    // Suggestions de catégorie : à chaque frappe/focus, on filtre catList "à la main" (inclut le texte tapé,
    // insensible à la casse) et on affiche le résultat dans une liste custom sous le champ.
    const fCat = document.getElementById("fCat");
    const fCatSuggestions = document.getElementById("fCatSuggestions");
    function renderCatSuggestions() {
      const q = fCat.value.toLowerCase().trim();
      const matches = catList.filter((c) => c.toLowerCase().includes(q));
      if (matches.length === 0) { fCatSuggestions.classList.remove("show"); fCatSuggestions.innerHTML = ""; return; }
      fCatSuggestions.innerHTML = matches.map((c) => `<div class="cat-suggestion-item" data-cat-suggest="${esc(c)}">${categoryIcon(c)} ${esc(c)}</div>`).join("");
      fCatSuggestions.classList.add("show");
    }
    fCat.addEventListener("focus", renderCatSuggestions);
    fCat.addEventListener("input", renderCatSuggestions);
    // Un petit délai avant de cacher la liste au "blur" : sinon le clic sur une suggestion n'a pas le temps de se déclencher
    // (le blur du champ arrive avant le clic sur l'élément de la liste)
    fCat.addEventListener("blur", () => setTimeout(() => fCatSuggestions.classList.remove("show"), 150));
    fCatSuggestions.addEventListener("click", (e) => {
      const item = e.target.closest("[data-cat-suggest]");
      if (!item) return;
      fCat.value = item.dataset.catSuggest;
      fCatSuggestions.classList.remove("show");
    });
    const deleteTxBtn = document.getElementById("deleteTxBtn");
    if (deleteTxBtn) deleteTxBtn.onclick = () => {
      state.tx = state.tx.filter((t) => t.id !== existing.id);
      persist("tx");
      root.innerHTML = "";
      render();
    };
    document.getElementById("addForm").onsubmit = (e) => {
      e.preventDefault();
      const montant = parseFloat(document.getElementById("fMontant").value);
      if (!montant || montant <= 0) return;
      const date = document.getElementById("fDate").value || todayISO;
      const description = document.getElementById("fDesc").value;
      const categorie = (document.getElementById("fCat").value || "autres").toLowerCase().trim();
      const key = type === "depense" ? "depenses" : "revenus";
      if (!state.cats[key].includes(categorie)) state.cats[key].push(categorie);

      if (isEdit) {
        const t = state.tx.find((x) => x.id === existing.id);
        if (t) { t.type = type; t.date = date; t.montant = montant; t.description = description; t.categorie = categorie; }
      } else {
        state.tx.push({ id: uid(), type, date, montant, description, categorie });
      }
      persist();
      root.innerHTML = "";
      state.month = monthKey(date);
      render();
    };
  }
  paint();
}

/* ---------- Navigation ---------- */
function shiftMonth(delta) {
  const [y, m] = state.month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  render();
}

/* ---------- Fenêtre Réglages (gestion de l'appli : tutoriel, sauvegarde) ---------- */
// Regroupe les actions qui concernent l'appli elle-même (pas les données financières, qui restent
// dans leurs onglets respectifs) : revoir le tutoriel, exporter/importer une sauvegarde.
function openSettingsModal() {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="settingsBackdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Réglages</h3>
          <button type="button" id="closeSettings">✕</button>
        </div>
        <h3 class="section-title" style="margin-top:4px;">Tutoriel</h3>
        <button type="button" class="btn btn-outline" id="replayTutoBtn" style="width:100%;justify-content:center;margin-bottom:20px;">🔎 Revoir le tutoriel de bienvenue</button>

        <h3 class="section-title">Sauvegarde</h3>
        <p class="hint" style="margin:0 0 14px;">Tes données restent uniquement sur cet appareil. Pour les retrouver sur un autre téléphone ou un PC, exporte un fichier de sauvegarde ici, transfère-le (mail, drive, clé USB...), puis importe-le sur l'autre appareil.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-outline" id="exportDataBtn">⬇ Exporter mes données (.json)</button>
          <button type="button" class="btn btn-outline" id="exportCSVBtn">⬇ Exporter en CSV (Excel)</button>
          <button type="button" class="btn btn-outline" id="importDataBtn">⬆ Importer une sauvegarde</button>
          <input type="file" id="importDataFile" accept="application/json" style="display:none;" />
        </div>

        <h3 class="section-title" style="margin-top:20px;">Verrouillage</h3>
        <p class="hint" style="margin:0 0 14px;">${localStorage.getItem(LS_KEYS.pin) ? "Un code PIN est actuellement demandé à l'ouverture de l'appli." : "Aucun code demandé à l'ouverture. Utile si quelqu'un d'autre peut avoir accès à cet appareil."}</p>
        <button type="button" class="btn btn-outline" id="pinToggleBtn" style="width:100%;justify-content:center;">${localStorage.getItem(LS_KEYS.pin) ? "🔓 Désactiver le code PIN" : "🔒 Activer un code PIN (4 chiffres)"}</button>
      </div>
    </div>
  `;
  document.getElementById("settingsBackdrop").onclick = (e) => { if (e.target.id === "settingsBackdrop") root.innerHTML = ""; };
  document.getElementById("closeSettings").onclick = () => (root.innerHTML = "");
  document.getElementById("replayTutoBtn").onclick = () => { root.innerHTML = ""; showOnboarding(); };
  document.getElementById("exportDataBtn").onclick = () => exportData();
  document.getElementById("exportCSVBtn").onclick = () => exportCSV();
  document.getElementById("pinToggleBtn").onclick = () => {
    if (localStorage.getItem(LS_KEYS.pin)) {
      const saisi = prompt("Entre ton code PIN actuel pour désactiver le verrouillage :");
      if (saisi === null) return;
      if (saisi.trim() !== localStorage.getItem(LS_KEYS.pin)) { alert("Code incorrect."); return; }
      localStorage.removeItem(LS_KEYS.pin);
      alert("Verrouillage désactivé.");
    } else {
      const p1 = prompt("Choisis un code PIN à 4 chiffres :");
      if (p1 === null) return;
      if (!/^\d{4}$/.test(p1.trim())) { alert("Le code doit contenir exactement 4 chiffres."); return; }
      const p2 = prompt("Confirme le code PIN :");
      if (p2 === null) return;
      if (p2.trim() !== p1.trim()) { alert("Les deux codes ne correspondent pas."); return; }
      localStorage.setItem(LS_KEYS.pin, p1.trim());
      alert("Verrouillage activé — le code sera demandé au prochain lancement de l'appli.");
    }
    openSettingsModal(); // redessine la fenêtre pour mettre à jour le texte/bouton selon le nouvel état
  };
  const importDataBtn = document.getElementById("importDataBtn");
  const importDataFileInput = document.getElementById("importDataFile");
  importDataBtn.onclick = () => importDataFileInput.click();
  importDataFileInput.onchange = () => {
    if (importDataFileInput.files && importDataFileInput.files[0]) importDataFile(importDataFileInput.files[0]);
    importDataFileInput.value = "";
  };
}

/* ---------- Tutoriel de bienvenue (onboarding) ---------- */
// Contenu des écrans du tutoriel : chaque étape a un emoji (illustration), un titre et un texte court.
// Pour ajouter/modifier une étape, il suffit de modifier ce tableau — le reste (points, boutons, navigation) s'adapte tout seul.
const ONBOARDING_SLIDES = [
  { icon: "📒", title: "Bienvenue dans Le Carnet", text: "Ton budget, géré simplement. Toutes tes données restent uniquement sur cet appareil — rien n'est jamais envoyé sur un serveur." },
  { icon: "📊", title: "Le tableau de bord", text: "En un coup d'œil : ce qu'il te reste à vivre ce mois-ci, ce que tu as prévu vs réellement dépensé par catégorie, et la répartition de tes dépenses." },
  { icon: "➕", title: "Ajouter une transaction", text: "Le bouton vert « + » ajoute une dépense ou un revenu. Tape ensuite sur n'importe quelle transaction de la liste pour la modifier ou la supprimer." },
  { icon: "🔍", title: "Rechercher et recatégoriser en masse", text: "Dans Transactions, la recherche retrouve toutes les opérations d'un commerçant (ex : « Oxytif »). Si elles sont mal catégorisées, choisis la bonne catégorie dans le bandeau qui apparaît pour toutes les corriger d'un coup — coche « Tous les mois » pour remonter dans tout l'historique." },
  { icon: "📥", title: "Importer ton relevé bancaire", text: "Toujours dans Transactions, importe directement le CSV exporté par ta banque (Crédit Agricole reconnu automatiquement) : les catégories se remplissent toutes seules, à toi de corriger si besoin." },
  { icon: "🎯", title: "Budget prévu", text: "Fixe un montant prévu par catégorie. Tape sur l'icône d'une catégorie pour changer son emoji, ou sur le ✕ pour la supprimer. Un tableau compare aussi tes dépenses réelles sur les 6 derniers mois." },
  { icon: "🔁", title: "Transactions récurrentes", text: "Toujours dans Budget prévu : configure une fois ton loyer, tes abonnements ou ton salaire, et ils se recréeront automatiquement chaque mois, au jour indiqué." },
  { icon: "💰", title: "Année & objectif", text: "Suis ton reste par mois sur toute l'année, ton patrimoine total (comptes ajoutés à la main + compte courant automatique), et fixe un objectif d'épargne avec une date." },
  { icon: "⚙️", title: "Les réglages", text: "L'icône ⚙️ en haut à droite regroupe ce tutoriel (pour le revoir quand tu veux), l'export de tes données (fichier de sauvegarde ou CSV pour Excel), l'import d'une sauvegarde, et un code PIN optionnel pour protéger l'ouverture de l'appli." },
];

let onboardingStep = 0;
// Affiche le tutoriel. Appelée automatiquement au tout premier lancement (voir init()), ou manuellement
// via le bouton "Revoir le tutoriel" dans les réglages.
function showOnboarding() {
  onboardingStep = 0;
  document.getElementById("onboardingRoot").innerHTML = `
    <div class="onboarding-backdrop" id="obBackdrop">
      <div class="onboarding-card" id="obCard">
        <button type="button" class="onboarding-skip" id="obSkip">Passer</button>
        <div id="obContent"></div>
        <div class="onboarding-dots" id="obDots"></div>
        <div class="onboarding-nav">
          <button type="button" class="btn btn-outline" id="obPrev">Précédent</button>
          <button type="button" class="btn btn-solid" id="obNext">Suivant</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("obSkip").onclick = closeOnboarding;
  document.getElementById("obPrev").onclick = () => { onboardingStep = Math.max(0, onboardingStep - 1); paintOnboarding(); };
  document.getElementById("obNext").onclick = () => {
    if (onboardingStep >= ONBOARDING_SLIDES.length - 1) { closeOnboarding(); return; }
    onboardingStep++; paintOnboarding();
  };
  paintOnboarding();
}
// (Re)dessine uniquement le contenu de l'étape actuelle + les points de navigation, sans reconstruire toute la carte
function paintOnboarding() {
  const s = ONBOARDING_SLIDES[onboardingStep];
  const isLast = onboardingStep === ONBOARDING_SLIDES.length - 1;
  document.getElementById("obContent").innerHTML = `
    <div class="onboarding-icon">${s.icon}</div>
    <h3 class="onboarding-title">${esc(s.title)}</h3>
    <p class="onboarding-text">${esc(s.text)}</p>
  `;
  document.getElementById("obDots").innerHTML = ONBOARDING_SLIDES.map((_, i) =>
    `<span class="onboarding-dot ${i === onboardingStep ? "active" : ""}" data-ob-dot="${i}"></span>`
  ).join("");
  document.querySelectorAll("[data-ob-dot]").forEach((dot) => {
    dot.onclick = () => { onboardingStep = parseInt(dot.dataset.obDot, 10); paintOnboarding(); };
  });
  document.getElementById("obPrev").style.visibility = onboardingStep === 0 ? "hidden" : "visible";
  document.getElementById("obNext").textContent = isLast ? "Commencer" : "Suivant";
}
// Ferme le tutoriel et retient définitivement qu'il a déjà été vu (pour ne pas le réafficher au prochain lancement)
function closeOnboarding() {
  document.getElementById("onboardingRoot").innerHTML = "";
  localStorage.setItem(LS_KEYS.onboarded, "1");
}

/* ---------- Verrouillage par code PIN ---------- */
// Au démarrage : si un PIN a été configuré (voir openSettingsModal), on bloque l'accès derrière un écran de saisie
// avant de démarrer l'appli. C'est juste un frein d'accès simple (pas un vrai chiffrement) — largement suffisant
// pour empêcher un regard indiscret sur un téléphone partagé ou égaré, mais pas une protection cryptographique.
function checkPinLock() {
  const pin = localStorage.getItem(LS_KEYS.pin);
  if (!pin) { bootApp(); return; }
  document.getElementById("lockRoot").innerHTML = `
    <div class="onboarding-backdrop">
      <div class="onboarding-card">
        <div class="onboarding-icon">🔒</div>
        <h3 class="onboarding-title">Appli verrouillée</h3>
        <p class="onboarding-text">Entre ton code PIN pour continuer.</p>
        <input type="password" inputmode="numeric" maxlength="4" id="lockInput" class="lock-input" autofocus />
        <div id="lockError" class="lock-error"></div>
        <button type="button" class="btn btn-solid" id="lockSubmit" style="width:100%;justify-content:center;margin-top:14px;">Déverrouiller</button>
      </div>
    </div>
  `;
  const input = document.getElementById("lockInput");
  const tryUnlock = () => {
    if (input.value.trim() === pin) {
      document.getElementById("lockRoot").innerHTML = "";
      bootApp();
    } else {
      document.getElementById("lockError").textContent = "Code incorrect, réessaie.";
      input.value = "";
      input.focus();
    }
  };
  document.getElementById("lockSubmit").onclick = tryUnlock;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
  input.focus();
}

/* ---------- Init ---------- */
function init() {
  loadState();
  document.getElementById("loading").style.display = "none";
  checkPinLock();
}

// Démarrage effectif de l'appli (après un éventuel déverrouillage par PIN, ou immédiatement s'il n'y en a pas)
function bootApp() {
  document.getElementById("app").style.display = "block";

  document.getElementById("prevMonth").onclick = () => shiftMonth(-1);
  document.getElementById("nextMonth").onclick = () => shiftMonth(1);
  document.getElementById("settingsBtn").onclick = () => openSettingsModal();
  document.querySelectorAll("#tabs button").forEach((b) => { b.onclick = () => { state.tab = b.dataset.tab; render(); }; });
  document.getElementById("fabAdd").onclick = () => openTxModal(null);

  // Crée automatiquement les transactions du mois si des règles récurrentes sont configurées (voir plus haut)
  applyRecurringTransactions();

  render();

  // Tutoriel : si la clé "onboarded" n'existe pas encore dans le stockage, c'est le tout premier lancement -> on l'affiche
  if (!localStorage.getItem(LS_KEYS.onboarded)) showOnboarding();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById("installBanner").classList.add("show");
  });
  const installBtn = document.getElementById("installBtn");
  if (installBtn) installBtn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById("installBanner").classList.remove("show");
  };
}

document.addEventListener("DOMContentLoaded", init);
