/* ============================================================
   Gorillas — Networks: WAN, VPN, Wi-Fi, VLAN pages
   ============================================================ */

// ───────── Page: Redes ─────────
function pageRedes() {
  const tab = appState.netTab || "wans";
  return `
  <div class="card">
    <div class="card-header">
      <div><h2 class="card-title">Redes</h2><p class="card-desc">Gerencie conexões WAN, túneis VPN, redes Wi-Fi e VLANs.</p></div>
    </div>
    <div class="tabs" id="netTabs">
      <button class="tab ${tab === "wans" ? "active" : ""}" data-net-tab="wans">WANs / ISPs</button>
      <button class="tab ${tab === "vpns" ? "active" : ""}" data-net-tab="vpns">VPNs</button>
      <button class="tab ${tab === "wifis" ? "active" : ""}" data-net-tab="wifis">Wi-Fi</button>
      <button class="tab ${tab === "vlans" ? "active" : ""}" data-net-tab="vlans">VLANs</button>
    </div>
    <div id="netTabContent">${tab === "wans" ? renderWanTab() :
      tab === "vpns" ? renderVpnTab() :
        tab === "wifis" ? renderWifiTab() :
          renderVlanTab()
    }</div>
  </div>`;
}

// ───────── WAN Tab ─────────
function renderWanTab() {
  const wans = appState.db.wans || [];
  const devById = new Map(appState.db.dispositivos.map(d => [d.id, d]));
  if (!wans.length) return `<div class="empty-state" style="padding:32px"><div class="empty-state-title">Nenhuma WAN cadastrada</div><div class="empty-state-desc">Registre os links de internet do estabelecimento.</div><button class="btn btn-primary" type="button" id="btnNewWan">Adicionar WAN</button></div>`;
  return `
  <div style="margin-bottom:12px"><button class="btn btn-primary" type="button" id="btnNewWan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar WAN</button></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Nome</th><th>ISP</th><th>Tipo</th><th>IP</th><th>Velocidade</th><th>Failover</th><th>Dispositivo</th><th>Ações</th></tr></thead>
    <tbody>${wans.map(w => {
    const dev = devById.get(w.dispositivoId);
    return `<tr>
        <td class="td-name">${esc(w.nome)}</td><td>${esc(w.isp || "—")}</td>
        <td><span class="badge">${esc(w.tipo)}</span></td><td>${esc(w.ip || "—")}</td>
        <td>${esc(w.velocidadeDown || "—")}↓ / ${esc(w.velocidadeUp || "—")}↑</td>
        <td>${w.failover ? '<span class="badge badge-warning">Failover</span>' : w.balanceamento ? '<span class="badge badge-accent">Balanceamento</span>' : "—"}</td>
        <td>${esc(dev?.nome || "—")}</td>
        <td class="td-actions"><button class="btn btn-sm btn-ghost" data-action="edit-wan" data-id="${esc(w.id)}">Editar</button><button class="btn btn-sm btn-danger" data-action="del-wan" data-id="${esc(w.id)}">Remover</button></td>
      </tr>`}).join("")}</tbody>
  </table></div>`;
}

// ───────── VPN Tab ─────────
function renderVpnTab() {
  const vpns = appState.db.vpns || [];
  if (!vpns.length) return `<div class="empty-state" style="padding:32px"><div class="empty-state-title">Nenhum túnel VPN</div><div class="empty-state-desc">Configure conexões VPN site-to-site ou de acesso remoto.</div><button class="btn btn-primary" type="button" id="btnNewVpn">Adicionar VPN</button></div>`;
  return `
  <div style="margin-bottom:12px"><button class="btn btn-primary" type="button" id="btnNewVpn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar VPN</button></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Nome</th><th>Tipo</th><th>Endpoint</th><th>Dispositivos</th><th>Ações</th></tr></thead>
    <tbody>${vpns.map(v => {
    const devNames = (v.dispositivoIds || []).map(id => { const d = appState.db.dispositivos.find(x => x.id === id); return d ? d.nome : "—" }).join(", ");
    return `<tr><td class="td-name">${esc(v.nome)}</td><td><span class="badge">${esc(v.tipo)}</span></td><td>${esc(v.endpoint || "—")}</td><td>${esc(devNames || "—")}</td>
      <td class="td-actions"><button class="btn btn-sm btn-ghost" data-action="edit-vpn" data-id="${esc(v.id)}">Editar</button><button class="btn btn-sm btn-danger" data-action="del-vpn" data-id="${esc(v.id)}">Remover</button></td></tr>`
  }).join("")}</tbody>
  </table></div>`;
}

