/* ============================================================
   Gorillas — Pages: Dashboard, Dispositivos, Conexões, Configurações
   CRUD forms, export/import/clear, backup UI
   ============================================================ */

// ───────── Page: Painel (Dashboard) — with topology canvas (A) ─────────
function pagePainel() {
  const devs = appState.db.dispositivos, links = appState.db.conexoes;
  const wans = appState.db.wans || [], vpns = appState.db.vpns || [], wifis = appState.db.wifis || [];
  const totalDevQty = devs.reduce((s, d) => s + (d.quantidade || 1), 0);
  const byTipo = {}; devs.forEach(d => { const k = d.tipo || 'Outro'; byTipo[k] = (byTipo[k] || 0) + (d.quantidade || 1); });
  const byLocal = {}; devs.forEach(d => { const k = d.local || 'Sem local'; byLocal[k] = (byLocal[k] || 0) + (d.quantidade || 1); });
  const critCount = devs.filter(d => d.criticidade === "crítica").reduce((s, d) => s + (d.quantidade || 1), 0);
  const inactiveCount = devs.filter(d => d.status === "inativo" || d.status === "manutenção").reduce((s, d) => s + (d.quantidade || 1), 0);

  const tipoCards = Object.entries(byTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="stat-card" data-filter-tipo="${esc(k)}"><div class="stat-value">${v}</div><div class="stat-label">${esc(k)}</div></div>`).join("");
  const localCards = Object.entries(byLocal).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="stat-card" data-filter-local="${esc(k)}"><div class="stat-value">${v}</div><div class="stat-label">${esc(k)}</div></div>`).join("");

  return `
  <div class="card">
    <div class="card-header">
      <div><h2 class="card-title">Painel de controle</h2><p class="card-desc">${totalDevQty} dispositivo(s)${totalDevQty !== devs.length ? ` (${devs.length} grupo(s))` : ''}, ${links.length} conexão(ões), ${wans.length} WAN(s)${wifis.length ? `, ${wifis.length} rede(s) Wi-Fi` : ""}</p></div>
      <div class="card-actions">
        <button class="btn btn-primary" type="button" id="dashNewDev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar</button>
        <button class="btn" type="button" id="dashTemplate">Usar template</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card" style="cursor:default"><div class="stat-value">${totalDevQty}</div><div class="stat-label">Total de dispositivos</div></div>
      <div class="stat-card" style="cursor:default"><div class="stat-value">${links.length}</div><div class="stat-label">Conexões</div></div>
      ${critCount ? `<div class="stat-card" style="cursor:default"><div class="stat-value" style="color:var(--danger)">${critCount}</div><div class="stat-label">Críticos</div></div>` : ""}
      ${inactiveCount ? `<div class="stat-card" style="cursor:default"><div class="stat-value" style="color:var(--warning)">${inactiveCount}</div><div class="stat-label">Inativos / Manutenção</div></div>` : ""}
    </div>
  </div>
  ${devs.length ? `
  <div class="card">
    <div class="card-header">
      <div><h2 class="card-title">Mapa da rede</h2><p class="card-desc">Visão geral da topologia (somente leitura). <a href="#/topologia" style="color:var(--accent);text-decoration:none;font-weight:600">Abrir editor →</a></p></div>
    </div>
    <div id="dashTopo" class="dash-topo-canvas"></div>
  </div>
  <div class="card">
    <div class="card-header"><div><h2 class="card-title">Por tipo</h2><p class="card-desc">Clique para filtrar na lista de dispositivos</p></div></div>
    <div class="stats-grid">${tipoCards}</div>
  </div>
  <div class="card">
    <div class="card-header"><div><h2 class="card-title">Por local</h2><p class="card-desc">Clique para filtrar na lista de dispositivos</p></div></div>
    <div class="stats-grid">${localCards}</div>
  </div>
  ${renderBandwidthCard(appState.db)}` : ""}`;
}

