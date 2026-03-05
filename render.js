/* ============================================================
   Gorillas — Render Engine, Event Binding, Init
   ============================================================ */

const debouncedSearchDev = debounce(v => { appState.searchDevices = v; render() }, 200);
const debouncedSearchLink = debounce(v => { appState.searchLinks = v; render() }, 200);

// ───────── Render ─────────
function render() {
    appState.route = routeFromHash();
    setActiveNav(appState.route);
    const view = $("#view");
    let html = "";
    if (appState.route === "/painel") html = pagePainel();
    else if (appState.route === "/dispositivos") html = pageDispositivos();
    else if (appState.route === "/conexoes") html = pageConexoes();
    else if (appState.route === "/topologia") html = pageTopologia();
    else if (appState.route === "/redes") html = pageRedes();
    else if (appState.route === "/racks") html = pageRacks();
    else if (appState.route === "/configuracoes") html = pageConfiguracoes();
    else html = `<div class="card"><div class="card-header"><div><h2 class="card-title">Página não encontrada</h2></div></div><button class="btn" type="button" id="goHome">Voltar ao painel</button></div>`;

    // Topology uses wide layout
    if (appState.route === "/topologia" || appState.route === "/racks") { view.classList.add("wide") } else { view.classList.remove("wide") }

    view.innerHTML = html;
    updateSyncDot();
    bindEvents();

    // Page-specific post-render
    if (appState.route === "/configuracoes") loadBackupList();
    if (appState.route === "/topologia") renderTopo();
    if (appState.route === "/racks") bindRackEvents();
    if (appState.route === "/redes") bindNetworkEvents();
    if (appState.route === "/painel") renderDashTopo();

    // Hide inspector on non-topology pages
    if (appState.route !== "/topologia") { hideInspector(); appState.topoSelected = null }
}

// ───────── Event Binding ─────────
function bindEvents() {
    // Dashboard
    $("#dashNewDev")?.addEventListener("click", () => openPresetPicker());
    $("#dashTemplate")?.addEventListener("click", () => openTemplatePicker());
    $("#goHome")?.addEventListener("click", () => navigate("/painel"));

    // Clickable stat cards (dashboard)
    $$("[data-filter-tipo]").forEach(c => c.addEventListener("click", () => {
        appState.deviceFilter.tipo = c.dataset.filterTipo; appState.deviceFilter.local = ""; navigate("/dispositivos");
    }));
    $$("[data-filter-local]").forEach(c => c.addEventListener("click", () => {
        appState.deviceFilter.local = c.dataset.filterLocal; appState.deviceFilter.tipo = ""; navigate("/dispositivos");
    }));

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

    // Topologia controls
    $("#topoToggleEdit")?.addEventListener("click", () => { appState.topoEditMode = !appState.topoEditMode; render() });
    $("#topoToggleSnap")?.addEventListener("click", () => { appState.topoSnapGrid = !appState.topoSnapGrid; render() });
    $("#topoAutoLayout")?.addEventListener("click", performAutoLayout);
    $("#topoFit")?.addEventListener("click", topoFitView);

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

    // Undo button
    $("#btnUndo")?.addEventListener("click", performUndo);

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

    // Delegated actions (devices, links, backups)
    $("#view")?.addEventListener("click", e => {
        const btn = e.target.closest("[data-action]"); if (!btn) return;
        const action = btn.dataset.action, id = btn.dataset.id;
        if (action === "detail-dev") { const d = appState.db.dispositivos.find(x => x.id === id); if (d) openDeviceDetail(d) }
        if (action === "edit-dev") { const d = appState.db.dispositivos.find(x => x.id === id); if (d) openDeviceForm(d) }
        if (action === "del-dev") deleteDevice(id);
        if (action === "edit-link") { const l = appState.db.conexoes.find(x => x.id === id); if (l) openLinkForm(l) }
        if (action === "del-link") deleteLink(id);
        if (action === "topo-link") navigateToTopoLink(id);
        if (action === "restore-backup") {
            openModal({
                title: "Restaurar backup", saveLabel: "Restaurar", saveClass: "btn-primary",
                body: `<p style="font-size:13px;color:var(--text-secondary)">Os dados atuais serão substituídos por este backup. Deseja continuar?</p>`,
                onSave: async () => {
                    pushUndo("Antes de restaurar backup", structuredClone(appState.db));
                    await Backups.create("Antes de restaurar");
                    const s = await Backups.restore(Number(id));
                    closeModal(); toast("success", "Restaurado", "Backup '" + s.name + "' restaurado."); render();
                }
            });
        }
        if (action === "del-backup") { Backups.remove(Number(id)).then(() => { toast("success", "Excluído", "Backup removido."); loadBackupList() }) }
    });

    // Preset picker delegation (shared between pages)
    $("#modalBody")?.addEventListener("click", e => {
        const card = e.target.closest("[data-preset]");
        if (card) {
            const preset = PRESETS.find(p => p.key === card.dataset.preset);
            closeModal(); setTimeout(() => openDeviceForm(null, preset), 100);
            return;
        }
        const tpl = e.target.closest("[data-template]");
        if (tpl) {
            applyTemplate(tpl.dataset.template);
            return;
        }
    });

    // Keyboard: Delete selected in topology
    if (appState.route === "/topologia") {
        const keyHandler = e => {
            if (modal.open) return;
            if (e.key === "Delete" && appState.topoSelected) {
                e.preventDefault();
                if (appState.topoSelected.type === "device") deleteDevice(appState.topoSelected.id);
                else if (appState.topoSelected.type === "link") deleteLink(appState.topoSelected.id);
            }
            if (e.key === "Escape" && appState.topoSelected) {
                appState.topoSelected = null; appState.topoHighlight = null; hideInspector(); renderTopo();
            }
        };
        document.addEventListener("keydown", keyHandler);
        const origHash = location.hash;
        const check = () => { if (location.hash !== origHash) document.removeEventListener("keydown", keyHandler) };
        window.addEventListener("hashchange", check, { once: true });
    }
}

// ───────── File Import Handlers ─────────
$("#fileImportData").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importData(f) });
$("#fileImportBackups").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const fr = new FileReader(); fr.onload = async () => { try { await Backups.importAll(fr.result); toast("success", "Backups", "Backups importados."); if (appState.route === "/configuracoes") loadBackupList() } catch (err) { toast("error", "Erro", "Arquivo de backups inválido.") } }; fr.readAsText(f) });

// ───────── Init ─────────
if (!location.hash) location.hash = "#/painel";
appState.db = loadCache();
render();
initFirebase();
