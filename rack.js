/* ============================================================
   Gorillas — Rack Elevation Planner v2
   U-based placement, drag-drop, overlap prevention, move, details
   ============================================================ */

// ───────── Page: Racks ─────────
function pageRacks() {
  const racks = appState.db.racks || [];
  const sel = appState.selectedRack;
  const rackObj = sel ? racks.find(r => r.id === sel) : null;

  let listHTML = racks.map(r => `
    <div class="rack-palette-item ${sel === r.id ? "active" : ""}" data-rack-select="${esc(r.id)}" style="${sel === r.id ? "border-color:var(--accent);background:var(--accent-bg)" : ""}">
      <div class="rack-palette-swatch" style="background:#2d3748"></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.nome)}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${r.totalU}U · ${esc(r.local || "—")}</div>
      </div>
    </div>`).join("");

  return `
  <div class="card">
    <div class="card-header">
      <div><h2 class="card-title">Racks</h2><p class="card-desc">Planeje a disposição física dos equipamentos nos racks.</p></div>
      <div class="card-actions"><button class="btn btn-primary" type="button" id="btnNewRack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Novo rack</button></div>
    </div>
    ${!racks.length ? `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
      <div class="empty-state-title">Nenhum rack cadastrado</div>
      <div class="empty-state-desc">Crie um rack para começar a alocar os equipamentos.</div>
    </div>` : `
    <div class="rack-layout">
      <div class="rack-sidebar">
        <div style="margin-bottom:12px;font-size:12px;font-weight:600;color:var(--text-secondary)">RACKS</div>
        ${listHTML}
        <hr class="divider"/>
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">ITENS</div>
        <div class="rack-palette" id="rackPalette">
          ${RACK_ITEM_TYPES.map(t => `<div class="rack-palette-item" data-rackitem-type="${t.key}" draggable="true"><div class="rack-palette-swatch" style="background:${t.color}"></div>${esc(t.label)} (${t.altU}U)</div>`).join("")}
        </div>
        ${rackObj ? `<hr class="divider"/><div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" id="btnEditRack">Editar</button>
          <button class="btn btn-sm btn-danger" id="btnDelRack">Excluir</button>
        </div>` : ""}
      </div>
      <div class="rack-view">
        ${rackObj ? buildRackElevation(rackObj) : `<div class="empty-state" style="padding:40px"><div class="empty-state-title">Selecione um rack</div><div class="empty-state-desc">Clique em um rack à esquerda para ver a elevação.</div></div>`}
      </div>
    </div>`}
  </div>`;
}

// ───────── Rack Elevation Builder ─────────
function buildRackElevation(rack) {
  const totalU = rack.totalU || 24;
  const itens = rack.itens || [];
  const devById = new Map(appState.db.dispositivos.map(d => [d.id, d]));
  const wanById = new Map((appState.db.wans || []).map(w => [w.id, w]));
  // Build occupied map: u -> item that starts at or covers this U
  if (!rack.itens) rack.itens = []; // defensive init
  const occupiedMap = new Map();
  itens.forEach(it => { for (let u = it.posU; u < it.posU + it.altU; u++) occupiedMap.set(u, it) });

  let rows = "";
  for (let u = totalU; u >= 1; u--) {
    const item = itens.find(it => it.posU === u);
    const coveredBy = occupiedMap.get(u);
    const occupied = coveredBy && !item; // covered by multi-U item starting below
    rows += `<div class="rack-u" data-rack-u="${u}">
      <div class="rack-u-label">${u}</div>
      <div class="rack-u-slot" data-slot="${u}">
        ${item ? renderRackItem(item, devById, wanById) : ""}
        ${!occupied && !item ? `<div class="rack-drop-zone" data-drop-u="${u}"></div>` : ""}
      </div>
    </div>`;
  }

  return `
  <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
    <div><strong>${esc(rack.nome)}</strong> <span class="badge">${totalU}U</span> <span class="badge">${esc(rack.local || "—")}</span></div>
    <span class="badge">${itens.length} item(ns)</span>
  </div>
  <div class="rack-elevation" id="rackElevation" data-rack-id="${esc(rack.id)}" style="width:100%;max-width:500px">
    ${rows}
  </div>`;
}

