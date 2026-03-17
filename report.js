/* ============================================================
   Gorillas — Relatórios & Impressão
   Print/PDF report system: topology, devices, connections
   ============================================================ */

// ───────── Page: Relatórios ─────────
function pageRelatorios() {
  const devs = appState.db.dispositivos;
  const links = appState.db.conexoes;
  const tipos = uniqueValues(devs, "tipo");
  const locais = uniqueValues(devs, "local");

  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h2 class="card-title">Relatórios</h2>
        <p class="card-desc">Gere relatórios detalhados para impressão ou exportação em PDF.</p>
      </div>
    </div>

    <!-- Section Toggles -->
    <div class="report-section-label">Seções do relatório</div>
    <div class="report-toggles">
      <label class="report-toggle">
        <input type="checkbox" id="rptSecTopologia" checked />
        <span class="report-toggle-text">Topologia</span>
      </label>
      <label class="report-toggle">
        <input type="checkbox" id="rptSecDispositivos" checked />
        <span class="report-toggle-text">Dispositivos</span>
      </label>
      <label class="report-toggle">
        <input type="checkbox" id="rptSecConexoes" checked />
        <span class="report-toggle-text">Conexões</span>
      </label>
      <label class="report-toggle">
        <input type="checkbox" id="rptSecResumo" checked />
        <span class="report-toggle-text">Resumo</span>
      </label>
    </div>

    <hr class="divider"/>

    <!-- Filters -->
    <div class="report-section-label">Filtros</div>
    <div class="report-filters">
      <div class="form-group">
        <label class="form-label">Local</label>
        <select class="form-select" id="rptFilterLocal">
          <option value="">Todos os locais</option>
          ${locais.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de dispositivo</label>
        <select class="form-select" id="rptFilterTipo">
          <option value="">Todos os tipos</option>
          ${tipos.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
        </select>
      </div>
    </div>

    <hr class="divider"/>

    <!-- Options -->
    <div class="report-section-label">Opções</div>
    <div class="report-options">
      <label class="report-toggle">
        <input type="checkbox" id="rptOptNotas" checked />
        <span class="report-toggle-text">Incluir observações</span>
      </label>
      <label class="report-toggle">
        <input type="checkbox" id="rptOptIpMac" checked />
        <span class="report-toggle-text">Incluir IP / MAC</span>
      </label>
      <div class="form-group" style="margin-top:4px">
        <label class="form-label">Orientação da página</label>
        <div class="btn-group">
          <button class="btn btn-sm active" type="button" id="rptOrientRetrato" data-orient="portrait">Retrato</button>
          <button class="btn btn-sm" type="button" id="rptOrientPaisagem" data-orient="landscape">Paisagem</button>
        </div>
      </div>
    </div>

    <hr class="divider"/>

    <!-- Actions -->
    <div class="report-actions">
      <button class="btn btn-primary" type="button" id="rptPrint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Imprimir / Salvar PDF
      </button>
      <span class="report-hint">Use "Salvar como PDF" no diálogo de impressão do navegador para gerar um arquivo PDF.</span>
    </div>
  </div>

  <!-- Preview -->
  <div class="card">
    <div class="card-header">
      <div>
        <h2 class="card-title">Prévia</h2>
        <p class="card-desc">Resumo do que será incluído no relatório.</p>
      </div>
    </div>
    <div id="rptPreview" class="report-preview"></div>
  </div>`;
}

// ───────── Report Options State ─────────
function getReportOptions() {
  return {
    secTopologia: $("#rptSecTopologia")?.checked ?? true,
    secDispositivos: $("#rptSecDispositivos")?.checked ?? true,
    secConexoes: $("#rptSecConexoes")?.checked ?? true,
    secResumo: $("#rptSecResumo")?.checked ?? true,
    filterLocal: $("#rptFilterLocal")?.value || "",
    filterTipo: $("#rptFilterTipo")?.value || "",
    includeNotas: $("#rptOptNotas")?.checked ?? true,
    includeIpMac: $("#rptOptIpMac")?.checked ?? true,
    orientation: document.querySelector("#rptOrientPaisagem.active") ? "landscape" : "portrait",
  };
}

// ───────── Filtered Data ─────────
function getFilteredReportData(opts) {
  let devs = [...appState.db.dispositivos];
  if (opts.filterLocal) devs = devs.filter(d => d.local === opts.filterLocal);
  if (opts.filterTipo) devs = devs.filter(d => d.tipo === opts.filterTipo);
  const devIds = new Set(devs.map(d => d.id));
  // Connections: include if both endpoints in filtered set (or show all if no filter)
  let links = [...appState.db.conexoes];
  if (opts.filterLocal || opts.filterTipo) {
    links = links.filter(l => devIds.has(l.deId) || devIds.has(l.paraId));
  }
  return { devs, links, devIds };
}

// ───────── Update Preview ─────────
function updateReportPreview() {
  const preview = $("#rptPreview");
  if (!preview) return;
  const opts = getReportOptions();
  const { devs, links } = getFilteredReportData(opts);

  const sections = [];
  if (opts.secTopologia) sections.push("Topologia");
  if (opts.secDispositivos) sections.push(`Dispositivos (${devs.length})`);
  if (opts.secConexoes) sections.push(`Conexões (${links.length})`);
  if (opts.secResumo) sections.push("Resumo");

  const filters = [];
  if (opts.filterLocal) filters.push(`Local: ${opts.filterLocal}`);
  if (opts.filterTipo) filters.push(`Tipo: ${opts.filterTipo}`);

  preview.innerHTML = `
    <div class="report-preview-row"><span class="report-preview-label">Seções:</span> ${sections.length ? sections.join(", ") : "<em>Nenhuma selecionada</em>"}</div>
    <div class="report-preview-row"><span class="report-preview-label">Filtros:</span> ${filters.length ? filters.join(" · ") : "Nenhum"}</div>
    <div class="report-preview-row"><span class="report-preview-label">Opções:</span> ${[opts.includeNotas ? "Observações" : "", opts.includeIpMac ? "IP/MAC" : ""].filter(Boolean).join(", ") || "Nenhuma"}</div>
    <div class="report-preview-row"><span class="report-preview-label">Orientação:</span> ${opts.orientation === "landscape" ? "Paisagem" : "Retrato"}</div>
    <div class="report-preview-row"><span class="report-preview-label">Dispositivos:</span> ${devs.length}</div>
    <div class="report-preview-row"><span class="report-preview-label">Conexões:</span> ${links.length}</div>
  `;
}

// ───────── Bind Report Events ─────────
function bindReportEvents() {
  // Section toggles & options → update preview
  const inputs = $$("#rptSecTopologia,#rptSecDispositivos,#rptSecConexoes,#rptSecResumo,#rptOptNotas,#rptOptIpMac,#rptFilterLocal,#rptFilterTipo");
  inputs.forEach(el => el?.addEventListener("change", updateReportPreview));

  // Orientation buttons
  const btnRetrato = $("#rptOrientRetrato");
  const btnPaisagem = $("#rptOrientPaisagem");
  btnRetrato?.addEventListener("click", () => {
    btnRetrato.classList.add("active"); btnPaisagem.classList.remove("active");
    updateReportPreview();
  });
  btnPaisagem?.addEventListener("click", () => {
    btnPaisagem.classList.add("active"); btnRetrato.classList.remove("active");
    updateReportPreview();
  });

  // Print button
  $("#rptPrint")?.addEventListener("click", () => {
    const opts = getReportOptions();
    generatePrintReport(opts);
  });

  // Initial preview
  updateReportPreview();
}

// ═══════════════════════════════════════════════════════════════
//  PRINT DOCUMENT GENERATION
// ═══════════════════════════════════════════════════════════════

function generatePrintReport(opts) {
  const { devs, links } = getFilteredReportData(opts);
  const devById = new Map(appState.db.dispositivos.map(d => [d.id, d]));
  const wans = appState.db.wans || [];
  const wifis = appState.db.wifis || [];
  const vpns = appState.db.vpns || [];

  const now = new Date();
  const dateStr = now.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });

  // Active filters summary
  const filterParts = [];
  if (opts.filterLocal) filterParts.push("Local: " + opts.filterLocal);
  if (opts.filterTipo) filterParts.push("Tipo: " + opts.filterTipo);
  const filterSummary = filterParts.length ? filterParts.join(" · ") : "Todos os dispositivos e conexões";

  // Build sections
  let bodyHTML = "";

  // ── Report Header ──
  bodyHTML += buildReportHeader(dateStr, filterSummary);

  // ── Summary Section ──
  if (opts.secResumo) {
    bodyHTML += buildSummarySection(devs, links, wans, wifis, vpns);
  }

  // ── Topology Section ──
  if (opts.secTopologia && devs.length) {
    bodyHTML += buildTopologySection(wans, wifis, vpns);
  }

  // ── Devices Section ──
  if (opts.secDispositivos && devs.length) {
    bodyHTML += buildDevicesSection(devs, links, devById, opts);
  }

  // ── Connections Section ──
  if (opts.secConexoes && links.length) {
    bodyHTML += buildConnectionsSection(links, devById, opts);
  }

  // ── Footer ──
  bodyHTML += `<div class="rpt-footer">Gorillas &bull; Relatório gerado em ${esc(dateStr)}</div>`;

  // Build complete HTML document
  const fullHTML = buildPrintDocument(bodyHTML, opts);

  // Try to open in new window; fallback to same-page
  openPrintWindow(fullHTML);
}

// ───────── Report Header ─────────
function buildReportHeader(dateStr, filterSummary) {
  return `
  <div class="rpt-header">
    <div class="rpt-header-brand">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="#006fff">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      <div>
        <div class="rpt-header-title">Gorillas &bull; Relatório de Rede</div>
        <div class="rpt-header-sub">${esc(dateStr)}</div>
      </div>
    </div>
    <div class="rpt-header-filters">${esc(filterSummary)}</div>
  </div>`;
}

// ───────── Summary Section ─────────
function buildSummarySection(devs, links, wans, wifis, vpns) {
  const totalQty = devs.reduce((s, d) => s + (d.quantidade || 1), 0);
  const byTipo = {};
  devs.forEach(d => { const k = d.tipo || "Outro"; byTipo[k] = (byTipo[k] || 0) + (d.quantidade || 1); });
  const byLocal = {};
  devs.forEach(d => { const k = d.local || "Sem local"; byLocal[k] = (byLocal[k] || 0) + (d.quantidade || 1); });
  const critCount = devs.filter(d => d.criticidade === "crítica").reduce((s, d) => s + (d.quantidade || 1), 0);

  let html = `<div class="rpt-section">
    <h2 class="rpt-section-title">Resumo da Rede</h2>
    <div class="rpt-summary-grid">
      <div class="rpt-summary-item"><div class="rpt-summary-value">${totalQty}</div><div class="rpt-summary-label">Dispositivos</div></div>
      <div class="rpt-summary-item"><div class="rpt-summary-value">${links.length}</div><div class="rpt-summary-label">Conexões</div></div>
      <div class="rpt-summary-item"><div class="rpt-summary-value">${wans.length}</div><div class="rpt-summary-label">Links WAN</div></div>
      <div class="rpt-summary-item"><div class="rpt-summary-value">${wifis.length}</div><div class="rpt-summary-label">Redes Wi-Fi</div></div>
      <div class="rpt-summary-item"><div class="rpt-summary-value">${vpns.length}</div><div class="rpt-summary-label">Túneis VPN</div></div>
      ${critCount ? `<div class="rpt-summary-item rpt-summary-crit"><div class="rpt-summary-value">${critCount}</div><div class="rpt-summary-label">Críticos</div></div>` : ""}
    </div>`;

  // By type table
  const tipoEntries = Object.entries(byTipo).sort((a, b) => b[1] - a[1]);
  if (tipoEntries.length) {
    html += `<div class="rpt-sub-grid"><div>
      <h3 class="rpt-sub-title">Por tipo</h3>
      <table class="rpt-table rpt-table-sm"><thead><tr><th>Tipo</th><th style="text-align:right">Qtd.</th></tr></thead><tbody>
      ${tipoEntries.map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right"><strong>${v}</strong></td></tr>`).join("")}
      </tbody></table>
    </div><div>
      <h3 class="rpt-sub-title">Por local</h3>
      <table class="rpt-table rpt-table-sm"><thead><tr><th>Local</th><th style="text-align:right">Qtd.</th></tr></thead><tbody>
      ${Object.entries(byLocal).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right"><strong>${v}</strong></td></tr>`).join("")}
      </tbody></table>
    </div></div>`;
  }

  // WANs list
  if (wans.length) {
    html += `<h3 class="rpt-sub-title">Links WAN / ISP</h3>
    <table class="rpt-table rpt-table-sm"><thead><tr><th>Nome</th><th>ISP</th><th>Tipo</th><th>Velocidade</th></tr></thead><tbody>
    ${wans.map(w => `<tr><td>${esc(w.nome)}</td><td>${esc(w.isp || "—")}</td><td>${esc(w.tipo)}</td><td>${esc(w.velocidadeDown || "—")}↓ / ${esc(w.velocidadeUp || "—")}↑</td></tr>`).join("")}
    </tbody></table>`;
  }

  // Wi-Fi list
  if (wifis.length) {
    html += `<h3 class="rpt-sub-title">Redes Wi-Fi</h3>
    <table class="rpt-table rpt-table-sm"><thead><tr><th>SSID</th><th>Banda</th><th>Segurança</th><th>VLAN</th></tr></thead><tbody>
    ${wifis.map(w => `<tr><td>${esc(w.ssid)}</td><td>${esc(w.banda)}</td><td>${esc(w.seguranca)}</td><td>${esc(w.vlanTag || "—")}</td></tr>`).join("")}
    </tbody></table>`;
  }

  // VPN list
  if (vpns.length) {
    html += `<h3 class="rpt-sub-title">Túneis VPN</h3>
    <table class="rpt-table rpt-table-sm"><thead><tr><th>Nome</th><th>Tipo</th><th>Endpoint</th></tr></thead><tbody>
    ${vpns.map(v => `<tr><td>${esc(v.nome)}</td><td>${esc(v.tipo)}</td><td>${esc(v.endpoint || "—")}</td></tr>`).join("")}
    </tbody></table>`;
  }

  html += `</div>`;
  return html;
}

// ───────── Topology Section ─────────
function buildTopologySection(wans, wifis, vpns) {
  // Generate SVG with fit-to-page
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

  // Parse SVG and set proper viewBox for print
  const svgStr = result.svg;

  // Build legend inline
  const usedTypes = new Set(appState.db.conexoes.map(l => l.tipo).filter(Boolean));
  if (wans.length) usedTypes.add("WAN");
  const legendItems = [...usedTypes].map(t => {
    const s = TOPO.LINK_STYLES[t] || TOPO.LINK_STYLES["Outro"];
    return `<span class="rpt-legend-item"><span class="rpt-legend-line" style="background:${s.color}${s.dash ? ";border:1px dashed " + s.color + ";background:none" : ""}"></span> ${esc(t)}</span>`;
  });
  if (wifis.length) legendItems.push(`<span class="rpt-legend-item"><span class="rpt-legend-dot" style="background:#22c55e"></span> Wi-Fi/SSID</span>`);
  if (vpns.length) legendItems.push(`<span class="rpt-legend-item"><span class="rpt-legend-dot" style="background:#f59e0b"></span> VPN</span>`);

  return `
  <div class="rpt-section rpt-page-break">
    <h2 class="rpt-section-title">Topologia da Rede</h2>
    <div class="rpt-topo-wrap">${svgStr}</div>
    ${legendItems.length ? `<div class="rpt-legend">${legendItems.join("")}</div>` : ""}
  </div>`;
}

// ───────── Devices Section ─────────
function buildDevicesSection(devs, links, devById, opts) {
  const sorted = [...devs].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  // Summary table
  let html = `<div class="rpt-section rpt-page-break">
    <h2 class="rpt-section-title">Dispositivos (${devs.length})</h2>
    <table class="rpt-table">
      <thead><tr>
        <th>Nome</th><th>Tipo</th>
        ${opts.includeIpMac ? "<th>IP</th><th>MAC</th>" : ""}
        <th>Local</th><th>Status</th><th>Criticidade</th>
        ${opts.includeNotas ? "<th>Observações</th>" : ""}
      </tr></thead>
      <tbody>${sorted.map(d => {
        const qty = (d.quantidade || 1) > 1 ? ` (×${d.quantidade})` : "";
        return `<tr>
          <td><strong>${esc(d.nome)}${qty}</strong></td>
          <td>${esc(d.tipo || "—")}</td>
          ${opts.includeIpMac ? `<td>${esc(d.ip || "—")}</td><td style="font-size:10px">${esc(d.mac || "—")}</td>` : ""}
          <td>${esc(d.local || "—")}</td>
          <td><span class="rpt-status rpt-status-${d.status || "ativo"}">${esc(d.status || "ativo")}</span></td>
          <td>${esc(d.criticidade || "normal")}</td>
          ${opts.includeNotas ? `<td style="font-size:11px;color:#64748b;max-width:200px">${esc(d.notas || "—")}</td>` : ""}
        </tr>`;
      }).join("")}</tbody>
    </table>`;

  // Per-device detail blocks
  html += `<div class="rpt-detail-blocks">`;
  sorted.forEach(d => {
    const devLinks = links.filter(l => l.deId === d.id || l.paraId === d.id);
    const fields = [
      ["Fabricante", d.fabricante], ["Modelo", d.modelo], ["Função", d.funcao],
      ["Serial", d.serial], ["Firmware", d.firmware],
      opts.includeIpMac ? ["IP", d.ip] : null,
      opts.includeIpMac ? ["MAC", d.mac] : null,
      ["Portas", d.portas], ["Uplinks", d.uplinks], ["PoE", d.poe ? "Sim" : ""],
      ["Local", d.local], ["Rack", d.rack], ["Posição U", d.posicaoU ? String(d.posicaoU) : ""],
      ["Criticidade", d.criticidade], ["Status", d.status],
      opts.includeNotas ? ["Observações", d.notas] : null,
    ].filter(f => f && f[1]);

    html += `
    <div class="rpt-device-card">
      <div class="rpt-device-header">
        <strong>${esc(d.nome)}</strong>
        <span class="rpt-badge">${esc(d.tipo || "—")}</span>
        ${(d.quantidade || 1) > 1 ? `<span class="rpt-badge">×${d.quantidade}</span>` : ""}
        <span class="rpt-status rpt-status-${d.status || "ativo"}">${esc(d.status || "ativo")}</span>
      </div>
      <div class="rpt-device-fields">
        ${fields.map(([k, v]) => `<div class="rpt-field"><span class="rpt-field-label">${esc(k)}</span><span class="rpt-field-value">${esc(v)}</span></div>`).join("")}
      </div>
      ${devLinks.length ? `<div class="rpt-device-links">
        <span class="rpt-field-label">Conexões (${devLinks.length}):</span>
        ${devLinks.map(l => {
          const other = l.deId === d.id ? devById.get(l.paraId) : devById.get(l.deId);
          return `<span class="rpt-conn-chip">${esc(l.tipo || "Cabo")} → ${esc(other?.nome || "—")}${l.vlan ? " (VLAN " + esc(l.vlan) + ")" : ""}</span>`;
        }).join("")}
      </div>` : ""}
    </div>`;
  });
  html += `</div></div>`;
  return html;
}

// ───────── Connections Section ─────────
function buildConnectionsSection(links, devById, opts) {
  const sorted = [...links].sort((a, b) => {
    const da = devById.get(a.deId)?.nome || "";
    const db2 = devById.get(b.deId)?.nome || "";
    return da.localeCompare(db2);
  });

  return `
  <div class="rpt-section rpt-page-break">
    <h2 class="rpt-section-title">Conexões (${links.length})</h2>
    <table class="rpt-table">
      <thead><tr>
        <th>Origem</th><th>Destino</th><th>Tipo</th>
        <th>Portas</th><th>Velocidade</th><th>VLAN</th>
        ${opts.includeNotas ? "<th>Observações</th>" : ""}
      </tr></thead>
      <tbody>${sorted.map(l => {
        const de = devById.get(l.deId)?.nome || "(removido)";
        const para = devById.get(l.paraId)?.nome || "(removido)";
        return `<tr>
          <td><strong>${esc(de)}</strong></td>
          <td><strong>${esc(para)}</strong></td>
          <td><span class="rpt-badge">${esc(l.tipo || "—")}</span></td>
          <td>${esc(l.portaDe || "—")} → ${esc(l.portaPara || "—")}</td>
          <td>${esc(l.velocidade || "—")}</td>
          <td>${esc(l.vlan || "—")}</td>
          ${opts.includeNotas ? `<td style="font-size:11px;color:#64748b">${esc(l.notas || "—")}</td>` : ""}
        </tr>`;
      }).join("")}</tbody>
    </table>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  SINGLE-ITEM PRINT (from device detail / connection row)
// ═══════════════════════════════════════════════════════════════

function printSingleDevice(deviceId) {
  const d = appState.db.dispositivos.find(x => x.id === deviceId);
  if (!d) { toast("error", "Erro", "Dispositivo não encontrado."); return; }
  const devById = new Map(appState.db.dispositivos.map(x => [x.id, x]));
  const links = appState.db.conexoes.filter(l => l.deId === d.id || l.paraId === d.id);
  const now = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });

  let bodyHTML = buildReportHeader(now, "Detalhes de dispositivo: " + d.nome);
  bodyHTML += buildDevicesSection([d], links, devById, { includeNotas: true, includeIpMac: true });
  bodyHTML += `<div class="rpt-footer">Gorillas &bull; Relatório gerado em ${esc(now)}</div>`;

  openPrintWindow(buildPrintDocument(bodyHTML, { orientation: "portrait" }));
}

function printSingleConnection(linkId) {
  const l = appState.db.conexoes.find(x => x.id === linkId);
  if (!l) { toast("error", "Erro", "Conexão não encontrada."); return; }
  const devById = new Map(appState.db.dispositivos.map(x => [x.id, x]));
  const de = devById.get(l.deId);
  const para = devById.get(l.paraId);
  const now = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });

  let bodyHTML = buildReportHeader(now, `Conexão: ${de?.nome || "—"} ↔ ${para?.nome || "—"}`);

  // Mini topology snippet showing just the two devices + link
  if (de && para) {
    bodyHTML += buildMiniTopologySnippet(l, de, para);
  }

  bodyHTML += buildConnectionsSection([l], devById, { includeNotas: true });

  // Include brief details of both devices
  if (de || para) {
    const relevantDevs = [de, para].filter(Boolean);
    bodyHTML += `<div class="rpt-section"><h2 class="rpt-section-title">Dispositivos envolvidos</h2>`;
    relevantDevs.forEach(d => {
      const fields = [
        ["Tipo", d.tipo], ["Fabricante", d.fabricante], ["Modelo", d.modelo],
        ["IP", d.ip], ["MAC", d.mac], ["Local", d.local], ["Status", d.status],
      ].filter(([, v]) => v);
      bodyHTML += `<div class="rpt-device-card"><div class="rpt-device-header"><strong>${esc(d.nome)}</strong><span class="rpt-badge">${esc(d.tipo || "—")}</span></div>
        <div class="rpt-device-fields">${fields.map(([k, v]) => `<div class="rpt-field"><span class="rpt-field-label">${esc(k)}</span><span class="rpt-field-value">${esc(v)}</span></div>`).join("")}</div></div>`;
    });
    bodyHTML += `</div>`;
  }

  bodyHTML += `<div class="rpt-footer">Gorillas &bull; Relatório gerado em ${esc(now)}</div>`;
  openPrintWindow(buildPrintDocument(bodyHTML, { orientation: "portrait" }));
}

// ───────── Mini topology for single connection ─────────
function buildMiniTopologySnippet(link, de, para) {
  const W = 170, H = 56, GAP = 200;
  const x1 = 40, y = 60;
  const x2 = x1 + W + GAP;
  const svgW = x2 + W + 40;
  const svgH = y + H + 40;
  const style = TOPO.LINK_STYLES[link.tipo] || TOPO.LINK_STYLES["Outro"];
  const label = [link.tipo, link.vlan ? "VLAN " + link.vlan : "", link.velocidade].filter(Boolean).join(" · ");

  const nodeSVG = (d, x) => {
    const statusColor = d.status === "ativo" ? "#22c55e" : d.status === "inativo" ? "#ef4444" : d.status === "manutenção" ? "#f59e0b" : "#94a3b8";
    const name = d.nome.length > 20 ? d.nome.slice(0, 19) + "…" : d.nome;
    const sub = [d.tipo || "", d.ip || ""].filter(Boolean).join(" · ");
    return `<g>
      <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="10" fill="#fff" stroke="#006fff" stroke-width="2"/>
      <circle cx="${x + W - 12}" cy="${y + 12}" r="4" fill="${statusColor}"/>
      <text x="${x + 12}" y="${y + 23}" font-size="12.5" font-weight="600" fill="#1a1e2c" font-family="Inter,sans-serif">${esc(name)}</text>
      <text x="${x + 12}" y="${y + 40}" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">${esc(sub)}</text>
    </g>`;
  };

  const midX = (x1 + W / 2 + x2 + W / 2) / 2;
  const midY = y + H / 2;

  return `
  <div class="rpt-section">
    <h2 class="rpt-section-title">Visualização da Conexão</h2>
    <div class="rpt-topo-wrap rpt-topo-mini">
      <svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="max-height:180px">
        <line x1="${x1 + W}" y1="${midY}" x2="${x2}" y2="${midY}" stroke="${style.color}" stroke-width="${style.width + 1}" ${style.dash ? `stroke-dasharray="${style.dash}"` : ""}/>
        ${label ? `<text x="${midX}" y="${midY - 8}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="500" font-family="Inter,sans-serif">${esc(label)}</text>` : ""}
        ${nodeSVG(de, x1)}
        ${nodeSVG(para, x2)}
      </svg>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  PRINT DOCUMENT BUILDER & WINDOW OPENER
// ═══════════════════════════════════════════════════════════════

function buildPrintDocument(bodyHTML, opts) {
  const orient = opts.orientation || "portrait";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Gorillas — Relatório de Rede</title>
<style>
/* ── Print Document Styles ── */
@page { size: A4 ${orient}; margin: 16mm 14mm; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 12px; color: #1a1e2c; background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  line-height: 1.5;
}

/* Header */
.rpt-header {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 2px solid #006fff; padding-bottom: 12px; margin-bottom: 20px;
}
.rpt-header-brand { display: flex; align-items: center; gap: 10px; }
.rpt-header-title { font-size: 18px; font-weight: 700; color: #1a1e2c; }
.rpt-header-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
.rpt-header-filters { font-size: 11px; color: #64748b; text-align: right; max-width: 50%; }

/* Sections */
.rpt-section { margin-bottom: 24px; }
.rpt-section-title {
  font-size: 15px; font-weight: 700; color: #1a1e2c;
  border-bottom: 1px solid #e2e5ea; padding-bottom: 6px; margin: 0 0 12px;
}
.rpt-sub-title { font-size: 12px; font-weight: 600; color: #64748b; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: .3px; }
.rpt-page-break { page-break-before: always; break-before: page; }
.rpt-page-break:first-of-type { page-break-before: auto; break-before: auto; }

/* Summary Grid */
.rpt-summary-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px; margin-bottom: 16px;
}
.rpt-summary-item {
  border: 1px solid #e2e5ea; border-radius: 6px; padding: 10px; text-align: center; background: #f8f9fb;
}
.rpt-summary-value { font-size: 22px; font-weight: 700; color: #1a1e2c; }
.rpt-summary-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .3px; margin-top: 2px; }
.rpt-summary-crit .rpt-summary-value { color: #ef4444; }
.rpt-sub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; }

/* Tables */
.rpt-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
.rpt-table th {
  text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 600;
  color: #64748b; text-transform: uppercase; letter-spacing: .3px;
  background: #f1f5f9; border: 1px solid #e2e5ea;
}
.rpt-table td { padding: 6px 8px; border: 1px solid #e2e5ea; vertical-align: top; }
.rpt-table tr:nth-child(even) td { background: #f8f9fb; }
.rpt-table-sm { font-size: 10px; }
.rpt-table-sm th, .rpt-table-sm td { padding: 4px 6px; }

/* Status badges */
.rpt-status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
.rpt-status-ativo { background: rgba(34,197,94,.12); color: #16a34a; }
.rpt-status-inativo { background: rgba(239,68,68,.12); color: #ef4444; }
.rpt-status-manutenção { background: rgba(245,158,11,.12); color: #d97706; }
.rpt-status-planejado { background: #f1f5f9; color: #64748b; }
.rpt-badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 500; background: #f1f5f9; color: #64748b; margin-left: 4px; }

/* Device detail cards */
.rpt-detail-blocks { margin-top: 20px; }
.rpt-device-card {
  border: 1px solid #e2e5ea; border-radius: 8px; padding: 12px; margin-bottom: 10px;
  page-break-inside: avoid; break-inside: avoid;
}
.rpt-device-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.rpt-device-header strong { font-size: 13px; }
.rpt-device-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 4px 12px; }
.rpt-field { display: flex; gap: 6px; font-size: 11px; padding: 2px 0; }
.rpt-field-label { color: #64748b; font-weight: 600; font-size: 10px; min-width: 70px; text-transform: uppercase; letter-spacing: .2px; }
.rpt-field-value { color: #1a1e2c; word-break: break-all; }
.rpt-device-links { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.rpt-conn-chip { display: inline-block; padding: 2px 8px; background: #f0f4ff; border: 1px solid #dce4f0; border-radius: 10px; font-size: 10px; color: #006fff; }

/* Topology */
.rpt-topo-wrap {
  border: 1px solid #e2e5ea; border-radius: 8px; overflow: hidden;
  background: #fafbfc; margin-bottom: 8px;
  page-break-inside: avoid; break-inside: avoid;
}
.rpt-topo-wrap svg { display: block; width: 100%; height: auto; max-height: 560px; }
.rpt-topo-mini svg { max-height: 180px; }
.rpt-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 10px; color: #64748b; padding: 4px 0; }
.rpt-legend-item { display: flex; align-items: center; gap: 4px; }
.rpt-legend-line { display: inline-block; width: 18px; height: 2px; border-radius: 1px; }
.rpt-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }

/* Footer */
.rpt-footer {
  margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e5ea;
  font-size: 10px; color: #94a3b8; text-align: center;
}

/* Print-specific overrides */
@media print {
  body { background: #fff !important; }
  .rpt-device-card { break-inside: avoid; }
  .rpt-topo-wrap { break-inside: avoid; }
  .rpt-table tr { break-inside: avoid; }
  .rpt-section { break-inside: avoid; }
  svg { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}

/* Screen-only: add a max-width for readability in browser */
@media screen {
  body { max-width: 900px; margin: 24px auto; padding: 0 16px; }
}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body>
${bodyHTML}
<script>
  // Auto-trigger print after rendering
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 400);
  });
</script>
</body>
</html>`;
}

function openPrintWindow(htmlContent) {
  const printWin = window.open("", "_blank");
  if (printWin) {
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  } else {
    // Fallback: popup blocked — use in-page print mode
    toast("warning", "Relatório", "O navegador bloqueou a janela. Abrindo na mesma página…");
    fallbackInPagePrint(htmlContent);
  }
}

function fallbackInPagePrint(htmlContent) {
  // Create overlay with print content
  const overlay = document.createElement("div");
  overlay.id = "printFallbackOverlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:#fff;overflow-y:auto;padding:24px;";
  overlay.innerHTML = `
    <div style="max-width:900px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:12px;background:#f6f7f9;border-radius:8px;">
        <span style="font-size:13px;font-weight:600;color:#1a1e2c">Prévia do relatório</span>
        <div style="display:flex;gap:8px;">
          <button onclick="window.print()" style="padding:8px 16px;background:#006fff;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Imprimir</button>
          <button onclick="document.getElementById('printFallbackOverlay').remove()" style="padding:8px 16px;background:#fff;border:1px solid #e2e5ea;border-radius:6px;cursor:pointer;font-size:13px">Fechar</button>
        </div>
      </div>
      <iframe id="printFallbackFrame" style="width:100%;height:calc(100vh - 120px);border:1px solid #e2e5ea;border-radius:8px;" sandbox="allow-same-origin allow-scripts"></iframe>
    </div>`;
  document.body.appendChild(overlay);

  const frame = document.getElementById("printFallbackFrame");
  frame.contentDocument.open();
  frame.contentDocument.write(htmlContent.replace(/window\.print\(\)/, "// print disabled in iframe"));
  frame.contentDocument.close();
}
