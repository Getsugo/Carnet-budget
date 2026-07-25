/* ---------- Constantes ---------- */
const LS_KEYS = { tx: "carnet:tx", budgets: "carnet:budgets", settings: "carnet:settings", cats: "carnet:cats" };
const DEFAULT_CATS = {
  depenses: ["courses", "loisirs", "voiture", "gasoil", "salle", "cadeaux", "groupama", "resto", "canal", "maman", "autres"],
  revenus: ["salaire", "caf", "maman", "cpam", "wtw", "mamy"],
};
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const PALETTE = ["#3F6B58","#B98B29","#7A5C7E","#2E6E7E","#B8492F","#6B7F3F","#8C6239","#4A5C77","#9C5B45","#5C7A6B"];

/* ---------- Etat ---------- */
let state = {
  tx: [],
  budgets: {},
  settings: { objectif: 60000, soldeInitial: 0 },
  cats: JSON.parse(JSON.stringify(DEFAULT_CATS)),
  month: new Date().toISOString().slice(0, 7),
  tab: "dashboard",
};

/* ---------- Utils ---------- */
const fmtEUR = (n) => (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MOIS_FR[m - 1]} ${y}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
const hashColor = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return PALETTE[Math.abs(h) % PALETTE.length]; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Stockage local ---------- */
function loadState() {
  try { const v = localStorage.getItem(LS_KEYS.tx); if (v) state.tx = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.budgets); if (v) state.budgets = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.settings); if (v) state.settings = JSON.parse(v); } catch (e) {}
  try { const v = localStorage.getItem(LS_KEYS.cats); if (v) state.cats = JSON.parse(v); } catch (e) {}
  if (state.tx.length) { const months = state.tx.map((t) => monthKey(t.date)).sort(); state.month = months[months.length - 1]; }
}
function persist(part) {
  if (part === "tx" || !part) localStorage.setItem(LS_KEYS.tx, JSON.stringify(state.tx));
  if (part === "budgets" || !part) localStorage.setItem(LS_KEYS.budgets, JSON.stringify(state.budgets));
  if (part === "settings" || !part) localStorage.setItem(LS_KEYS.settings, JSON.stringify(state.settings));
  if (part === "cats" || !part) localStorage.setItem(LS_KEYS.cats, JSON.stringify(state.cats));
}

/* ---------- Dérivées ---------- */
function getMonthTx() { return state.tx.filter((t) => monthKey(t.date) === state.month); }
function getMonthBudget() { return state.budgets[state.month] || { depenses: {}, revenus: {} }; }
function getTotals() {
  const mtx = getMonthTx();
  const depReel = {}, revReel = {};
  mtx.forEach((t) => { const b = t.type === "depense" ? depReel : revReel; b[t.categorie] = (b[t.categorie] || 0) + t.montant; });
  const totalDep = Object.values(depReel).reduce((a, b) => a + b, 0);
  const totalRev = Object.values(revReel).reduce((a, b) => a + b, 0);
  return { depReel, revReel, totalDep, totalRev, reste: totalRev - totalDep };
}
function getYearlySeries() {
  const map = {};
  state.tx.forEach((t) => {
    const mk = monthKey(t.date);
    map[mk] = map[mk] || { revenus: 0, depenses: 0 };
    if (t.type === "revenu") map[mk].revenus += t.montant; else map[mk].depenses += t.montant;
  });
  return Object.keys(map).sort().map((mk) => ({ mois: mk, label: monthLabel(mk).slice(0, 3), reste: map[mk].revenus - map[mk].depenses }));
}
function getCompteActuel() {
  const cumul = state.tx.reduce((acc, t) => acc + (t.type === "revenu" ? t.montant : -t.montant), 0);
  return state.settings.soldeInitial + cumul;
}

/* ---------- Rendu ---------- */
function render() {
  document.getElementById("monthLabel").textContent = monthLabel(state.month);
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  const view = document.getElementById("view");
  if (state.tab === "dashboard") view.innerHTML = renderDashboard();
  else if (state.tab === "transactions") view.innerHTML = renderTransactions();
  else if (state.tab === "budget") view.innerHTML = renderBudget();
  else if (state.tab === "annee") view.innerHTML = renderAnnee();
  attachViewHandlers();
}