function renderRackItem(item, devById, wanById) {
  const h = item.altU * 28;
  let color = '#94a3b8', label = item.nome || '';
  const rit = RACK_ITEM_TYPES.find(t => t.key === item.tipo);
  if (rit) color = rit.color;
  if (item.tipo === 'wan') {
    color = '#ef4444';
    if (item.wanId) {
      const wan = wanById?.get(item.wanId);
      if (wan) label = `WAN · ${wan.nome || wan.isp || 'Link'}`;
    }
  }
  if (item.tipo === 'device' && item.dispositivoId) {
    const dev = devById.get(item.dispositivoId);
    if (dev) { label = dev.nome; color = RACK_ITEM_TYPES[0].color }
  }
  return `<div class="rack-item" style="height:${h}px;background:${color};bottom:0" data-rackitem-pos="${item.posU}" data-rackitem-altu="${item.altU}" draggable="true" title="${esc(label)}">
    <span class="rack-item-grip">⠿</span> ${esc(label)}
  </div>`;
}

// ───────── Rack CRUD ─────────
function openRackForm(existing) {
  const isEdit = !!existing;
  const r = existing || newRack();
  openModal({
    title: isEdit ? "Editar rack" : "Novo rack", saveLabel: isEdit ? "Salvar" : "Criar",
    body: `<div class="form-grid">
    <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f_rname" placeholder="Rack principal…" value="${esc(r.nome)}"/></div>
    <div class="form-group"><label class="form-label">Local</label><input class="form-input" id="f_rlocal" placeholder="Sala técnica, cozinha…" value="${esc(r.local)}"/></div>
    <div class="form-group"><label class="form-label">Altura total (U)</label><select class="form-select" id="f_rtotalu">${[12, 24, 36, 42, 48].map(u => `<option value="${u}" ${u === r.totalU ? "selected" : ""}>${u}U</option>`).join("")}</select></div>
    <div class="form-group full"><label class="form-label">Observações</label><input class="form-input" id="f_rnotas" value="${esc(r.notas)}"/></div>
  </div>`,
    onSave: () => {
      const nome = $("#f_rname").value.trim();
      if (!nome) { toast("error", "Validação", "Informe um nome."); return }
      pushUndo(isEdit ? "Edição rack" : "Antes de criar rack", structuredClone(appState.db));
      const payload = { ...r, nome, local: $("#f_rlocal").value.trim(), totalU: parseInt($("#f_rtotalu").value) || 24, notas: $("#f_rnotas").value.trim(), updatedAt: nowISO() };
      if (!payload.createdAt) payload.createdAt = nowISO();
      if (isEdit) { const i = (appState.db.racks || []).findIndex(x => x.id === r.id); if (i >= 0) appState.db.racks[i] = payload; toast("success", "Rack", "Rack atualizado.") }
      else { if (!appState.db.racks) appState.db.racks = []; appState.db.racks.push(payload); appState.selectedRack = payload.id; toast("success", "Rack", "Rack criado.") }
      saveDB(appState.db); closeModal(); render();
    }
  });
}

function deleteRack(id) {
  openModal({
    title: "Excluir rack", saveLabel: "Excluir", saveClass: "btn-danger",
    body: `<p style="font-size:13px;color:var(--text-secondary)">O rack e seus itens serão removidos. Os dispositivos não serão excluídos.</p>`,
    onSave: () => {
      pushUndo("Excluir rack", structuredClone(appState.db));
      appState.db.racks = (appState.db.racks || []).filter(r => r.id !== id);
      appState.db.dispositivos.forEach(d => { if (d.rack === id) { d.rack = ""; d.posicaoU = 0 } });
      appState.selectedRack = null;
      saveDB(appState.db); closeModal(); toast("success", "Rack", "Rack excluído."); render();
    }
  });
}

