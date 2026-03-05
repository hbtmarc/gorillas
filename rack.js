/* ============================================================
   Gorillas — Rack Elevation Planner
   U-based placement, drag-drop, overlap prevention, sync
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
    </div>`: `
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
        </div>`: ""}
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
    const occupiedSet = new Set();
    itens.forEach(it => { for (let u = it.posU; u < it.posU + it.altU; u++)occupiedSet.add(u) });

    let rows = "";
    for (let u = totalU; u >= 1; u--) {
        const item = itens.find(it => it.posU === u);
        const occupied = occupiedSet.has(u) && !item;
        rows += `<div class="rack-u" data-rack-u="${u}">
      <div class="rack-u-label">${u}</div>
      <div class="rack-u-slot" data-slot="${u}">
        ${item ? renderRackItem(item, devById) : ""}
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

function renderRackItem(item, devById) {
    const h = item.altU * 28;
    let color = "#94a3b8", label = item.nome || "";
    const rit = RACK_ITEM_TYPES.find(t => t.key === item.tipo);
    if (rit) color = rit.color;
    if (item.tipo === "device" && item.dispositivoId) {
        const dev = devById.get(item.dispositivoId);
        if (dev) { label = dev.nome; const p = getPresetByTipo(dev.tipo); if (p) color = RACK_ITEM_TYPES[0].color }
    }
    return `<div class="rack-item" style="height:${h}px;background:${color};top:0" data-rackitem-pos="${item.posU}" title="${esc(label)}">${esc(label)}</div>`;
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
            // Clear rack refs from devices
            appState.db.dispositivos.forEach(d => { if (d.rack === id) { d.rack = ""; d.posicaoU = 0 } });
            appState.selectedRack = null;
            saveDB(appState.db); closeModal(); toast("success", "Rack", "Rack excluído."); render();
        }
    });
}

// ───────── Rack Item Placement ─────────
function addRackItem(rackId, tipo, posU) {
    const rack = (appState.db.racks || []).find(r => r.id === rackId); if (!rack) return;
    const rit = RACK_ITEM_TYPES.find(t => t.key === tipo); if (!rit) return;
    const altU = rit.altU;

    // Check overlap
    for (let u = posU; u < posU + altU; u++) {
        if (u > rack.totalU) { toast("error", "Rack", "Posição ultrapassa o limite do rack."); return }
        if (rack.itens.some(it => u >= it.posU && u < it.posU + it.altU)) { toast("error", "Rack", "Posição já ocupada."); return }
    }

    let item = { tipo, posU, altU, nome: rit.label, dispositivoId: "" };

    if (tipo === "device") {
        // Show device picker
        const unracked = appState.db.dispositivos.filter(d => !d.rack && (d.alturaU || 1) > 0);
        if (!unracked.length) { toast("warning", "Rack", "Não há dispositivos disponíveis para alocar."); return }
        openModal({
            title: "Alocar dispositivo na posição U" + posU, saveLabel: "Alocar",
            body: `<div class="form-group"><label class="form-label">Dispositivo</label><select class="form-select" id="f_rdev">${unracked.map(d => `<option value="${esc(d.id)}">${esc(d.nome)} (${d.alturaU || 1}U)</option>`).join("")}</select></div>`,
            onSave: () => {
                const devId = $("#f_rdev").value;
                const dev = appState.db.dispositivos.find(d => d.id === devId); if (!dev) return;
                item.dispositivoId = devId; item.altU = dev.alturaU || 1; item.nome = dev.nome;
                // Re-check overlap with actual altU
                for (let u = posU; u < posU + item.altU; u++) {
                    if (u > rack.totalU || rack.itens.some(it => u >= it.posU && u < it.posU + it.altU)) { toast("error", "Rack", "Espaço insuficiente para este dispositivo."); return }
                }
                pushUndo("Alocar no rack", structuredClone(appState.db));
                rack.itens.push(item);
                dev.rack = rackId; dev.posicaoU = posU;
                saveDB(appState.db); closeModal(); render();
                toast("success", "Rack", dev.nome + " alocado na U" + posU + ".");
            }
        });
        return;
    }

    pushUndo("Adicionar item ao rack", structuredClone(appState.db));
    rack.itens.push(item);
    saveDB(appState.db); render();
    toast("success", "Rack", rit.label + " adicionado na U" + posU + ".");
}

function removeRackItem(rackId, posU) {
    const rack = (appState.db.racks || []).find(r => r.id === rackId); if (!rack) return;
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

// ───────── Rack Event Binding ─────────
function bindRackEvents() {
    // Rack select
    $$("[data-rack-select]").forEach(el => el.addEventListener("click", () => {
        appState.selectedRack = el.dataset.rackSelect; render();
    }));
    // New rack
    $("#btnNewRack")?.addEventListener("click", () => openRackForm(null));
    $("#btnEditRack")?.addEventListener("click", () => {
        const r = (appState.db.racks || []).find(x => x.id === appState.selectedRack); if (r) openRackForm(r);
    });
    $("#btnDelRack")?.addEventListener("click", () => { if (appState.selectedRack) deleteRack(appState.selectedRack) });

    // Click on empty U slot to add item
    const elev = $("#rackElevation");
    if (elev) {
        elev.addEventListener("click", e => {
            const slot = e.target.closest("[data-drop-u]");
            const existingItem = e.target.closest("[data-rackitem-pos]");
            if (existingItem) {
                const posU = parseInt(existingItem.dataset.rackitemPos);
                openModal({
                    title: "Item na posição U" + posU, saveLabel: "", hideFooter: true,
                    body: `<p style="font-size:13px;color:var(--text-secondary)">Deseja remover este item da posição U${posU}?</p>
            <button class="btn btn-danger" id="rmRackItem" style="margin-top:8px">Remover</button>`
                });
                setTimeout(() => { $("#rmRackItem")?.addEventListener("click", () => { closeModal(); removeRackItem(elev.dataset.rackId, posU) }) }, 0);
                return;
            }
            if (!slot) return;
            const u = parseInt(slot.dataset.dropU);
            const rackId = elev.dataset.rackId;
            // Show type picker
            openModal({
                title: "Adicionar item na posição U" + u, saveLabel: "", hideFooter: true,
                body: `<div class="preset-grid">${RACK_ITEM_TYPES.map(t => `<button class="preset-card" type="button" data-add-racktype="${t.key}" data-add-pos="${u}" data-add-rack="${rackId}"><div class="rack-palette-swatch" style="background:${t.color};width:24px;height:24px;border-radius:4px"></div><span class="preset-card-label">${esc(t.label)}</span></button>`).join("")}</div>`
            });
            setTimeout(() => {
                $$("#modalBody [data-add-racktype]").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const tipo = btn.dataset.addRacktype;
                        const pos = parseInt(btn.dataset.addPos);
                        const rid = btn.dataset.addRack;
                        closeModal(); addRackItem(rid, tipo, pos);
                    });
                });
            }, 0);
        });
    }

    // Drag from palette
    $$("#rackPalette [data-rackitem-type]").forEach(el => {
        el.addEventListener("dragstart", e => {
            e.dataTransfer.setData("rackItemType", el.dataset.rackitemType);
            e.dataTransfer.effectAllowed = "copy";
        });
    });
    $$("[data-drop-u]").forEach(zone => {
        zone.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; zone.classList.add("active") });
        zone.addEventListener("dragleave", () => zone.classList.remove("active"));
        zone.addEventListener("drop", e => {
            e.preventDefault(); zone.classList.remove("active");
            const tipo = e.dataTransfer.getData("rackItemType");
            const u = parseInt(zone.dataset.dropU);
            const rackId = $("#rackElevation")?.dataset.rackId;
            if (tipo && rackId) addRackItem(rackId, tipo, u);
        });
    });
}