function renderDashboard() {
  const totals = getTotals();
  const mb = getMonthBudget();
  const allCats = new Set([...Object.keys(mb.depenses || {}), ...Object.keys(totals.depReel)]);
  const rows = [...allCats].map((cat) => {
    const prevu = (mb.depenses || {})[cat] || 0;
    const reel = totals.depReel[cat] || 0;
    return { cat, prevu, reel };
  }).sort((a, b) => b.reel - a.reel);

  const pieData = Object.entries(totals.depReel);
  let gradient = "", acc = 0;
  const total = pieData.reduce((s, [, v]) => s + v, 0) || 1;
  pieData.forEach(([name, v]) => {
    const start = (acc / total) * 360; acc += v; const end = (acc / total) * 360;
    gradient += `${hashColor(name)} ${start}deg ${end}deg, `;
  });
  gradient = gradient ? gradient.slice(0, -2) : "var(--paper-dim) 0deg 360deg";

  return `
    <div class="card dark hero">
      <div class="hero-top">
        <div>
          <div class="hero-label">Reste à vivre — ${esc(monthLabel(state.month))}</div>
          <div class="hero-amount font-mono" style="color:${totals.reste >= 0 ? "#9FD1B0" : "#E8A490"}">${fmtEUR(totals.reste)}</div>
        </div>
        <div class="hero-stats">
          <div><div class="stat-label">Revenus</div><div class="stat-value" style="color:#9FD1B0">${fmtEUR(totals.totalRev)}</div></div>
          <div><div class="stat-label">Dépenses</div><div class="stat-value" style="color:#E8A490">${fmtEUR(totals.totalDep)}</div></div>
        </div>
      </div>
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
              <span class="name">${esc(r.cat)}</span>
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
          <div class="donut" style="background:conic-gradient(${gradient})"></div>
          <div class="legend">
            ${pieData.map(([name]) => `<span class="legend-item"><span class="legend-dot" style="background:${hashColor(name)}"></span>${esc(name)}</span>`).join("")}
          </div>
        </div>`}
      </div>
    </div>
  `;
}

function renderTransactions() {
  const mtx = getMonthTx().slice().sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="tx-toolbar">
      <h2 class="section-title" style="margin:0;">Transactions du mois</h2>
      <div style="display:flex;gap:8px;">
        <input type="file" id="csvInput" accept=".csv,.txt" style="display:none;" />
        <button class="btn btn-outline" id="importBtn">⇧ Importer un CSV</button>
        <button class="btn btn-solid" id="addBtnInline">+ Ajouter</button>
      </div>
    </div>
    <div id="importErrorBox"></div>
    <p class="hint">Import automatique reconnu : export <strong>Crédit Agricole</strong> (Date, Libellé, Débit euros, Crédit euros) — catégorisation auto. Ou format générique : <span class="font-mono">date, montant, description, categorie, type</span>.</p>
    <div class="card">
      <div class="receipt-edge"></div>
      <div class="tx-list">
        ${mtx.length === 0 ? `<div class="empty">Aucune transaction ce mois-ci. Ajoute-en une pour commencer.</div>` : mtx.map((t) => `
          <div class="tx-row">
            <div class="tx-left">
              <span class="tx-dot" style="background:${hashColor(t.categorie)}"></span>
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

function renderBudget() {
  const mb = getMonthBudget();
  const col = (type, list) => list.map((cat) => `
    <div class="budget-row">
      <span class="name">${esc(cat)}</span>
      <div class="budget-input-wrap">
        <input type="number" step="0.01" placeholder="0" data-prevu="${type}|${esc(cat)}" value="${(mb[type] || {})[cat] ?? ""}" />
        <span style="color:var(--ink40)">€</span>
      </div>
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
  `;
}

function renderAnnee() {
  const series = getYearlySeries();
  const compte = getCompteActuel();
  const pct = Math.min(100, Math.max(0, (compte / (state.settings.objectif || 1)) * 100));
  const maxAbs = Math.max(...series.map((s) => Math.abs(s.reste)), 1);
  return `
    <div class="card card-pad">
      <h3 class="section-title">Reste par mois</h3>
      ${series.length === 0 ? `<div class="empty">Pas encore assez de données.</div>` : `
      <div class="yearly-bars">
        ${series.map((s) => `
          <div class="yearly-bar-col">
            <div class="yearly-bar ${s.reste < 0 ? "neg" : ""}" style="height:${Math.max(2, (Math.abs(s.reste) / maxAbs) * 150)}px"></div>
            <div class="yearly-bar-label">${esc(s.label)}</div>
          </div>
        `).join("")}
      </div>`}
    </div>

    <div class="card dark card-pad" style="margin-top:20px;">
      <div class="hero-label">🎯 Objectif d'épargne</div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:6px 0;">
        <div class="hero-amount font-mono" style="font-size:30px;">${fmtEUR(compte)}</div>
        <div class="font-mono" style="font-size:13px;opacity:0.7;">sur ${fmtEUR(state.settings.objectif)}</div>
      </div>
      <div class="goal-progress"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="goal-pct">${pct.toFixed(1)}%</div>
    </div>

    <div class="card card-pad" style="margin-top:20px;">
      <h3 class="section-title">Réglages</h3>
      <div class="settings-grid">
        <div class="field">
          <label>Objectif d'épargne (€)</label>
          <input type="number" id="setObjectif" value="${state.settings.objectif}" />
        </div>
        <div class="field">
          <label>Solde de départ (€)</label>
          <input type="number" id="setSolde" value="${state.settings.soldeInitial}" />
        </div>
      </div>
      <p class="hint" style="margin-top:14px;">Le solde actuel est calculé automatiquement : solde de départ + somme de tous les revenus et dépenses enregistrés.</p>
    </div>
  `;
}

/* ---------- Handlers de vue ---------- */
function attachViewHandlers() {
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = () => { state.tx = state.tx.filter((t) => t.id !== btn.dataset.del); persist("tx"); render(); };
  });
  const addBtnInline = document.getElementById("addBtnInline");
  if (addBtnInline) addBtnInline.onclick = openAddModal;

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
  if (setObjectif) setObjectif.onchange = () => { state.settings.objectif = parseFloat(setObjectif.value) || 0; persist("settings"); render(); };
  if (setSolde) setSolde.onchange = () => { state.settings.soldeInitial = parseFloat(setSolde.value) || 0; persist("settings"); render(); };
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
function detectDelim(text) {
  const sample = text.slice(0, 3000);
  const semi = (sample.match(/;/g) || []).length;
  const comma = (sample.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function toISODate(str) {
  if (!str) return new Date().toISOString().slice(0, 10);
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return new Date().toISOString().slice(0, 10);
}

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
const CATEGORY_RULES_REV = [
  [/salaire|\bpaie\b|virement.*salaire/i, "salaire"],
  [/\bcaf\b/i, "caf"],
];
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
      if (headerIdx !== -1 && (debKey !== -1 || credKey !== -1)) {
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
        }).filter((r) => r.montant > 0);
        box.innerHTML = `<div class="hint" style="color:var(--sage);margin-bottom:12px;">✓ Format Crédit Agricole détecté — ${parsed.length} opération(s) importée(s) avec catégorisation automatique. Vérifie et corrige les catégories si besoin.</div>`;
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

      if (parsed.length === 0) {
        box.innerHTML = `<div class="err-box">⚠ Aucune opération valide trouvée dans le fichier.</div>`;
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
    } catch (e) {
      box.innerHTML = `<div class="err-box">⚠ Le fichier n'a pas pu être lu (${esc(e.message || "erreur inconnue")}).</div>`;
    }
  };
  reader.readAsText(file, "ISO-8859-1");
}