// ───────── Rack Item Placement ─────────
function addRackItem(rackId, tipo, posU) {
  const rack = (appState.db.racks || []).find(r => r.id === rackId); if (!rack) return;
  if (!rack.itens) rack.itens = []; // defensive init
  const rit = RACK_ITEM_TYPES.find(t => t.key === tipo); if (!rit) return;
  const altU = rit.altU;

  // Check overlap
  for (let u = posU; u < posU + altU; u++) {
    if (u > rack.totalU) { toast('error', 'Rack', 'Posição ultrapassa o limite do rack.'); return }
    if (rack.itens.some(it => u >= it.posU && u < it.posU + it.altU)) { toast('error', 'Rack', 'Posição já ocupada.'); return }
  }

  if (tipo === 'device') {
    // Show device picker (with WAN-only option)
    const unracked = appState.db.dispositivos.filter(d => !d.rack && (d.alturaU || 1) > 0);
    const wanDeviceIdSet = new Set((appState.db.wans || []).map(w => w.dispositivoId).filter(Boolean));
    const WAN_RECEIVER_TYPES = new Set(['Firewall', 'Roteador', 'Modem ISP']);
    const unrackedWan = unracked.filter(d => wanDeviceIdSet.has(d.id) || WAN_RECEIVER_TYPES.has(d.tipo));
    const existingWanIds = new Set((rack.itens || []).map(it => it.wanId).filter(Boolean));
    const existingDeviceIds = new Set((rack.itens || []).map(it => it.dispositivoId).filter(Boolean));
    const wanOptions = (appState.db.wans || []).filter(w => !existingWanIds.has(w.id)).map(w => {
      const dev = appState.db.dispositivos.find(d => d.id === w.dispositivoId);
      const devName = dev?.nome ? ` · ${dev.nome}` : '';
      const port = w.porta ? ` · P${w.porta}` : '';
      return {
        value: `wan:${w.id}`,
        label: `WAN · ${w.nome || w.isp || 'Link'}${devName}${port}`
      };
    });
    if (!unracked.length && !wanOptions.length) { toast('warning', 'Rack', 'Não há dispositivos ou WANs disponíveis para alocar.'); return }
    // Small delay to let previous modal close fully
    setTimeout(() => {
      openModal({
        title: 'Alocar dispositivo na posição U' + posU, saveLabel: 'Alocar',
        body: `<div class="form-group"><label class="form-check"><input type="checkbox" id="f_rwanonly"/> Somente WANs (borda: firewall/roteador/modem)</label></div>
        <div class="form-group"><label class="form-label">Dispositivo</label><select class="form-select" id="f_rdev"></select>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px" id="f_rdev_hint"></div></div>`,
        onSave: () => {
          const devId = $('#f_rdev').value;
          if (!devId) { toast('warning', 'Rack', 'Selecione um item para alocar.'); return; }

          if (devId.startsWith('wan:')) {
            const wanId = devId.slice(4);
            const wan = (appState.db.wans || []).find(w => w.id === wanId);
            if (!wan) { toast('error', 'Rack', 'WAN não encontrada.'); return; }
            if ((rack.itens || []).some(it => it.wanId === wan.id)) {
              toast('warning', 'Rack', 'Esta WAN já foi adicionada no rack.');
              return;
            }
            const item = { tipo: 'wan', posU, altU: 1, nome: `WAN · ${wan.nome || wan.isp || 'Link'}`, dispositivoId: '', wanId: wan.id };
            if (rack.itens.some(it => posU >= it.posU && posU < it.posU + it.altU)) {
              toast('error', 'Rack', 'Posição já ocupada.'); return;
            }
            pushUndo('Alocar WAN no rack', structuredClone(appState.db));
            rack.itens.push(item);
            saveDB(appState.db); closeModal(); render();
            toast('success', 'Rack', (wan.nome || wan.isp || 'WAN') + ' alocada na U' + posU + '.');
            return;
          }

          const dev = appState.db.dispositivos.find(d => d.id === devId); if (!dev) return;
          if (existingDeviceIds.has(dev.id)) {
            toast('warning', 'Rack', 'Este dispositivo já foi adicionado no rack.');
            return;
          }
          const item = { tipo, posU, altU: dev.alturaU || 1, nome: dev.nome, dispositivoId: devId };
          for (let u = posU; u < posU + item.altU; u++) {
            if (u > rack.totalU || rack.itens.some(it => u >= it.posU && u < it.posU + it.altU)) {
              toast('error', 'Rack', 'Espaço insuficiente para este dispositivo.'); return;
            }
          }
          pushUndo('Alocar no rack', structuredClone(appState.db));
          rack.itens.push(item);
          dev.rack = rackId; dev.posicaoU = posU;
          saveDB(appState.db); closeModal(); render();
          toast('success', 'Rack', dev.nome + ' alocado na U' + posU + '.');
        }
      });
      setTimeout(() => {
        const chk = $('#f_rwanonly');
        const sel = $('#f_rdev');
        const hint = $('#f_rdev_hint');
        const renderOptions = (wanOnly) => {
          const list = wanOnly
            ? wanOptions.map(w => ({ value: w.value, text: w.label }))
            : unracked.map(d => {
              const wanTag = wanDeviceIdSet.has(d.id) ? ' · WAN' : '';
              return { value: d.id, text: `${d.nome} (${d.alturaU || 1}U${wanTag})` };
            });
          sel.innerHTML = list.map(o => `<option value="${esc(o.value)}">${esc(o.text)}</option>`).join('');
          if (!list.length) {
            sel.innerHTML = '';
            hint.textContent = wanOnly
              ? 'Nenhuma WAN cadastrada para alocar.'
              : 'Nenhum dispositivo disponível.';
          } else {
            hint.textContent = wanOnly
              ? `${list.length} WAN(s) disponível(is).`
              : `${list.length} dispositivo(s) disponível(is).`;
          }
        };
        if (chk && sel && hint) {
          renderOptions(false);
          chk.addEventListener('change', () => renderOptions(chk.checked));
        }
      }, 0);
    }, 100);
    return;
  }

  // Non-device items: add directly
  const item = { tipo, posU, altU, nome: rit.label, dispositivoId: '' };
  pushUndo('Adicionar item ao rack', structuredClone(appState.db));
  rack.itens.push(item);
  saveDB(appState.db); render();
  toast('success', 'Rack', rit.label + ' adicionado na U' + posU + '.');
}

