/* ============================================================
   Gorillas • Rede — App Core
   Firebase RTDB, IndexedDB Backups, Modal, Toast, State, Routing
   ============================================================ */

// ───────── Firebase ─────────
const firebaseConfig = { apiKey: "AIzaSyAuZ_RWLLn26CqUy3zpyz75_IuQSVQti2k", authDomain: "projectshub-marc35.firebaseapp.com", databaseURL: "https://projectshub-marc35-default-rtdb.firebaseio.com", projectId: "projectshub-marc35", storageBucket: "projectshub-marc35.firebasestorage.app", messagingSenderId: "949883815683", appId: "1:949883815683:web:7367cf58a2d23acbb34b36", measurementId: "G-EPKZTRGGGC" };
firebase.initializeApp(firebaseConfig);
const rtdb = firebase.database(), dbRef = rtdb.ref("gorillas_net");
let firebaseConnected = false;

// ───────── Utils ─────────
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));
const uid = () => crypto?.randomUUID?.() || "id-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
const nowISO = () => new Date().toISOString();
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
function safeJSON(t, fb) { try { return JSON.parse(t) } catch { return fb } }
function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso); return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) }
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }

// ───────── Data Layer ─────────
const DB_KEY = "gorillas_netdb_v1";
function loadCache() {
    const r = localStorage.getItem(DB_KEY);
    if (!r) return createDefaultDB();
    const p = safeJSON(r, null);
    if (!p || typeof p !== "object") return createDefaultDB();
    return migrateDB(p);
}
function saveCache(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)) }
function saveDB(db) {
    db.meta.updatedAt = nowISO(); saveCache(db);
    dbRef.set(db).catch(e => { console.error("save error", e); toast("error", "Erro", "Falha ao salvar.") });
}
function initFirebase() {
    rtdb.ref(".info/connected").on("value", s => { firebaseConnected = !!s.val(); updateSyncDot() });
    dbRef.on("value", s => {
        const d = s.val();
        if (d && typeof d === "object") {
            const migrated = migrateDB(d);
            appState.db = migrated; saveCache(migrated); render();
        } else {
            const init = loadCache(); dbRef.set(init).catch(e => console.error(e));
        }
    }, e => { console.error("listener error", e); toast("error", "Erro", "Problema na sincronização.") });
}
function updateSyncDot() {
    const dot = $("#syncDot"); if (!dot) return;
    dot.classList.toggle("connected", firebaseConnected);
    dot.classList.toggle("disconnected", !firebaseConnected);
    dot.title = firebaseConnected ? "Dados sincronizados" : "Verificando conexão…";
}

// ───────── IndexedDB Backups ─────────
const Backups = {
    DB: "gorillas_backups", STORE: "snapshots", VER: 1, MAX: 10,
    _open() { return new Promise((ok, fail) => { const r = indexedDB.open(this.DB, this.VER); r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE, { keyPath: "id", autoIncrement: true }) }; r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error) }) },
    async create(name) { const db = await this._open(); const snap = { name: name || "Backup automático", timestamp: nowISO(), data: structuredClone(appState.db), deviceCount: appState.db.dispositivos.length, connectionCount: appState.db.conexoes.length }; return new Promise((ok, fail) => { const tx = db.transaction(this.STORE, "readwrite"); tx.objectStore(this.STORE).add(snap); tx.oncomplete = () => { this._enforce().then(ok) }; tx.onerror = () => fail(tx.error) }) },
    async list() { const db = await this._open(); return new Promise((ok, fail) => { const r = db.transaction(this.STORE, "readonly").objectStore(this.STORE).getAll(); r.onsuccess = () => ok(r.result.sort((a, b) => b.timestamp.localeCompare(a.timestamp))); r.onerror = () => fail(r.error) }) },
    async get(id) { const db = await this._open(); return new Promise((ok, fail) => { const r = db.transaction(this.STORE, "readonly").objectStore(this.STORE).get(id); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error) }) },
    async remove(id) { const db = await this._open(); return new Promise((ok, fail) => { const tx = db.transaction(this.STORE, "readwrite"); tx.objectStore(this.STORE).delete(id); tx.oncomplete = () => ok(); tx.onerror = () => fail(tx.error) }) },
    async restore(id) { const s = await this.get(id); if (!s) throw new Error("Não encontrado"); appState.db = migrateDB(structuredClone(s.data)); saveDB(appState.db); return s },
    async _enforce() { const all = await this.list(); if (all.length <= this.MAX) return; const del = all.slice(this.MAX); const db = await this._open(); const tx = db.transaction(this.STORE, "readwrite"); const st = tx.objectStore(this.STORE); del.forEach(s => st.delete(s.id)); return new Promise(ok => { tx.oncomplete = ok }) },
    async exportAll() { return JSON.stringify(await this.list(), null, 2) },
    async importAll(json) { const arr = safeJSON(json, null); if (!Array.isArray(arr)) throw new Error("Inválido"); const db = await this._open(); const tx = db.transaction(this.STORE, "readwrite"); const st = tx.objectStore(this.STORE); arr.forEach(s => { delete s.id; st.add(s) }); return new Promise((ok, fail) => { tx.oncomplete = () => { this._enforce().then(ok) }; tx.onerror = () => fail(tx.error) }) }
};