/* ---------- Modal d'ajout ---------- */
function openAddModal() {
  const root = document.getElementById("modalRoot");
  let type = "depense";
  const todayISO = new Date().toISOString().slice(0, 10);

  function optionsFor(t) { return (t === "depense" ? state.cats.depenses : state.cats.revenus); }

  function paint() {
    root.innerHTML = `
      <div class="modal-backdrop" id="backdrop">
        <form class="modal" id="addForm">
          <div class="modal-head">
            <h3>Nouvelle transaction</h3>
            <button type="button" id="closeModal">✕</button>
          </div>
          <div class="type-switch">
            <button type="button" data-type="depense" class="${type === "depense" ? "active-dep" : ""}">Dépense</button>
            <button type="button" data-type="revenu" class="${type === "revenu" ? "active-rev" : ""}">Revenu</button>
          </div>
          <div class="field"><label>Montant (€)</label><input type="number" step="0.01" min="0" required id="fMontant" placeholder="0,00" /></div>
          <div class="field"><label>Date</label><input type="date" id="fDate" value="${todayISO}" /></div>
          <div class="field"><label>Description (optionnel)</label><input type="text" id="fDesc" placeholder="ex : courses Leclerc" /></div>
          <div class="field">
            <label>Catégorie</label>
            <div class="cat-row-input">
              <select id="fCat">${optionsFor(type).map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select>
              <button type="button" class="link-btn" id="newCatBtn">Nouvelle</button>
            </div>
          </div>
          <button type="submit" class="submit-btn">Enregistrer</button>
        </form>
      </div>
    `;
    document.getElementById("backdrop").onclick = (e) => { if (e.target.id === "backdrop") root.innerHTML = ""; };
    document.getElementById("closeModal").onclick = () => (root.innerHTML = "");
    document.querySelectorAll(".type-switch button").forEach((b) => {
      b.onclick = () => { type = b.dataset.type; paint(); };
    });
    document.getElementById("newCatBtn").onclick = () => {
      const wrap = document.querySelector(".cat-row-input");
      wrap.innerHTML = `<input type="text" id="fCat" placeholder="nom de la catégorie" autofocus />`;
    };
    document.getElementById("addForm").onsubmit = (e) => {
      e.preventDefault();
      const montant = parseFloat(document.getElementById("fMontant").value);
      if (!montant || montant <= 0) return;
      const date = document.getElementById("fDate").value || todayISO;
      const description = document.getElementById("fDesc").value;
      const categorie = (document.getElementById("fCat").value || "autres").toLowerCase().trim();
      state.tx.push({ id: uid(), type, date, montant, description, categorie });
      const key = type === "depense" ? "depenses" : "revenus";
      if (!state.cats[key].includes(categorie)) state.cats[key].push(categorie);
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
  document.getElementById("fabAdd").onclick = openAddModal;

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