// ───────── Wi-Fi Tab ─────────
function renderWifiTab() {
  const wifis = appState.db.wifis || [];
  if (!wifis.length) return `<div class="empty-state" style="padding:32px"><div class="empty-state-title">Nenhuma rede Wi-Fi</div><div class="empty-state-desc">Registre as redes Wi-Fi (SSIDs) do estabelecimento.</div><button class="btn btn-primary" type="button" id="btnNewWifi">Adicionar rede Wi-Fi</button></div>`;
  return `
  <div style="margin-bottom:12px"><button class="btn btn-primary" type="button" id="btnNewWifi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar Wi-Fi</button></div>
  <div class="table-wrap"><table>
    <thead><tr><th>SSID</th><th>Banda</th><th>Segurança</th><th>VLAN</th><th>APs</th><th>Oculta</th><th>Ações</th></tr></thead>
    <tbody>${wifis.map(w => {
    const apNames = (w.apIds || []).map(id => { const d = appState.db.dispositivos.find(x => x.id === id); return d ? d.nome : "—" }).join(", ");
    return `<tr><td class="td-name">${esc(w.ssid)}</td><td>${esc(w.banda)}</td><td><span class="badge">${esc(w.seguranca)}</span></td><td>${esc(w.vlanTag || "—")}</td><td>${esc(apNames || "—")}</td><td>${w.oculta ? "Sim" : "Não"}</td>
      <td class="td-actions"><button class="btn btn-sm btn-ghost" data-action="edit-wifi" data-id="${esc(w.id)}">Editar</button><button class="btn btn-sm btn-danger" data-action="del-wifi" data-id="${esc(w.id)}">Remover</button></td></tr>`
  }).join("")}</tbody>
  </table></div>`;
}

// ───────── VLAN Tab ─────────
function renderVlanTab() {
  const vlans = appState.db.vlans || [];
  if (!vlans.length) return `<div class="empty-state" style="padding:32px"><div class="empty-state-title">Nenhuma VLAN</div><div class="empty-state-desc">Organize a rede com VLANs para segmentar o tráfego.</div><button class="btn btn-primary" type="button" id="btnNewVlan">Adicionar VLAN</button></div>`;
  return `
  <div style="margin-bottom:12px"><button class="btn btn-primary" type="button" id="btnNewVlan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar VLAN</button></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Tag</th><th>Nome</th><th>Sub-rede</th><th>IPs disponíveis</th><th>Gateway</th><th>Ações</th></tr></thead>
    <tbody>${vlans.map(v => {
    const cidr = parseCIDR(v.subrede); const ipsCol = cidr ? `<strong>${cidr.usableHosts.toLocaleString('pt-BR')}</strong> <span style="font-size:10px;color:var(--text-tertiary)">/${cidr.prefix}</span>` : '—'; return `<tr><td><span class="badge badge-accent">${esc(v.tag)}</span></td><td class="td-name">${esc(v.nome)}</td><td>${esc(v.subrede || "—")}</td><td>${ipsCol}</td><td>${esc(v.gateway || "—")}</td>
    <td class="td-actions"><button class="btn btn-sm btn-ghost" data-action="edit-vlan" data-id="${esc(v.id)}">Editar</button><button class="btn btn-sm btn-danger" data-action="del-vlan" data-id="${esc(v.id)}">Remover</button></td></tr>`
  }).join("")}</tbody>
  </table></div>`;
}