// ───────── Render dashboard topology mini-canvas (A) ─────────
function renderDashTopo() {
  const container = $("#dashTopo"); if (!container) return;
  const devs = appState.db.dispositivos;
  if (!devs.length) return;
  // Use buildTopoSVG but as view-only (no edit mode, no selection)
  const origEdit = appState.topoEditMode;
  const origSel = appState.topoSelected;
  const origHl = appState.topoHighlight;
  appState.topoEditMode = false;
  appState.topoSelected = null;
  appState.topoHighlight = null;
  const result = buildTopoSVG();
  appState.topoEditMode = origEdit;
  appState.topoSelected = origSel;
  appState.topoHighlight = origHl;
  // Render SVG + legend (read-only, no controls)
  container.innerHTML = result.svg + result.legendHTML;
  // Fit into the container
  const svg = container.querySelector("svg");
  if (svg) {
    svg.style.cursor = "default";
    svg.removeAttribute("id"); // don't conflict with main topo SVG
  }
}

// ───────── Page: Dispositivos (B: device name as link) ─────────
function pageDispositivos() {
  const q = (appState.searchDevices || "").trim().toLowerCase();
  const ft = appState.deviceFilter;
  let list = appState.db.dispositivos.filter(d => {
    if (ft.tipo && d.tipo !== ft.tipo) return false;
    if (ft.local && d.local !== ft.local) return false;
    if (q) { const h = [d.nome, d.tipo, d.ip, d.mac, d.local, d.fabricante, d.modelo, d.funcao, d.notas].join(" ").toLowerCase(); if (!h.includes(q)) return false }
    return true;
  });
  list = sortList(list, appState.deviceSort.col, appState.deviceSort.dir);
  const tipos = uniqueValues(appState.db.dispositivos, "tipo");
  const locais = uniqueValues(appState.db.dispositivos, "local");
  const sortIcon = (col) => { const s = appState.deviceSort; const active = s.col === col; return `<span class="sort-icon">${active ? (s.dir === "asc" ? "▲" : "▼") : "⇅"}</span>` };

  const statusBadge = (s) => {
    const m = { ativo: "badge-success", inativo: "badge-danger", "manutenção": "badge-warning", planejado: "badge" };
    return `<span class="badge ${m[s] || "badge"}">${esc(s || "—")}</span>`;
  };

  return `
  <div class="card">
    <div class="card-header">
      <div><h2 class="card-title">Dispositivos</h2><p class="card-desc">Gerencie roteadores, switches, access points e demais equipamentos.</p></div>
      <div class="card-actions"><button class="btn btn-primary" type="button" id="btnNewDev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar</button></div>
    </div>
    <div class="toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="form-input" id="searchDev" placeholder="Buscar por nome, IP, MAC, fabricante…" value="${esc(appState.searchDevices)}"/>
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
        <th data-sort="status">Status ${sortIcon("status")}</th>
        <th data-sort="updatedAt" class="${appState.deviceSort.col === "updatedAt" ? "sorted" : ""}">Atualizado ${sortIcon("updatedAt")}</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>${list.map(d => `<tr>
        <td class="td-name"><a class="dev-link" href="javascript:void(0)" data-action="detail-dev" data-id="${esc(d.id)}">${esc(d.nome)}</a>${(d.quantidade || 1) > 1 ? ` <span class="badge" style="font-size:10px;vertical-align:middle;background:var(--accent);color:#fff">×${d.quantidade}</span>` : ''}</td>
        <td><span class="badge">${esc(d.tipo || "—")}</span></td>
        <td>${esc(d.ip || "—")}</td>
        <td>${esc(d.local || "—")}</td>
        <td>${statusBadge(d.status)}</td>
        <td>${esc(fmtDate(d.updatedAt))}</td>
        <td class="td-actions">
          <button class="btn btn-sm btn-ghost" data-action="edit-dev" data-id="${esc(d.id)}">Editar</button>
          <button class="btn btn-sm btn-danger" data-action="del-dev" data-id="${esc(d.id)}">Remover</button>
        </td>
      </tr>`).join("")}</tbody>
    </table></div>
    ` : `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/></svg>
      <div class="empty-state-title">Nenhum dispositivo encontrado</div>
      <div class="empty-state-desc">${q || ft.tipo || ft.local ? "Tente ajustar os filtros ou a busca." : "Adicione roteadores, switches e demais equipamentos da sua rede."}</div>
      ${!q && !ft.tipo && !ft.local ? '<button class="btn btn-primary" type="button" id="emptyNewDev">Adicionar dispositivo</button>' : ""}
    </div>`}
  </div>`;
}

// ───────── Device Detail Modal (B) ─────────
function openDeviceDetail(device) {
  const d = device; if (!d) return;
  const statusBadge = (s) => {
    const m = { ativo: "badge-success", inativo: "badge-danger", "manutenção": "badge-warning", planejado: "badge" };
    return `<span class="badge ${m[s] || "badge"}">${esc(s || "—")}</span>`;
  };
  const fields = [
    ["Tipo", d.tipo], ["Fabricante", d.fabricante], ["Modelo", d.modelo],
    ["Função", d.funcao], ["IP", d.ip], ["MAC", d.mac],
    ["Serial", d.serial], ["Firmware", d.firmware],
    ["Portas", d.portas], ["Uplinks", d.uplinks], ["PoE", d.poe ? "Sim" : ""],
    ["Local", d.local], ["Criticidade", d.criticidade],
    ["Rack", d.rack || ""], ["Posição U", d.posicaoU || ""],
    ["Observações", d.notas],
    ["Criado em", fmtDate(d.createdAt)], ["Atualizado", fmtDate(d.updatedAt)]
  ].filter(([, v]) => v);

  const connLinks = appState.db.conexoes.filter(l => l.deId === d.id || l.paraId === d.id);
  const devById = new Map(appState.db.dispositivos.map(x => [x.id, x]));
  const connHTML = connLinks.length ? `
    <div style="margin-top:16px">
      <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Conexões (${connLinks.length})</div>
      ${connLinks.map(l => {
    const other = l.deId === d.id ? devById.get(l.paraId) : devById.get(l.deId);
    return `<div class="detail-conn-row">${esc(l.tipo || "Cabo")} → ${esc(other?.nome || "—")}${l.vlan ? ` <span class="badge" style="font-size:10px">VLAN ${esc(l.vlan)}</span>` : ""}</div>`;
  }).join("")}
    </div>` : "";

  openModal({
    title: "Detalhes do dispositivo", saveLabel: "", hideFooter: true, wide: true,
    body: `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div>${deviceIconSVG(d.tipo, 32)}</div>
      <div>
        <div style="font-size:16px;font-weight:700">${esc(d.nome)}</div>
        <div style="font-size:13px;color:var(--text-secondary)">${esc(d.tipo || "")}${d.ip ? " · " + esc(d.ip) : ""}</div>
      </div>
      <div style="margin-left:auto">${statusBadge(d.status)}</div>
    </div>
    <div class="detail-grid">
      ${fields.map(([k, v]) => `<div class="detail-grid-item"><div class="detail-grid-label">${esc(k)}</div><div class="detail-grid-value">${esc(v)}</div></div>`).join("")}
    </div>
    ${connHTML}
    <div style="margin-top:20px;display:flex;gap:8px;border-top:1px solid var(--border-light);padding-top:16px">
      <button class="btn btn-primary" type="button" id="detailEdit">Editar</button>
      <button class="btn" type="button" id="detailTopoView">Ver na topologia</button>
      <button class="btn" type="button" id="detailPrint">Imprimir detalhes</button>
      <button class="btn" type="button" id="detailClose" style="margin-left:auto">Fechar</button>
    </div>`
  });
  setTimeout(() => {
    $("#detailEdit")?.addEventListener("click", () => { closeModal(); openDeviceForm(d) });
    $("#detailTopoView")?.addEventListener("click", () => { closeModal(); navigateToTopoDevice(d.id) });
    $("#detailPrint")?.addEventListener("click", () => { closeModal(); printSingleDevice(d.id) });
    $("#detailClose")?.addEventListener("click", closeModal);
  }, 0);
}

// ───────── Page: Conexões (C: "Ver na topologia" button) ─────────
function pageConexoes() {
  const q = (appState.searchLinks || "").trim().toLowerCase();
  const ft = appState.linkFilter;
  const devById = new Map(appState.db.dispositivos.map(d => [d.id, d]));
  let list = appState.db.conexoes.filter(l => {
    if (ft.tipo && l.tipo !== ft.tipo) return false;
    if (q) { const de = devById.get(l.deId)?.nome || ""; const para = devById.get(l.paraId)?.nome || ""; const h = [de, para, l.tipo, l.portaDe, l.portaPara, l.velocidade, l.vlan, l.notas].join(" ").toLowerCase(); if (!h.includes(q)) return false }
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
        <th>VLAN</th><th>Portas</th><th>Velocidade</th>
        <th data-lsort="updatedAt" class="${appState.linkSort.col === "updatedAt" ? "sorted" : ""}">Atualizado ${sortIcon("updatedAt")}</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>${list.map(l => {
        const de = devById.get(l.deId)?.nome || "(removido)";
        const para = devById.get(l.paraId)?.nome || "(removido)";
        return `<tr>
        <td class="td-name">${esc(de)}</td><td class="td-name">${esc(para)}</td>
        <td><span class="badge">${esc(l.tipo || "—")}</span></td>
        <td>${esc(l.vlan || "—")}</td>
        <td>${esc(l.portaDe || "—")} → ${esc(l.portaPara || "—")}</td>
        <td>${esc(l.velocidade || "—")}</td>
        <td>${esc(fmtDate(l.updatedAt))}</td>
        <td class="td-actions">
          <button class="btn btn-sm btn-ghost" data-action="topo-link" data-id="${esc(l.id)}" title="Ver na topologia">🗺️</button>
          <button class="btn btn-sm btn-ghost" data-action="print-link" data-id="${esc(l.id)}" title="Imprimir esta conexão">🖨️</button>
          <button class="btn btn-sm btn-ghost" data-action="edit-link" data-id="${esc(l.id)}">Editar</button>
          <button class="btn btn-sm btn-danger" data-action="del-link" data-id="${esc(l.id)}">Remover</button>
        </td>
      </tr>`}).join("")}</tbody>
    </table></div>
    ` : `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><div class="empty-state-title">Nenhuma conexão encontrada</div><div class="empty-state-desc">${q || ft.tipo ? "Ajuste os filtros ou a busca." : "Registre o primeiro link entre seus dispositivos."}</div>${!q && !ft.tipo ? '<button class="btn btn-primary" type="button" id="emptyNewLink">Adicionar conexão</button>' : ""}</div>`}
  </div>`;
}

// ───────── Page: Configurações (H: max 10, disclosure) ─────────
function pageConfiguracoes() {
  const db = appState.db; return `
  <div class="card">
    <div class="card-header"><div><h2 class="card-title">Configurações</h2><p class="card-desc">Informações do projeto e ferramentas de manutenção.</p></div></div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Dispositivos</div><div class="info-value">${db.dispositivos.length}</div></div>
      <div class="info-item"><div class="info-label">Conexões</div><div class="info-value">${db.conexoes.length}</div></div>
      <div class="info-item"><div class="info-label">WANs</div><div class="info-value">${(db.wans || []).length}</div></div>
      <div class="info-item"><div class="info-label">Redes Wi-Fi</div><div class="info-value">${(db.wifis || []).length}</div></div>
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
      <div><h2 class="card-title">Backups</h2><p class="card-desc">Crie e restaure snapshots do projeto. Máximo de 10 — o mais antigo é removido automaticamente.</p></div>
      <div class="card-actions"><button class="btn btn-primary" type="button" id="cfgBackupCreate">Criar backup</button></div>
    </div>
    <div id="backupListArea"><p style="color:var(--text-tertiary);font-size:13px">Carregando…</p></div>
    <hr class="divider"/>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" type="button" id="cfgBackupExport">Exportar backups</button>
      <button class="btn" type="button" id="cfgBackupImport">Importar backups</button>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div><h2 class="card-title">Atalhos</h2></div></div>
    <div style="font-size:13px;color:var(--text-secondary);line-height:1.7">
      <strong>Ctrl + Z</strong> — Desfazer última ação destrutiva<br>
      <strong>Delete</strong> — Remover item selecionado (na topologia)<br>
      <strong>Escape</strong> — Fechar painel / desselecionar
    </div>
  </div>`;
}

async function loadBackupList() {
  const area = $("#backupListArea"); if (!area) return;
  try {
    const list = await Backups.list();
    if (!list.length) { area.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-title">Nenhum backup</div><div class="empty-state-desc">Crie um backup para ter um ponto de restauração.</div></div>`; return }
    const renderItem = s => `
    <div class="backup-item">
      <div class="backup-item-info">
        <div class="backup-item-name">${esc(s.name)}</div>
        <div class="backup-item-meta">${esc(fmtDate(s.timestamp))} · ${s.deviceCount || 0} dispositivo(s), ${s.connectionCount || 0} conexão(ões)</div>
      </div>
      <div class="backup-item-actions">
        <button class="btn btn-sm" data-action="restore-backup" data-id="${s.id}">Restaurar</button>
        <button class="btn btn-sm btn-danger" data-action="del-backup" data-id="${s.id}">Excluir</button>
      </div>
    </div>`;

    const recent = list.slice(0, 3);
    const older = list.slice(3);
    let html = `<div class="backup-list">${recent.map(renderItem).join("")}</div>`;
    if (older.length) {
      html += `<details class="backup-details"><summary>Ver mais ${older.length} backup(s)</summary><div class="backup-list">${older.map(renderItem).join("")}</div></details>`;
    }
    area.innerHTML = html;
  } catch (e) { area.innerHTML = `<p style="color:var(--danger);font-size:13px">Erro ao carregar backups.</p>` }
}

