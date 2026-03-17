/* ============================================================
   Gorillas — Topology Editor v2
   Topological layout, zoom-to-fit, WAN clouds, Wi-Fi/VPN chips,
   drag-drop, snap-to-grid, inspector, highlight from Conexões
   ============================================================ */

// ───────── Page: Topologia ─────────
function pageTopologia() {
    const editMode = appState.topoEditMode;
    const snap = appState.topoSnapGrid;
    return `
  <div class="card" style="margin-bottom:0;display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h) - 48px)">
    <div class="card-header" style="margin-bottom:8px">
      <div><h2 class="card-title">Topologia</h2><p class="card-desc">Visualize e organize os dispositivos e conexões da rede.</p></div>
      <div class="card-actions">
        <div class="btn-group">
          <button class="btn btn-sm ${editMode ? "active" : ""}" type="button" id="topoToggleEdit">${editMode ? "✏️ Editando" : "👁️ Visualizando"}</button>
          <button class="btn btn-sm ${snap ? "active" : ""}" type="button" id="topoToggleSnap" title="Snap ao grid">#</button>
        </div>
        <button class="btn btn-sm" type="button" id="topoAutoLayout">Organizar</button>
        <button class="btn btn-sm" type="button" id="topoFit">Ajustar</button>
      </div>
    </div>
    <div class="topo-container" id="topoMain" style="flex:1;min-height:300px">
      <div class="topo-controls">
        <button class="btn btn-icon" type="button" id="topoZoomIn" aria-label="Aproximar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        <button class="btn btn-icon" type="button" id="topoZoomOut" aria-label="Afastar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
      </div>
    </div>
  </div>`;
}

// ───────── Topology Constants ─────────
const TOPO = {
    PAD: 60, NODE_W: 170, NODE_H: 56, GRID: 20,
    LAYER_GAP_Y: 140, LAYER_GAP_X: 50,
    LINK_STYLES: {
        "Cabo": { color: "#006fff", dash: "", width: 2 },
        "Fibra/Uplink": { color: "#8b5cf6", dash: "", width: 2.5 },
        "Wi-Fi": { color: "#22c55e", dash: "6 4", width: 1.5 },
        "VPN": { color: "#f59e0b", dash: "4 4", width: 1.5 },
        "WAN": { color: "#ef4444", dash: "", width: 2 },
        "Outro": { color: "#94a3b8", dash: "3 3", width: 1.5 }
    },
    TYPE_ORDER: { "Modem ISP": 0, "Firewall": 1, "Roteador": 2, "Switch": 3, "Servidor": 4, "DVR/NVR": 4, "Access Point": 5, "Impressora": 6, "PDV/Terminal": 6, "Câmera": 6, "Computador": 6, "Outro": 7 },
    ROOT_TYPES: new Set(["Modem ISP", "Firewall", "Roteador"])
};
const topoState = { vb: null, dragging: false, panStart: null, dragNode: null, dragOffset: null };

// ───────── Topological Layout (E) ─────────
function topoLayoutPositions(devs, links) {
    if (!devs.length) return;
    // Build adjacency
    const adj = new Map();
    devs.forEach(d => adj.set(d.id, []));
    links.forEach(l => {
        if (adj.has(l.deId) && adj.has(l.paraId)) {
            adj.get(l.deId).push(l.paraId);
            adj.get(l.paraId).push(l.deId);
        }
    });

    // Find roots: ISP/Firewall/Router with best centrality, or just highest TYPE_ORDER priority
    const candidates = devs.filter(d => TOPO.ROOT_TYPES.has(d.tipo));
    const roots = candidates.length ? candidates.sort((a, b) => (TOPO.TYPE_ORDER[a.tipo] ?? 7) - (TOPO.TYPE_ORDER[b.tipo] ?? 7)) : devs.slice(0, 1);

    // BFS layered assignment
    const layer = new Map();
    const visited = new Set();
    const queue = [];
    roots.forEach(r => { layer.set(r.id, 0); visited.add(r.id); queue.push(r.id) });
    while (queue.length) {
        const cur = queue.shift();
        const cl = layer.get(cur);
        for (const nb of (adj.get(cur) || [])) {
            if (!visited.has(nb)) {
                visited.add(nb);
                layer.set(nb, cl + 1);
                queue.push(nb);
            }
        }
    }
    // Assign unconnected devices to last layer +1
    const maxLayer = Math.max(0, ...layer.values());
    devs.forEach(d => { if (!layer.has(d.id)) layer.set(d.id, maxLayer + 1) });

    // Group by layer, then sort within layer by type priority + local
    const layerGroups = {};
    devs.forEach(d => {
        const l = layer.get(d.id);
        if (!layerGroups[l]) layerGroups[l] = [];
        layerGroups[l].push(d);
    });

    // Barycenter heuristic for crossing reduction (one pass)
    const layerNums = Object.keys(layerGroups).map(Number).sort((a, b) => a - b);
    for (let li = 1; li < layerNums.length; li++) {
        const prevLayer = layerGroups[layerNums[li - 1]];
        const prevPos = new Map();
        prevLayer.forEach((d, i) => prevPos.set(d.id, i));
        const curLayer = layerGroups[layerNums[li]];
        // Compute barycenter for each node
        curLayer.forEach(d => {
            const neighbors = (adj.get(d.id) || []).filter(n => prevPos.has(n));
            if (neighbors.length) {
                d._bary = neighbors.reduce((s, n) => s + prevPos.get(n), 0) / neighbors.length;
            } else {
                d._bary = (TOPO.TYPE_ORDER[d.tipo] ?? 7);
            }
        });
        curLayer.sort((a, b) => a._bary - b._bary);
    }
    // Sort first layer by type order
    if (layerGroups[0]) layerGroups[0].sort((a, b) => (TOPO.TYPE_ORDER[a.tipo] ?? 7) - (TOPO.TYPE_ORDER[b.tipo] ?? 7));

    // Position: layers top-to-bottom, nodes left-to-right
    const startY = TOPO.PAD + 40; // space for WAN clouds above
    layerNums.forEach(ln => {
        const nodes = layerGroups[ln];
        const totalW = nodes.length * (TOPO.NODE_W + TOPO.LAYER_GAP_X) - TOPO.LAYER_GAP_X;
        const startX = TOPO.PAD + Math.max(0, (600 - totalW) / 2); // center horizontally
        nodes.forEach((d, i) => {
            d.topoX = startX + i * (TOPO.NODE_W + TOPO.LAYER_GAP_X);
            d.topoY = startY + ln * TOPO.LAYER_GAP_Y;
        });
    });
}

