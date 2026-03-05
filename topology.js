/* ============================================================
   Gorillas — Topology Editor
   Auto-layout, drag-drop, snap-to-grid, inspector, zoom/pan
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
    W: 2000, PAD: 50, NODE_W: 160, NODE_H: 52, GRID: 20,
    LINK_STYLES: {
        "Cabo": { color: "#006fff", dash: "", width: 2 },
        "Fibra/Uplink": { color: "#8b5cf6", dash: "", width: 2.5 },
        "Wi-Fi": { color: "#22c55e", dash: "6 4", width: 1.5 },
        "VPN": { color: "#f59e0b", dash: "4 4", width: 1.5 },
        "Outro": { color: "#94a3b8", dash: "3 3", width: 1.5 }
    },
    TYPE_ORDER: { "Modem ISP": 0, "Firewall": 1, "Roteador": 2, "Switch": 3, "Servidor": 4, "DVR/NVR": 4, "Access Point": 5, "Impressora": 6, "PDV/Terminal": 6, "Câmera": 6, "Computador": 6, "Outro": 7 }
};
const topoState = { vb: null, base: null, dragging: false, panStart: null, dragNode: null, dragOffset: null };

// ───────── Build Topology SVG ─────────
function buildTopoSVG() {
    const devs = appState.db.dispositivos, links = appState.db.conexoes;
    const hasPinned = devs.some(d => d.topoPinned);
    if (!hasPinned) autoLayoutPositions(devs);

    const pos = new Map();
    devs.forEach(d => { pos.set(d.id, { x: d.topoX || 0, y: d.topoY || 0 }) });

    const minX = Math.min(0, ...[...pos.values()].map(p => p.x)) - TOPO.PAD;
    const minY = Math.min(0, ...[...pos.values()].map(p => p.y)) - TOPO.PAD;
    const maxX = Math.max(TOPO.W, ...[...pos.values()].map(p => p.x + TOPO.NODE_W)) + TOPO.PAD;
    const maxY = Math.max(500, ...[...pos.values()].map(p => p.y + TOPO.NODE_H)) + TOPO.PAD;
    const vw = maxX - minX, vh = maxY - minY;

    // Group backgrounds
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

    // Links
    let linesHTML = links.map(l => {
        const a = pos.get(l.deId), b = pos.get(l.paraId); if (!a || !b) return "";
        const st = TOPO.LINK_STYLES[l.tipo] || TOPO.LINK_STYLES["Outro"];
        const ax = a.x + TOPO.NODE_W / 2, ay = a.y + TOPO.NODE_H / 2;
        const bx = b.x + TOPO.NODE_W / 2, by = b.y + TOPO.NODE_H / 2;
        const sel = appState.topoSelected?.type === "link" && appState.topoSelected.id === l.id;
        return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${sel ? "#006fff" : st.color}" stroke-width="${sel ? 3.5 : st.width}" opacity="${sel ? 1 : .6}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ""} data-link-id="${esc(l.id)}" style="cursor:pointer"/>`;
    }).join("");

    // Link labels
    let linkLabels = links.map(l => {
        const a = pos.get(l.deId), b = pos.get(l.paraId); if (!a || !b) return "";
        const mx = (a.x + b.x + TOPO.NODE_W) / 2, my = (a.y + b.y + TOPO.NODE_H) / 2;
        const label = [l.tipo, l.vlan ? `VLAN ${l.vlan}` : ""].filter(Boolean).join(" · ");
        if (!label) return "";
        return `<text x="${mx}" y="${my - 6}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter,sans-serif">${esc(label)}</text>`;
    }).join("");

    // Nodes
    let nodesHTML = devs.map(d => {
        const p = pos.get(d.id); if (!p) return "";
        const sel = appState.topoSelected?.type === "device" && appState.topoSelected.id === d.id;
        const label = d.nome.length > 18 ? d.nome.slice(0, 17) + "…" : d.nome;
        const sub = [d.tipo || "", d.ip || ""].filter(Boolean).join(" · ");
        const subT = sub.length > 24 ? sub.slice(0, 23) + "…" : sub;
        const statusColor = d.status === "ativo" ? "#22c55e" : d.status === "inativo" ? "#ef4444" : d.status === "manutenção" ? "#f59e0b" : "#94a3b8";
        return `<g data-node-id="${esc(d.id)}" style="cursor:${appState.topoEditMode ? "grab" : "pointer"}">
      <rect x="${p.x}" y="${p.y}" width="${TOPO.NODE_W}" height="${TOPO.NODE_H}" rx="10" fill="#fff" stroke="${sel ? "#006fff" : "#e2e5ea"}" stroke-width="${sel ? 2.5 : 1}"/>
      <circle cx="${p.x + TOPO.NODE_W - 12}" cy="${p.y + 12}" r="4" fill="${statusColor}"/>
      <text x="${p.x + 12}" y="${p.y + 22}" font-size="12" font-weight="600" fill="#1a1e2c" font-family="Inter,sans-serif">${esc(label)}</text>
      <text x="${p.x + 12}" y="${p.y + 38}" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">${esc(subT)}</text>
    </g>`;
    }).join("");

    // Grid overlay
    let gridHTML = "";
    if (appState.topoSnapGrid && appState.topoEditMode) {
        const gs = TOPO.GRID;
        for (let x = Math.floor(minX / gs) * gs; x < maxX; x += gs) gridHTML += `<line x1="${x}" y1="${minY}" x2="${x}" y2="${maxY}" stroke="#e2e5ea" stroke-width=".3"/>`;
        for (let y = Math.floor(minY / gs) * gs; y < maxY; y += gs) gridHTML += `<line x1="${minX}" y1="${y}" x2="${maxX}" y2="${y}" stroke="#e2e5ea" stroke-width=".3"/>`;
    }

    // Legend
    const usedTypes = new Set(links.map(l => l.tipo).filter(Boolean));
    let legendHTML = "";
    if (usedTypes.size) {
        legendHTML = `<div class="topo-legend">${[...usedTypes].map(t => { const s = TOPO.LINK_STYLES[t] || TOPO.LINK_STYLES["Outro"]; return `<div class="topo-legend-item"><div class="topo-legend-line" style="background:${s.color}${s.dash ? ";border:1px dashed " + s.color + ";background:none" : ""}"></div> ${esc(t)}</div>` }).join("")}</div>`;
    }

    const svg = `<svg viewBox="${minX} ${minY} ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" id="topoSVG" style="cursor:grab">${gridHTML}${groupBGs}${linesHTML}${linkLabels}${nodesHTML}</svg>`;

    return svg + legendHTML;
}

// ───────── Auto-layout ─────────
function autoLayoutPositions(devs) {
    const groups = groupBy(devs, d => d.local || "Sem local");
    const locais = Object.keys(groups).sort();
    const groupW = Math.max(200, (TOPO.W - TOPO.PAD * 2) / Math.max(1, locais.length));

    locais.forEach((loc, gi) => {
        const items = [...groups[loc]].sort((a, b) => (TOPO.TYPE_ORDER[a.tipo] ?? 7) - (TOPO.TYPE_ORDER[b.tipo] ?? 7));
        const gx = TOPO.PAD + gi * groupW;
        const cols = Math.max(1, Math.floor((groupW - 20) / (TOPO.NODE_W + 16)));
        items.forEach((d, i) => {
            const row = Math.floor(i / cols), col = i % cols;
            d.topoX = gx + 10 + col * (TOPO.NODE_W + 16);
            d.topoY = TOPO.PAD + 40 + row * (TOPO.NODE_H + 20);
        });
    });
}

function performAutoLayout() {
    autoLayoutPositions(appState.db.dispositivos);
    appState.db.dispositivos.forEach(d => { d.topoPinned = false });
    saveDB(appState.db); renderTopo();
    toast("success", "Topologia", "Layout reorganizado.");
}

// ───────── Render Topology ─────────
function renderTopo() {
    const container = $("#topoMain"); if (!container) return;
    // Save controls html
    const controlsHTML = container.querySelector(".topo-controls")?.outerHTML || "";
    const svgAndLegend = buildTopoSVG();
    container.innerHTML = svgAndLegend + controlsHTML;
    initTopoPanZoom();
    initTopoInteraction();
    // Re-bind controls
    $("#topoZoomIn")?.addEventListener("click", () => topoZoom(0.8));
    $("#topoZoomOut")?.addEventListener("click", () => topoZoom(1.25));
}

// ───────── Pan/Zoom ─────────
function initTopoPanZoom() {
    const svg = $("#topoSVG"); if (!svg) return;
    const vb = svg.viewBox.baseVal;
    topoState.vb = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    topoState.base = { ...topoState.vb };

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
function topoFitView() { const svg = $("#topoSVG"); if (!svg || !topoState.base) return; topoState.vb = { ...topoState.base }; applyVB(svg) }

// ───────── Interaction (select, drag) ─────────
function initTopoInteraction() {
    const svg = $("#topoSVG"); if (!svg) return;

    // Click: select node or link
    svg.addEventListener("click", e => {
        const nodeG = e.target.closest("[data-node-id]");
        const linkEl = e.target.closest("[data-link-id]");
        if (nodeG) {
            const id = nodeG.dataset.nodeId;
            appState.topoSelected = { type: "device", id };
            renderTopo(); showInspector();
        } else if (linkEl) {
            const id = linkEl.dataset.linkId;
            appState.topoSelected = { type: "link", id };
            renderTopo(); showInspector();
        } else {
            if (appState.topoSelected) { appState.topoSelected = null; renderTopo(); hideInspector() }
        }
    });

    // Drag nodes in edit mode
    if (!appState.topoEditMode) return;
    svg.addEventListener("mousedown", e => {
        const nodeG = e.target.closest("[data-node-id]");
        if (!nodeG) return;
        e.stopPropagation();
        const id = nodeG.dataset.nodeId;
        const d = appState.db.dispositivos.find(x => x.id === id); if (!d) return;
        const rect = svg.getBoundingClientRect();
        const sx = topoState.vb.w / rect.width, sy = topoState.vb.h / rect.height;
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
        // Connected links
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
        // Bind inspector actions
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
$("#inspectorClose").onclick = () => { appState.topoSelected = null; hideInspector(); if (appState.route === "/topologia") renderTopo() };