function removeRackItem(rackId, posU) {
  const rack = (appState.db.racks || []).find(r => r.id === rackId); if (!rack) return;
  if (!rack.itens) rack.itens = [];
  const item = rack.itens.find(it => it.posU === posU); if (!item) return;
  pushUndo("Remover item do rack", structuredClone(appState.db));
  rack.itens = rack.itens.filter(it => it.posU !== posU);
  if (item.dispositivoId) {
    const dev = appState.db.dispositivos.find(d => d.id === item.dispositivoId);
    if (dev) { dev.rack = ""; dev.posicaoU = 0 }
  }
  saveDB(appState.db); render();
  toast("success", "Rack", "Item removido.");
}

function moveRackItem(rackId, fromU, toU) {
  const rack = (appState.db.racks || []).find(r => r.id === rackId); if (!rack) return;
  if (!rack.itens) rack.itens = [];
  const item = rack.itens.find(it => it.posU === fromU); if (!item) return;
  // Check overlap at target (excluding self)
  for (let u = toU; u < toU + item.altU; u++) {
    if (u > rack.totalU || u < 1) { toast("error", "Rack", "Posição fora do limite."); return }
    if (rack.itens.some(it => it.posU !== fromU && u >= it.posU && u < it.posU + it.altU)) {
      toast("error", "Rack", "Posição já ocupada."); return;
    }
  }
  pushUndo("Mover item no rack", structuredClone(appState.db));
  item.posU = toU;
  if (item.dispositivoId) {
    const dev = appState.db.dispositivos.find(d => d.id === item.dispositivoId);
    if (dev) dev.posicaoU = toU;
  }
  saveDB(appState.db); render();
  toast("success", "Rack", "Item movido para U" + toU + ".");
}

