/* ---------- Constantes ---------- */
// Clés utilisées pour sauvegarder chaque partie des données dans le stockage du téléphone (localStorage)
const LS_KEYS = { tx: "carnet:tx", budgets: "carnet:budgets", settings: "carnet:settings", cats: "carnet:cats", assets: "carnet:assets", catIcons: "carnet:catIcons" };
// Catégories fournies par défaut au tout premier lancement de l'appli (l'utilisateur peut les modifier/supprimer ensuite)
const DEFAULT_CATS = {
  depenses: ["courses", "loisirs", "voiture", "gasoil", "salle", "cadeaux", "groupama", "resto", "canal", "maman", "autres"],
  revenus: ["salaire", "caf", "maman", "cpam", "wtw", "mamy"],
};
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
// Couleurs utilisées pour colorer automatiquement les catégories (choisies au hasard selon le nom, voir hashColor)
const PALETTE = ["#37D399","#F0BE4E","#A78BFA","#4FC3E8","#FB7A8A","#8FD14F","#E89A4D","#6C8FE8","#E8739E","#4FD1B5"];
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
  month: new Date().toISOString().slice(0, 7), // mois actuellement affiché, format "AAAA-MM"
  tab: "dashboard", // onglet actuellement affiché
};

/* ---------- Utils ---------- */
const fmtEUR = (n) => (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MOIS_FR[m - 1]} ${y}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
const hashColor = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return PALETTE[Math.abs(h) % PALETTE.length]; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
  // du cercle proportionnelle à son montant, en cumulant les angles de départ/fin (acc = angle cumulé)
  const pieData = Object.entries(totals.depReel);
  let gradient = "", acc = 0;
  const total = pieData.reduce((s, [, v]) => s + v, 0) || 1;
  pieData.forEach(([name, v]) => {
    const start = (acc / total) * 360; acc += v; const end = (acc / total) * 360;
    gradient += `${hashColor(name)} ${start}deg ${end}deg, `;
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
function renderTransactions() {
  const mtx = getMonthTx().slice().sort((a, b) => b.date.localeCompare(a.date));
  const dupCount = countDuplicates();
  return `
    <div class="tx-toolbar">
      <h2 class="section-title" style="margin:0;">Transactions du mois</h2>
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
    <div class="card">
      <div class="receipt-edge"></div>
      <div class="tx-list">
        ${mtx.length === 0 ? `<div class="empty">Aucune transaction ce mois-ci. Ajoute-en une pour commencer.</div>` : mtx.map((t) => `
          <div class="tx-row" data-edit-id="${t.id}">
            <div class="tx-left">
              <span class="tx-icon" style="background:${hashColor(t.categorie)}22;">${categoryIcon(t.categorie)}</span>
              <div style="min-width:0;">
                <div class="tx-desc">${esc(t.description) || esc(t.categorie)}</div>
                <div class="tx-meta"><span>${new Date(t.date).toLocaleDateString("fr-FR")}</span><span>${esc(t.categorie)}</span></div>
              </div>
            </div>
            <div class="tx-right">
              <span class="tx-amount ${t.type === "revenu" ? "rev" : ""}">${t.type === "revenu" ? "+" : "−"}${fmtEUR(t.montant)}</span>
              <button class="tx-del" data-del="${t.id}">✕</button>
            </div>
          </div>
        `).join("")}
      </div>
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
  Object.keys(state.budgets).forEach((mk) => { if (state.budgets[mk]?.[type]) delete state.budgets[mk][type][cat]; });
  persist("cats"); persist("budgets");
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
        <input type="number" step="0.01" placeholder="0" data-prevu="${type}|${esc(cat)}" value="${(mb[type] || {})[cat] ?? ""}" />
        <span style="color:var(--ink40)">€</span>
      </div>
      <button type="button" class="cat-del-btn" data-cat-del="${type}|${esc(cat)}" title="Supprimer cette catégorie">✕</button>
    </div>`).join("");
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
            <input type="number" step="0.01" class="asset-amount" data-asset-field="montant" value="${a.montant ?? ""}" placeholder="0" />
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
          <input type="month" id="setDateObjectif" value="${state.settings.dateObjectif || ""}" />
        </div>
        <div class="field">
          <label>Solde de départ du compte courant (€)</label>
          <input type="number" id="setSolde" value="${state.settings.soldeInitial}" />
        </div>
      </div>
      <p class="hint" style="margin-top:14px;">Le compte courant est calculé automatiquement : solde de départ + somme de tous les revenus et dépenses enregistrés. Le patrimoine total additionne ce compte courant et les comptes que tu ajoutes toi-même ci-dessus.</p>
    </div>

    <div class="card card-pad" style="margin-top:20px;">
      <h3 class="section-title">Sauvegarde</h3>
      <p class="hint" style="margin:0 0 14px;">Tes données restent uniquement sur cet appareil. Pour les retrouver sur un autre téléphone ou un PC, exporte un fichier de sauvegarde ici, transfère-le (mail, drive, clé USB...), puis importe-le sur l'autre appareil.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" class="btn btn-outline" id="exportDataBtn">⬇ Exporter mes données</button>
        <button type="button" class="btn btn-outline" id="importDataBtn">⬆ Importer une sauvegarde</button>
        <input type="file" id="importDataFile" accept="application/json" style="display:none;" />
      </div>
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
    settings: state.settings, catIcons: state.catIcons,
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
    persist();
    render();
    alert("Sauvegarde importée avec succès.");
  };
  reader.readAsText(file);
}

/* ---------- Handlers de vue ---------- */
function attachViewHandlers() {
  // Supprimer une transaction (bouton ✕ sur une ligne) — stopPropagation pour ne pas déclencher l'ouverture de la fiche d'édition
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); state.tx = state.tx.filter((t) => t.id !== btn.dataset.del); persist("tx"); render(); };
  });
  // Ouvrir la fiche d'édition en tapant n'importe où sur une ligne de transaction
  document.querySelectorAll("[data-edit-id]").forEach((row) => {
    row.onclick = () => {
      const t = state.tx.find((x) => x.id === row.dataset.editId);
      if (t) openTxModal(t);
    };
  });
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

  // Sauvegarde : le bouton "Exporter" télécharge un fichier .json ; le bouton "Importer" ouvre le sélecteur de fichier
  // caché, et dès qu'un fichier est choisi, importDataFile() s'en charge (voir plus haut).
  const exportDataBtn = document.getElementById("exportDataBtn");
  if (exportDataBtn) exportDataBtn.onclick = () => exportData();
  const importDataBtn = document.getElementById("importDataBtn");
  const importDataFileInput = document.getElementById("importDataFile");
  if (importDataBtn && importDataFileInput) {
    importDataBtn.onclick = () => importDataFileInput.click();
    importDataFileInput.onchange = () => {
      if (importDataFileInput.files && importDataFileInput.files[0]) importDataFile(importDataFileInput.files[0]);
      importDataFileInput.value = "";
    };
  }
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
          <div class="field"><label>Date</label><input type="date" id="fDate" value="${existing ? existing.date : todayISO}" /></div>
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

/* ---------- Init ---------- */
function init() {
  loadState();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("prevMonth").onclick = () => shiftMonth(-1);
  document.getElementById("nextMonth").onclick = () => shiftMonth(1);
  document.querySelectorAll("#tabs button").forEach((b) => { b.onclick = () => { state.tab = b.dataset.tab; render(); }; });
  document.getElementById("fabAdd").onclick = () => openTxModal(null);

  render();

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
