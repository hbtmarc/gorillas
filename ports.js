/* ============================================================
   Gorillas — Portas (Switch Port Manager)
   Grid/table views, connection-derived mapping, conflict detection
   ============================================================ */

// ───────── Page: Portas ─────────
function pagePortas() {
  const devs = appState.db.dispositivos;
  const links = appState.db.conexoes;
  const switches = devs.filter(d => parseInt(d.portas) > 0);
  const sel = appState.selectedSwitch;
  const swObj = sel ? switches.find(s => s.id === sel) : null;

  // Switch list sidebar
  let listHTML = switches.map(s => {
    const portCount = parseInt(s.portas) || 0;
    const mapping = buildPortMapping(s, links, devs);
    const usedCount = mapping.filter(p => p.connections.length > 0).length;
    const conflictCount = mapping.filter(p => p.connections.length > 1).length;
    return `
    <div class="port-palette-item ${sel === s.id ? 'active' : ''}" data-switch-select="${esc(s.id)}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.nome)}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${portCount} porta(s) · ${usedCount} em uso${conflictCount ? ` · <span style="color:var(--danger)">${conflictCount} conflito(s)</span>` : ''}</div>
      </div>
      ${deviceIconSVG(s.tipo, 18)}
    </div>`;
  }).join('');

  // Unassigned connections (portaDe/portaPara empty)
  const unassigned = links.filter(l => {
    const de = devs.find(d => d.id === l.deId);
    const para = devs.find(d => d.id === l.paraId);
    const deHasPorts = de && parseInt(de.portas) > 0;
    const paraHasPorts = para && parseInt(para.portas) > 0;
    return (deHasPorts && !l.portaDe) || (paraHasPorts && !l.portaPara);
  });

  return `
  <div class="card">
    <div class="card-header">
      <div><h2 class="card-title">Portas</h2><p class="card-desc">Gerencie as portas dos switches e veja quais dispositivos estão conectados.</p></div>
    </div>
    ${!switches.length ? `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/></svg>
      <div class="empty-state-title">Nenhum switch com portas</div>
      <div class="empty-state-desc">Cadastre dispositivos do tipo Switch com número de portas definido para visualizar o mapeamento.</div>
      <button class="btn btn-primary" type="button" onclick="navigate('/dispositivos')">Ir para Dispositivos</button>
    </div>` : `
    <div class="port-layout">
      <div class="port-sidebar">
        <div style="margin-bottom:12px;font-size:12px;font-weight:600;color:var(--text-secondary)">SWITCHES</div>
        ${listHTML}
        ${unassigned.length ? `<hr class="divider"/><div class="port-warn-box">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style="font-size:11px;color:var(--text-secondary)"><strong>${unassigned.length}</strong> conexão(ões) sem porta informada</div>
        </div>` : ''}
      </div>
      <div class="port-view">
        ${swObj ? buildPortPanel(swObj) : `<div class="empty-state" style="padding:40px"><div class="empty-state-title">Selecione um switch</div><div class="empty-state-desc">Clique em um switch à esquerda para ver o mapeamento de portas.</div></div>`}
      </div>
    </div>`}
  </div>`;
}

// ───────── Build Port Mapping ─────────
function buildPortMapping(switchDev, links, devs) {
  const portCount = parseInt(switchDev.portas) || 0;
  const mapping = [];

  for (let i = 1; i <= portCount; i++) {
    mapping.push({ port: i, label: portLabel(i, switchDev), connections: [] });
  }

  // Find connections involving this switch
  const switchLinks = links.filter(l => l.deId === switchDev.id || l.paraId === switchDev.id);

  switchLinks.forEach(l => {
    const isOrigin = l.deId === switchDev.id;
    const portStr = isOrigin ? l.portaDe : l.portaPara;
    const otherDevId = isOrigin ? l.paraId : l.deId;
    const otherPortStr = isOrigin ? l.portaPara : l.portaDe;
    const otherDev = devs.find(d => d.id === otherDevId);

    if (!portStr) return; // no port assigned

    const portNum = parsePortNumber(portStr, switchDev);
    if (portNum >= 1 && portNum <= portCount) {
      mapping[portNum - 1].connections.push({
        linkId: l.id,
        deviceId: otherDevId,
        deviceName: otherDev?.nome || '(removido)',
        deviceTipo: otherDev?.tipo || '',
        deviceIp: otherDev?.ip || '',
        portStr: portStr,
        otherPortStr: otherPortStr || '',
        tipo: l.tipo || 'Cabo',
        velocidade: l.velocidade || '',
        vlan: l.vlan || ''
      });
    }
  });

  return mapping;
}

