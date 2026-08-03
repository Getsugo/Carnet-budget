/* ---------- Constantes ---------- */
// Clés utilisées pour sauvegarder chaque partie des données dans le stockage du téléphone (localStorage)
const LS_KEYS = { tx: "carnet:tx", budgets: "carnet:budgets", settings: "carnet:settings", cats: "carnet:cats", assets: "carnet:assets", catIcons: "carnet:catIcons", onboarded: "carnet:onboarded", recurring: "carnet:recurring", pin: "carnet:pin", biometric: "carnet:biometric", salt: "carnet:salt", verify: "carnet:verify", encOn: "carnet:encOn", dekWrappedPin: "carnet:dekwp" };
// Catégories fournies par défaut au tout premier lancement de l'appli (l'utilisateur peut les modifier/supprimer ensuite)
const DEFAULT_CATS = {
  depenses: ["courses", "loisirs", "voiture", "gasoil", "salle", "cadeaux", "groupama", "resto", "canal", "maman", "autres"],
  revenus: ["salaire", "caf", "maman", "cpam", "wtw", "mamy"],
};
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
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
  settings: { objectif: 60000, soldeInitial: 0, dateObjectif: "", theme: "dark", goalCelebrated: false, nearGoalPct: 15, nearGoalNotified: false, backupReminder: { freq: "none", when: "mid", lastPeriod: null } }, // réglages généraux (objectif d'épargne, solde de départ du compte, date cible, thème clair/sombre, si le feu d'artifice de l'objectif a déjà été joué, seuil et flag du rappel "presque atteint", rappel de sauvegarde périodique)
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
// Attribue une couleur à chaque catégorie. Au lieu d'une palette figée à N couleurs (qui finit par répéter des
// teintes proches si on ajoute plus de catégories que la palette n'a de couleurs), on génère la teinte directement :
// chaque catégorie avance de 137,5° sur la roue chromatique (l'« angle d'or ») par rapport à la précédente, dans
// l'ordre alphabétique de toutes les catégories connues. C'est la méthode classique pour répartir un nombre
// illimité de couleurs de façon à ce qu'elles restent toujours bien distinctes les unes des autres, même juste
// à côté : contrairement à une simple répartition régulière (360°/N), l'angle d'or évite que la Nème couleur
// ajoutée retombe près d'une couleur déjà utilisée.
// Calcule la teinte (0-360°) attribuée à une catégorie, par angle d'or (voir explication ci-dessus)
function categoryHue(s) {
  const dep = (state.cats && state.cats.depenses) || [];
  const rev = (state.cats && state.cats.revenus) || [];
  const allCats = [...new Set([...dep, ...rev])].sort();
  let idx = allCats.indexOf(s);
  if (idx === -1) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); idx = Math.abs(h); } // catégorie inconnue/supprimée : on retombe sur un hash
  return (idx * 137.508) % 360;
}
const hashColor = (s) => `hsl(${categoryHue(s).toFixed(1)}, 68%, 58%)`;
// Même couleur que hashColor mais avec une transparence réglable (0 à 1) — utilisée pour les fonds discrets
// (ex : pastille d'icône de transaction), là où avant on collait "22" derrière un hex (astuce qui ne marche
// plus depuis qu'on génère des couleurs en hsl() et non plus en hexadécimal).
const hashColorAlpha = (s, a) => `hsla(${categoryHue(s).toFixed(1)}, 68%, 58%, ${a})`;
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
  if (!state.settings.backupReminder) state.settings.backupReminder = { freq: "none", when: "mid", lastPeriod: null }; // idem
  if (state.settings.nearGoalPct === undefined) state.settings.nearGoalPct = 15;
  if (state.settings.nearGoalNotified === undefined) state.settings.nearGoalNotified = false;
  // Au démarrage, on se place automatiquement sur le mois de la transaction la plus récente (plutôt que le mois calendaire actuel)
  if (state.tx.length) { const months = state.tx.map((t) => monthKey(t.date)).sort(); state.month = months[months.length - 1]; }
}
// Sauvegarde l'état dans le stockage du téléphone.
// "part" permet de ne sauvegarder qu'un seul morceau (ex: persist("tx") après avoir modifié une transaction),
// ou tout sauvegarder d'un coup si "part" n'est pas précisé.
// Si le chiffrement est actif (sessionKey présente), chaque écriture est chiffrée avant d'être stockée — en
// tâche de fond (persist() reste synchrone en apparence, pas besoin de toucher tous ses appels dans le fichier).
function persist(part) {
  const write = (key, value) => {
    const json = JSON.stringify(value);
    if (sessionKey) encryptString(sessionKey, json).then((enc) => localStorage.setItem(key, enc));
    else localStorage.setItem(key, json);
  };
  if (part === "tx" || !part) write(LS_KEYS.tx, state.tx);
  if (part === "budgets" || !part) write(LS_KEYS.budgets, state.budgets);
  if (part === "settings" || !part) write(LS_KEYS.settings, state.settings);
  if (part === "cats" || !part) write(LS_KEYS.cats, state.cats);
  if (part === "assets" || !part) write(LS_KEYS.assets, state.assets);
  if (part === "catIcons" || !part) write(LS_KEYS.catIcons, state.catIcons);
  if (part === "recurring" || !part) write(LS_KEYS.recurring, state.recurring);
}

// Applique le thème (clair/sombre) choisi dans les réglages : pose l'attribut data-theme sur <html>, ce qui
// bascule toutes les variables CSS définies dans style.css (voir html[data-theme="light"] { ... }).
// Met aussi à jour la couleur de la barre de statut du téléphone (meta theme-color) pour rester cohérent.
function applyTheme() {
  const light = state.settings.theme === "light";
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", light ? "#F5F6F9" : "#0A0E14");
}

// Petite vibration (retour haptique) à la validation d'une transaction, si le téléphone le supporte.
// Ne fait rien sur PC ou sur un navigateur qui ne supporte pas l'API — jamais bloquant.
function hapticTap() {
  if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
}