// ───────── CRUD: WAN ─────────
function openWanForm(existing) {
  const isEdit = !!existing; const w = existing || newWan();
  const devOpts = appState.db.dispositivos.map(d => `<option value="${esc(d.id)}" ${d.id === w.dispositivoId ? "selected" : ""}>${esc(d.nome)}</option>`).join("");
  openModal({
    title: isEdit ? "Editar WAN" : "Adicionar WAN", saveLabel: isEdit ? "Salvar" : "Adicionar", wide: true,
    body: `<div class="form-grid">
    <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f_wname" value="${esc(w.nome)}" placeholder="WAN Principal"/></div>
    <div class="form-group"><label class="form-label">ISP</label><input class="form-input" id="f_wisp" value="${esc(w.isp)}" placeholder="Vivo, Claro, Tim…"/></div>
    <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="f_wtipo">${WAN_TIPOS.map(t => `<option value="${esc(t)}" ${t === w.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">IP externo</label><input class="form-input" id="f_wip" value="${esc(w.ip)}" placeholder="Dinâmico ou fixo"/></div>
    <div class="form-group"><label class="form-label">Gateway</label><input class="form-input" id="f_wgw" value="${esc(w.gateway)}"/></div>
    <div class="form-group"><label class="form-label">DNS</label><input class="form-input" id="f_wdns" value="${esc(w.dns)}" placeholder="8.8.8.8, 1.1.1.1"/></div>
    <div class="form-group"><label class="form-label">Download</label><input class="form-input" id="f_wdown" value="${esc(w.velocidadeDown)}" placeholder="500 Mbps"/></div>
    <div class="form-group"><label class="form-label">Upload</label><input class="form-input" id="f_wup" value="${esc(w.velocidadeUp)}" placeholder="250 Mbps"/></div>
    <div class="form-group"><label class="form-label">Dispositivo (modem/roteador)</label><select class="form-select" id="f_wdev"><option value="">Nenhum</option>${devOpts}</select></div>
    <div class="form-group"><label class="form-check"><input type="checkbox" id="f_wfail" ${w.failover ? "checked" : ""}/> Failover</label></div>
    <div class="form-group"><label class="form-check"><input type="checkbox" id="f_wbal" ${w.balanceamento ? "checked" : ""}/> Balanceamento</label></div>
    <div class="form-group full"><label class="form-label">Observações</label><input class="form-input" id="f_wnotas" value="${esc(w.notas)}"/></div>
  </div>`,
    onSave: () => {
      const nome = $("#f_wname").value.trim(); if (!nome) { toast("error", "Validação", "Informe um nome."); return }
      pushUndo(isEdit ? "Editar WAN" : "Adicionar WAN", structuredClone(appState.db));
      const p = { ...w, nome, isp: $("#f_wisp").value.trim(), tipo: $("#f_wtipo").value, ip: $("#f_wip").value.trim(), gateway: $("#f_wgw").value.trim(), dns: $("#f_wdns").value.trim(), velocidadeDown: $("#f_wdown").value.trim(), velocidadeUp: $("#f_wup").value.trim(), dispositivoId: $("#f_wdev").value, failover: $("#f_wfail").checked, balanceamento: $("#f_wbal").checked, notas: $("#f_wnotas").value.trim(), updatedAt: nowISO() };
      if (!p.id) p.id = uid(); if (!p.createdAt) p.createdAt = nowISO();
      if (isEdit) { const i = (appState.db.wans || []).findIndex(x => x.id === w.id); if (i >= 0) appState.db.wans[i] = p } else { if (!appState.db.wans) appState.db.wans = []; appState.db.wans.push(p) }
      saveDB(appState.db); closeModal(); toast("success", "WAN", isEdit ? "WAN atualizada." : "WAN adicionada."); render();
    }
  });
}

// ───────── CRUD: VPN ─────────
function openVpnForm(existing) {
  const isEdit = !!existing; const v = existing || newVpn();
  const devChecks = appState.db.dispositivos.map(d => `<label class="form-check" style="margin-bottom:4px"><input type="checkbox" value="${esc(d.id)}" ${(v.dispositivoIds || []).includes(d.id) ? "checked" : ""}/> ${esc(d.nome)}</label>`).join("");
  openModal({
    title: isEdit ? "Editar VPN" : "Adicionar VPN", saveLabel: isEdit ? "Salvar" : "Adicionar",
    body: `<div class="form-grid">
    <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f_vname" value="${esc(v.nome)}" placeholder="VPN Matriz-Filial"/></div>
    <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="f_vtipo">${VPN_TIPOS.map(t => `<option value="${esc(t)}" ${t === v.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Endpoint</label><input class="form-input" id="f_vep" value="${esc(v.endpoint)}" placeholder="IP ou domínio"/></div>
    <div class="form-group full"><label class="form-label">Dispositivos</label><div id="f_vdevs" style="max-height:120px;overflow-y:auto">${devChecks || "<span style='color:var(--text-tertiary);font-size:12px'>Nenhum dispositivo</span>"}</div></div>
    <div class="form-group full"><label class="form-label">Observações</label><input class="form-input" id="f_vnotas" value="${esc(v.notas)}"/></div>
  </div>`,
    onSave: () => {
      const nome = $("#f_vname").value.trim(); if (!nome) { toast("error", "Validação", "Informe um nome."); return }
      pushUndo(isEdit ? "Editar VPN" : "Adicionar VPN", structuredClone(appState.db));
      const devIds = [...$$('#f_vdevs input[type="checkbox"]:checked')].map(c => c.value);
      const p = { ...v, nome, tipo: $("#f_vtipo").value, endpoint: $("#f_vep").value.trim(), dispositivoIds: devIds, notas: $("#f_vnotas").value.trim(), updatedAt: nowISO() };
      if (!p.id) p.id = uid(); if (!p.createdAt) p.createdAt = nowISO();
      if (isEdit) { const i = (appState.db.vpns || []).findIndex(x => x.id === v.id); if (i >= 0) appState.db.vpns[i] = p } else { if (!appState.db.vpns) appState.db.vpns = []; appState.db.vpns.push(p) }
      saveDB(appState.db); closeModal(); toast("success", "VPN", isEdit ? "VPN atualizada." : "VPN adicionada."); render();
    }
  });
}

// ───────── CRUD: Wi-Fi ─────────
function openWifiForm(existing) {
  const isEdit = !!existing; const w = existing || newWifi();
  const aps = appState.db.dispositivos.filter(d => d.tipo === "Access Point" || d.tipo === "Roteador");
  const apChecks = aps.map(d => `<label class="form-check" style="margin-bottom:4px"><input type="checkbox" value="${esc(d.id)}" ${(w.apIds || []).includes(d.id) ? "checked" : ""}/> ${esc(d.nome)}</label>`).join("");
  openModal({
    title: isEdit ? "Editar rede Wi-Fi" : "Adicionar rede Wi-Fi", saveLabel: isEdit ? "Salvar" : "Adicionar",
    body: `<div class="form-grid">
    <div class="form-group"><label class="form-label">SSID *</label><input class="form-input" id="f_wfssid" value="${esc(w.ssid)}" placeholder="Gorillas-Guest"/></div>
    <div class="form-group"><label class="form-label">Banda</label><select class="form-select" id="f_wfbanda">${WIFI_BANDAS.map(b => `<option value="${esc(b)}" ${b === w.banda ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Segurança</label><select class="form-select" id="f_wfseg">${WIFI_SEGURANCA.map(s => `<option value="${esc(s)}" ${s === w.seguranca ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">VLAN Tag</label><input class="form-input" id="f_wfvlan" value="${esc(w.vlanTag)}" placeholder="10, 20…"/></div>
    <div class="form-group"><label class="form-label">Senha</label><input class="form-input" id="f_wfsenha" value="${esc(w.senha)}" type="password"/></div>
    <div class="form-group"><label class="form-check"><input type="checkbox" id="f_wfhidden" ${w.oculta ? "checked" : ""}/> Rede oculta</label></div>
    <div class="form-group full"><label class="form-label">Access Points / Roteadores</label><div id="f_wfaps" style="max-height:120px;overflow-y:auto">${apChecks || "<span style='color:var(--text-tertiary);font-size:12px'>Nenhum AP cadastrado</span>"}</div></div>
    <div class="form-group full"><label class="form-label">Observações</label><input class="form-input" id="f_wfnotas" value="${esc(w.notas)}"/></div>
  </div>`,
    onSave: () => {
      const ssid = $("#f_wfssid").value.trim(); if (!ssid) { toast("error", "Validação", "Informe o SSID."); return }
      pushUndo(isEdit ? "Editar Wi-Fi" : "Adicionar Wi-Fi", structuredClone(appState.db));
      const apIds = [...$$('#f_wfaps input[type="checkbox"]:checked')].map(c => c.value);
      const p = { ...w, ssid, banda: $("#f_wfbanda").value, seguranca: $("#f_wfseg").value, vlanTag: $("#f_wfvlan").value.trim(), senha: $("#f_wfsenha").value, oculta: $("#f_wfhidden").checked, apIds, notas: $("#f_wfnotas").value.trim(), updatedAt: nowISO() };
      if (!p.id) p.id = uid(); if (!p.createdAt) p.createdAt = nowISO();
      if (isEdit) { const i = (appState.db.wifis || []).findIndex(x => x.id === w.id); if (i >= 0) appState.db.wifis[i] = p } else { if (!appState.db.wifis) appState.db.wifis = []; appState.db.wifis.push(p) }
      saveDB(appState.db); closeModal(); toast("success", "Wi-Fi", isEdit ? "Rede atualizada." : "Rede adicionada."); render();
    }
  });
}

// ───────── CRUD: VLAN ─────────
function openVlanForm(existing) {
  const isEdit = !!existing; const v = existing || newVlan();
  const initialCidr = parseCIDR(v.subrede);
  openModal({
    title: isEdit ? "Editar VLAN" : "Adicionar VLAN", saveLabel: isEdit ? "Salvar" : "Adicionar",
    body: `<div class="form-grid">
    <div class="form-group"><label class="form-label">Tag *</label><input class="form-input" id="f_vltag" value="${esc(v.tag)}" placeholder="10, 20, 100…"/></div>
    <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f_vlname" value="${esc(v.nome)}" placeholder="Gerência, Clientes, CFTV…"/></div>
    <div class="form-group"><label class="form-label">Sub-rede</label><input class="form-input" id="f_vlsub" value="${esc(v.subrede)}" placeholder="192.168.10.0/24"/><div id="cidrHint" style="min-height:20px">${initialCidr ? cidrHintHTML(initialCidr) : '<div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">Use notação CIDR (ex: /24, /25, /28) para ver IPs disponíveis</div>'}</div></div>
    <div class="form-group"><label class="form-label">Gateway</label><input class="form-input" id="f_vlgw" value="${esc(v.gateway)}" placeholder="192.168.10.1"/></div>
    <div class="form-group full"><label class="form-label">Observações</label><input class="form-input" id="f_vlnotas" value="${esc(v.notas)}"/></div>
  </div>`,
    onSave: () => {
      const tag = $("#f_vltag").value.trim(), nome = $("#f_vlname").value.trim();
      if (!tag || !nome) { toast("error", "Validação", "Informe tag e nome."); return }
      pushUndo(isEdit ? "Editar VLAN" : "Adicionar VLAN", structuredClone(appState.db));
      const p = { ...v, tag, nome, subrede: $("#f_vlsub").value.trim(), gateway: $("#f_vlgw").value.trim(), notas: $("#f_vlnotas").value.trim(), updatedAt: nowISO() };
      if (!p.id) p.id = uid(); if (!p.createdAt) p.createdAt = nowISO();
      if (isEdit) { const i = (appState.db.vlans || []).findIndex(x => x.id === v.id); if (i >= 0) appState.db.vlans[i] = p } else { if (!appState.db.vlans) appState.db.vlans = []; appState.db.vlans.push(p) }
      saveDB(appState.db); closeModal(); toast("success", "VLAN", isEdit ? "VLAN atualizada." : "VLAN adicionada."); render();
    }
  });
  // Live CIDR hint
  setTimeout(() => {
    const subInput = $('#f_vlsub');
    const hintEl = $('#cidrHint');
    if (subInput && hintEl) {
      subInput.addEventListener('input', () => {
        const info = parseCIDR(subInput.value);
        hintEl.innerHTML = info ? cidrHintHTML(info) : '<div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">Use notação CIDR (ex: /24, /25, /28) para ver IPs disponíveis</div>';
      });
    }
  }, 0);
}

// ───────── Delete helpers (networks) ─────────
function deleteNetEntity(collection, id, label) {
  openModal({
    title: "Remover " + label, saveLabel: "Remover", saveClass: "btn-danger",
    body: `<p style="font-size:13px;color:var(--text-secondary)">Deseja remover este registro? Pode ser desfeito com Ctrl+Z.</p>`,
    onSave: () => {
      pushUndo("Remover " + label, structuredClone(appState.db));
      appState.db[collection] = (appState.db[collection] || []).filter(x => x.id !== id);
      saveDB(appState.db); closeModal(); toast("success", "Removido", label + " removido(a)."); render();
    }
  });
}

// ───────── Network Events ─────────
function bindNetworkEvents() {
  // Tab switching
  $$("#netTabs .tab").forEach(t => t.addEventListener("click", () => { appState.netTab = t.dataset.netTab; render() }));
  // Add buttons
  $("#btnNewWan")?.addEventListener("click", () => openWanForm(null));
  $("#btnNewVpn")?.addEventListener("click", () => openVpnForm(null));
  $("#btnNewWifi")?.addEventListener("click", () => openWifiForm(null));
  $("#btnNewVlan")?.addEventListener("click", () => openVlanForm(null));
  // Delegated actions
  $("#netTabContent")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]"); if (!btn) return;
    const action = btn.dataset.action, id = btn.dataset.id;
    if (action === "edit-wan") { const w = (appState.db.wans || []).find(x => x.id === id); if (w) openWanForm(w) }
    if (action === "del-wan") deleteNetEntity("wans", id, "WAN");
    if (action === "edit-vpn") { const v = (appState.db.vpns || []).find(x => x.id === id); if (v) openVpnForm(v) }
    if (action === "del-vpn") deleteNetEntity("vpns", id, "VPN");
    if (action === "edit-wifi") { const w = (appState.db.wifis || []).find(x => x.id === id); if (w) openWifiForm(w) }
    if (action === "del-wifi") deleteNetEntity("wifis", id, "Wi-Fi");
    if (action === "edit-vlan") { const v = (appState.db.vlans || []).find(x => x.id === id); if (v) openVlanForm(v) }
    if (action === "del-vlan") deleteNetEntity("vlans", id, "VLAN");
  });
}