// ───────── Port Label / Number Parser ─────────
function portLabel(num, switchDev) {
  // Customize label based on device model hints
  return String(num);
}

function parsePortNumber(portStr, switchDev) {
  // Try to extract numeric port from strings like "1", "LAN1", "Gi0/1", "eth0", "Port 5"
  const clean = String(portStr).trim();
  // Direct number
  const direct = parseInt(clean, 10);
  if (!isNaN(direct) && String(direct) === clean) return direct;
  // Trailing number: "LAN1" → 1, "Gi0/1" → 1, "Port 5" → 5
  const match = clean.match(/(\d+)\s*$/);
  if (match) return parseInt(match[1], 10);
  return -1;
}

// ───────── Build Port Panel (Grid + Table) ─────────
function buildPortPanel(switchDev) {
  const links = appState.db.conexoes;
  const devs = appState.db.dispositivos;
  const mapping = buildPortMapping(switchDev, links, devs);
  const portCount = mapping.length;

  const viewMode = appState.portViewMode || 'grid';
  const filter = appState.portFilter || 'todos';

  // Stats
  const total = mapping.length;
  const used = mapping.filter(p => p.connections.length > 0).length;
  const free = mapping.filter(p => p.connections.length === 0).length;
  const conflicts = mapping.filter(p => p.connections.length > 1).length;

  // Filter
  let filtered = mapping;
  if (filter === 'ocupadas') filtered = mapping.filter(p => p.connections.length > 0);
  else if (filter === 'livres') filtered = mapping.filter(p => p.connections.length === 0);
  else if (filter === 'conflito') filtered = mapping.filter(p => p.connections.length > 1);

  // Unassigned connections for this switch
  const switchLinks = links.filter(l => l.deId === switchDev.id || l.paraId === switchDev.id);
  const noPort = switchLinks.filter(l => {
    const isOrigin = l.deId === switchDev.id;
    const portStr = isOrigin ? l.portaDe : l.portaPara;
    return !portStr;
  });

  return `
  <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <div>
      <strong>${esc(switchDev.nome)}</strong>
      <span class="badge">${portCount} portas</span>
      ${switchDev.ip ? `<span class="badge">${esc(switchDev.ip)}</span>` : ''}
      ${switchDev.poe ? '<span class="badge badge-success">PoE</span>' : ''}
    </div>
    <div class="card-actions" style="gap:6px">
      <div class="btn-group">
        <button class="btn btn-sm ${viewMode === 'grid' ? 'active' : ''}" data-port-view="grid" title="Visão em grade">▦ Grade</button>
        <button class="btn btn-sm ${viewMode === 'table' ? 'active' : ''}" data-port-view="table" title="Visão em tabela">☰ Tabela</button>
      </div>
    </div>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <span class="port-stat"><span class="port-stat-dot port-stat-total"></span> Total: ${total}</span>
    <span class="port-stat"><span class="port-stat-dot port-stat-used"></span> Ocupadas: ${used}</span>
    <span class="port-stat"><span class="port-stat-dot port-stat-free"></span> Livres: ${free}</span>
    ${conflicts ? `<span class="port-stat"><span class="port-stat-dot port-stat-conflict"></span> Conflitos: ${conflicts}</span>` : ''}
  </div>

  <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
    <button class="btn btn-sm ${filter === 'todos' ? 'active' : ''}" data-port-filter="todos">Todas</button>
    <button class="btn btn-sm ${filter === 'ocupadas' ? 'active' : ''}" data-port-filter="ocupadas">Ocupadas</button>
    <button class="btn btn-sm ${filter === 'livres' ? 'active' : ''}" data-port-filter="livres">Livres</button>
    ${conflicts ? `<button class="btn btn-sm ${filter === 'conflito' ? 'active' : ''}" data-port-filter="conflito">Conflitos</button>` : ''}
  </div>

  ${noPort.length ? `<div class="port-warn-box" style="margin-bottom:16px">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <div style="font-size:12px;color:var(--text-secondary)"><strong>${noPort.length}</strong> conexão(ões) deste switch sem porta informada. <a href="javascript:void(0)" data-port-action="show-unassigned" style="color:var(--accent);font-weight:600;text-decoration:none">Atribuir portas →</a></div>
  </div>` : ''}

  ${viewMode === 'grid' ? buildPortGrid(filtered, switchDev) : buildPortTable(filtered, switchDev)}`;
}