// ───────── Rack Item Detail Modal (G) ─────────
function openRackItemDetail(rackId, posU) {
  const rack = (appState.db.racks || []).find(r => r.id === rackId); if (!rack) return;
  if (!rack.itens) rack.itens = [];
  const item = rack.itens.find(it => it.posU === posU); if (!item) return;
  const rit = RACK_ITEM_TYPES.find(t => t.key === item.tipo);
  const devById = new Map(appState.db.dispositivos.map(d => [d.id, d]));
  const wanById = new Map((appState.db.wans || []).map(w => [w.id, w]));
  const dev = item.dispositivoId ? devById.get(item.dispositivoId) : null;
  const wan = item.wanId ? wanById.get(item.wanId) : null;
  const label = dev ? dev.nome : item.nome;
  const tipoLabel = item.tipo === 'wan' ? 'WAN' : (rit ? rit.label : item.tipo);

  openModal({
    title: 'Detalhes do item', saveLabel: '', hideFooter: true,
    body: `
        <div style="margin-bottom:16px">
          <div style="font-size:15px;font-weight:700;margin-bottom:4px">${esc(label)}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${esc(tipoLabel)} · Posição U${posU} · ${item.altU}U de altura</div>
          ${dev ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${esc(dev.tipo || '')}${dev.ip ? ' · ' + esc(dev.ip) : ''}</div>` : ''}
          ${wan ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${esc(wan.isp || '')}${wan.porta ? ' · Porta ' + esc(wan.porta) : ''}</div>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px">ℹ️ Arraste o item para mover entre posições.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-danger" id="rackItemRemove">Remover</button>
          <button class="btn btn-sm" id="rackItemClose" style="margin-left:auto">Fechar</button>
        </div>`
  });
  setTimeout(() => {
    $('#rackItemRemove')?.addEventListener('click', () => { closeModal(); removeRackItem(rackId, posU) });
    $('#rackItemClose')?.addEventListener('click', closeModal);
  }, 0);
}

// ───────── Rack Event Binding ─────────
function bindRackEvents() {
  // Rack select
  $$('[data-rack-select]').forEach(el => el.addEventListener('click', () => {
    appState.selectedRack = el.dataset.rackSelect; render();
  }));
  $('#btnNewRack')?.addEventListener('click', () => openRackForm(null));
  $('#btnEditRack')?.addEventListener('click', () => {
    const r = (appState.db.racks || []).find(x => x.id === appState.selectedRack); if (r) openRackForm(r);
  });
  $('#btnDelRack')?.addEventListener('click', () => { if (appState.selectedRack) deleteRack(appState.selectedRack) });

  const elev = $('#rackElevation');
  if (!elev) return;
  const rackId = elev.dataset.rackId;

  // ── Click handler: items open detail, empty slots open type picker ──
  elev.addEventListener('click', e => {
    if (elev._justDragged) { elev._justDragged = false; return; }

    const existingItem = e.target.closest('[data-rackitem-pos]');
    const slot = e.target.closest('[data-drop-u]');

    if (existingItem) {
      openRackItemDetail(rackId, parseInt(existingItem.dataset.rackitemPos));
      return;
    }
    if (!slot) return;
    const u = parseInt(slot.dataset.dropU);
    openModal({
      title: 'Adicionar item na posição U' + u, saveLabel: '', hideFooter: true,
      body: `<div class="preset-grid">${RACK_ITEM_TYPES.map(t => `<button class="preset-card" type="button" data-add-racktype="${t.key}" data-add-pos="${u}" data-add-rack="${rackId}"><div class="rack-palette-swatch" style="background:${t.color};width:24px;height:24px;border-radius:4px"></div><span class="preset-card-label">${esc(t.label)}</span></button>`).join('')}</div>`
    });
    setTimeout(() => {
      $$('#modalBody [data-add-racktype]').forEach(btn => {
        btn.addEventListener('click', () => {
          closeModal(); addRackItem(rackId, btn.dataset.addRacktype, parseInt(btn.dataset.addPos));
        });
      });
    }, 0);
  });

  // ── Drag from palette to add new items ──
  $$('#rackPalette [data-rackitem-type]').forEach(el => {
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('rackItemType', el.dataset.rackitemType);
      e.dataTransfer.effectAllowed = 'copy';
    });
  });

  // ── Drag-to-move: items are draggable, every U row is a drop target ──
  const allURows = $$('#rackElevation .rack-u');
  let dragFromU = null;
  let dragAltU = 1;

  // Make items draggable
  $$('[data-rackitem-pos]').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragFromU = parseInt(el.dataset.rackitemPos);
      dragAltU = parseInt(el.dataset.rackitemAltu) || 1;
      e.dataTransfer.setData('rackMoveFrom', String(dragFromU));
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('rack-item-dragging');
      setTimeout(() => elev.classList.add('rack-dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('rack-item-dragging');
      elev.classList.remove('rack-dragging');
      clearAllDropHighlights();
      dragFromU = null;
    });
  });

  function clearAllDropHighlights() {
    allURows.forEach(row => {
      row.classList.remove('rack-u-drop-valid', 'rack-u-drop-invalid');
    });
  }

  function canDropAt(toU) {
    const rack = (appState.db.racks || []).find(r => r.id === rackId); if (!rack) return false;
    if (!rack.itens) rack.itens = [];
    for (let u = toU; u < toU + dragAltU; u++) {
      if (u > rack.totalU || u < 1) return false;
      if (rack.itens.some(it => it.posU !== dragFromU && u >= it.posU && u < it.posU + it.altU)) return false;
    }
    return true;
  }

  // Every U row is a drop target
  allURows.forEach(row => {
    const u = parseInt(row.dataset.rackU);

    row.addEventListener('dragover', e => {
      e.preventDefault();
      const isMove = dragFromU !== null;
      e.dataTransfer.dropEffect = isMove ? 'move' : 'copy';

      if (isMove) {
        clearAllDropHighlights();
        const valid = canDropAt(u);
        const rack = (appState.db.racks || []).find(r => r.id === rackId);
        const maxU = rack ? rack.totalU : 48;
        for (let i = u; i < u + dragAltU && i <= maxU; i++) {
          const targetRow = elev.querySelector(`[data-rack-u="${i}"]`);
          if (targetRow) targetRow.classList.add(valid ? 'rack-u-drop-valid' : 'rack-u-drop-invalid');
        }
      }
    });

    row.addEventListener('dragleave', e => {
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove('rack-u-drop-valid', 'rack-u-drop-invalid');
      }
    });

    row.addEventListener('drop', e => {
      e.preventDefault();
      clearAllDropHighlights();
      elev.classList.remove('rack-dragging');

      // Palette drops
      const paletteType = e.dataTransfer.getData('rackItemType');
      if (paletteType && rackId) { addRackItem(rackId, paletteType, u); return; }

      // Move drops
      const moveFrom = e.dataTransfer.getData('rackMoveFrom');
      if (moveFrom) {
        const fromU = parseInt(moveFrom);
        if (fromU !== u && canDropAt(u)) {
          elev._justDragged = true;
          moveRackItem(rackId, fromU, u);
        }
      }
    });
  });

  // Keep empty drop zones functional for palette items
  $$('[data-drop-u]').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = dragFromU !== null ? 'move' : 'copy';
      zone.classList.add('drag-active');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-active'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-active');
      const tipo = e.dataTransfer.getData('rackItemType');
      if (tipo && rackId) addRackItem(rackId, tipo, parseInt(zone.dataset.dropU));
    });
  });
}
