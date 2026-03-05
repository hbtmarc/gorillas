/* ============================================================
   Gorillas — Pages, CRUD, Topology, Render Engine
   ============================================================ */

// ───────── Page: Painel (Dashboard) ─────────
function pagePainel() {
    const devs = appState.db.dispositivos, links = appState.db.conexoes;
    const byTipo = countBy(devs, d => d.tipo || "Outro");
    const byLocal = countBy(devs, d => d.local || "Sem local");
    const tipoCards = Object.entries(byTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${esc(k)}</div></div>`).join("");
    const localCards = Object.entries(byLocal).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${esc(k)}</div></div>`).join("");
    const topoSVG = buildTopologySVG(devs, links, { heroHeight: 420 });
    return `
    <div class="card">
      <div class="card-header">
        <div><h2 class="card-title">Visão geral da rede</h2><p class="card-desc">Topologia atual do estabelecimento com ${devs.length} dispositivo(s) e ${links.length} conexão(ões).</p></div>
        <div class="card-actions">
          <button class="btn btn-primary" type="button" id="dashNewDev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar dispositivo</button>
          <button class="btn" type="button" id="dashNewLink"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar conexão</button>
        </div>
      </div>
      <div class="topo-container" id="dashTopo" style="height:420px">${topoSVG}</div>
    </div>
    ${devs.length ? `
    <div class="card"><div class="card-header"><div><h2 class="card-title">Por tipo</h2></div></div><div class="stats-grid">${tipoCards}</div></div>
    <div class="card"><div class="card-header"><div><h2 class="card-title">Por local</h2></div></div><div class="stats-grid">${localCards}</div></div>
    `: ""}`;
}