// ───────── Toast ─────────
function toast(kind, title, msg) {
    const c = $("#toasts"), el = document.createElement("div");
    el.className = "toast-item " + (kind || "");
    el.innerHTML = `<div class="toast-dot"></div><div><p class="toast-title">${esc(title)}</p>${msg ? `<p class="toast-msg">${esc(msg)}</p>` : ""}</div>`;
    c.appendChild(el); setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 200) }, 3200);
}

// ───────── Modal ─────────
const modal = { open: false, lastFocus: null, onSave: null };
function openModal({ title, body, onSave, saveLabel = "Salvar", saveClass = "btn-primary", hideFooter = false, wide = false }) {
    modal.open = true; modal.onSave = onSave; modal.lastFocus = document.activeElement;
    $("#modalTitle").textContent = title || "";
    $("#modalBody").innerHTML = body || "";
    const m = $(".modal"); m.classList.toggle("modal-wide", !!wide);
    $("#modalSave").textContent = saveLabel;
    $("#modalSave").className = "btn " + saveClass;
    $("#modalFooter").style.display = hideFooter ? "none" : "";
    const ov = $("#modalOverlay"); ov.classList.add("open"); ov.setAttribute("aria-hidden", "false");
    const fi = $("#modalBody input,#modalBody select,#modalBody textarea");
    (fi || $("#modalSave")).focus();
    document.addEventListener("keydown", onModalKey, true);
}
function closeModal() {
    modal.open = false; modal.onSave = null;
    const ov = $("#modalOverlay"); ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onModalKey, true);
    if (modal.lastFocus?.focus) modal.lastFocus.focus();
}
function onModalKey(e) {
    if (!modal.open) return;
    if (e.key === "Escape") { e.preventDefault(); closeModal(); return }
    if (e.key === "Tab") {
        const f = $$(`.modal button,.modal [href],.modal input,.modal select,.modal textarea,.modal [tabindex]:not([tabindex="-1"])`, $("#modalOverlay")).filter(el => !el.disabled && el.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    }
}
$("#modalClose").onclick = closeModal;
$("#modalCancel").onclick = closeModal;
$("#modalSave").onclick = () => { if (typeof modal.onSave === "function") modal.onSave() };
$("#modalOverlay").onclick = e => { if (e.target === $("#modalOverlay")) closeModal() };

// ───────── Device Presets ─────────
const PRESETS = [
    { key: "router", label: "Roteador", defaults: { tipo: "Roteador", ip: "192.168.0.1", fabricante: "", funcao: "Gateway / DHCP", criticidade: "crítica", alturaU: 1 }, icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>' },
    { key: "switch", label: "Switch", defaults: { tipo: "Switch", ip: "192.168.0.2", portas: "24", funcao: "Distribuição", criticidade: "alta", alturaU: 1 }, icon: '<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/>' },
    { key: "ap", label: "Access Point", defaults: { tipo: "Access Point", ip: "192.168.0.10", funcao: "Wi-Fi", criticidade: "alta", alturaU: 0 }, icon: '<path d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>' },
    { key: "dvr", label: "DVR / NVR", defaults: { tipo: "DVR/NVR", ip: "192.168.0.20", funcao: "Gravação CFTV", criticidade: "alta", alturaU: 2 }, icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>' },
    { key: "pdv", label: "PDV / Terminal", defaults: { tipo: "PDV/Terminal", ip: "", funcao: "Caixa", alturaU: 0 }, icon: '<rect x="5" y="2" width="14" height="16" rx="2"/><line x1="5" y1="22" x2="19" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/>' },
    { key: "printer", label: "Impressora", defaults: { tipo: "Impressora", ip: "192.168.0.50", funcao: "Impressão", alturaU: 0 }, icon: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>' },
    { key: "server", label: "Servidor", defaults: { tipo: "Servidor", ip: "192.168.0.100", funcao: "Servidor de aplicações", criticidade: "crítica", alturaU: 2 }, icon: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/>' },
    { key: "modem", label: "Modem ISP", defaults: { tipo: "Modem ISP", ip: "192.168.1.1", funcao: "Acesso WAN", criticidade: "crítica", alturaU: 1 }, icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><circle cx="12" cy="17" r="1.5" fill="currentColor"/>' },
    { key: "camera", label: "Câmera", defaults: { tipo: "Câmera", ip: "192.168.0.60", funcao: "Vigilância", alturaU: 0 }, icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>' },
    { key: "firewall", label: "Firewall", defaults: { tipo: "Firewall", ip: "192.168.0.254", funcao: "Segurança de borda", criticidade: "crítica", alturaU: 1 }, icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    { key: "custom", label: "Personalizado", defaults: { tipo: "", ip: "" }, icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>' },
];
function presetSVG(p, size = 28) { return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${p.icon}</svg>` }
function getPresetByTipo(tipo) { return PRESETS.find(p => p.defaults.tipo === tipo) }
function deviceIconSVG(tipo, size = 20) { const p = getPresetByTipo(tipo) || PRESETS[PRESETS.length - 1]; return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${p.icon}</svg>` }

// ───────── Network Pattern Templates ─────────
const NET_TEMPLATES = [
    {
        key: "basica", label: "Rede básica", desc: "Modem + Roteador + Switch + AP",
        devices: [
            { nome: "Modem ISP", tipo: "Modem ISP", ip: "192.168.1.1", local: "Rack", funcao: "Acesso WAN" },
            { nome: "Roteador", tipo: "Roteador", ip: "192.168.0.1", local: "Rack", funcao: "Gateway" },
            { nome: "Switch Principal", tipo: "Switch", ip: "192.168.0.2", local: "Rack", funcao: "Distribuição", portas: "24" },
            { nome: "AP Salão", tipo: "Access Point", ip: "192.168.0.10", local: "Salão", funcao: "Wi-Fi" },
        ],
        links: [{ de: 0, para: 1, tipo: "Cabo" }, { de: 1, para: 2, tipo: "Cabo" }, { de: 2, para: 3, tipo: "Cabo" }]
    },
    {
        key: "cftv", label: "Sistema CFTV", desc: "NVR + 4 Câmeras",
        devices: [
            { nome: "NVR Central", tipo: "DVR/NVR", ip: "192.168.0.20", local: "Rack", funcao: "Gravação CFTV" },
            { nome: "Câmera Entrada", tipo: "Câmera", ip: "192.168.0.61", local: "Entrada", funcao: "Vigilância" },
            { nome: "Câmera Salão", tipo: "Câmera", ip: "192.168.0.62", local: "Salão", funcao: "Vigilância" },
            { nome: "Câmera Cozinha", tipo: "Câmera", ip: "192.168.0.63", local: "Cozinha", funcao: "Vigilância" },
            { nome: "Câmera Caixa", tipo: "Câmera", ip: "192.168.0.64", local: "Caixa", funcao: "Vigilância" },
        ],
        links: [{ de: 1, para: 0, tipo: "Cabo" }, { de: 2, para: 0, tipo: "Cabo" }, { de: 3, para: 0, tipo: "Cabo" }, { de: 4, para: 0, tipo: "Cabo" }]
    },
];

// ───────── App State ─────────
const appState = {
    db: null, route: "/painel",
    searchDevices: "", searchLinks: "",
    deviceSort: { col: "nome", dir: "asc" },
    linkSort: { col: "updatedAt", dir: "desc" },
    deviceFilter: { tipo: "", local: "" },
    linkFilter: { tipo: "" },
    // topology
    topoEditMode: false,
    topoSnapGrid: true,
    topoSelected: null, // {type:'device'|'link',id}
    topoHighlight: null, // {linkId,deId,paraId} — from Conexões "Ver na topologia"
    // rack
    selectedRack: null,
    // networks tab
    netTab: "wans",
};

// ───────── Sidebar mobile ─────────
function toggleSidebar(open) {
    const sb = $("#sidebar"), bd = $("#sidebarBackdrop");
    const isOpen = sb.classList.contains("open");
    const next = typeof open === "boolean" ? open : !isOpen;
    sb.classList.toggle("open", next); bd.classList.toggle("open", next);
}
$("#menuToggle").onclick = () => toggleSidebar();
$("#sidebarBackdrop").onclick = () => toggleSidebar(false);

// ───────── Routing ─────────
function routeFromHash() { const h = location.hash || "#/painel"; return h.startsWith("#") ? h.slice(1) : h || "/painel" }
function setActiveNav(route) { $$("#sidebar .nav-item").forEach(a => a.classList.toggle("active", a.dataset.route === route)) }
function navigate(r) { location.hash = "#" + r }
window.addEventListener("hashchange", () => { toggleSidebar(false); render() });

// ───────── Helpers ─────────
function groupBy(arr, fn) { const o = {}; for (const it of arr) { const k = fn(it); (o[k] = o[k] || []).push(it) } return o }
function countBy(arr, fn) { const o = {}; for (const it of arr) { const k = fn(it); o[k] = (o[k] || 0) + 1 } return o }
function sortList(list, col, dir) {
    return [...list].sort((a, b) => { let va = (a[col] || ""), vb = (b[col] || ""); if (typeof va === "string") va = va.toLowerCase(); if (typeof vb === "string") vb = vb.toLowerCase(); const c = va < vb ? -1 : va > vb ? 1 : 0; return dir === "asc" ? c : -c });
}
function uniqueValues(arr, key) { return [...new Set(arr.map(i => i[key]).filter(Boolean))].sort() }
function downloadJSON(data, filename) {
    const b = new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b), a = document.createElement("a");
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
}

// ───────── Keyboard Shortcuts ─────────
document.addEventListener("keydown", e => {
    if (modal.open) return;
    if (e.ctrlKey && e.key === "z") { e.preventDefault(); performUndo() }
});

// Init placeholder — render() defined in render.js