// Affiche un petit message temporaire en bas de l'écran (ex : "✓ Transaction enregistrée"), qui apparaît en
// douceur puis disparaît tout seul après 2,2 secondes. L'élément est créé une seule fois puis réutilisé.
let toastTimer = null;
function showToast(message) {
  let el = document.getElementById("toastRoot");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastRoot";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  void el.offsetWidth; // force le navigateur à "lire" l'état avant d'ajouter .show, sinon la transition ne se rejoue pas si le toast était déjà affiché juste avant
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
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
// Construit le petit résumé automatique du mois affiché sur le tableau de bord : compare le total des dépenses
// du mois affiché à la moyenne de TOUS les autres mois (peu importe lesquels), et identifie la catégorie qui
// explique le plus cet écart (celle dont l'écart va dans le même sens que la tendance globale, en valeur absolue).
// Renvoie null s'il n'y a pas encore d'autre mois pour comparer (premier mois d'utilisation).
function getMonthlyInsight() {
  const curMonth = state.month;
  const byMonth = {};
  state.tx.forEach((t) => {
    if (t.type !== "depense") return;
    const mk = monthKey(t.date);
    byMonth[mk] = byMonth[mk] || { total: 0, cats: {} };
    byMonth[mk].total += t.montant;
    byMonth[mk].cats[t.categorie] = (byMonth[mk].cats[t.categorie] || 0) + t.montant;
  });
  const otherMonths = Object.keys(byMonth).filter((mk) => mk !== curMonth);
  if (otherMonths.length === 0) return null;
  const curData = byMonth[curMonth] || { total: 0, cats: {} };
  const avgTotal = otherMonths.reduce((s, mk) => s + byMonth[mk].total, 0) / otherMonths.length;
  if (avgTotal <= 0) return null;
  const diff = curData.total - avgTotal;
  const pct = (diff / avgTotal) * 100;

  const allCats = new Set();
  otherMonths.forEach((mk) => Object.keys(byMonth[mk].cats).forEach((c) => allCats.add(c)));
  Object.keys(curData.cats).forEach((c) => allCats.add(c));
  let topCat = null, topCatDiff = 0;
  allCats.forEach((cat) => {
    const curVal = curData.cats[cat] || 0;
    const avgVal = otherMonths.reduce((s, mk) => s + ((byMonth[mk].cats || {})[cat] || 0), 0) / otherMonths.length;
    const catDiff = curVal - avgVal;
    // On ne garde que les catégories dont l'écart va dans le même sens que la tendance globale
    // (si le mois est en hausse, on cherche la catégorie qui monte le plus ; si en baisse, celle qui baisse le plus)
    if ((diff >= 0 && catDiff > topCatDiff) || (diff < 0 && catDiff < topCatDiff)) {
      topCatDiff = catDiff;
      topCat = cat;
    }
  });

  const THRESHOLD = 5; // en dessous de 5% d'écart avec la moyenne, on considère que c'est stable
  let text, trend;
  if (Math.abs(pct) < THRESHOLD) {
    text = `📊 Ce mois-ci, tes dépenses (${fmtEUR(curData.total)}) sont proches de ta moyenne habituelle (${fmtEUR(avgTotal)}).`;
    trend = "stable";
  } else if (pct > 0) {
    text = `📈 Ce mois-ci, +${Math.round(pct)}% de dépenses par rapport à ta moyenne${topCat ? `, surtout à cause de ${categoryIcon(topCat)} ${topCat} (+${fmtEUR(topCatDiff)})` : ""}.`;
    trend = "up"; // hausse des dépenses = mauvaise nouvelle -> couleur rouge, pas verte
  } else {
    text = `📉 Ce mois-ci, ${Math.round(pct)}% de dépenses par rapport à ta moyenne${topCat ? `, notamment grâce à ${categoryIcon(topCat)} ${topCat} (${fmtEUR(topCatDiff)}) mieux maîtrisé` : ""}.`;
    trend = "down"; // baisse des dépenses = bonne nouvelle -> couleur verte
  }
  return { text, trend };
}

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
// Reconstruit l'évolution du patrimoine total mois par mois, pour le graphique de l'onglet "Année & objectif".
// Le compte courant à chaque mois passé est calculé EXACTEMENT (on ré-additionne les transactions jusqu'à la
// fin de ce mois-là) ; en revanche on ne connaît pas l'historique des comptes ajoutés à la main (Livret A...),
// donc leur valeur ACTUELLE est utilisée pour tous les mois (approximation, mais c'est la meilleure info dispo
// tant qu'on n'a pas commencé à suivre leur évolution). Le mois en cours, lui, est donc toujours exact.
function getPatrimoineSeries() {
  const monthKeys = [...new Set(state.tx.map((t) => monthKey(t.date)))].sort();
  const assetsTotal = state.assets.reduce((acc, a) => acc + (Number(a.montant) || 0), 0);
  return monthKeys.map((mk) => {
    const [y, m] = mk.split("-").map(Number);
    const endOfMonth = new Date(y, m, 0).toISOString().slice(0, 10); // dernier jour du mois mk
    const cumul = state.tx
      .filter((t) => t.date <= endOfMonth)
      .reduce((acc, t) => acc + (t.type === "revenu" ? t.montant : -t.montant), 0);
    const compte = state.settings.soldeInitial + cumul;
    return { mois: mk, label: monthLabel(mk).slice(0, 3), total: compte + assetsTotal };
  });
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
  checkNearGoal();
  checkGoalCelebration();
}

// Vérifie si le patrimoine est entré dans la zone "presque atteint" (à moins de X% de l'objectif, X étant
// réglable dans Année & objectif) sans l'avoir encore atteint complètement, et affiche un petit message une
// seule fois. Même principe que checkGoalCelebration ci-dessus, en plus discret (pas de confettis, l'objectif
// n'est pas encore vraiment atteint).
function checkNearGoal() {
  const objectif = Number(state.settings.objectif) || 0;
  if (objectif <= 0) return;
  const patrimoine = getPatrimoineTotal();
  const pct = (patrimoine / objectif) * 100;
  const seuil = Number(state.settings.nearGoalPct) || 15;
  const inZone = pct >= (100 - seuil) && pct < 100;
  if (inZone && !state.settings.nearGoalNotified) {
    state.settings.nearGoalNotified = true;
    persist("settings");
    const manque = objectif - patrimoine;
    showToast(`🎯 Encore ${fmtEUR(manque)} et ton objectif d'épargne est atteint !`);
    hapticTap();
  } else if (!inZone && state.settings.nearGoalNotified) {
    state.settings.nearGoalNotified = false;
    persist("settings");
  }
}

// Vérifie si l'objectif d'épargne (patrimoine total) vient d'être atteint pour la première fois, et déclenche
// le feu d'artifice si oui. Le flag settings.goalCelebrated évite de la rejouer à chaque ouverture de l'appli
// tant que l'objectif reste atteint ; si le patrimoine repasse sous l'objectif (ou si l'objectif est relevé)
// puis qu'on l'atteint à nouveau plus tard, la célébration pourra rejouer.
function checkGoalCelebration() {
  const objectif = Number(state.settings.objectif) || 0;
  if (objectif <= 0) return;
  const reached = getPatrimoineTotal() >= objectif;
  if (reached && !state.settings.goalCelebrated) {
    state.settings.goalCelebrated = true;
    persist("settings");
    celebrateGoal();
  } else if (!reached && state.settings.goalCelebrated) {
    state.settings.goalCelebrated = false;
    persist("settings");
  }
}

// Petit feu d'artifice de confettis en CSS pur (aucune dépendance) + message + vibration, joué une seule fois
// quand l'objectif d'épargne vient d'être atteint. Les confettis sont générés dynamiquement puis retirés du DOM.
function celebrateGoal() {
  const colors = ["#37D399", "#F0BE4E", "#FB7A8A", "#4FC3E8", "#A78BFA", "#8FD14F"];
  const root = document.createElement("div");
  root.className = "confetti-root";
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.3}s`;
    piece.style.setProperty("--rot", `${Math.random() * 520 - 260}deg`);
    piece.style.setProperty("--drift", `${Math.random() * 180 - 90}px`);
    piece.style.width = piece.style.height = `${5 + Math.random() * 5}px`;
    if (Math.random() > 0.5) piece.style.borderRadius = "50%";
    root.appendChild(piece);
  }
  document.body.appendChild(root);
  showToast("🎉 Objectif d'épargne atteint !");
  hapticTap();
  setTimeout(() => root.remove(), 3800);
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

  // Construit le donut de répartition en SVG (et non plus en dégradé CSS) : chaque catégorie est un arc de cercle
  // séparé, ce qui permet 1) de le rendre cliquable (voir attachViewHandlers → clic sur .pie-seg) et
  // 2) de connaître le pourcentage exact de chaque part. Technique : un <circle> plein avec seulement une partie
  // de son contour dessinée (stroke-dasharray), qu'on "avance" avec stroke-dashoffset pour positionner chaque part
  // après la précédente. rotate(-90deg) sur le groupe fait juste démarrer la première part en haut (comme une horloge).
  const pieData = Object.entries(totals.depReel).sort((a, b) => b[1] - a[1]);
  const total = pieData.reduce((s, [, v]) => s + v, 0) || 1;
  const R = 38, CIRC = 2 * Math.PI * R;
  let accLen = 0;
  const pieSegs = pieData.map(([name, v]) => {
    const segLen = (v / total) * CIRC;
    // Le gap doit rester visuellement net entre deux grosses parts, MAIS ne jamais avaler une petite part :
    // il est donc plafonné à 20% de la longueur du segment lui-même (au lieu d'une valeur fixe qui, sur une
    // part de 1%, pouvait consommer la totalité de son arc et la faire disparaître complètement — c'est ce
    // qui créait un grand vide dans le donut là où une petite catégorie aurait dû apparaître).
    const gap = pieData.length > 1 ? Math.min(2.2, segLen * 0.2) : 0;
    const dash = Math.max(0, segLen - gap);
    const offset = -accLen;
    accLen += segLen;
    const pct = Math.round((v / total) * 100);
    return `<circle class="pie-seg" data-cat="${esc(name)}" data-amount="${v}" data-pct="${pct}" cx="50" cy="50" r="${R}" fill="none" stroke="${hashColor(name)}" stroke-width="16" stroke-dasharray="${dash.toFixed(2)} ${(CIRC - dash).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />`;
  }).join("");

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

    ${(() => {
      const insight = getMonthlyInsight();
      return insight ? `<div class="insight-banner insight-${insight.trend}">${esc(insight.text)}</div>` : "";
    })()}

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
            <svg class="donut-svg" viewBox="0 0 100 100" id="pieSvg"><g transform="rotate(-90 50 50)">${pieSegs}</g></svg>
            <!-- Le centre affiche le total par défaut ; un clic sur une part (voir attachViewHandlers) le remplace
                 par le détail de la catégorie choisie, et data-pie-reset ramène au total. -->
            <div class="donut-center" id="pieCenter" data-pie-reset>
              <div class="amt font-mono" id="pieCenterAmt">${fmtEUR(total).replace(",00", "")}</div>
              <div class="lbl" id="pieCenterLbl">total</div>
            </div>
          </div>
          <div class="legend">
            ${pieData.map(([name, v]) => `<span class="legend-item" data-legend-cat="${esc(name)}"><span class="legend-dot" style="background:${hashColor(name)}"></span>${categoryIcon(name)} ${esc(name)} <span class="legend-pct">${Math.round((v / total) * 100)}%</span></span>`).join("")}
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
        <span class="tx-icon" style="background:${hashColorAlpha(t.categorie, 0.13)};">${categoryIcon(t.categorie)}</span>
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
    <div class="hint" style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--gold-light);color:var(--gold);padding:10px 12px;border-radius:12px;margin-bottom:12px;">
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