// ───────── CRUD: Dispositivos ─────────
function openPresetPicker() {
  openModal({
    title: "Escolha o tipo de dispositivo", saveLabel: "", hideFooter: true,
    body: `<div class="preset-grid">${PRESETS.map(p => `<button class="preset-card" type="button" data-preset="${p.key}" tabindex="0">${presetSVG(p)}<span class="preset-card-label">${esc(p.label)}</span></button>`).join("")}</div>`
  });
}

function openDeviceForm(device, preset) {
  const isEdit = !!device;
  const d = device || newDevice(preset?.defaults || {});
  const tipoOpts = ["Roteador", "Switch", "Access Point", "DVR/NVR", "PDV/Terminal", "Impressora", "Servidor", "Modem ISP", "Câmera", "Firewall", "Computador", "Outro"];
  openModal({
    title: isEdit ? "Editar dispositivo" : "Adicionar dispositivo", saveLabel: isEdit ? "Salvar alterações" : "Adicionar", wide: true,
    body: `<div class="form-grid">
    <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f_nome" placeholder="Ex.: Switch 24p, AP Salão…" value="${esc(d.nome)}"/></div>
    <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="f_tipo">${tipoOpts.map(t => `<option value="${esc(t)}" ${t === d.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Fabricante</label><input class="form-input" id="f_fabricante" placeholder="Ubiquiti, Mikrotik, TP-Link…" value="${esc(d.fabricante)}"/></div>
    <div class="form-group"><label class="form-label">Modelo</label><input class="form-input" id="f_modelo" placeholder="USW-24-PoE, hEX…" value="${esc(d.modelo)}"/></div>
    <div class="form-group"><label class="form-label">Função</label><input class="form-input" id="f_funcao" placeholder="Gateway, Distribuição, Wi-Fi…" value="${esc(d.funcao)}"/></div>
    <div class="form-group"><label class="form-label">Serial</label><input class="form-input" id="f_serial" value="${esc(d.serial)}"/></div>
    <div class="form-group"><label class="form-label">Firmware</label><input class="form-input" id="f_firmware" value="${esc(d.firmware)}"/></div>
    <div class="form-group"><label class="form-label">IP</label><input class="form-input" id="f_ip" placeholder="192.168.0.x" value="${esc(d.ip)}"/></div>
    <div class="form-group"><label class="form-label">MAC</label><input class="form-input" id="f_mac" placeholder="AA:BB:CC:DD:EE:FF" value="${esc(d.mac)}"/></div>
    <div class="form-group"><label class="form-label">Portas</label><input class="form-input" id="f_portas" placeholder="24, 48…" value="${esc(d.portas)}"/></div>
    <div class="form-group"><label class="form-label">Uplinks</label><input class="form-input" id="f_uplinks" placeholder="SFP+, RJ45 10G…" value="${esc(d.uplinks)}"/></div>
    <div class="form-group"><label class="form-label">Interface</label><select class="form-select" id="f_interface"><option value="">Selecione...</option>${INTERFACE_OPTIONS.map(o => `<option value="${esc(o)}" ${o === d.interface ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Velocidade (Mbps)</label><input class="form-input" id="f_velocidade" type="number" min="0" placeholder="1000" value="${esc(d.velocidade)}"/><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Usado no cálculo de balanço de rede</div></div>
    <div class="form-group"><label class="form-label">Quantidade</label><input class="form-input" id="f_quantidade" type="number" min="1" max="9999" placeholder="1" value="${d.quantidade || 1}"/><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Acima de 1 = grupo (ex: 30 tablets)</div></div>
    <div class="form-group"><label class="form-check"><input type="checkbox" id="f_poe" ${d.poe ? 'checked' : ''}/> Suporta PoE</label></div>
    <div class="form-group"><label class="form-label">Local</label><input class="form-input" id="f_local" placeholder="Rack, Salão, Cozinha…" value="${esc(d.local)}"/></div>
    <div class="form-group"><label class="form-label">Criticidade</label><select class="form-select" id="f_criticidade">${CRITICIDADE_OPTIONS.map(c => `<option value="${esc(c)}" ${c === d.criticidade ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="f_status">${STATUS_OPTIONS.map(s => `<option value="${esc(s)}" ${s === d.status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Altura (U) para rack</label><input class="form-input" id="f_alturaU" type="number" min="0" max="10" value="${d.alturaU || 1}"/></div>
    <div class="form-group full"><label class="form-label">Observações</label><textarea class="form-textarea" id="f_notas" placeholder="VLAN, SSID, DHCP, notas diversas…">${esc(d.notas)}</textarea></div>
  </div>`,
    onSave: () => {
      const nome = $("#f_nome").value.trim();
      if (!nome) { toast("error", "Validação", "Informe um nome."); $("#f_nome").focus(); return }
      const payload = {
        ...d,
        nome, tipo: $("#f_tipo").value, fabricante: $("#f_fabricante").value.trim(), modelo: $("#f_modelo").value.trim(),
        funcao: $("#f_funcao").value.trim(), serial: $("#f_serial").value.trim(), firmware: $("#f_firmware").value.trim(),
        ip: $("#f_ip").value.trim(), mac: $("#f_mac").value.trim(), portas: $("#f_portas").value.trim(),
        uplinks: $("#f_uplinks").value.trim(), poe: $("#f_poe").checked,
        interface: $("#f_interface").value, velocidade: $("#f_velocidade").value.trim(),
        quantidade: parseInt($("#f_quantidade").value) || 1,
        local: $("#f_local").value.trim(), criticidade: $("#f_criticidade").value, status: $("#f_status").value,
        alturaU: parseInt($("#f_alturaU").value) || 1,
        notas: $("#f_notas").value.trim(), updatedAt: nowISO()
      };
      if (!payload.createdAt) payload.createdAt = nowISO();
      if (!payload.id) payload.id = uid();
      pushUndo(isEdit ? "Edição: " + d.nome : "Antes de adicionar: " + nome, structuredClone(appState.db));
      if (isEdit) { const i = appState.db.dispositivos.findIndex(x => x.id === d.id); if (i >= 0) appState.db.dispositivos[i] = payload; toast("success", "Dispositivo", "Alterações salvas.") }
      else { appState.db.dispositivos.push(payload); toast("success", "Dispositivo", "Dispositivo adicionado.") }
      saveDB(appState.db); closeModal(); render();
    }
  });
  // Auto-populate velocity from interface selection
  setTimeout(() => {
    const ifSel = $('#f_interface');
    const velInput = $('#f_velocidade');
    if (ifSel && velInput) {
      ifSel.addEventListener('change', () => {
        const speed = INTERFACE_SPEEDS[ifSel.value];
        if (speed) {
          velInput.value = speed;
        }
      });
    }
  }, 0);
}

function deleteDevice(id) {
  const d = appState.db.dispositivos.find(x => x.id === id); if (!d) return;
  openModal({
    title: "Remover dispositivo", saveLabel: "Remover", saveClass: "btn-danger",
    body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5">O dispositivo <strong>${esc(d.nome)}</strong> será removido junto com todas as suas conexões. Esta ação pode ser desfeita com Ctrl+Z.</p>`,
    onSave: async () => {
      pushUndo("Remover: " + d.nome, structuredClone(appState.db));
      await Backups.create("Antes de remover: " + d.nome);
      appState.db.dispositivos = appState.db.dispositivos.filter(x => x.id !== id);
      appState.db.conexoes = appState.db.conexoes.filter(l => l.deId !== id && l.paraId !== id);
      (appState.db.racks || []).forEach(r => { r.itens = r.itens.filter(it => it.dispositivoId !== id) });
      saveDB(appState.db); closeModal(); toast("success", "Removido", "Dispositivo removido."); render();
    }
  });
}

// ───────── CRUD: Conexões ─────────
function openLinkForm(link) {
  const isEdit = !!link; const l = link || { id: null, deId: "", paraId: "", tipo: "Cabo", portaDe: "", portaPara: "", velocidade: "1 Gbps", vlan: "", notas: "" };
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
    <div class="form-group"><label class="form-label">VLAN</label><input class="form-input" id="f_vlan" placeholder="10, 20, trunk…" value="${esc(l.vlan || "")}"/></div>
    <div class="form-group full"><label class="form-label">Observações</label><input class="form-input" id="f_lnotas" placeholder="Uplink, trunk VLAN…"/></div>
  </div>`,
    onSave: () => {
      const deId = $("#f_de").value, paraId = $("#f_para").value;
      if (!deId || !paraId) { toast("error", "Validação", "Selecione origem e destino."); return }
      if (deId === paraId) { toast("error", "Validação", "Origem e destino devem ser diferentes."); return }
      pushUndo(isEdit ? "Edição de conexão" : "Antes de adicionar conexão", structuredClone(appState.db));
      const payload = { id: l.id || uid(), deId, paraId, tipo: $("#f_ltipo").value, velocidade: $("#f_vel").value, portaDe: $("#f_pde").value.trim(), portaPara: $("#f_ppara").value.trim(), vlan: $("#f_vlan").value.trim(), notas: $("#f_lnotas").value.trim(), createdAt: l.createdAt || nowISO(), updatedAt: nowISO() };
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
    body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5">Esta conexão será removida. Pode ser desfeito com Ctrl+Z.</p>`,
    onSave: () => { pushUndo("Remover conexão", structuredClone(appState.db)); appState.db.conexoes = appState.db.conexoes.filter(x => x.id !== id); saveDB(appState.db); closeModal(); toast("success", "Removido", "Conexão removida."); render() }
  });
}

// ───────── Templates ─────────
function openTemplatePicker() {
  openModal({
    title: "Aplicar template de rede", saveLabel: "", hideFooter: true,
    body: `<div class="preset-grid">${NET_TEMPLATES.map(t => `<button class="preset-card" type="button" data-template="${t.key}" tabindex="0"><span class="preset-card-label" style="font-size:14px;font-weight:700">${esc(t.label)}</span><span style="font-size:11px;color:var(--text-secondary)">${esc(t.desc)}</span></button>`).join("")}</div>`
  });
}
function applyTemplate(key) {
  const t = NET_TEMPLATES.find(x => x.key === key); if (!t) return;
  pushUndo("Antes de template: " + t.label, structuredClone(appState.db));
  const ids = [];
  t.devices.forEach(d => { const dev = newDevice({ ...d, createdAt: nowISO(), updatedAt: nowISO() }); ids.push(dev.id); appState.db.dispositivos.push(dev) });
  (t.links || []).forEach(l => { if (ids[l.de] && ids[l.para]) appState.db.conexoes.push({ id: uid(), deId: ids[l.de], paraId: ids[l.para], tipo: l.tipo || "Cabo", velocidade: "1 Gbps", portaDe: "", portaPara: "", vlan: "", notas: "", createdAt: nowISO(), updatedAt: nowISO() }) });
  saveDB(appState.db); closeModal(); toast("success", "Template", "\"" + t.label + "\" aplicado com " + t.devices.length + " dispositivos."); render();
}

// ───────── Export / Import / Clear ─────────
function exportData() { downloadJSON(appState.db, "gorillas-rede.json"); toast("success", "Exportação", "Arquivo JSON baixado.") }
function importData(file) {
  const fr = new FileReader();
  fr.onload = async () => {
    const p = safeJSON(fr.result, null);
    if (!p || !Array.isArray(p.dispositivos)) { toast("error", "Importação", "Arquivo inválido."); return }
    await Backups.create("Antes de importar dados");
    appState.db = migrateDB(p); saveDB(appState.db); toast("success", "Importação", "Dados importados."); render();
  }; fr.readAsText(file);
}
function clearAll() {
  openModal({
    title: "Limpar todos os dados", saveLabel: "Limpar tudo", saveClass: "btn-danger",
    body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5">Esta ação apagará <strong>todos</strong> os dispositivos, conexões, WANs, VPNs, redes Wi-Fi, VLANs e racks. Um backup automático será criado antes.</p>
    <p style="font-size:13px;color:var(--text-secondary)">Para confirmar, digite <strong>LIMPAR</strong> abaixo:</p>
    <div class="confirm-input-wrap"><input class="form-input" id="confirmClear" placeholder="LIMPAR" autocomplete="off"/></div>`,
    onSave: async () => {
      if ($("#confirmClear").value.trim() !== "LIMPAR") { toast("warning", "Confirmação", 'Digite "LIMPAR" para confirmar.'); return }
      pushUndo("Antes de limpar tudo", structuredClone(appState.db));
      await Backups.create("Antes de limpar tudo");
      appState.db = createDefaultDB(); saveDB(appState.db); closeModal(); toast("success", "Pronto", "Todos os dados foram removidos."); render();
    }
  });
}