// ───────── Content Bounds ─────────
function topoContentBounds(devs, extraPoints) {
    const pts = [];
    devs.forEach(d => {
        pts.push({ x: d.topoX || 0, y: d.topoY || 0 });
        pts.push({ x: (d.topoX || 0) + TOPO.NODE_W, y: (d.topoY || 0) + TOPO.NODE_H });
    });
    if (extraPoints) extraPoints.forEach(p => pts.push(p));
    if (!pts.length) return { x: 0, y: 0, w: 600, h: 400 };
    const minX = Math.min(...pts.map(p => p.x)) - TOPO.PAD;
    const minY = Math.min(...pts.map(p => p.y)) - TOPO.PAD;
    const maxX = Math.max(...pts.map(p => p.x)) + TOPO.PAD;
    const maxY = Math.max(...pts.map(p => p.y)) + TOPO.PAD;
    return { x: minX, y: minY, w: Math.max(200, maxX - minX), h: Math.max(150, maxY - minY) };
}

// ───────── Build Topology SVG ─────────
function buildTopoSVG(opts) {
    opts = opts || {};
    const devs = appState.db.dispositivos, links = appState.db.conexoes;
    const wans = appState.db.wans || [], wifis = appState.db.wifis || [], vpns = appState.db.vpns || [];
    const hasPinned = devs.some(d => d.topoPinned);
    if (!hasPinned) topoLayoutPositions(devs, links);

    const hl = appState.topoHighlight; // {linkId,deId,paraId} from Conexões
    const sel = appState.topoSelected;
    const pos = new Map();
    devs.forEach(d => { pos.set(d.id, { x: d.topoX || 0, y: d.topoY || 0 }) });

    // ── WAN cloud nodes (F) ──
    const extraPts = [];
    let wanHTML = "";
    // Group WANs per device so we can offset horizontally
    const wansByDev = new Map();
    wans.forEach(w => {
        const key = w.dispositivoId || '__unlinked__';
        if (!wansByDev.has(key)) wansByDev.set(key, []);
        wansByDev.get(key).push(w);
    });
    let freeWanIdx = 0; // index for unlinked WANs
    wansByDev.forEach((group, devId) => {
        const devPos = devId !== '__unlinked__' ? pos.get(devId) : null;
        const count = group.length;
        const WAN_SPREAD = 140; // horizontal spacing between sibling clouds
        group.forEach((w, i) => {
            // Spread multiple WANs horizontally around the parent device center
            const baseX = devPos ? (devPos.x + TOPO.NODE_W / 2) : (TOPO.PAD + freeWanIdx * 220);
            const offsetX = count > 1 ? (i - (count - 1) / 2) * WAN_SPREAD : 0;
            const cx = baseX + offsetX;
            const cy = devPos ? (devPos.y - 70) : (TOPO.PAD - 30);
            const label = w.nome || w.isp || 'WAN';
            const subLabel = [w.isp, w.velocidadeDown ? w.velocidadeDown + '↓' : ''].filter(Boolean).join(' · ');
            const portaLabel = w.porta ? 'P' + w.porta : '';
            extraPts.push({ x: cx - 64, y: cy - 26 }, { x: cx + 64, y: cy + 26 });
            wanHTML += `<g class="topo-wan" data-wan-id="${esc(w.id)}">
          <ellipse cx="${cx}" cy="${cy}" rx="62" ry="24" fill="#fef2f2" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 3" opacity=".85"/>
          <text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="11" font-weight="600" fill="#dc2626" font-family="Inter,sans-serif">${esc(label)}</text>
          ${subLabel ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="8.5" fill="#f87171" font-family="Inter,sans-serif">${esc(subLabel)}</text>` : ''}
        </g>`;
            // Link from cloud to device
            if (devPos) {
                const lx1 = cx, ly1 = cy + 24;
                const lx2 = devPos.x + TOPO.NODE_W / 2, ly2 = devPos.y;
                wanHTML += `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 3" opacity=".5"/>`;
                if (portaLabel) {
                    const mx = (lx1 + lx2) / 2, my = (ly1 + ly2) / 2;
                    wanHTML += `<rect x="${mx - 10}" y="${my - 7}" width="20" height="12" rx="3" fill="#fef2f2" stroke="#fca5a5" stroke-width=".5" opacity=".9"/>`;
                    wanHTML += `<text x="${mx}" y="${my + 3}" text-anchor="middle" font-size="8" font-weight="600" fill="#dc2626" font-family="Inter,sans-serif">${esc(portaLabel)}</text>`;
                }
            }
            if (!devPos) freeWanIdx++;
        });
    });

    // ── Group backgrounds ──
    const groups = groupBy(devs, d => d.local || "Sem local");
    const locais = Object.keys(groups).sort();
    let groupBGs = "";
    locais.forEach(loc => {
        const items = groups[loc];
        const positions = items.map(d => pos.get(d.id)).filter(Boolean);
        if (!positions.length) return;
        const gx = Math.min(...positions.map(p => p.x)) - 16;
        const gy = Math.min(...positions.map(p => p.y)) - 32;
        const gx2 = Math.max(...positions.map(p => p.x + TOPO.NODE_W)) + 16;
        const gy2 = Math.max(...positions.map(p => p.y + TOPO.NODE_H)) + 16;
        groupBGs += `<rect x="${gx}" y="${gy}" width="${gx2 - gx}" height="${gy2 - gy}" rx="12" fill="#f0f4ff" stroke="#dce4f0" stroke-dasharray="4 3" opacity=".7"/>`;
        groupBGs += `<text x="${gx + 10}" y="${gy + 18}" font-size="11" font-weight="600" fill="#94a3b8" font-family="Inter,sans-serif">${esc(loc)}</text>`;
    });

    // ── Links ──
    let linesHTML = links.map(l => {
        const a = pos.get(l.deId), b = pos.get(l.paraId); if (!a || !b) return "";
        const st = TOPO.LINK_STYLES[l.tipo] || TOPO.LINK_STYLES["Outro"];
        const ax = a.x + TOPO.NODE_W / 2, ay = a.y + TOPO.NODE_H / 2;
        const bx = b.x + TOPO.NODE_W / 2, by = b.y + TOPO.NODE_H / 2;
        const isSel = sel?.type === "link" && sel.id === l.id;
        const isHl = hl && hl.linkId === l.id;
        const active = isSel || isHl;
        return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${active ? "#006fff" : st.color}" stroke-width="${active ? 3.5 : st.width}" opacity="${active ? 1 : .6}" ${st.dash && !active ? `stroke-dasharray="${st.dash}"` : ""} data-link-id="${esc(l.id)}" style="cursor:pointer"${isHl ? ' filter="url(#glowFilter)"' : ""}/>`;
    }).join("");

    // ── Link labels ──
    let linkLabels = links.map(l => {
        const a = pos.get(l.deId), b = pos.get(l.paraId); if (!a || !b) return "";
        const mx = (a.x + b.x + TOPO.NODE_W) / 2, my = (a.y + b.y + TOPO.NODE_H) / 2;
        const label = [l.tipo, l.vlan ? `VLAN ${l.vlan}` : ""].filter(Boolean).join(" · ");
        if (!label) return "";
        const isHl = hl && hl.linkId === l.id;
        // Small bg for readability
        return `<g>
      <rect x="${mx - label.length * 3 - 4}" y="${my - 16}" width="${label.length * 6 + 8}" height="14" rx="3" fill="#fff" opacity=".85"/>
      <text x="${mx}" y="${my - 6}" text-anchor="middle" font-size="9" fill="${isHl ? "#006fff" : "#94a3b8"}" font-weight="${isHl ? "600" : "400"}" font-family="Inter,sans-serif">${esc(label)}</text>
    </g>`;
    }).join("");

    // ── Nodes ──
    let nodesHTML = devs.map(d => {
        const p = pos.get(d.id); if (!p) return "";
        const isSel = sel?.type === "device" && sel.id === d.id;
        const isHl = hl && (hl.deId === d.id || hl.paraId === d.id);
        const active = isSel || isHl;
        const label = d.nome.length > 20 ? d.nome.slice(0, 19) + "…" : d.nome;
        const sub = [d.tipo || "", d.ip || ""].filter(Boolean).join(" · ");
        const subT = d.ip ? sub : (sub.length > 26 ? sub.slice(0, 25) + "…" : sub);
        const statusColor = d.status === "ativo" ? "#22c55e" : d.status === "inativo" ? "#ef4444" : d.status === "manutenção" ? "#f59e0b" : "#94a3b8";
        return `<g data-node-id="${esc(d.id)}" style="cursor:${appState.topoEditMode ? "grab" : "pointer"}">
      <rect x="${p.x}" y="${p.y}" width="${TOPO.NODE_W}" height="${TOPO.NODE_H}" rx="10" fill="#fff" stroke="${active ? "#006fff" : "#e2e5ea"}" stroke-width="${active ? 2.5 : 1}"${isHl ? ' filter="url(#glowFilter)"' : ""}/>
      <circle cx="${p.x + TOPO.NODE_W - 12}" cy="${p.y + 12}" r="4" fill="${statusColor}"/>
      <text x="${p.x + 12}" y="${p.y + 23}" font-size="12.5" font-weight="600" fill="#1a1e2c" font-family="Inter,sans-serif">${esc(label)}</text>
      <text x="${p.x + 12}" y="${p.y + 40}" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">${esc(subT)}</text>
    </g>`;
    }).join("");

    // ── Wi-Fi SSID chips (F) — rendered BELOW the parent node ──
    const WIFI_ICON = (x, y) => `<g transform="translate(${x},${y}) scale(0.55)">
      <path d="M1 7.4C3.6 4.8 7.1 3.2 11 3.2s7.4 1.6 10 4.2" stroke="#16a34a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M4.6 11C6.3 9.3 8.5 8.2 11 8.2s4.7 1.1 6.4 2.8" stroke="#16a34a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M8.2 14.6c.7-.7 1.7-1.2 2.8-1.2s2.1.5 2.8 1.2" stroke="#16a34a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="11" cy="18" r="1.2" fill="#16a34a"/>
    </g>`;
    let wifiChips = '';
    const apWifiMap = new Map();
    wifis.forEach(w => { (w.apIds || []).forEach(apId => { apWifiMap.set(apId, [...(apWifiMap.get(apId) || []), w]) }) });
    // Pre-compute chip counts per device for vertical stacking
    const chipCountPerDev = new Map();
    devs.forEach(d => {
        const myWifis = apWifiMap.get(d.id);
        if (!myWifis || !myWifis.length) return;
        const p = pos.get(d.id); if (!p) return;
        const chipBaseY = p.y + TOPO.NODE_H + 6;
        myWifis.forEach((w, i) => {
            const ssidText = w.ssid || 'Wi-Fi';
            const textW = ssidText.length * 6.2 + 28;
            const cx = p.x + (TOPO.NODE_W - textW) / 2; // center below node
            const cy = chipBaseY + i * 18;
            wifiChips += `<g class="topo-chip">
        <rect x="${cx}" y="${cy}" width="${textW}" height="15" rx="7.5" fill="#f0fdf4" stroke="#22c55e" stroke-width=".8"/>
        ${WIFI_ICON(cx + 3, cy + 1)}
        <text x="${cx + 17}" y="${cy + 11}" font-size="9" fill="#16a34a" font-weight="500" font-family="Inter,sans-serif">${esc(ssidText)}</text>
      </g>`;
            extraPts.push({ x: cx, y: cy }, { x: cx + textW, y: cy + 15 });
        });
        chipCountPerDev.set(d.id, myWifis.length);
    });

    // ── VPN chips (F) ──
    const LOCK_ICON = (x, y) => `<g transform="translate(${x},${y}) scale(0.56)">
      <rect x="3" y="10" width="14" height="10" rx="2" fill="none" stroke="#d97706" stroke-width="2"/>
      <path d="M7 10V6a3 3 0 0 1 6 0v4" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
    </g>`;
    let vpnChips = '';
    const devVpnMap = new Map();
    vpns.forEach(v => { (v.dispositivoIds || []).forEach(dId => { devVpnMap.set(dId, [...(devVpnMap.get(dId) || []), v]) }) });
    devs.forEach(d => {
        const myVpns = devVpnMap.get(d.id);
        if (!myVpns || !myVpns.length) return;
        const p = pos.get(d.id); if (!p) return;
        const wifiCount = chipCountPerDev.get(d.id) || 0;
        const chipBaseY = p.y + TOPO.NODE_H + 6;
        myVpns.forEach((v, i) => {
            const vpnText = v.nome || 'VPN';
            const textW = vpnText.length * 6.2 + 28;
            const cx = p.x + (TOPO.NODE_W - textW) / 2; // center below node
            const cy = chipBaseY + (wifiCount + i) * 18;
            vpnChips += `<g class="topo-chip">
        <rect x="${cx}" y="${cy}" width="${textW}" height="15" rx="7.5" fill="#fffbeb" stroke="#f59e0b" stroke-width=".8" stroke-dasharray="3 2"/>
        ${LOCK_ICON(cx + 3, cy + 1)}
        <text x="${cx + 17}" y="${cy + 11}" font-size="9" fill="#d97706" font-weight="500" font-family="Inter,sans-serif">${esc(vpnText)}</text>
      </g>`;
            extraPts.push({ x: cx, y: cy }, { x: cx + textW, y: cy + 15 });
        });
    });

    // ── Grid overlay ──
    let gridHTML = "";
    if (appState.topoSnapGrid && appState.topoEditMode) {
        const bounds = topoContentBounds(devs, extraPts);
        const gs = TOPO.GRID;
        for (let x = Math.floor(bounds.x / gs) * gs; x < bounds.x + bounds.w; x += gs)gridHTML += `<line x1="${x}" y1="${bounds.y}" x2="${x}" y2="${bounds.y + bounds.h}" stroke="#e2e5ea" stroke-width=".3"/>`;
        for (let y = Math.floor(bounds.y / gs) * gs; y < bounds.y + bounds.h; y += gs)gridHTML += `<line x1="${bounds.x}" y1="${y}" x2="${bounds.x + bounds.w}" y2="${y}" stroke="#e2e5ea" stroke-width=".3"/>`;
    }

    // ── Legend ──
    const usedTypes = new Set(links.map(l => l.tipo).filter(Boolean));
    if (wans.length) usedTypes.add('WAN');
    let legendItems = [...usedTypes].map(t => { const s = TOPO.LINK_STYLES[t] || TOPO.LINK_STYLES['Outro']; return `<div class="topo-legend-item"><div class="topo-legend-line" style="background:${s.color}${s.dash ? ';border:1px dashed ' + s.color + ';background:none' : ''}"></div> ${esc(t)}</div>` });
    if (wifis.length) legendItems.push(`<div class="topo-legend-item"><svg viewBox="0 0 22 22" width="12" height="12"><path d="M1 7.4C3.6 4.8 7.1 3.2 11 3.2s7.4 1.6 10 4.2" stroke="#16a34a" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M4.6 11C6.3 9.3 8.5 8.2 11 8.2s4.7 1.1 6.4 2.8" stroke="#16a34a" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="11" cy="16" r="1.5" fill="#16a34a"/></svg> Wi-Fi/SSID</div>`);
    if (vpns.length) legendItems.push(`<div class="topo-legend-item"><svg viewBox="0 0 20 22" width="11" height="13"><rect x="3" y="10" width="14" height="10" rx="2" fill="none" stroke="#d97706" stroke-width="2"/><path d="M7 10V6a3 3 0 0 1 6 0v4" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round"/></svg> VPN</div>`);
    const legendHTML = legendItems.length ? `<div class="topo-legend">${legendItems.join('')}</div>` : '';

    // ── Compute viewBox from content ──
    const bounds = topoContentBounds(devs, extraPts);

    // SVG filter for glow
    const defs = `<defs><filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

    const svg = `<svg viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" xmlns="http://www.w3.org/2000/svg" id="topoSVG" style="cursor:grab">${defs}${gridHTML}${groupBGs}${wanHTML}${linesHTML}${linkLabels}${nodesHTML}${wifiChips}${vpnChips}</svg>`;
    return { svg, legendHTML, bounds };
}