// ───────── Page: Dispositivos ─────────
function pageDispositivos() {
    const q = (appState.searchDevices || "").trim().toLowerCase();
    const ft = appState.deviceFilter;
    let list = appState.db.dispositivos.filter(d => {
        if (ft.tipo && d.tipo !== ft.tipo) return false;
        if (ft.local && d.local !== ft.local) return false;
        if (q) { const h = [d.nome, d.tipo, d.ip, d.mac, d.local, d.notas].join(" ").toLowerCase(); if (!h.includes(q)) return false }
        return true;
    });
    list = sortList(list, appState.deviceSort.col, appState.deviceSort.dir);
    const tipos = uniqueValues(appState.db.dispositivos, "tipo");
    const locais = uniqueValues(appState.db.dispositivos, "local");
    const sortIcon = (col) => { const s = appState.deviceSort; const active = s.col === col; return `<span class="sort-icon">${active ? (s.dir === "asc" ? "▲" : "▼") : "⇅"}</span>` };
    return `
    <div class="card">
      <div class="card-header">
        <div><h2 class="card-title">Dispositivos</h2><p class="card-desc">Gerencie roteadores, switches, access points e demais equipamentos.</p></div>
        <div class="card-actions"><button class="btn btn-primary" type="button" id="btnNewDev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar</button></div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-input" id="searchDev" placeholder="Buscar por nome, IP, MAC, local…" value="${esc(appState.searchDevices)}"/>
        </div>
        <select class="form-select filter-select" id="filterDevTipo"><option value="">Todos os tipos</option>${tipos.map(t => `<option value="${esc(t)}" ${ft.tipo === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select class="form-select filter-select" id="filterDevLocal"><option value="">Todos os locais</option>${locais.map(l => `<option value="${esc(l)}" ${ft.local === l ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <span class="badge">${list.length} item(ns)</span>
      </div>
      ${list.length ? `
      <div class="table-wrap"><table>
        <thead><tr>
          <th data-sort="nome" class="${appState.deviceSort.col === "nome" ? "sorted" : ""}">Nome ${sortIcon("nome")}</th>
          <th data-sort="tipo" class="${appState.deviceSort.col === "tipo" ? "sorted" : ""}">Tipo ${sortIcon("tipo")}</th>
          <th data-sort="ip" class="${appState.deviceSort.col === "ip" ? "sorted" : ""}">IP ${sortIcon("ip")}</th>
          <th data-sort="local" class="${appState.deviceSort.col === "local" ? "sorted" : ""}">Local ${sortIcon("local")}</th>
          <th data-sort="updatedAt" class="${appState.deviceSort.col === "updatedAt" ? "sorted" : ""}">Atualizado ${sortIcon("updatedAt")}</th>
          <th>Ações</th>
        </tr></thead>
        <tbody>${list.map(d => `<tr>
          <td class="td-name">${esc(d.nome)}</td>
          <td><span class="badge">${esc(d.tipo || "—")}</span></td>
          <td>${esc(d.ip || "—")}</td>
          <td>${esc(d.local || "—")}</td>
          <td>${esc(fmtDate(d.updatedAt))}</td>
          <td class="td-actions">
            <button class="btn btn-sm btn-ghost" data-action="edit-dev" data-id="${esc(d.id)}">Editar</button>
            <button class="btn btn-sm btn-danger" data-action="del-dev" data-id="${esc(d.id)}">Remover</button>
          </td>
        </tr>`).join("")}</tbody>
      </table></div>
      `: `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>
        <div class="empty-state-title">Nenhum dispositivo encontrado</div>
        <div class="empty-state-desc">${q || ft.tipo || ft.local ? "Tente ajustar os filtros ou a busca." : "Adicione roteadores, switches e demais equipamentos da sua rede."}</div>
        ${!q && !ft.tipo && !ft.local ? '<button class="btn btn-primary" type="button" id="emptyNewDev">Adicionar dispositivo</button>' : ""}
      </div>`}
    </div>`;
}

// ───────── Page: Conexões ─────────
function pageConexoes() {
    const q = (appState.searchLinks || "").trim().toLowerCase();
    const ft = appState.linkFilter;
    const devById = new Map(appState.db.dispositivos.map(d => [d.id, d]));
    let list = appState.db.conexoes.filter(l => {
        if (ft.tipo && l.tipo !== ft.tipo) return false;
        if (q) { const de = devById.get(l.deId)?.nome || ""; const para = devById.get(l.paraId)?.nome || ""; const h = [de, para, l.tipo, l.portaDe, l.portaPara, l.velocidade, l.notas].join(" ").toLowerCase(); if (!h.includes(q)) return false }
        return true;
    });
    list = sortList(list, appState.linkSort.col, appState.linkSort.dir);
    const tiposLink = uniqueValues(appState.db.conexoes, "tipo");
    const sortIcon = (col) => { const s = appState.linkSort; return `<span class="sort-icon">${s.col === col ? (s.dir === "asc" ? "▲" : "▼") : "⇅"}</span>` };
    return `
    <div class="card">
      <div class="card-header">
        <div><h2 class="card-title">Conexões</h2><p class="card-desc">Registre os links entre dispositivos (cabo, uplink, Wi-Fi, etc.).</p></div>
        <div class="card-actions"><button class="btn btn-primary" type="button" id="btnNewLink"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar</button></div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-input" id="searchLink" placeholder="Buscar por dispositivo, tipo, porta…" value="${esc(appState.searchLinks)}"/>
        </div>
        <select class="form-select filter-select" id="filterLinkTipo"><option value="">Todos os tipos</option>${tiposLink.map(t => `<option value="${esc(t)}" ${ft.tipo === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <span class="badge">${list.length} item(ns)</span>
      </div>
      ${appState.db.dispositivos.length < 2 && !list.length ? `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><div class="empty-state-title">Cadastre ao menos 2 dispositivos</div><div class="empty-state-desc">Você precisa de pelo menos dois dispositivos para registrar uma conexão.</div></div>` :
            list.length ? `
      <div class="table-wrap"><table>
        <thead><tr>
          <th data-lsort="deId">Origem ${sortIcon("deId")}</th>
          <th data-lsort="paraId">Destino ${sortIcon("paraId")}</th>
          <th data-lsort="tipo">Tipo ${sortIcon("tipo")}</th>
          <th>Portas</th><th>Velocidade</th>
          <th data-lsort="updatedAt" class="${appState.linkSort.col === "updatedAt" ? "sorted" : ""}">Atualizado ${sortIcon("updatedAt")}</th>
          <th>Ações</th>
        </tr></thead>
        <tbody>${list.map(l => {
                const de = devById.get(l.deId)?.nome || "(removido)";
                const para = devById.get(l.paraId)?.nome || "(removido)";
                return `<tr>
            <td class="td-name">${esc(de)}</td><td class="td-name">${esc(para)}</td>
            <td><span class="badge">${esc(l.tipo || "—")}</span></td>
            <td>${esc(l.portaDe || "—")} → ${esc(l.portaPara || "—")}</td>
            <td>${esc(l.velocidade || "—")}</td>
            <td>${esc(fmtDate(l.updatedAt))}</td>
            <td class="td-actions">
              <button class="btn btn-sm btn-ghost" data-action="edit-link" data-id="${esc(l.id)}">Editar</button>
              <button class="btn btn-sm btn-danger" data-action="del-link" data-id="${esc(l.id)}">Remover</button>
            </td></tr>`}).join("")}</tbody>
      </table></div>
      `: `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><div class="empty-state-title">Nenhuma conexão encontrada</div><div class="empty-state-desc">${q || ft.tipo ? "Ajuste os filtros ou a busca." : "Registre o primeiro link entre seus dispositivos."}</div>${!q && !ft.tipo ? '<button class="btn btn-primary" type="button" id="emptyNewLink">Adicionar conexão</button>' : ""}</div>`}
    </div>`;
}

// ───────── Page: Topologia ─────────
function pageTopologia() {
    const svg = buildTopologySVG(appState.db.dispositivos, appState.db.conexoes, { heroHeight: 560 });
    return `
    <div class="card">
      <div class="card-header">
        <div><h2 class="card-title">Topologia</h2><p class="card-desc">Visualização dos dispositivos e conexões. Arraste para navegar, use os botões para zoom.</p></div>
        <div class="card-actions"><button class="btn" type="button" id="topoRefresh">Atualizar</button></div>
      </div>
      <div class="topo-container" id="topoMain" style="height:560px">${svg}
        <div class="topo-controls">
          <button class="btn btn-icon" type="button" id="topoZoomIn" aria-label="Aproximar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          <button class="btn btn-icon" type="button" id="topoZoomOut" aria-label="Afastar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          <button class="btn btn-icon" type="button" id="topoFit" aria-label="Ajustar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
        </div>
        <div class="topo-legend">
          <div class="topo-legend-item"><div class="topo-legend-line" style="background:#006fff"></div> Cabo</div>
          <div class="topo-legend-item"><div class="topo-legend-line" style="background:#006fff;border:1px dashed #006fff;background:none"></div> Wi-Fi</div>
        </div>
      </div>
    </div>`;
}

// ───────── Page: Configurações ─────────
function pageConfiguracoes() {
    const db = appState.db;
    return `
    <div class="card">
      <div class="card-header"><div><h2 class="card-title">Configurações</h2><p class="card-desc">Informações do projeto e ferramentas de manutenção.</p></div></div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Dispositivos</div><div class="info-value">${db.dispositivos.length}</div></div>
        <div class="info-item"><div class="info-label">Conexões</div><div class="info-value">${db.conexoes.length}</div></div>
        <div class="info-item"><div class="info-label">Última atualização</div><div class="info-value">${esc(fmtDate(db.meta.updatedAt))}</div></div>
        <div class="info-item"><div class="info-label">Criado em</div><div class="info-value">${esc(fmtDate(db.meta.createdAt))}</div></div>
      </div>
      <hr class="divider"/>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" type="button" id="cfgExport">Exportar dados</button>
        <button class="btn" type="button" id="cfgImport">Importar dados</button>
        <button class="btn btn-danger" type="button" id="cfgClear">Limpar tudo</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div><h2 class="card-title">Backups</h2><p class="card-desc">Crie e restaure snapshots do projeto. Máximo de 20 — o mais antigo é removido automaticamente.</p></div>
        <div class="card-actions"><button class="btn btn-primary" type="button" id="cfgBackupCreate">Criar backup</button></div>
      </div>
      <div id="backupListArea"><p style="color:var(--text-tertiary);font-size:13px">Carregando…</p></div>
      <hr class="divider"/>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" type="button" id="cfgBackupExport">Exportar backups</button>
        <button class="btn" type="button" id="cfgBackupImport">Importar backups</button>
      </div>
    </div>`;
}
async function loadBackupList() {
    const area = $("#backupListArea"); if (!area) return;
    try {
        const list = await Backups.list();
        if (!list.length) { area.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-title">Nenhum backup</div><div class="empty-state-desc">Crie um backup para ter um ponto de restauração.</div></div>`; return }
        area.innerHTML = `<div class="backup-list">${list.map(s => `
      <div class="backup-item">
        <div class="backup-item-info">
          <div class="backup-item-name">${esc(s.name)}</div>
          <div class="backup-item-meta">${esc(fmtDate(s.timestamp))} · ${s.deviceCount || 0} dispositivo(s), ${s.connectionCount || 0} conexão(ões)</div>
        </div>
        <div class="backup-item-actions">
          <button class="btn btn-sm" data-action="restore-backup" data-id="${s.id}">Restaurar</button>
          <button class="btn btn-sm btn-danger" data-action="del-backup" data-id="${s.id}">Excluir</button>
        </div>
      </div>`).join("")}</div>`;
    } catch (e) { area.innerHTML = `<p style="color:var(--danger);font-size:13px">Erro ao carregar backups.</p>` }
}

// ───────── Topology SVG Builder ─────────
function buildTopologySVG(dispositivos, conexoes, opts = {}) {
    const H = opts.heroHeight || 520;
    if (!dispositivos.length) return `<svg viewBox="0 0 1000 ${H}" xmlns="http://www.w3.org/2000/svg"><text x="500" y="${H / 2 - 10}" text-anchor="middle" font-size="15" fill="#94a3b8" font-family="Inter,sans-serif">Nenhum dispositivo cadastrado</text><text x="500" y="${H / 2 + 14}" text-anchor="middle" font-size="13" fill="#cbd5e1" font-family="Inter,sans-serif">Adicione equipamentos para visualizar a topologia</text></svg>`;
    const W = 1000, pad = 40, nodeW = 150, nodeH = 48;
    const typeOrder = { "Modem ISP": 0, "Roteador": 1, "Switch": 2, "Servidor": 3, "DVR/CFTV": 3, "Access Point": 4, "Impressora": 5, "PDV/Terminal": 5, "Câmera": 5, "Computador": 5, "Outro": 5 };
    const groups = groupBy(dispositivos, d => d.local || "Sem local");
    const locais = Object.keys(groups).sort();
    const groupW = (W - pad * 2) / Math.max(1, locais.length);
    const pos = new Map();
    locais.forEach((loc, gi) => {
        const items = [...groups[loc]].sort((a, b) => (typeOrder[a.tipo] ?? 5) - (typeOrder[b.tipo] ?? 5));
        const gx = pad + gi * groupW;
        const cols = Math.max(1, Math.floor((groupW - 20) / Math.min(nodeW + 10, groupW)));
        items.forEach((d, i) => {
            const row = Math.floor(i / cols), col = i % cols;
            const usedW = Math.min(nodeW, groupW / cols - 10);
            const x = gx + 10 + col * (usedW + 10);
            const y = pad + 40 + row * (nodeH + 16);
            pos.set(d.id, { x, y, cx: x + usedW / 2, cy: y + nodeH / 2, w: usedW });
        });
    });
    const maxY = Math.max(H, ...[...pos.values()].map(p => p.y + nodeH + pad));
    const viewH = Math.max(H, maxY);
    const devById = new Map(dispositivos.map(d => [d.id, d]));
    // Group backgrounds
    let groupBGs = "";
    locais.forEach((loc, gi) => {
        const items = groups[loc];
        const gx = pad + gi * groupW;
        groupBGs += `<rect x="${gx}" y="${pad}" width="${groupW - 6}" height="${viewH - pad * 2}" rx="10" fill="#f8f9fb" stroke="#eef0f3"/>`;
        groupBGs += `<text x="${gx + 12}" y="${pad + 22}" font-size="12" font-weight="600" fill="#94a3b8" font-family="Inter,sans-serif">${esc(loc)}</text>`;
    });
    // Connections
    let lines = conexoes.map(l => {
        const a = pos.get(l.deId), b = pos.get(l.paraId); if (!a || !b) return "";
        const wifi = (l.tipo || "").toLowerCase().includes("wi");
        return `<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="#006fff" stroke-width="2" opacity=".5" ${wifi ? 'stroke-dasharray="5 5"' : ""}/>`;
    }).join("");
    // Nodes
    let nodes = dispositivos.map(d => {
        const p = pos.get(d.id); if (!p) return "";
        const label = d.nome.length > 16 ? d.nome.slice(0, 15) + "…" : d.nome;
        const sub = [d.tipo || "", d.ip || ""].filter(Boolean).join(" · ");
        const subTrunc = sub.length > 22 ? sub.slice(0, 21) + "…" : sub;
        return `<g><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${nodeH}" rx="8" fill="#fff" stroke="#e2e5ea"/><text x="${p.x + 10}" y="${p.y + 20}" font-size="12" font-weight="600" fill="#1a1e2c" font-family="Inter,sans-serif">${esc(label)}</text><text x="${p.x + 10}" y="${p.y + 35}" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">${esc(subTrunc)}</text></g>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${viewH}" xmlns="http://www.w3.org/2000/svg" id="topoSVG">${groupBGs}${lines}${nodes}</svg>`;
}

// ───────── Topology Zoom/Pan ─────────
const topoState = { vb: null, base: null, dragging: false, start: null };
function initTopoPanZoom() {
    const svg = $("#topoSVG"); if (!svg) return;
    const vb = svg.viewBox.baseVal;
    topoState.vb = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    topoState.base = { ...topoState.vb };
    svg.addEventListener("mousedown", e => { if (e.button !== 0) return; topoState.dragging = true; topoState.start = { mx: e.clientX, my: e.clientY, vx: topoState.vb.x, vy: topoState.vb.y }; svg.style.cursor = "grabbing" });
    svg.addEventListener("mousemove", e => { if (!topoState.dragging) return; const s = topoState.start; const r = svg.getBoundingClientRect(); const sx = topoState.vb.w / r.width, sy = topoState.vb.h / r.height; topoState.vb.x = s.vx - (e.clientX - s.mx) * sx; topoState.vb.y = s.vy - (e.clientY - s.my) * sy; applyVB(svg) });
    const up = () => { topoState.dragging = false; if (svg) svg.style.cursor = "grab" };
    svg.addEventListener("mouseup", up); svg.addEventListener("mouseleave", up);
    // Touch support
    svg.addEventListener("touchstart", e => { const t = e.touches[0]; topoState.dragging = true; topoState.start = { mx: t.clientX, my: t.clientY, vx: topoState.vb.x, vy: topoState.vb.y } }, { passive: true });
    svg.addEventListener("touchmove", e => { if (!topoState.dragging) return; const t = e.touches[0]; const r = svg.getBoundingClientRect(); const sx = topoState.vb.w / r.width, sy = topoState.vb.h / r.height; topoState.vb.x = topoState.start.vx - (t.clientX - topoState.start.mx) * sx; topoState.vb.y = topoState.start.vy - (t.clientY - topoState.start.my) * sy; applyVB(svg) }, { passive: true });
    svg.addEventListener("touchend", up);
}
function applyVB(svg) { if (!svg || !topoState.vb) return; const v = topoState.vb; svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`) }
function topoZoom(factor) {
    const svg = $("#topoSVG"); if (!svg || !topoState.vb) return;
    const v = topoState.vb, cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    v.w *= factor; v.h *= factor; v.x = cx - v.w / 2; v.y = cy - v.h / 2; applyVB(svg);
}
function topoFit() { const svg = $("#topoSVG"); if (!svg || !topoState.base) return; topoState.vb = { ...topoState.base }; applyVB(svg) }

// ───────── CRUD: Dispositivos ─────────
function openPresetPicker() {
    openModal({
        title: "Escolha o tipo de dispositivo", saveLabel: "", hideFooter: true,
        body: `<div class="preset-grid">${PRESETS.map(p => `<button class="preset-card" type="button" data-preset="${p.key}" tabindex="0">${presetSVG(p)}<span class="preset-card-label">${esc(p.label)}</span></button>`).join("")}</div>`
    });
}
function openDeviceForm(device, preset) {
    const isEdit = !!device;
    const d = device || { id: null, nome: "", tipo: preset?.defaults.tipo || "", ip: preset?.defaults.ip || "", mac: "", local: "", notas: "" };
    const tipoOpts = ["Roteador", "Switch", "Access Point", "DVR/CFTV", "PDV/Terminal", "Impressora", "Servidor", "Modem ISP", "Câmera", "Computador", "Outro"];
    openModal({
        title: isEdit ? "Editar dispositivo" : "Adicionar dispositivo", saveLabel: isEdit ? "Salvar alterações" : "Adicionar",
        body: `<div class="form-grid">
      <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f_nome" placeholder="Ex.: Switch 24p, AP Salão…" value="${esc(d.nome)}"/></div>
      <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="f_tipo">${tipoOpts.map(t => `<option value="${esc(t)}" ${t === d.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
      <div class="form-group"><label class="form-label">IP</label><input class="form-input" id="f_ip" placeholder="192.168.0.x" value="${esc(d.ip)}"/></div>
      <div class="form-group"><label class="form-label">MAC</label><input class="form-input" id="f_mac" placeholder="AA:BB:CC:DD:EE:FF" value="${esc(d.mac)}"/></div>
      <div class="form-group"><label class="form-label">Local</label><input class="form-input" id="f_local" placeholder="Rack, Salão, Cozinha…" value="${esc(d.local)}"/></div>
      <div class="form-group"><label class="form-label">Observações</label><input class="form-input" id="f_notas" placeholder="VLAN, SSID, DHCP…" value="${esc(d.notas)}"/></div>
    </div>`,
        onSave: () => {
            const nome = $("#f_nome").value.trim();
            if (!nome) { toast("error", "Validação", "Informe um nome."); $("#f_nome").focus(); return }
            const payload = { id: d.id || uid(), nome, tipo: $("#f_tipo").value, ip: $("#f_ip").value.trim(), mac: $("#f_mac").value.trim(), local: $("#f_local").value.trim(), notas: $("#f_notas").value.trim(), createdAt: d.createdAt || nowISO(), updatedAt: nowISO() };
            if (isEdit) { const i = appState.db.dispositivos.findIndex(x => x.id === d.id); if (i >= 0) appState.db.dispositivos[i] = payload; toast("success", "Dispositivo", "Alterações salvas.") }
            else { appState.db.dispositivos.push(payload); toast("success", "Dispositivo", "Dispositivo adicionado.") }
            saveDB(appState.db); closeModal(); render();
        }
    });
}
function deleteDevice(id) {
    const d = appState.db.dispositivos.find(x => x.id === id); if (!d) return;
    openModal({
        title: "Remover dispositivo", saveLabel: "Remover", saveClass: "btn-danger",
        body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5">O dispositivo <strong>${esc(d.nome)}</strong> será removido junto com todas as suas conexões. Esta ação não pode ser desfeita.</p>`,
        onSave: async () => {
            await Backups.create("Antes de remover: " + d.nome);
            appState.db.dispositivos = appState.db.dispositivos.filter(x => x.id !== id);
            appState.db.conexoes = appState.db.conexoes.filter(l => l.deId !== id && l.paraId !== id);
            saveDB(appState.db); closeModal(); toast("success", "Removido", "Dispositivo removido."); render();
        }
    });
}

// ───────── CRUD: Conexões ─────────
function openLinkForm(link) {
    const isEdit = !!link; const l = link || { id: null, deId: "", paraId: "", tipo: "Cabo", portaDe: "", portaPara: "", velocidade: "1 Gbps", notas: "" };
    if (appState.db.dispositivos.length < 2) { toast("warning", "Conexões", "Cadastre ao menos 2 dispositivos."); navigate("/dispositivos"); return }
    const opts = appState.db.dispositivos.map(d => `<option value="${esc(d.id)}">${esc(d.nome)} (${esc(d.tipo || "—")})</option>`).join("");
    openModal({
        title: isEdit ? "Editar conexão" : "Adicionar conexão", saveLabel: isEdit ? "Salvar alterações" : "Adicionar",
        body: `<div class="form-grid">
      <div class="form-group"><label class="form-label">Origem *</label><select class="form-select" id="f_de"><option value="">Selecione…</option>${opts}</select></div>
      <div class="form-group"><label class="form-label">Destino *</label><select class="form-select" id="f_para"><option value="">Selecione…</option>${opts}</select></div>
      <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="f_ltipo">${["Cabo", "Wi-Fi", "Fibra/Uplink", "VPN", "Outro"].map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select></div>
      <div class="form-group"><label class="form-label">Velocidade</label><select class="form-select" id="f_vel">${["100 Mbps", "1 Gbps", "2.5 Gbps", "10 Gbps", "—"].map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select></div>
      <div class="form-group"><label class="form-label">Porta (Origem)</label><input class="form-input" id="f_pde" placeholder="LAN1, 24, Gi0/1…"/></div>
      <div class="form-group"><label class="form-label">Porta (Destino)</label><input class="form-input" id="f_ppara" placeholder="LAN2, 1…"/></div>
      <div class="form-group full"><label class="form-label">Observações</label><input class="form-input" id="f_lnotas" placeholder="Uplink, trunk VLAN…"/></div>
    </div>`,
        onSave: () => {
            const deId = $("#f_de").value, paraId = $("#f_para").value;
            if (!deId || !paraId) { toast("error", "Validação", "Selecione origem e destino."); return }
            if (deId === paraId) { toast("error", "Validação", "Origem e destino devem ser diferentes."); return }
            const payload = { id: l.id || uid(), deId, paraId, tipo: $("#f_ltipo").value, velocidade: $("#f_vel").value, portaDe: $("#f_pde").value.trim(), portaPara: $("#f_ppara").value.trim(), notas: $("#f_lnotas").value.trim(), createdAt: l.createdAt || nowISO(), updatedAt: nowISO() };
            if (isEdit) { const i = appState.db.conexoes.findIndex(x => x.id === l.id); if (i >= 0) appState.db.conexoes[i] = payload; toast("success", "Conexão", "Alterações salvas.") }
            else { appState.db.conexoes.push(payload); toast("success", "Conexão", "Conexão adicionada.") }
            saveDB(appState.db); closeModal(); render();
        }
    });
    setTimeout(() => {
        if ($("#f_de")) $("#f_de").value = l.deId || ""; if ($("#f_para")) $("#f_para").value = l.paraId || "";
        if ($("#f_ltipo")) $("#f_ltipo").value = l.tipo || "Cabo"; if ($("#f_vel")) $("#f_vel").value = l.velocidade || "1 Gbps";
        if ($("#f_pde")) $("#f_pde").value = l.portaDe || ""; if ($("#f_ppara")) $("#f_ppara").value = l.portaPara || "";
        if ($("#f_lnotas")) $("#f_lnotas").value = l.notas || "";
    }, 0);
}
function deleteLink(id) {
    openModal({
        title: "Remover conexão", saveLabel: "Remover", saveClass: "btn-danger",
        body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5">Esta conexão será removida. Dispositivos não serão afetados.</p>`,
        onSave: () => { appState.db.conexoes = appState.db.conexoes.filter(x => x.id !== id); saveDB(appState.db); closeModal(); toast("success", "Removido", "Conexão removida."); render() }
    });
}

// ───────── Export / Import / Clear ─────────
function exportData() { downloadJSON(appState.db, "gorillas-rede.json"); toast("success", "Exportação", "Arquivo JSON baixado.") }
function importData(file) {
    const fr = new FileReader();
    fr.onload = async () => {
        const p = safeJSON(fr.result, null);
        if (!p || !Array.isArray(p.dispositivos) || !Array.isArray(p.conexoes)) { toast("error", "Importação", "Arquivo inválido."); return }
        await Backups.create("Antes de importar dados");
        appState.db = p; saveDB(appState.db); toast("success", "Importação", "Dados importados."); render();
    }; fr.readAsText(file);
}
function clearAll() {
    openModal({
        title: "Limpar todos os dados", saveLabel: "Limpar tudo", saveClass: "btn-danger",
        body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5">Esta ação apagará <strong>todos</strong> os dispositivos e conexões. Um backup automático será criado antes.</p>
      <p style="font-size:13px;color:var(--text-secondary)">Para confirmar, digite <strong>LIMPAR</strong> abaixo:</p>
      <div class="confirm-input-wrap"><input class="form-input" id="confirmClear" placeholder="LIMPAR" autocomplete="off"/></div>`,
        onSave: async () => {
            if ($("#confirmClear").value.trim() !== "LIMPAR") { toast("warning", "Confirmação", 'Digite "LIMPAR" para confirmar.'); return }
            await Backups.create("Antes de limpar tudo");
            appState.db = structuredClone(DEFAULT_DB); saveDB(appState.db); closeModal(); toast("success", "Pronto", "Todos os dados foram removidos."); render();
        }
    });
}

// ───────── Render Engine ─────────
const debouncedSearchDev = debounce(v => { appState.searchDevices = v; render() }, 200);
const debouncedSearchLink = debounce(v => { appState.searchLinks = v; render() }, 200);

function render() {
    appState.route = routeFromHash(); setActiveNav(appState.route);
    const view = $("#view"); let html = "";
    if (appState.route === "/painel") html = pagePainel();
    else if (appState.route === "/dispositivos") html = pageDispositivos();
    else if (appState.route === "/conexoes") html = pageConexoes();
    else if (appState.route === "/topologia") html = pageTopologia();
    else if (appState.route === "/configuracoes") html = pageConfiguracoes();
    else html = `<div class="card"><div class="card-header"><div><h2 class="card-title">Página não encontrada</h2></div></div><button class="btn" type="button" id="goHome">Voltar ao painel</button></div>`;
    view.innerHTML = html;
    updateSyncDot();
    bindEvents();
    if (appState.route === "/configuracoes") loadBackupList();
    if (appState.route === "/topologia" || appState.route === "/painel") setTimeout(initTopoPanZoom, 0);
}

function bindEvents() {
    // Dashboard
    $("#dashNewDev")?.addEventListener("click", () => openPresetPicker());
    $("#dashNewLink")?.addEventListener("click", () => openLinkForm(null));
    $("#goHome")?.addEventListener("click", () => navigate("/painel"));
    // Dispositivos
    $("#btnNewDev")?.addEventListener("click", () => openPresetPicker());
    $("#emptyNewDev")?.addEventListener("click", () => openPresetPicker());
    $("#searchDev")?.addEventListener("input", e => debouncedSearchDev(e.target.value));
    $("#filterDevTipo")?.addEventListener("change", e => { appState.deviceFilter.tipo = e.target.value; render() });
    $("#filterDevLocal")?.addEventListener("change", e => { appState.deviceFilter.local = e.target.value; render() });
    // Conexões
    $("#btnNewLink")?.addEventListener("click", () => openLinkForm(null));
    $("#emptyNewLink")?.addEventListener("click", () => openLinkForm(null));
    $("#searchLink")?.addEventListener("input", e => debouncedSearchLink(e.target.value));
    $("#filterLinkTipo")?.addEventListener("change", e => { appState.linkFilter.tipo = e.target.value; render() });
    // Topologia
    $("#topoRefresh")?.addEventListener("click", () => { toast("success", "Topologia", "Atualizada."); render() });
    $("#topoZoomIn")?.addEventListener("click", () => topoZoom(0.8));
    $("#topoZoomOut")?.addEventListener("click", () => topoZoom(1.25));
    $("#topoFit")?.addEventListener("click", topoFit);
    // Configurações
    $("#cfgExport")?.addEventListener("click", exportData);
    $("#cfgImport")?.addEventListener("click", () => $("#fileImportData").click());
    $("#cfgClear")?.addEventListener("click", clearAll);
    $("#cfgBackupCreate")?.addEventListener("click", async () => {
        const name = prompt("Nome do backup (opcional):", "Backup manual");
        if (name === null) return;
        await Backups.create(name || "Backup manual"); toast("success", "Backup", "Backup criado."); loadBackupList();
    });
    $("#cfgBackupExport")?.addEventListener("click", async () => { const j = await Backups.exportAll(); downloadJSON(j, "gorillas-backups.json"); toast("success", "Backups", "Backups exportados.") });
    $("#cfgBackupImport")?.addEventListener("click", () => $("#fileImportBackups").click());
    // Table sort - Dispositivos
    $$("#view th[data-sort]").forEach(th => th.addEventListener("click", () => {
        const col = th.dataset.sort; const s = appState.deviceSort;
        if (s.col === col) s.dir = s.dir === "asc" ? "desc" : "asc"; else { s.col = col; s.dir = "asc" }
        render();
    }));
    // Table sort - Conexões
    $$("#view th[data-lsort]").forEach(th => th.addEventListener("click", () => {
        const col = th.dataset.lsort; const s = appState.linkSort;
        if (s.col === col) s.dir = s.dir === "asc" ? "desc" : "asc"; else { s.col = col; s.dir = "asc" }
        render();
    }));
    // Delegated actions
    $("#view")?.addEventListener("click", e => {
        const btn = e.target.closest("button[data-action]"); if (!btn) return;
        const action = btn.dataset.action, id = btn.dataset.id;
        if (action === "edit-dev") { const d = appState.db.dispositivos.find(x => x.id === id); if (d) openDeviceForm(d) }
        if (action === "del-dev") deleteDevice(id);
        if (action === "edit-link") { const l = appState.db.conexoes.find(x => x.id === id); if (l) openLinkForm(l) }
        if (action === "del-link") deleteLink(id);
        if (action === "restore-backup") {
            openModal({
                title: "Restaurar backup", saveLabel: "Restaurar", saveClass: "btn-primary",
                body: `<p style="font-size:13px;color:var(--text-secondary)">Os dados atuais serão substituídos por este backup. Deseja continuar?</p>`,
                onSave: async () => {
                    await Backups.create("Antes de restaurar");
                    const s = await Backups.restore(Number(id));
                    closeModal(); toast("success", "Restaurado", "Backup '" + s.name + "' restaurado."); render();
                }
            });
        }
        if (action === "del-backup") { Backups.remove(Number(id)).then(() => { toast("success", "Excluído", "Backup removido."); loadBackupList() }) }
    });
    // Preset picker delegation
    $("#modalBody")?.addEventListener("click", e => {
        const card = e.target.closest("[data-preset]"); if (!card) return;
        const preset = PRESETS.find(p => p.key === card.dataset.preset);
        closeModal(); setTimeout(() => openDeviceForm(null, preset), 100);
    });
}
// File import handlers
$("#fileImportData").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importData(f) });
$("#fileImportBackups").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const fr = new FileReader(); fr.onload = async () => { try { await Backups.importAll(fr.result); toast("success", "Backups", "Backups importados."); if (appState.route === "/configuracoes") loadBackupList() } catch (err) { toast("error", "Erro", "Arquivo de backups inválido.") } }; fr.readAsText(f) });

// ───────── Init ─────────
if (!location.hash) location.hash = "#/painel";
appState.db = loadCache();
render();
initFirebase();
