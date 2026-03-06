/* ============================================================
   Gorillas — Data Model v2
   Schema, migration, defaults, expanded device properties
   ============================================================ */

// ───────── Schema Defaults ─────────
const DEVICE_DEFAULTS = {
    id: "", nome: "", tipo: "", fabricante: "", modelo: "", funcao: "", serial: "", firmware: "",
    ip: "", mac: "", portas: "", uplinks: "", poe: false, local: "", criticidade: "normal", status: "ativo",
    interface: "", velocidade: "", quantidade: 1,
    rack: "", posicaoU: 0, alturaU: 1, notas: "",
    topoX: 0, topoY: 0, topoPinned: false,
    createdAt: "", updatedAt: ""
};

const WAN_DEFAULTS = { id: "", nome: "", isp: "", tipo: "Fibra", ip: "", gateway: "", dns: "", velocidadeDown: "", velocidadeUp: "", failover: false, balanceamento: false, dispositivoId: "", notas: "", createdAt: "", updatedAt: "" };

const VPN_DEFAULTS = { id: "", nome: "", tipo: "Site-to-Site", endpoint: "", psk: "", dispositivoIds: [], notas: "", createdAt: "", updatedAt: "" };

const WIFI_DEFAULTS = { id: "", ssid: "", banda: "2.4/5 GHz", seguranca: "WPA3", vlanTag: "", apIds: [], senha: "", oculta: false, notas: "", createdAt: "", updatedAt: "" };

const VLAN_DEFAULTS = { id: "", tag: "", nome: "", subrede: "", gateway: "", notas: "", createdAt: "", updatedAt: "" };

const RACK_DEFAULTS = { id: "", nome: "", local: "", totalU: 24, itens: [], notas: "", createdAt: "", updatedAt: "" };

// Rack item: {dispositivoId,tipo,nome,posU,altU} — tipo can be "device","bandeja","patch_panel","blank","organizador","nvr"

const RACK_ITEM_TYPES = [
    { key: "device", label: "Dispositivo", altU: 1, color: "#006fff" },
    { key: "patch_panel", label: "Patch Panel", altU: 1, color: "#8b5cf6" },
    { key: "bandeja", label: "Bandeja", altU: 1, color: "#64748b" },
    { key: "blank", label: "Painel Cego", altU: 1, color: "#cbd5e1" },
    { key: "organizador", label: "Organizador", altU: 1, color: "#94a3b8" },
    { key: "nvr", label: "Central CFTV / NVR", altU: 2, color: "#f59e0b" },
];

const CRITICIDADE_OPTIONS = ["baixa", "normal", "alta", "crítica"];
const STATUS_OPTIONS = ["ativo", "inativo", "manutenção", "planejado"];
const WAN_TIPOS = ["Fibra", "Cable", "DSL", "4G/5G", "Rádio", "Outro"];
const VPN_TIPOS = ["Site-to-Site", "Client-to-Site", "SSL/TLS", "WireGuard", "IPsec", "Outro"];
const WIFI_SEGURANCA = ["Aberta", "WEP", "WPA2", "WPA3", "WPA2/WPA3", "Enterprise"];
const WIFI_BANDAS = ["2.4 GHz", "5 GHz", "2.4/5 GHz", "6 GHz", "Tri-band"];

// ───────── Default DB v2 ─────────
function createDefaultDB() {
    const now = nowISO();
    return {
        meta: { app: "GorillasNet", version: 2, createdAt: now, updatedAt: now },
        dispositivos: [
            { ...DEVICE_DEFAULTS, id: uid(), nome: "Roteador Principal", tipo: "Roteador", fabricante: "Ubiquiti", modelo: "EdgeRouter X", ip: "192.168.0.1", mac: "AA:BB:CC:DD:EE:01", local: "Rack", funcao: "Gateway / DHCP", criticidade: "crítica", status: "ativo", alturaU: 1, createdAt: now, updatedAt: now },
            { ...DEVICE_DEFAULTS, id: uid(), nome: "Switch 24p", tipo: "Switch", fabricante: "Ubiquiti", modelo: "USW-24-PoE", ip: "192.168.0.2", mac: "AA:BB:CC:DD:EE:02", local: "Rack", funcao: "Distribuição", poe: true, portas: "24", alturaU: 1, criticidade: "alta", status: "ativo", createdAt: now, updatedAt: now },
            { ...DEVICE_DEFAULTS, id: uid(), nome: "AP Salão", tipo: "Access Point", fabricante: "Ubiquiti", modelo: "U6-Lite", ip: "192.168.0.10", mac: "AA:BB:CC:DD:EE:10", local: "Salão", funcao: "Wi-Fi clientes", alturaU: 0, criticidade: "alta", status: "ativo", createdAt: now, updatedAt: now },
        ],
        conexoes: [],
        wans: [],
        vpns: [],
        wifis: [],
        vlans: [],
        racks: []
    };
}

// ───────── Migration ─────────
function migrateDB(db) {
    if (!db || typeof db !== "object") return createDefaultDB();
    const v = db.meta?.version || 1;
    // Ensure all collections exist
    if (!Array.isArray(db.dispositivos)) db.dispositivos = [];
    if (!Array.isArray(db.conexoes)) db.conexoes = [];
    if (!Array.isArray(db.wans)) db.wans = [];
    if (!Array.isArray(db.vpns)) db.vpns = [];
    if (!Array.isArray(db.wifis)) db.wifis = [];
    if (!Array.isArray(db.vlans)) db.vlans = [];
    if (!Array.isArray(db.racks)) db.racks = [];
    if (!db.meta) db.meta = { app: "GorillasNet", version: 2, createdAt: nowISO(), updatedAt: nowISO() };

    if (v < 2) {
        // Migrate devices: add new fields with defaults
        db.dispositivos = db.dispositivos.map(d => ({ ...DEVICE_DEFAULTS, ...d }));
        db.meta.version = 2;
        console.log("DB migrated to v2");
    }
    return db;
}

// ───────── Helpers ─────────
function newDevice(overrides = {}) { return { ...DEVICE_DEFAULTS, id: uid(), createdAt: nowISO(), updatedAt: nowISO(), ...overrides } }
function newWan(overrides = {}) { return { ...WAN_DEFAULTS, id: uid(), createdAt: nowISO(), updatedAt: nowISO(), ...overrides } }
function newVpn(overrides = {}) { return { ...VPN_DEFAULTS, id: uid(), createdAt: nowISO(), updatedAt: nowISO(), ...overrides } }
function newWifi(overrides = {}) { return { ...WIFI_DEFAULTS, id: uid(), createdAt: nowISO(), updatedAt: nowISO(), ...overrides } }
function newVlan(overrides = {}) { return { ...VLAN_DEFAULTS, id: uid(), createdAt: nowISO(), updatedAt: nowISO(), ...overrides } }
function newRack(overrides = {}) { return { ...RACK_DEFAULTS, id: uid(), createdAt: nowISO(), updatedAt: nowISO(), ...overrides } }

// ───────── Undo Stack ─────────
const undoStack = [];
const UNDO_MAX = 30;
function pushUndo(label, snapshot) {
    undoStack.push({ label, data: JSON.stringify(snapshot), ts: nowISO() });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
}
function popUndo() {
    if (!undoStack.length) return null;
    const entry = undoStack.pop();
    return { label: entry.label, data: JSON.parse(entry.data) };
}
function performUndo() {
    const u = popUndo();
    if (!u) { toast("warning", "Desfazer", "Nada para desfazer."); return }
    appState.db = u.data; saveDB(appState.db);
    toast("success", "Desfeito", u.label); render();
}