// ───────── Perform Auto Layout ─────────
function performAutoLayout() {
    appState.db.dispositivos.forEach(d => { d.topoPinned = false });
    topoLayoutPositions(appState.db.dispositivos, appState.db.conexoes);
    saveDB(appState.db); renderTopo();
    toast("success", "Topologia", "Layout reorganizado.");
}

// ───────── Render Topology ─────────
function renderTopo(containerId) {
    const cId = containerId || "topoMain";
    const container = $("#" + cId); if (!container) return;
    const controlsHTML = container.querySelector(".topo-controls")?.outerHTML || "";
    const result = buildTopoSVG();
    container.innerHTML = result.svg + result.legendHTML + controlsHTML;
    initTopoPanZoom(cId);
    if (cId === "topoMain") {
        initTopoInteraction();
        $("#topoZoomIn")?.addEventListener("click", () => topoZoom(0.8));
        $("#topoZoomOut")?.addEventListener("click", () => topoZoom(1.25));
    }
    // Auto zoom-to-fit on load
    topoFitView();
    // Clear highlight after 4s
    if (appState.topoHighlight) {
        setTimeout(() => { appState.topoHighlight = null; if (appState.route === "/topologia") renderTopo() }, 4000);
    }
}

// ───────── Zoom-to-Fit (D) ─────────
function topoFitView() {
    const svg = $('#topoSVG'); if (!svg) return;
    const container = svg.parentElement; if (!container) return;
    const cr = container.getBoundingClientRect();
    if (!cr.width || !cr.height) return;
    const devs = appState.db.dispositivos;
    const wans = appState.db.wans || [];
    const extraPts = [];
    // Use same grouping logic as buildTopoSVG for WAN cloud bounds
    const wansByDev = new Map();
    wans.forEach(w => {
        const key = w.dispositivoId || '__unlinked__';
        if (!wansByDev.has(key)) wansByDev.set(key, []);
        wansByDev.get(key).push(w);
    });
    let freeIdx = 0;
    wansByDev.forEach((group, devId) => {
        const dp = devId !== '__unlinked__' ? devs.find(d => d.id === devId) : null;
        const count = group.length;
        const WAN_SPREAD = 140;
        group.forEach((w, i) => {
            const baseX = dp ? ((dp.topoX || 0) + TOPO.NODE_W / 2) : (TOPO.PAD + freeIdx * 220);
            const offsetX = count > 1 ? (i - (count - 1) / 2) * WAN_SPREAD : 0;
            const cx = baseX + offsetX;
            const cy = dp ? ((dp.topoY || 0) - 70) : (TOPO.PAD - 30);
            extraPts.push({ x: cx - 64, y: cy - 26 }, { x: cx + 64, y: cy + 26 });
            if (!dp) freeIdx++;
        });
    });
    const bounds = topoContentBounds(devs, extraPts);
    const aspect = cr.width / cr.height;
    let vw = bounds.w, vh = bounds.h;
    if (vw / vh > aspect) { vh = vw / aspect } else { vw = vh * aspect }
    const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
    topoState.vb = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh };
    applyVB(svg);
}