// Renomme une catégorie partout où elle est utilisée (type = "depenses" ou "revenus") : liste des catégories,
// icône personnalisée, budgets prévus de tous les mois, transactions DÉJÀ enregistrées, et transactions récurrentes.
// Contrairement à la suppression (qui laisse l'historique intact sous l'ancien nom), un renommage doit tout
// mettre à jour : sinon les anciennes transactions se retrouveraient orphelines sous un nom qui n'existe plus.
// Renvoie false si le nouveau nom existe déjà (et ne change rien dans ce cas).
function renameCategory(type, oldCat, newCat) {
  if (newCat.toLowerCase() === oldCat.toLowerCase()) return true; // rien à faire
  if (state.cats[type].some((c) => c.toLowerCase() === newCat.toLowerCase())) return false;
  const txType = type === "depenses" ? "depense" : "revenu";
  state.cats[type] = state.cats[type].map((c) => (c === oldCat ? newCat : c));
  if (state.catIcons[oldCat.toLowerCase()] !== undefined) {
    state.catIcons[newCat.toLowerCase()] = state.catIcons[oldCat.toLowerCase()];
    delete state.catIcons[oldCat.toLowerCase()];
  }
  Object.keys(state.budgets).forEach((mk) => {
    const b = state.budgets[mk] && state.budgets[mk][type];
    if (b && b[oldCat] !== undefined) { b[newCat] = b[oldCat]; delete b[oldCat]; }
  });
  state.tx.forEach((t) => { if (t.type === txType && t.categorie === oldCat) t.categorie = newCat; });
  state.recurring.forEach((r) => { if (r.type === txType && r.categorie === oldCat) r.categorie = newCat; });
  persist("cats"); persist("catIcons"); persist("budgets"); persist("tx"); persist("recurring");
  return true;
}