// ───────── Grid View ─────────
function buildPortGrid(mapping, switchDev) {
  if (!mapping.length) return `<div class="empty-state" style="padding:24px"><div class="empty-state-title">Nenhuma porta neste filtro</div></div>`;
  return `<div class="port-grid">${mapping.map(p => {
    const status = p.connections.length > 1 ? 'conflict' : p.connections.length === 1 ? 'used' : 'free';
    const conn = p.connections[0];
    const portWan = findWanOnPort(switchDev.id, p.port);
    return `<div class="port-card port-card-${status}${portWan ? ' port-card-wan' : ''}" data-port-num="${p.port}" data-switch-id="${esc(switchDev.id)}" title="Porta ${p.label}${portWan ? ' (WAN)' : ''}">
      <div class="port-card-num">${esc(p.label)}${portWan ? ' <span class="port-wan-badge">WAN</span>' : ''}</div>
      ${conn ? `
        <div class="port-card-dev">${esc(conn.deviceName)}</div>
        <div class="port-card-meta">${esc(conn.tipo)}${conn.vlan ? ' · VLAN ' + esc(conn.vlan) : ''}</div>
      ` : portWan ? `<div class="port-card-dev" style="color:#dc2626">${esc(portWan.nome || portWan.isp || 'WAN')}</div>` : `<div class="port-card-dev port-card-free-label">Livre</div>`}
      ${p.connections.length > 1 ? `<div class="port-card-conflict-text">⚠ ${p.connections.length} conexões</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ───────── Table View ─────────
function buildPortTable(mapping, switchDev) {
  if (!mapping.length) return `<div class="empty-state" style="padding:24px"><div class="empty-state-title">Nenhuma porta neste filtro</div></div>`;
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Porta</th><th>Status</th><th>Dispositivo</th><th>Tipo</th><th>IP</th><th>VLAN</th><th>Velocidade</th><th>Ações</th>
    </tr></thead>
    <tbody>${mapping.map(p => {
      const status = p.connections.length > 1 ? 'conflict' : p.connections.length === 1 ? 'used' : 'free';
      const conn = p.connections[0];
      const portWan = findWanOnPort(switchDev.id, p.port);
      const statusBadge = status === 'conflict'
        ? '<span class="badge badge-danger">Conflito</span>'
        : status === 'used'
        ? '<span class="badge badge-success">Ocupada</span>'
        : '<span class="badge">Livre</span>';
      return `<tr>
        <td style="font-weight:600">${esc(p.label)}${portWan ? ' <span class="port-wan-badge">WAN</span>' : ''}</td>
        <td>${statusBadge}</td>
        <td>${conn ? `<span class="td-name">${esc(conn.deviceName)}</span>` : '—'}</td>
        <td>${conn ? `<span class="badge">${esc(conn.tipo)}</span>` : '—'}</td>
        <td>${conn?.deviceIp || '—'}</td>
        <td>${conn?.vlan || '—'}</td>
        <td>${conn?.velocidade || '—'}</td>
        <td class="td-actions">
          ${conn ? `<button class="btn btn-sm btn-ghost" data-port-action="edit-conn" data-link-id="${esc(conn.linkId)}" title="Editar conexão">Editar</button>
          <button class="btn btn-sm btn-ghost" data-port-action="topo-link" data-link-id="${esc(conn.linkId)}" title="Ver na topologia">🗺️</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-port-action="assign" data-port-num="${p.port}" data-switch-id="${esc(switchDev.id)}" title="${conn ? 'Reatribuir porta' : 'Atribuir conexão'}">📌</button>
        </td>
      </tr>${p.connections.length > 1 ? p.connections.slice(1).map(c => `<tr class="port-conflict-row">
        <td></td>
        <td><span class="badge badge-danger">Duplicado</span></td>
        <td><span class="td-name">${esc(c.deviceName)}</span></td>
        <td><span class="badge">${esc(c.tipo)}</span></td>
        <td>${c.deviceIp || '—'}</td>
        <td>${c.vlan || '—'}</td>
        <td>${c.velocidade || '—'}</td>
        <td class="td-actions">
          <button class="btn btn-sm btn-ghost" data-port-action="edit-conn" data-link-id="${esc(c.linkId)}">Editar</button>
        </td>
      </tr>`).join('') : ''}`;
    }).join('')}</tbody>
  </table></div>`;
}

// ───────── Show Unassigned Connections Modal ─────────
function showUnassignedConnections(switchDev) {
  const links = appState.db.conexoes;
  const devs = appState.db.dispositivos;
  const devById = new Map(devs.map(d => [d.id, d]));
  const switchLinks = links.filter(l => l.deId === switchDev.id || l.paraId === switchDev.id);
  const noPort = switchLinks.filter(l => {
    const isOrigin = l.deId === switchDev.id;
    return !(isOrigin ? l.portaDe : l.portaPara);
  });

  if (!noPort.length) { toast('success', 'Portas', 'Todas as conexões já têm porta atribuída.'); return; }

  const portCount = parseInt(switchDev.portas) || 24;
  const mapping = buildPortMapping(switchDev, links, devs);
  const freePorts = mapping.filter(p => p.connections.length === 0).map(p => p.port);

  const rows = noPort.map(l => {
    const isOrigin = l.deId === switchDev.id;
    const otherDev = devById.get(isOrigin ? l.paraId : l.deId);
    return `<div class="port-assign-row">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px">${esc(otherDev?.nome || '(removido)')}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${esc(l.tipo || 'Cabo')}${l.vlan ? ' · VLAN ' + esc(l.vlan) : ''}</div>
      </div>
      <select class="form-select" style="width:100px" data-assign-link="${esc(l.id)}" data-assign-side="${isOrigin ? 'de' : 'para'}">
        <option value="">—</option>
        ${freePorts.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
    </div>`;
  }).join('');

  openModal({
    title: 'Atribuir portas — ' + switchDev.nome,
    saveLabel: 'Aplicar', wide: true,
    body: `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Selecione a porta para cada conexão sem atribuição.</p>
    <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>`,
    onSave: () => {
      const selects = $$('#modalBody [data-assign-link]');
      let count = 0;
      pushUndo('Atribuir portas', structuredClone(appState.db));
      selects.forEach(sel => {
        const val = sel.value;
        if (!val) return;
        const linkId = sel.dataset.assignLink;
        const side = sel.dataset.assignSide;
        const link = appState.db.conexoes.find(x => x.id === linkId);
        if (!link) return;
        if (side === 'de') link.portaDe = val;
        else link.portaPara = val;
        link.updatedAt = nowISO();
        count++;
      });
      if (count) {
        saveDB(appState.db);
        toast('success', 'Portas', count + ' porta(s) atribuída(s).');
      }
      closeModal();
      render();
    }
  });
}

// ───────── WAN-Port helpers ─────────
function findWanOnPort(deviceId, portNum) {
  return (appState.db.wans || []).find(w => w.dispositivoId === deviceId && String(w.porta) === String(portNum));
}
function isWanCapableDevice(dev) {
  return dev && (dev.tipo === 'Roteador' || dev.tipo === 'Firewall');
}
function buildWanPortSection(switchDev, portNum) {
  if (!isWanCapableDevice(switchDev)) return '';
  const wan = findWanOnPort(switchDev.id, portNum);
  const wans = appState.db.wans || [];
  const wanOpts = wans.map(w => `<option value="${esc(w.id)}" ${wan && wan.id === w.id ? 'selected' : ''}>${esc(w.nome || w.isp || 'WAN ' + w.id.slice(0,6))}</option>`).join('');
  return `
  <div class="wan-port-section">
    <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Função da porta</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <select class="form-select" id="portFuncSel" style="width:120px">
        <option value="LAN" ${!wan ? 'selected' : ''}>LAN</option>
        <option value="WAN" ${wan ? 'selected' : ''}>WAN</option>
      </select>
    </div>
    <div id="portWanFields" style="display:${wan ? 'block' : 'none'}">
      <div class="form-grid" style="margin-top:8px">
        <div class="form-group"><label class="form-label">WAN associada</label>
          <select class="form-select" id="portWanSel"><option value="">Nenhuma</option>${wanOpts}</select>
        </div>
        <div class="form-group"><label class="form-label">Prioridade</label>
          <input class="form-input" id="portWanPrior" type="number" min="1" max="99" value="${wan ? (wan.prioridade || 1) : 1}" />
          <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">1 = primária</div>
        </div>
        <div class="form-group"><label class="form-label">Peso</label>
          <input class="form-input" id="portWanPeso" type="number" min="1" max="100" value="${wan ? (wan.peso || 1) : 1}" />
          <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Balanceamento</div>
        </div>
      </div>
      ${wan ? `<div style="margin-top:4px;font-size:11px;color:var(--text-secondary)">🌐 ${esc(wan.nome || '')} · ${esc(wan.isp || '')} · ${esc(wan.publicIp || wan.ip || '')}</div>` : ''}
    </div>
  </div>`;
}
function bindWanPortEvents(switchDev, portNum) {
  const funcSel = $('#portFuncSel');
  const wanFields = $('#portWanFields');
  if (!funcSel || !wanFields) return;
  funcSel.addEventListener('change', () => {
    wanFields.style.display = funcSel.value === 'WAN' ? 'block' : 'none';
  });
}
function saveWanPortBinding(switchDev, portNum) {
  const funcSel = $('#portFuncSel');
  if (!funcSel || !isWanCapableDevice(switchDev)) return;
  const prevWan = findWanOnPort(switchDev.id, portNum);

  if (funcSel.value === 'LAN') {
    // Remove WAN binding from this port
    if (prevWan) {
      prevWan.porta = '';
      prevWan.updatedAt = nowISO();
    }
    return;
  }
  // WAN mode
  const wanId = $('#portWanSel')?.value;
  const prior = parseInt($('#portWanPrior')?.value) || 1;
  const peso = parseInt($('#portWanPeso')?.value) || 1;

  // Clear previous WAN on this port if different
  if (prevWan && prevWan.id !== wanId) {
    prevWan.porta = '';
    prevWan.updatedAt = nowISO();
  }
  // Set new WAN binding
  if (wanId) {
    const wan = (appState.db.wans || []).find(w => w.id === wanId);
    if (wan) {
      wan.dispositivoId = switchDev.id;
      wan.porta = String(portNum);
      wan.prioridade = prior;
      wan.peso = peso;
      wan.updatedAt = nowISO();
    }
  }
}

// ───────── Port Detail Modal ─────────
function openPortDetail(switchDev, portNum) {
  const links = appState.db.conexoes;
  const devs = appState.db.dispositivos;
  const mapping = buildPortMapping(switchDev, links, devs);
  const port = mapping.find(p => p.port === portNum);
  if (!port) return;

  const devById = new Map(devs.map(d => [d.id, d]));
  const wanSection = buildWanPortSection(switchDev, portNum);

  if (port.connections.length === 0) {
    // Free port — offer to create/assign connection
    const switchLinks = links.filter(l => l.deId === switchDev.id || l.paraId === switchDev.id);
    const noPort = switchLinks.filter(l => {
      const isOrigin = l.deId === switchDev.id;
      return !(isOrigin ? l.portaDe : l.portaPara);
    });

    let assignHTML = '';
    if (noPort.length) {
      assignHTML = `<div style="margin-top:16px"><div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:8px">Atribuir conexão existente</div>
      <select class="form-select" id="portAssignLink"><option value="">Selecione…</option>${noPort.map(l => {
        const isOrigin = l.deId === switchDev.id;
        const other = devById.get(isOrigin ? l.paraId : l.deId);
        return `<option value="${esc(l.id)}" data-side="${isOrigin ? 'de' : 'para'}">${esc(other?.nome || '?')} (${esc(l.tipo || 'Cabo')})</option>`;
      }).join('')}</select></div>`;
    }

    openModal({
      title: `Porta ${portNum} — ${switchDev.nome}`,
      saveLabel: 'Aplicar',
      body: `<div style="text-align:center;padding:16px 0"><div style="font-size:40px;margin-bottom:8px">🔌</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-secondary)">Porta livre</div>
      </div>
      ${wanSection}
      ${assignHTML}
      <div style="margin-top:12px;text-align:center">
        <button class="btn btn-sm" id="portNewConn">Nova conexão nesta porta</button>
      </div>`,
      onSave: () => {
        pushUndo('Atribuir porta', structuredClone(appState.db));
        // Save WAN binding if applicable
        saveWanPortBinding(switchDev, portNum);
        const sel = $('#portAssignLink');
        if (sel && sel.value) {
          const linkId = sel.value;
          const side = sel.selectedOptions[0]?.dataset.side;
          const link = appState.db.conexoes.find(x => x.id === linkId);
          if (link) {
            if (side === 'de') link.portaDe = String(portNum);
            else link.portaPara = String(portNum);
            link.updatedAt = nowISO();
          }
        }
        saveDB(appState.db);
        toast('success', 'Porta', `Porta ${portNum} atualizada.`);
        closeModal(); render();
      }
    });
    setTimeout(() => {
      bindWanPortEvents(switchDev, portNum);
      $('#portNewConn')?.addEventListener('click', () => {
        closeModal();
        setTimeout(() => {
          // Pre-fill connection form with this switch and port
          openLinkForm(null);
          // After modal opens, pre-fill
          setTimeout(() => {
            const fDe = $('#f_de');
            const fPde = $('#f_pde');
            if (fDe) fDe.value = switchDev.id;
            if (fPde) fPde.value = String(portNum);
          }, 150);
        }, 120);
      });
    }, 0);
    return;
  }

  // Port with connections — show detail
  const connHTML = port.connections.map(c => {
    const dev = devById.get(c.deviceId);
    return `<div class="port-detail-conn">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        ${deviceIconSVG(c.deviceTipo, 18)}
        <div>
          <div style="font-weight:600;font-size:13px">${esc(c.deviceName)}</div>
          <div style="font-size:11px;color:var(--text-secondary)">${esc(c.deviceTipo)}${c.deviceIp ? ' · ' + esc(c.deviceIp) : ''}</div>
        </div>
      </div>
      <div class="detail-grid" style="margin:8px 0">
        <div class="detail-grid-item"><div class="detail-grid-label">Tipo</div><div class="detail-grid-value">${esc(c.tipo)}</div></div>
        <div class="detail-grid-item"><div class="detail-grid-label">Velocidade</div><div class="detail-grid-value">${esc(c.velocidade || '—')}</div></div>
        <div class="detail-grid-item"><div class="detail-grid-label">VLAN</div><div class="detail-grid-value">${esc(c.vlan || '—')}</div></div>
        <div class="detail-grid-item"><div class="detail-grid-label">Porta remota</div><div class="detail-grid-value">${esc(c.otherPortStr || '—')}</div></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-sm" data-port-modal-action="edit" data-link-id="${esc(c.linkId)}">Editar conexão</button>
        <button class="btn btn-sm" data-port-modal-action="topo" data-link-id="${esc(c.linkId)}">Ver na topologia</button>
        ${dev ? `<button class="btn btn-sm" data-port-modal-action="detail-dev" data-dev-id="${esc(c.deviceId)}">Detalhes do dispositivo</button>` : ''}
      </div>
    </div>`;
  }).join('<hr class="divider"/>');

  const statusLabel = port.connections.length > 1
    ? `<span class="badge badge-danger">Conflito — ${port.connections.length} conexões</span>`
    : '<span class="badge badge-success">Ocupada</span>';

  openModal({
    title: `Porta ${portNum} — ${switchDev.nome}`,
    saveLabel: wanSection ? 'Salvar' : '', hideFooter: !wanSection, wide: true,
    body: `<div style="margin-bottom:16px">${statusLabel}</div>${connHTML}
    ${wanSection ? `<hr class="divider"/>${wanSection}` : ''}
    <div style="margin-top:16px;border-top:1px solid var(--border-light);padding-top:12px">
      <button class="btn btn-sm" id="portDetailClose">Fechar</button>
    </div>`,
    onSave: wanSection ? () => {
      pushUndo('Função da porta', structuredClone(appState.db));
      saveWanPortBinding(switchDev, portNum);
      saveDB(appState.db);
      toast('success', 'Porta', `Porta ${portNum} atualizada.`);
      closeModal(); render();
    } : null
  });
  setTimeout(() => {
    bindWanPortEvents(switchDev, portNum);
    $('#portDetailClose')?.addEventListener('click', closeModal);
    $$('#modalBody [data-port-modal-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.portModalAction;
        const linkId = btn.dataset.linkId;
        const devId = btn.dataset.devId;
        if (action === 'edit') {
          const l = appState.db.conexoes.find(x => x.id === linkId);
          closeModal(); if (l) setTimeout(() => openLinkForm(l), 120);
        }
        if (action === 'topo') {
          closeModal(); navigateToTopoLink(linkId);
        }
        if (action === 'detail-dev') {
          const d = appState.db.dispositivos.find(x => x.id === devId);
          closeModal(); if (d) setTimeout(() => openDeviceDetail(d), 120);
        }
      });
    });
  }, 0);
}

// ───────── Port Event Binding ─────────
function bindPortEvents() {
  // Switch select
  $$('[data-switch-select]').forEach(el => el.addEventListener('click', () => {
    appState.selectedSwitch = el.dataset.switchSelect;
    render();
  }));

  // View mode toggle
  $$('[data-port-view]').forEach(btn => btn.addEventListener('click', () => {
    appState.portViewMode = btn.dataset.portView;
    render();
  }));

  // Filter
  $$('[data-port-filter]').forEach(btn => btn.addEventListener('click', () => {
    appState.portFilter = btn.dataset.portFilter;
    render();
  }));

  // Port card click (grid)
  $$('.port-card[data-port-num]').forEach(card => card.addEventListener('click', () => {
    const portNum = parseInt(card.dataset.portNum);
    const switchId = card.dataset.switchId;
    const switchDev = appState.db.dispositivos.find(d => d.id === switchId);
    if (switchDev) openPortDetail(switchDev, portNum);
  }));

  // Port actions (table)
  const view = $('#view');
  if (!view) return;
  view.addEventListener('click', e => {
    const btn = e.target.closest('[data-port-action]');
    if (!btn) return;
    const action = btn.dataset.portAction;
    if (action === 'edit-conn') {
      const l = appState.db.conexoes.find(x => x.id === btn.dataset.linkId);
      if (l) openLinkForm(l);
    }
    if (action === 'topo-link') {
      navigateToTopoLink(btn.dataset.linkId);
    }
    if (action === 'assign') {
      const switchId = btn.dataset.switchId;
      const portNum = parseInt(btn.dataset.portNum);
      const switchDev = appState.db.dispositivos.find(d => d.id === switchId);
      if (switchDev) openPortDetail(switchDev, portNum);
    }
    if (action === 'show-unassigned') {
      const switchDev = appState.db.dispositivos.find(d => d.id === appState.selectedSwitch);
      if (switchDev) showUnassignedConnections(switchDev);
    }
  });
}