// ───────── Pan/Zoom ─────────
function initTopoPanZoom(cId) {
    const svg = $("#topoSVG"); if (!svg) return;
    const vb = svg.viewBox.baseVal;
    topoState.vb = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };

    svg.addEventListener("wheel", e => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.1 : 0.9;
        const rect = svg.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * topoState.vb.w + topoState.vb.x;
        const my = ((e.clientY - rect.top) / rect.height) * topoState.vb.h + topoState.vb.y;
        topoState.vb.w *= factor; topoState.vb.h *= factor;
        topoState.vb.x = mx - ((e.clientX - rect.left) / rect.width) * topoState.vb.w;
        topoState.vb.y = my - ((e.clientY - rect.top) / rect.height) * topoState.vb.h;
        applyVB(svg);
    }, { passive: false });

    svg.addEventListener("mousedown", e => {
        if (topoState.dragNode) return;
        if (e.button !== 0) return;
        topoState.dragging = true;
        topoState.panStart = { mx: e.clientX, my: e.clientY, vx: topoState.vb.x, vy: topoState.vb.y };
        svg.style.cursor = "grabbing";
    });
    svg.addEventListener("mousemove", e => {
        if (topoState.dragNode) return;
        if (!topoState.dragging) return;
        const s = topoState.panStart, r = svg.getBoundingClientRect();
        const sx = topoState.vb.w / r.width, sy = topoState.vb.h / r.height;
        topoState.vb.x = s.vx - (e.clientX - s.mx) * sx;
        topoState.vb.y = s.vy - (e.clientY - s.my) * sy;
        applyVB(svg);
    });
    const up = () => { topoState.dragging = false; if (svg) svg.style.cursor = appState.topoEditMode ? "crosshair" : "grab" };
    svg.addEventListener("mouseup", up); svg.addEventListener("mouseleave", up);
    // Touch
    svg.addEventListener("touchstart", e => { const t = e.touches[0]; topoState.dragging = true; topoState.panStart = { mx: t.clientX, my: t.clientY, vx: topoState.vb.x, vy: topoState.vb.y } }, { passive: true });
    svg.addEventListener("touchmove", e => { if (!topoState.dragging || topoState.dragNode) return; const t = e.touches[0]; const r = svg.getBoundingClientRect(); const sx = topoState.vb.w / r.width, sy = topoState.vb.h / r.height; topoState.vb.x = topoState.panStart.vx - (t.clientX - topoState.panStart.mx) * sx; topoState.vb.y = topoState.panStart.vy - (t.clientY - topoState.panStart.my) * sy; applyVB(svg) }, { passive: true });
    svg.addEventListener("touchend", up);
}
function applyVB(svg) { if (!svg || !topoState.vb) return; const v = topoState.vb; svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`) }
function topoZoom(factor) {
    const svg = $("#topoSVG"); if (!svg || !topoState.vb) return;
    const v = topoState.vb, cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    v.w *= factor; v.h *= factor; v.x = cx - v.w / 2; v.y = cy - v.h / 2; applyVB(svg);
}

// ───────── Zoom to specific bounds ─────────
function topoZoomToBounds(minX, minY, maxX, maxY) {
    const svg = $("#topoSVG"); if (!svg) return;
    const container = svg.parentElement; if (!container) return;
    const cr = container.getBoundingClientRect();
    if (!cr.width || !cr.height) return;
    const pad = 80;
    const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
    const aspect = cr.width / cr.height;
    let vw = bw, vh = bh;
    if (vw / vh > aspect) { vh = vw / aspect } else { vw = vh * aspect }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    topoState.vb = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh };
    applyVB(svg);
}

// ───────── Interaction (select, drag) ─────────
function initTopoInteraction() {
    const svg = $("#topoSVG"); if (!svg) return;

    svg.addEventListener("click", e => {
        const nodeG = e.target.closest("[data-node-id]");
        const linkEl = e.target.closest("[data-link-id]");
        if (nodeG) {
            const id = nodeG.dataset.nodeId;
            appState.topoSelected = { type: "device", id };
            appState.topoHighlight = null;
            renderTopo(); showInspector();
        } else if (linkEl) {
            const id = linkEl.dataset.linkId;
            appState.topoSelected = { type: "link", id };
            appState.topoHighlight = null;
            renderTopo(); showInspector();
        } else {
            if (appState.topoSelected || appState.topoHighlight) { appState.topoSelected = null; appState.topoHighlight = null; renderTopo(); hideInspector() }
        }
    });

    if (!appState.topoEditMode) return;
    svg.addEventListener("mousedown", e => {
        const nodeG = e.target.closest("[data-node-id]");
        if (!nodeG) return;
        e.stopPropagation();
        const id = nodeG.dataset.nodeId;
        const d = appState.db.dispositivos.find(x => x.id === id); if (!d) return;
        const rect = svg.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * topoState.vb.w + topoState.vb.x;
        const svgY = ((e.clientY - rect.top) / rect.height) * topoState.vb.h + topoState.vb.y;
        topoState.dragNode = d;
        topoState.dragOffset = { dx: svgX - d.topoX, dy: svgY - d.topoY };
        svg.style.cursor = "grabbing";
    });
    svg.addEventListener("mousemove", e => {
        if (!topoState.dragNode) return;
        const d = topoState.dragNode;
        const rect = svg.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * topoState.vb.w + topoState.vb.x;
        const svgY = ((e.clientY - rect.top) / rect.height) * topoState.vb.h + topoState.vb.y;
        let nx = svgX - topoState.dragOffset.dx;
        let ny = svgY - topoState.dragOffset.dy;
        if (appState.topoSnapGrid) { nx = Math.round(nx / TOPO.GRID) * TOPO.GRID; ny = Math.round(ny / TOPO.GRID) * TOPO.GRID }
        d.topoX = nx; d.topoY = ny; d.topoPinned = true;
        renderTopo();
    });
    svg.addEventListener("mouseup", () => {
        if (topoState.dragNode) {
            topoState.dragNode = null; topoState.dragOffset = null;
            saveDB(appState.db);
        }
    });
}

// ───────── Navigate to topology + highlight connection (C) ─────────
function navigateToTopoLink(linkId) {
    const l = appState.db.conexoes.find(x => x.id === linkId); if (!l) return;
    appState.topoHighlight = { linkId: l.id, deId: l.deId, paraId: l.paraId };
    appState.topoSelected = null;
    navigate("/topologia");
    // After render, zoom to fit the two nodes
    setTimeout(() => {
        const dA = appState.db.dispositivos.find(x => x.id === l.deId);
        const dB = appState.db.dispositivos.find(x => x.id === l.paraId);
        if (dA && dB) {
            topoZoomToBounds(
                Math.min(dA.topoX, dB.topoX), Math.min(dA.topoY, dB.topoY),
                Math.max(dA.topoX + TOPO.NODE_W, dB.topoX + TOPO.NODE_W), Math.max(dA.topoY + TOPO.NODE_H, dB.topoY + TOPO.NODE_H)
            );
        }
    }, 150);
}

function navigateToTopoDevice(devId) {
    appState.topoSelected = { type: "device", id: devId };
    appState.topoHighlight = null;
    navigate("/topologia");
    setTimeout(() => {
        const d = appState.db.dispositivos.find(x => x.id === devId);
        if (d) {
            topoZoomToBounds(d.topoX, d.topoY, d.topoX + TOPO.NODE_W, d.topoY + TOPO.NODE_H);
        }
        showInspector();
    }, 150);
}

// ───────── Inspector ─────────
function showInspector() {
    const panel = $("#inspector"); if (!panel) return;
    panel.classList.add("open");
    const sel = appState.topoSelected; if (!sel) return;
    const title = $("#inspectorTitle");
    const body = $("#inspectorBody");
    if (sel.type === "device") {
        const d = appState.db.dispositivos.find(x => x.id === sel.id); if (!d) { hideInspector(); return }
        title.textContent = d.nome;
        const fields = [
            ["Tipo", d.tipo], ["Fabricante", d.fabricante], ["Modelo", d.modelo],
            ["Função", d.funcao], ["IP", d.ip], ["MAC", d.mac],
            ["Serial", d.serial], ["Firmware", d.firmware],
            ["Portas", d.portas], ["Uplinks", d.uplinks], ["PoE", d.poe ? "Sim" : "Não"],
            ["Local", d.local], ["Criticidade", d.criticidade], ["Status", d.status],
            ["Rack", d.rack || "—"], ["Posição U", d.posicaoU || "—"],
            ["Observações", d.notas],
            ["Atualizado", fmtDate(d.updatedAt)]
        ];
        const connLinks = appState.db.conexoes.filter(l => l.deId === d.id || l.paraId === d.id);
        const devById = new Map(appState.db.dispositivos.map(x => [x.id, x]));
        const linksHTML = connLinks.map(l => {
            const other = l.deId === d.id ? devById.get(l.paraId) : devById.get(l.deId);
            return `<div class="info-row"><span class="info-label">${esc(l.tipo || "Cabo")}</span><span class="info-value">${esc(other?.nome || "—")}</span></div>`;
        }).join("");

        body.innerHTML = `
      ${fields.filter(([, v]) => v).map(([k, v]) => `<div class="info-row"><span class="info-label">${esc(k)}</span><span class="info-value">${esc(v)}</span></div>`).join("")}
      ${connLinks.length ? `<div class="inspector-section"><div class="inspector-section-title">Conexões (${connLinks.length})</div>${linksHTML}</div>` : ""}
      <div style="margin-top:16px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-action="edit-dev" data-id="${esc(d.id)}">Editar</button>
        <button class="btn btn-sm btn-danger" data-action="del-dev" data-id="${esc(d.id)}">Remover</button>
      </div>`;
        body.querySelectorAll("[data-action]").forEach(btn => {
            btn.addEventListener("click", () => {
                if (btn.dataset.action === "edit-dev") openDeviceForm(d);
                if (btn.dataset.action === "del-dev") deleteDevice(d.id);
            });
        });
    } else if (sel.type === "link") {
        const l = appState.db.conexoes.find(x => x.id === sel.id); if (!l) { hideInspector(); return }
        const devById = new Map(appState.db.dispositivos.map(x => [x.id, x]));
        const de = devById.get(l.deId), para = devById.get(l.paraId);
        title.textContent = "Conexão";
        body.innerHTML = `
      <div class="info-row"><span class="info-label">Origem</span><span class="info-value">${esc(de?.nome || "—")}</span></div>
      <div class="info-row"><span class="info-label">Destino</span><span class="info-value">${esc(para?.nome || "—")}</span></div>
      <div class="info-row"><span class="info-label">Tipo</span><span class="info-value">${esc(l.tipo || "—")}</span></div>
      <div class="info-row"><span class="info-label">Velocidade</span><span class="info-value">${esc(l.velocidade || "—")}</span></div>
      <div class="info-row"><span class="info-label">Portas</span><span class="info-value">${esc(l.portaDe || "—")} → ${esc(l.portaPara || "—")}</span></div>
      ${l.vlan ? `<div class="info-row"><span class="info-label">VLAN</span><span class="info-value">${esc(l.vlan)}</span></div>` : ""}
      ${l.notas ? `<div class="info-row"><span class="info-label">Notas</span><span class="info-value">${esc(l.notas)}</span></div>` : ""}
      <div style="margin-top:16px;display:flex;gap:6px">
        <button class="btn btn-sm btn-primary" id="inspEditLink">Editar</button>
        <button class="btn btn-sm btn-danger" id="inspDelLink">Remover</button>
      </div>`;
        $("#inspEditLink")?.addEventListener("click", () => openLinkForm(l));
        $("#inspDelLink")?.addEventListener("click", () => deleteLink(l.id));
    }
}
function hideInspector() {
    const panel = $("#inspector"); if (panel) panel.classList.remove("open");
}
$("#inspectorClose").onclick = () => { appState.topoSelected = null; appState.topoHighlight = null; hideInspector(); if (appState.route === "/topologia") renderTopo() };