// Fenêtre de création directe d'une catégorie (type = "depenses" ou "revenus") : avant, il fallait passer par
// l'ajout d'une transaction pour en créer une (en tapant un nom inconnu dans le champ catégorie), ce qui n'était
// pas évident. Ce bouton permet de créer une catégorie vide directement depuis Budget prévu, sans transaction.
function openCategoryModal(type) {
  const root = document.getElementById("modalRoot");
  const label = type === "depenses" ? "de dépense" : "de revenu";
  root.innerHTML = `
    <div class="modal-backdrop" id="catModalBackdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Nouvelle catégorie ${label}</h3>
          <button type="button" id="closeCatModal">✕</button>
        </div>
        <div class="field">
          <label>Nom</label>
          <input type="text" id="newCatName" placeholder="ex : abonnements" autofocus />
        </div>
        <div class="field">
          <label>Icône (optionnel)</label>
          <input type="text" id="newCatIcon" placeholder="💳 par défaut si laissé vide" maxlength="4" />
        </div>
        <div id="catModalError" class="lock-error"></div>
        <button type="button" class="submit-btn" id="createCatBtn">Créer la catégorie</button>
      </div>
    </div>
  `;
  const close = () => (root.innerHTML = "");
  document.getElementById("catModalBackdrop").onclick = (e) => { if (e.target.id === "catModalBackdrop") close(); };
  document.getElementById("closeCatModal").onclick = close;
  const nameInput = document.getElementById("newCatName");
  const submit = () => {
    const name = nameInput.value.trim().toLowerCase();
    const icon = document.getElementById("newCatIcon").value.trim();
    const err = document.getElementById("catModalError");
    if (!name) { err.textContent = "Donne un nom à la catégorie."; return; }
    if (state.cats[type].some((c) => c.toLowerCase() === name)) { err.textContent = "Cette catégorie existe déjà."; return; }
    state.cats[type].push(name);
    persist("cats");
    if (icon) { state.catIcons[name] = icon; persist("catIcons"); }
    close();
    render();
  };
  document.getElementById("createCatBtn").onclick = submit;
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
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
      <span class="name cat-name-btn" data-name-edit="${type}|${esc(cat)}" title="Renommer cette catégorie">${esc(cat)}</span>
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
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <h3 class="section-title" style="margin:0;">Dépenses prévues</h3>
          <button type="button" class="btn btn-outline" data-new-cat="depenses" style="flex-shrink:0;">+ Créer</button>
        </div>
        <div style="margin-top:12px;">${col("depenses", state.cats.depenses)}</div>
      </div>
      <div class="card card-pad">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <h3 class="section-title" style="margin:0;">Revenus prévus</h3>
          <button type="button" class="btn btn-outline" data-new-cat="revenus" style="flex-shrink:0;">+ Créer</button>
        </div>
        <div style="margin-top:12px;">${col("revenus", state.cats.revenus)}</div>
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
// Dessine le graphique d'évolution du patrimoine (courbe + zone remplie), en SVG pur.
// La couleur est passée en dur (pas en var() CSS) car les <stop> de dégradé SVG ne supportent pas
// toujours bien les variables CSS suivant les navigateurs — on relit donc la couleur "sage" du thème actif.
function renderPatrimoineChart(series) {
  if (series.length < 2) return `<div class="empty">Pas encore assez de mois différents dans tes transactions pour tracer une évolution.</div>`;
  const sage = state.settings.theme === "light" ? "#14A876" : "#37D399";
  const vw = 300, vh = 100, padTop = 10, padBottom = 10;
  const values = series.map((s) => s.total);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = vw / (series.length - 1);
  const points = series.map((s, i) => ({
    x: i * stepX,
    y: padTop + (1 - (s.total - min) / range) * (vh - padTop - padBottom),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${vh} L0,${vh} Z`;
  const dots = points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.4" style="fill:${sage};" />`).join("");
  const first = series[0].total, last = series[series.length - 1].total;
  const evolution = last - first;
  return `
    <svg class="patrimoine-chart-svg" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${sage}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${sage}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" style="fill:url(#patGrad);" />
      <path d="${linePath}" style="fill:none;stroke:${sage};stroke-width:2;stroke-linejoin:round;stroke-linecap:round;" />
      ${dots}
    </svg>
    <div class="patrimoine-chart-labels">
      ${series.map((s) => `<span>${esc(s.label)}</span>`).join("")}
    </div>
    <p class="hint" style="margin:10px 0 0;">${evolution >= 0 ? "+" : ""}${fmtEUR(evolution)} depuis ${esc(series[0].label)}. Avant ce mois-ci, les comptes ajoutés à la main (Livret A...) sont comptés à leur valeur actuelle faute d'historique — seul le dernier point est garanti exact.</p>
  `;
}

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

    <div class="card card-pad" style="margin-top:20px;">
      <h3 class="section-title">Évolution du patrimoine</h3>
      ${renderPatrimoineChart(getPatrimoineSeries())}
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
          <div class="date-field-wrap"><div class="date-display" id="setDateObjectifDisplay"></div><input type="month" id="setDateObjectif" class="date-native" value="${state.settings.dateObjectif || ""}" /></div>
        </div>
        <div class="field">
          <label>Solde de départ du compte courant (€)</label>
          <input type="number" id="setSolde" value="${state.settings.soldeInitial}" />
        </div>
        <div class="field">
          <label>Rappel "presque atteint" (%)</label>
          <input type="number" id="setNearGoalPct" min="1" max="50" value="${state.settings.nearGoalPct}" />
        </div>
      </div>
      <p class="hint" style="margin-top:14px;">Le compte courant est calculé automatiquement : solde de départ + somme de tous les revenus et dépenses enregistrés. Le patrimoine total additionne ce compte courant et les comptes que tu ajoutes toi-même ci-dessus.</p>
      <p class="hint" style="margin-top:6px;">Un message s'affichera une fois quand il te restera moins de ce pourcentage à atteindre pour ton objectif (ex : 15% = prévenu quand tu es à 85% ou plus).</p>
    </div>
  `;
}

/* ---------- Sauvegarde / restauration (export-import manuel) ---------- */
// Regroupe toutes les données de l'appli dans un seul objet, puis déclenche le téléchargement d'un fichier .json
// (c'est ce fichier qu'on transfère à la main vers un autre appareil pour "synchroniser")
/* ---------- Rappel de sauvegarde périodique ---------- */
// Comme une PWA sans serveur ne peut pas envoyer de vraie notification pendant qu'elle est fermée (pas de
// "réveil" en arrière-plan fiable, surtout sur iPhone), le rappel se vérifie à chaque OUVERTURE de l'appli :
// si on est dans la bonne fenêtre de temps (ex : "milieu de mois") et qu'on n'a pas déjà montré le rappel pour
// cette période, on l'affiche. C'est un vrai rappel utile, juste pas une notification qui arrive dans la poche.

// Calcule un identifiant unique pour la période actuelle (ex : "2026-07" pour le mois, ou une date de lundi
// pour la semaine) — sert à savoir si le rappel a déjà été montré pour cette période précise.
function getReminderPeriodKey(freq, date) {
  if (freq === "week") {
    const dow = (date.getDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
    const monday = new Date(date); monday.setDate(date.getDate() - dow);
    return monday.toISOString().slice(0, 10);
  }
  if (freq === "month") return monthKey(date.toISOString().slice(0, 10));
  if (freq === "quarter") return `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
  return null;
}
// Vérifie si on est actuellement dans la bonne "fenêtre" (début/milieu/fin) pour la fréquence choisie
function isInReminderWindow(freq, when, date) {
  if (freq === "week") {
    const dow = (date.getDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
    if (when === "start") return dow <= 1; // lundi-mardi
    if (when === "end") return dow >= 5; // samedi-dimanche
    return dow >= 2 && dow <= 4; // mercredi-vendredi
  }
  if (freq === "month") {
    const day = date.getDate();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    if (when === "start") return day <= 10;
    if (when === "end") return day > daysInMonth - 10;
    return day > 10 && day <= daysInMonth - 10;
  }
  return true; // "quarter" : pas de fenêtre fine, dès qu'on change de trimestre ça suffit
}
// Renvoie true si le rappel doit s'afficher maintenant (bonne fréquence configurée, dans la bonne fenêtre,
// et pas déjà montré pour cette période précise)
function isBackupReminderDue() {
  const r = state.settings.backupReminder;
  if (!r || r.freq === "none") return false;
  const now = new Date();
  const periodKey = getReminderPeriodKey(r.freq, now);
  if (periodKey === r.lastPeriod) return false;
  if (!isInReminderWindow(r.freq, r.when, now)) return false;
  return true;
}
// Affiche le rappel (réutilise le style visuel du tutoriel) et retient qu'il a été montré pour cette période
function showBackupReminder() {
  const r = state.settings.backupReminder;
  const periodKey = getReminderPeriodKey(r.freq, new Date());
  const dismiss = () => {
    state.settings.backupReminder.lastPeriod = periodKey;
    persist("settings");
    document.getElementById("onboardingRoot").innerHTML = "";
  };
  document.getElementById("onboardingRoot").innerHTML = `
    <div class="onboarding-backdrop">
      <div class="onboarding-card">
        <div class="onboarding-icon">💾</div>
        <h3 class="onboarding-title">Petit rappel</h3>
        <p class="onboarding-text">Ça fait un moment — pense à exporter une sauvegarde de tes données, pour les garder en sécurité ou les transférer vers un autre appareil.</p>
        <button type="button" class="btn btn-solid" id="reminderExportBtn" style="width:100%;justify-content:center;margin-bottom:10px;">⬇ Exporter maintenant</button>
        <button type="button" class="link-btn" id="reminderLaterBtn" style="width:100%;text-align:center;">Plus tard</button>
      </div>
    </div>
  `;
  document.getElementById("reminderExportBtn").onclick = () => { exportData(); dismiss(); };
  document.getElementById("reminderLaterBtn").onclick = dismiss;
}

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
    applyTheme();
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

// Synchronise l'affichage custom (icône + date lisible) d'un champ date/mois avec la valeur du vrai champ natif,
// invisible mais toujours présent par-dessus (c'est lui qui reçoit le clic et ouvre le sélecteur natif du téléphone).
// À appeler une première fois après avoir inséré le champ dans le DOM, elle se tient ensuite à jour toute seule.
function syncDateDisplay(nativeId, displayId, kind) {
  const native = document.getElementById(nativeId);
  const display = document.getElementById(displayId);
  if (!native || !display) return;
  function paintDisplay() {
    const v = native.value;
    let text;
    if (!v) text = kind === "month" ? "Choisir un mois" : "Choisir une date";
    else if (kind === "month") text = monthLabel(v);
    else { const [y, m, d] = v.split("-"); text = `${d}/${m}/${y}`; }
    display.innerHTML = `<span>${esc(text)}</span><span class="cal-icon"></span>`;
  }
  paintDisplay();
  native.addEventListener("input", paintDisplay);
  native.addEventListener("change", paintDisplay);
}

function attachViewHandlers() {
  // Supprimer / éditer une transaction (voir attachTxRowHandlers ci-dessous, réutilisée aussi quand on filtre la liste)
  attachTxRowHandlers();
  attachBulkBarHandlers();
  // Camembert de répartition (Tableau de bord) : cliquer sur une part OU sur sa légende affiche son nom, son montant
  // et son pourcentage au centre du donut ; cliquer à nouveau sur le centre revient au total du mois.
  const pieCenterAmt = document.getElementById("pieCenterAmt");
  const pieCenterLbl = document.getElementById("pieCenterLbl");
  const allSegs = document.querySelectorAll(".pie-seg");
  const allLegendItems = document.querySelectorAll("[data-legend-cat]");
  let selectedCat = null; // catégorie actuellement mise en avant dans le camembert (null = aucune, affichage du total)
  // Met en avant la part choisie (plus épaisse, légère ombre) et atténue toutes les autres, pour qu'on
  // voie immédiatement laquelle est sélectionnée. Fait la même chose sur sa légende associée.
  function selectPieSlice(cat) {
    allSegs.forEach((s) => s.classList.toggle("selected", s.dataset.cat === cat));
    allSegs.forEach((s) => s.classList.toggle("dimmed", s.dataset.cat !== cat));
    allLegendItems.forEach((it) => it.classList.toggle("selected", it.dataset.legendCat === cat));
  }
  function clearPieSelection() {
    allSegs.forEach((s) => s.classList.remove("selected", "dimmed"));
    allLegendItems.forEach((it) => it.classList.remove("selected"));
  }
  function showPieDetail(cat, amount, pct) {
    if (!pieCenterAmt) return;
    selectedCat = cat;
    pieCenterAmt.textContent = fmtEUR(amount);
    pieCenterLbl.textContent = `${categoryIcon(cat)} ${cat} · ${pct}%`;
    selectPieSlice(cat);
  }
  function resetPieDetail() {
    if (!pieCenterAmt) return;
    selectedCat = null;
    const total = allSegs.length
      ? Array.from(allSegs).reduce((s, el) => s + Number(el.dataset.amount), 0)
      : 0;
    pieCenterAmt.textContent = fmtEUR(total).replace(",00", "");
    pieCenterLbl.textContent = "total";
    clearPieSelection();
  }
  // Cliquer sur une part déjà sélectionnée la désélectionne (bascule), plutôt que de devoir viser le centre
  allSegs.forEach((seg) => {
    seg.style.cursor = "pointer";
    seg.onclick = () => {
      if (selectedCat === seg.dataset.cat) resetPieDetail();
      else showPieDetail(seg.dataset.cat, Number(seg.dataset.amount), seg.dataset.pct);
    };
  });
  allLegendItems.forEach((item) => {
    const seg = document.querySelector(`.pie-seg[data-cat="${CSS.escape(item.dataset.legendCat)}"]`);
    if (!seg) return;
    item.onclick = () => {
      if (selectedCat === seg.dataset.cat) resetPieDetail();
      else showPieDetail(seg.dataset.cat, Number(seg.dataset.amount), seg.dataset.pct);
    };
  });
  const pieCenter = document.getElementById("pieCenter");
  if (pieCenter) pieCenter.onclick = resetPieDetail;
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
  // Créer une nouvelle catégorie directement (bouton "+ Créer" en haut de chaque colonne, Budget prévu)
  document.querySelectorAll("[data-new-cat]").forEach((btn) => {
    btn.onclick = () => openCategoryModal(btn.dataset.newCat);
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
  // Renommer une catégorie (tape sur son nom, dans Budget prévu) : met à jour tout l'historique, voir renameCategory()
  document.querySelectorAll("[data-name-edit]").forEach((el) => {
    el.onclick = () => {
      const [type, cat] = el.dataset.nameEdit.split("|");
      const saisi = prompt(`Renommer la catégorie "${cat}" en :`, cat);
      if (saisi === null) return;
      const nouveau = saisi.trim().toLowerCase();
      if (!nouveau) return;
      const ok = renameCategory(type, cat, nouveau);
      if (!ok) { alert(`Une catégorie "${nouveau}" existe déjà.`); return; }
      render();
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
  syncDateDisplay("setDateObjectif", "setDateObjectifDisplay", "month");
  if (setObjectif) setObjectif.onchange = () => { state.settings.objectif = parseFloat(setObjectif.value) || 0; persist("settings"); render(); };
  const setNearGoalPct = document.getElementById("setNearGoalPct");
  if (setNearGoalPct) setNearGoalPct.onchange = () => {
    const v = Math.min(50, Math.max(1, parseFloat(setNearGoalPct.value) || 15));
    state.settings.nearGoalPct = v;
    state.settings.nearGoalNotified = false; // un nouveau seuil n'a jamais encore été "montré"
    persist("settings");
    render();
  };
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
          <div class="field"><label>Date</label><div class="date-field-wrap"><div class="date-display" id="fDateDisplay"></div><input type="date" id="fDate" class="date-native" value="${existing ? existing.date : todayISO}" /></div></div>
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
    syncDateDisplay("fDate", "fDateDisplay", "date");
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
      hapticTap();
      showToast(isEdit ? "✓ Transaction modifiée" : "✓ Transaction enregistrée");
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
  const isEncrypted = localStorage.getItem(LS_KEYS.encOn) === "1";
  const isLocked = isEncrypted || !!localStorage.getItem(LS_KEYS.pin);
  root.innerHTML = `
    <div class="modal-backdrop" id="settingsBackdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Réglages</h3>
          <button type="button" id="closeSettings">✕</button>
        </div>
        <h3 class="section-title" style="margin-top:4px;">Apparence</h3>
        <div class="type-switch" style="margin-bottom:20px;">
          <button type="button" data-theme-choice="dark" class="${state.settings.theme !== "light" ? "active-neutral" : ""}">🌙 Sombre</button>
          <button type="button" data-theme-choice="light" class="${state.settings.theme === "light" ? "active-neutral" : ""}">☀️ Clair</button>
        </div>

        <h3 class="section-title">Tutoriel</h3>
        <button type="button" class="btn btn-outline" id="replayTutoBtn" style="width:100%;justify-content:center;margin-bottom:20px;">🔎 Revoir le tutoriel de bienvenue</button>

        <h3 class="section-title">Sauvegarde</h3>
        <p class="hint" style="margin:0 0 14px;">Tes données restent uniquement sur cet appareil. Pour les retrouver sur un autre téléphone ou un PC, exporte un fichier de sauvegarde ici, transfère-le (mail, drive, clé USB...), puis importe-le sur l'autre appareil.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-outline" id="exportDataBtn">⬇ Exporter mes données (.json)</button>
          <button type="button" class="btn btn-outline" id="exportCSVBtn">⬇ Exporter en CSV (Excel)</button>
          <button type="button" class="btn btn-outline" id="importDataBtn">⬆ Importer une sauvegarde</button>
          <input type="file" id="importDataFile" accept="application/json" style="display:none;" />
        </div>

        <h3 class="section-title" style="margin-top:20px;">Rappel de sauvegarde</h3>
        <p class="hint" style="margin:0 0 14px;">Un petit message s'affichera à l'ouverture de l'appli, à la fréquence choisie, pour te rappeler d'exporter une sauvegarde. (Pas une vraie notification — une PWA sans serveur ne peut pas en envoyer pendant qu'elle est fermée.)</p>
        <div class="field">
          <label>Fréquence</label>
          <select id="reminderFreq">
            <option value="none" ${state.settings.backupReminder.freq === "none" ? "selected" : ""}>Jamais</option>
            <option value="week" ${state.settings.backupReminder.freq === "week" ? "selected" : ""}>Chaque semaine</option>
            <option value="month" ${state.settings.backupReminder.freq === "month" ? "selected" : ""}>Chaque mois</option>
            <option value="quarter" ${state.settings.backupReminder.freq === "quarter" ? "selected" : ""}>Tous les 3 mois</option>
          </select>
        </div>
        ${["week", "month"].includes(state.settings.backupReminder.freq) ? `
        <div class="field">
          <label>Moment${state.settings.backupReminder.freq === "week" ? " de la semaine" : " du mois"}</label>
          <select id="reminderWhen">
            <option value="start" ${state.settings.backupReminder.when === "start" ? "selected" : ""}>${state.settings.backupReminder.freq === "week" ? "Début (lundi-mardi)" : "Début (1-10)"}</option>
            <option value="mid" ${state.settings.backupReminder.when === "mid" ? "selected" : ""}>${state.settings.backupReminder.freq === "week" ? "Milieu (mercredi-vendredi)" : "Milieu"}</option>
            <option value="end" ${state.settings.backupReminder.when === "end" ? "selected" : ""}>${state.settings.backupReminder.freq === "week" ? "Fin (week-end)" : "Fin de mois"}</option>
          </select>
        </div>
        ` : ""}

        <h3 class="section-title" style="margin-top:20px;">Verrouillage</h3>
        <p class="hint" style="margin:0 0 14px;">${isLocked ? "Un code PIN est actuellement demandé à l'ouverture de l'appli." : "Aucun code demandé à l'ouverture. Utile si quelqu'un d'autre peut avoir accès à cet appareil."}</p>
        <button type="button" class="btn btn-outline" id="pinToggleBtn" style="width:100%;justify-content:center;">${isLocked ? "🔓 Désactiver le code PIN" : "🔒 Activer un code PIN (4 chiffres)"}</button>
        ${isLocked && !isEncrypted ? `
        <p class="hint" style="margin:14px 0 10px;">${localStorage.getItem(LS_KEYS.biometric) ? "Le déverrouillage par empreinte/Face ID est activé, en plus du code PIN (toujours disponible en repli)." : "En plus du code, tu peux ajouter un raccourci empreinte/Face ID si ton appareil le permet."}</p>
        <button type="button" class="btn btn-outline" id="bioToggleBtn" style="width:100%;justify-content:center;">${localStorage.getItem(LS_KEYS.biometric) ? "🔓 Désactiver la biométrie" : "👆 Activer le déverrouillage biométrique"}</button>
        ` : ""}
        ${isLocked && isEncrypted ? `
        <p class="hint" style="margin:14px 0 10px;">Le raccourci empreinte/Face ID n'est pas proposé quand le chiffrement est actif : sur la plupart des téléphones (Android via Chrome, notamment), le navigateur ne fournit pas encore la brique technique nécessaire pour que la biométrie donne une vraie clé de déchiffrement, plutôt qu'une simple confirmation. Le code PIN reste ta seule option ici.</p>
        ` : ""}
        ${isLocked ? `
        <p class="hint" style="margin:14px 0 10px;">${isEncrypted ? "🔐 Tes données sont chiffrées (AES-256) : illisibles pour qui fouillerait le stockage technique du navigateur, même sans passer par l'appli." : "Renforce la protection : chiffre aussi tes données elles-mêmes avec ce code (pas juste l'écran d'accueil). Désactive le raccourci biométrique, qui ne peut pas fournir la clé de déchiffrement."}</p>
        <button type="button" class="btn ${isEncrypted ? "btn-outline" : "btn-solid"}" id="encToggleBtn" style="width:100%;justify-content:center;">${isEncrypted ? "🔓 Déchiffrer mes données" : "🔐 Chiffrer mes données (AES-256)"}</button>
        ${!isEncrypted ? `<p class="hint" style="margin-top:8px;">⚠️ Si tu oublies ce code une fois le chiffrement activé, tes données seront définitivement illisibles — aucune récupération possible, même par moi.</p>` : ""}
        ` : ""}
      </div>
    </div>
  `;
  document.getElementById("settingsBackdrop").onclick = (e) => { if (e.target.id === "settingsBackdrop") root.innerHTML = ""; };
  document.getElementById("closeSettings").onclick = () => (root.innerHTML = "");
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    btn.onclick = () => {
      state.settings.theme = btn.dataset.themeChoice;
      persist("settings");
      applyTheme();
      openSettingsModal(); // redessine la fenêtre pour mettre à jour le bouton actif
    };
  });
  document.getElementById("replayTutoBtn").onclick = () => { root.innerHTML = ""; showOnboarding(); };
  document.getElementById("exportDataBtn").onclick = () => exportData();
  document.getElementById("exportCSVBtn").onclick = () => exportCSV();
  const reminderFreq = document.getElementById("reminderFreq");
  if (reminderFreq) reminderFreq.onchange = () => {
    state.settings.backupReminder.freq = reminderFreq.value;
    state.settings.backupReminder.lastPeriod = null; // on repart de zéro : la nouvelle fréquence n'a jamais encore été "montrée"
    persist("settings");
    openSettingsModal(); // redessine pour faire apparaître/disparaître le sélecteur "Moment"
  };
  const reminderWhen = document.getElementById("reminderWhen");
  if (reminderWhen) reminderWhen.onchange = () => {
    state.settings.backupReminder.when = reminderWhen.value;
    persist("settings");
  };
  document.getElementById("pinToggleBtn").onclick = async () => {
    if (isLocked) {
      const saisi = prompt("Entre ton code PIN actuel pour désactiver le verrouillage :");
      if (saisi === null) return;
      if (isEncrypted) {
        const ok = await disableEncryption(saisi.trim());
        if (!ok) { alert("Code incorrect."); return; }
      } else if (saisi.trim() !== localStorage.getItem(LS_KEYS.pin)) {
        alert("Code incorrect."); return;
      }
      localStorage.removeItem(LS_KEYS.pin);
      disableBiometric(); // la biométrie dépend du PIN comme repli, donc on la désactive aussi
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
  const encToggleBtn = document.getElementById("encToggleBtn");
  if (encToggleBtn) encToggleBtn.onclick = async () => {
    if (isEncrypted) {
      const saisi = prompt("Entre ton code PIN pour déchiffrer tes données :");
      if (saisi === null) return;
      encToggleBtn.textContent = "Déchiffrement en cours…";
      const ok = await disableEncryption(saisi.trim());
      if (ok) alert("Chiffrement désactivé — tes données sont de nouveau stockées normalement (le code PIN reste actif).");
      else alert("Code incorrect.");
    } else {
      if (!confirm("Chiffrer tes données avec ton code PIN actuel ?\n\nSi tu oublies ce code par la suite, tes données seront définitivement illisibles : il n'existe aucun moyen de les récupérer sans lui, ni par moi ni par personne.\n\nContinuer ?")) return;
      encToggleBtn.textContent = "Chiffrement en cours…";
      const ok = await enableEncryption();
      if (ok) alert("Chiffrement activé ! Tes données sont maintenant illisibles sans ton code PIN.");
      else alert("Impossible d'activer le chiffrement (aucun code PIN actif ?).");
    }
    openSettingsModal();
  };
  const bioToggleBtn = document.getElementById("bioToggleBtn");
  if (bioToggleBtn) bioToggleBtn.onclick = async () => {
    if (localStorage.getItem(LS_KEYS.biometric)) {
      disableBiometric();
      alert("Déverrouillage biométrique désactivé.");
      openSettingsModal();
    } else {
      bioToggleBtn.textContent = "Vérification en cours…";
      const ok = await enableBiometric();
      if (ok) alert("Déverrouillage biométrique activé !");
      openSettingsModal();
    }
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

/* ---------- Déverrouillage biométrique (empreinte / Face ID) ---------- */
// Utilise l'API WebAuthn du navigateur, qui pilote directement le capteur biométrique du téléphone/PC —
// aucune donnée d'empreinte ne transite jamais par l'appli, tout est géré par le système d'exploitation.
// C'est une couche pratique en PLUS du code PIN, pas à sa place : si la biométrie échoue ou n'est pas
// disponible, on peut toujours retomber sur le PIN. C'est pourquoi elle n'est proposée que si un PIN existe déjà.

// Vérifie si le navigateur ET l'appareil supportent un capteur biométrique utilisable (empreinte, visage...)
async function biometricAvailable() {
  if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch (e) { return false; }
}
// Enregistre un nouvel identifiant biométrique auprès du système (déclenche la demande d'empreinte/Face ID
// une première fois, comme pour n'importe quelle appli qui active ce type de déverrouillage)
async function enableBiometric() {
  const available = await biometricAvailable();
  if (!available) { alert("Aucun capteur biométrique (empreinte, visage...) détecté ou activé sur cet appareil/navigateur."); return false; }
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Le Carnet" },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "carnet-local", displayName: "Le Carnet" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000,
      },
    });
    const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem(LS_KEYS.biometric, credId);
    return true;
  } catch (e) {
    alert("Impossible d'activer la biométrie (action annulée ou non supportée par ce navigateur).");
    return false;
  }
}
// Désactive le raccourci biométrique (le code PIN continue de fonctionner normalement)
function disableBiometric() { localStorage.removeItem(LS_KEYS.biometric); }
// Déclenche la demande d'empreinte/Face ID pour déverrouiller l'appli. Comme c'est une appli 100% locale
// sans serveur pour vérifier la signature cryptographique, on considère que la cérémonie WebAuthn qui réussit
// (sans exception) est une preuve suffisante que l'appareil a validé la biométrie — c'est le système qui a fait la vérification.
async function tryBiometricUnlock() {
  const credId = localStorage.getItem(LS_KEYS.biometric);
  if (!credId) return false;
  try {
    const idBytes = Uint8Array.from(atob(credId), (c) => c.charCodeAt(0));
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: idBytes, type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- Chiffrement des données (option, en plus du code PIN) ---------- */
// Aujourd'hui, le code PIN bloque juste l'AFFICHAGE de l'appli : les données restent lisibles en clair dans le
// stockage technique du navigateur pour qui sait où regarder (outils développeur). Le chiffrement va plus loin :
// les données elles-mêmes sont transformées en charabia illisible (AES-256).
//
// Architecture : au lieu de chiffrer directement avec une clé dérivée du PIN, on génère une clé de données
// aléatoire (DEK, "Data Encryption Key") — c'est ELLE qui chiffre vraiment tout. Le PIN, et éventuellement la
// biométrie, ne servent qu'à "déverrouiller" cette DEK, chacun avec sa propre clé indépendante. Ça permet
// d'avoir deux façons différentes d'accéder aux mêmes données, sans jamais avoir à tout rechiffrer pour
// ajouter ou retirer un moyen d'accès (ex : activer la biométrie plus tard).
let sessionKey = null; // la clé de DONNÉES (DEK) une fois déverrouillée -- jamais dérivée directement du PIN
const ENC_PARTS = ["tx", "budgets", "settings", "cats", "assets", "catIcons", "recurring"];

// Transforme un code PIN en une clé AES-256, via PBKDF2 (150 000 itérations : ça ralentit volontairement
// chaque tentative, pour rendre un essai "à l'aveugle" de toutes les combinaisons plus coûteux).
async function deriveKeyFromPin(pin, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function encryptString(key, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return btoa(String.fromCharCode(...iv)) + ":" + btoa(String.fromCharCode(...new Uint8Array(buf)));
}
async function decryptString(key, payload) {
  const [ivB64, ctB64] = payload.split(":");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(buf);
}
// Importe 32 octets bruts comme clé AES-256 utilisable (jamais exportable ensuite)
function importAesKey(bytes) { return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]); }
// Charge l'état APRÈS déverrouillage en mode chiffré : chaque morceau est déchiffré avec la DEK avant d'être interprété.
async function loadStateDecrypted(key) {
  for (const part of ENC_PARTS) {
    const raw = localStorage.getItem(LS_KEYS[part]);
    if (raw == null) continue;
    try { state[part] = JSON.parse(await decryptString(key, raw)); } catch (e) {}
  }
  if (state.settings.dateObjectif === undefined) state.settings.dateObjectif = "";
  if (!state.settings.backupReminder) state.settings.backupReminder = { freq: "none", when: "mid", lastPeriod: null };
  if (state.settings.nearGoalPct === undefined) state.settings.nearGoalPct = 15;
  if (state.settings.nearGoalNotified === undefined) state.settings.nearGoalNotified = false;
  if (state.tx.length) { const months = state.tx.map((t) => monthKey(t.date)).sort(); state.month = months[months.length - 1]; }
}

// Active le chiffrement : génère une DEK aléatoire, chiffre toutes les données déjà stockées avec elle, puis
// "enveloppe" la DEK avec une clé dérivée du code PIN actuel. Le code PIN en clair est ensuite supprimé (il ne
// sert plus qu'à re-dériver sa clé d'enveloppe, jamais retenu tel quel). La biométrie liée à l'ANCIEN système
// (simple confirmation) est désactivée au passage : elle ne fournissait pas de vraie clé de déchiffrement.
async function enableEncryption() {
  const pin = localStorage.getItem(LS_KEYS.pin);
  if (!pin) return false;
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const dekB64 = btoa(String.fromCharCode(...dek));
  const dekKey = await importAesKey(dek);

  const saltB64 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const pinKey = await deriveKeyFromPin(pin, saltB64);

  for (const part of ENC_PARTS) {
    const raw = localStorage.getItem(LS_KEYS[part]);
    if (raw == null) continue;
    localStorage.setItem(LS_KEYS[part], await encryptString(dekKey, raw));
  }
  localStorage.setItem(LS_KEYS.dekWrappedPin, await encryptString(pinKey, dekB64));
  localStorage.setItem(LS_KEYS.salt, saltB64);
  localStorage.setItem(LS_KEYS.encOn, "1");
  localStorage.removeItem(LS_KEYS.pin);
  localStorage.removeItem(LS_KEYS.verify); // ancien repère, plus utilisé avec ce schéma
  disableBiometric();
  sessionKey = dekKey;
  return true;
}
// Désactive le chiffrement : récupère la DEK via le code PIN (donc le vérifie au passage), déchiffre tout,
// et revient à un stockage en clair comme avant. Si le code est faux, rien n'est modifié.
async function disableEncryption(pinTyped) {
  const saltB64 = localStorage.getItem(LS_KEYS.salt);
  if (!saltB64) return false;
  const pinKey = await deriveKeyFromPin(pinTyped, saltB64);
  let dek;
  try { dek = await unwrapDek(pinKey, saltB64, pinTyped); } catch (e) { return false; }
  if (!dek) return false;
  const dekKey = await importAesKey(dek);
  for (const part of ENC_PARTS) {
    const raw = localStorage.getItem(LS_KEYS[part]);
    if (raw == null) continue;
    localStorage.setItem(LS_KEYS[part], await decryptString(dekKey, raw));
  }
  localStorage.removeItem(LS_KEYS.salt);
  localStorage.removeItem(LS_KEYS.dekWrappedPin);
  localStorage.removeItem(LS_KEYS.encOn);
  disableBiometric();
  localStorage.setItem(LS_KEYS.pin, pinTyped);
  sessionKey = null;
  return true;
}
// Récupère la DEK à partir du code PIN. Gère aussi la migration silencieuse depuis l'ancien schéma de chiffrement
// (celui d'avant l'ajout de la biométrie liée au chiffrement, qui n'avait pas de DEK séparée) : si aucune DEK
// enveloppée n'existe encore mais qu'un ancien repère "verify" oui, on déchiffre à l'ancienne puis on migre
// immédiatement vers le nouveau schéma, de façon transparente pour la personne qui tape juste son code habituel.
async function unwrapDek(pinKey, saltB64, pinTyped) {
  const wrapped = localStorage.getItem(LS_KEYS.dekWrappedPin);
  if (wrapped) {
    const dekB64 = await decryptString(pinKey, wrapped);
    return Uint8Array.from(atob(dekB64), (c) => c.charCodeAt(0));
  }
  // Ancien schéma : pas de DEK, chaque donnée était chiffrée directement avec la clé du PIN
  const verifyRaw = localStorage.getItem(LS_KEYS.verify);
  if (!verifyRaw) return null;
  const check = await decryptString(pinKey, verifyRaw);
  if (check !== "OK") return null;
  const oldValues = {};
  for (const part of ENC_PARTS) {
    const raw = localStorage.getItem(LS_KEYS[part]);
    if (raw == null) continue;
    oldValues[part] = await decryptString(pinKey, raw);
  }
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const dekKey = await importAesKey(dek);
  for (const part of Object.keys(oldValues)) {
    localStorage.setItem(LS_KEYS[part], await encryptString(dekKey, oldValues[part]));
  }
  localStorage.setItem(LS_KEYS.dekWrappedPin, await encryptString(pinKey, btoa(String.fromCharCode(...dek))));
  localStorage.removeItem(LS_KEYS.verify);
  return dek;
}

/* ---------- Verrouillage par code PIN ---------- */
// Au démarrage : si un PIN a été configuré (voir openSettingsModal), on bloque l'accès derrière un écran de saisie
// avant de démarrer l'appli. Si en plus le chiffrement est actif, les données ne sont même pas chargées en mémoire
// tant que le bon code n'a pas débloqué la DEK (voir plus haut pourquoi la biométrie n'est pas proposée dans ce cas).
function checkPinLock(encOn) {
  const pinPlain = localStorage.getItem(LS_KEYS.pin);
  if (!encOn && !pinPlain) { bootApp(); return; }
  if (!encOn) {
    const bioId = localStorage.getItem(LS_KEYS.biometric);
    if (bioId) paintLockBiometric(); else paintLockPin(false);
    return;
  }
  paintLockPin(true);
}
// Écran de verrouillage : étape biométrique EN MODE NORMAL (pas de chiffrement) — simple confirmation, sans
// lien cryptographique avec des données (elles sont déjà en clair de toute façon dans ce mode).
function paintLockBiometric() {
  document.getElementById("lockRoot").innerHTML = `
    <div class="onboarding-backdrop">
      <div class="onboarding-card">
        <div class="onboarding-icon">🔒</div>
        <h3 class="onboarding-title">Appli verrouillée</h3>
        <p class="onboarding-text">Déverrouille avec ton empreinte ou Face ID.</p>
        <button type="button" class="btn btn-solid" id="bioUnlockBtn" style="width:100%;justify-content:center;">👆 Déverrouiller</button>
        <div id="lockError" class="lock-error"></div>
        <button type="button" class="link-btn" id="useCodeInstead" style="width:100%;margin-top:14px;text-align:center;">Utiliser le code PIN à la place</button>
      </div>
    </div>
  `;
  const tryBio = async () => {
    document.getElementById("lockError").textContent = "";
    const ok = await tryBiometricUnlock();
    if (ok) { document.getElementById("lockRoot").innerHTML = ""; bootApp(); }
    else document.getElementById("lockError").textContent = "Échec — réessaie ou utilise le code PIN.";
  };
  document.getElementById("bioUnlockBtn").onclick = tryBio;
  document.getElementById("useCodeInstead").onclick = () => paintLockPin(false);
}
// Écran de verrouillage : étape code PIN. En mode normal, comparaison directe au code stocké.
// En mode chiffré, le code tapé sert à déballer la DEK (voir unwrapDek, gère aussi la migration silencieuse
// depuis l'ancien schéma de chiffrement si besoin) ; si ça réussit, les vraies données sont déchiffrées dans la foulée.
function paintLockPin(encOn) {
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
  const tryUnlock = async () => {
    const val = input.value.trim();
    const fail = () => { document.getElementById("lockError").textContent = "Code incorrect, réessaie."; input.value = ""; input.focus(); };
    if (!encOn) {
      if (val === localStorage.getItem(LS_KEYS.pin)) { document.getElementById("lockRoot").innerHTML = ""; bootApp(); }
      else fail();
      return;
    }
    try {
      const pinKey = await deriveKeyFromPin(val, localStorage.getItem(LS_KEYS.salt));
      const dek = await unwrapDek(pinKey, localStorage.getItem(LS_KEYS.salt), val);
      if (!dek) throw new Error("mauvais code");
      sessionKey = await importAesKey(dek);
      await loadStateDecrypted(sessionKey);
      applyTheme();
      document.getElementById("lockRoot").innerHTML = "";
      bootApp();
    } catch (e) { fail(); }
  };
  document.getElementById("lockSubmit").onclick = tryUnlock;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
  input.focus();
}

/* ---------- Init ---------- */
function init() {
  const encOn = localStorage.getItem(LS_KEYS.encOn) === "1";
  if (!encOn) loadState(); // en mode chiffré, on attend le bon code avant de charger quoi que ce soit (voir paintLockPin)
  applyTheme();
  document.getElementById("loading").style.display = "none";
  checkPinLock(encOn);
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
  // Sinon (appli déjà utilisée), on vérifie si un rappel de sauvegarde est dû pour la période actuelle
  if (!localStorage.getItem(LS_KEYS.onboarded)) showOnboarding();
  else if (isBackupReminderDue()) showBackupReminder();

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
