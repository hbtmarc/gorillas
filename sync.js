/* ============================================================
   Gorillas — SyncEngine
   Durable IndexedDB queue, silent auto-sync on reconnect,
   entity-level merge (last-write-wins by updatedAt)
   ============================================================ */

const SyncEngine = {
  DB_NAME: 'gorillas_sync',
  QUEUE_STORE: 'queue',
  META_STORE: 'meta',
  VER: 1,
  _db: null,

  // ───────── IndexedDB helpers ─────────
  _open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.QUEUE_STORE)) {
          db.createObjectStore(this.QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(this.META_STORE)) {
          db.createObjectStore(this.META_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },

  // ───────── Queue operations ─────────
  async enqueue(collection, entityId, op) {
    try {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.QUEUE_STORE, 'readwrite');
        tx.objectStore(this.QUEUE_STORE).add({
          collection: collection || 'data',
          entityId: entityId || '',
          op: op || 'update',
          timestamp: new Date().toISOString()
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { console.warn('[sync] enqueue:', e.message); }
  },

  async hasPending() {
    try {
      const db = await this._open();
      return new Promise(resolve => {
        const req = db.transaction(this.QUEUE_STORE, 'readonly')
          .objectStore(this.QUEUE_STORE).count();
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      });
    } catch { return false; }
  },

  async getQueue() {
    try {
      const db = await this._open();
      return new Promise(resolve => {
        const req = db.transaction(this.QUEUE_STORE, 'readonly')
          .objectStore(this.QUEUE_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch { return []; }
  },

  async clearQueue() {
    try {
      const db = await this._open();
      return new Promise(resolve => {
        const tx = db.transaction(this.QUEUE_STORE, 'readwrite');
        tx.objectStore(this.QUEUE_STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch { /* silent */ }
  },

  async setMeta(key, value) {
    try {
      const db = await this._open();
      return new Promise(resolve => {
        const tx = db.transaction(this.META_STORE, 'readwrite');
        tx.objectStore(this.META_STORE).put({ key, value });
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch { /* silent */ }
  },

  async getMeta(key) {
    try {
      const db = await this._open();
      return new Promise(resolve => {
        const req = db.transaction(this.META_STORE, 'readonly')
          .objectStore(this.META_STORE).get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  },

  // ───────── Merge (last-write-wins per entity by updatedAt) ─────────
  COLLECTIONS: ['dispositivos', 'conexoes', 'wans', 'vpns', 'wifis', 'vlans', 'racks'],

  mergeDB(local, remote) {
    if (!remote || typeof remote !== 'object') return local;
    if (!local || typeof local !== 'object') return migrateDB(remote);
    const merged = structuredClone(local);

    for (const col of this.COLLECTIONS) {
      const lArr = local[col] || [];
      const rArr = remote[col] || [];
      if (!rArr.length && !lArr.length) continue;

      const lMap = new Map(lArr.map(i => [i.id, i]));
      const rMap = new Map(rArr.map(i => [i.id, i]));
      const allIds = new Set([...lMap.keys(), ...rMap.keys()]);
      const result = [];

      for (const id of allIds) {
        const l = lMap.get(id);
        const r = rMap.get(id);
        if (l && r) {
          // Deterministic: newer updatedAt wins; on tie, pick remote (canonical)
          result.push((r.updatedAt || '') >= (l.updatedAt || '') ? r : l);
        } else {
          result.push(l || r);
        }
      }
      merged[col] = result;
    }

    // Meta: take newer
    if ((remote.meta?.updatedAt || '') > (local.meta?.updatedAt || '')) {
      merged.meta = { ...local.meta, ...remote.meta };
    }
    return merged;
  },

  // ───────── Push: immediate attempt if online ─────────
  async pushIfOnline(db) {
    if (!navigator.onLine) return;
    if (typeof dbRef === 'undefined') return;
    try {
      await dbRef.set(db);
      await this.clearQueue();
      await this.setMeta('lastSyncAt', nowISO());
      console.log('[sync] pushed');
    } catch (e) {
      console.warn('[sync] push deferred:', e.message);
    }
  },

  // ───────── Full sync (reconnect) ─────────
  async syncNow() {
    if (!navigator.onLine) return;
    if (typeof dbRef === 'undefined') return;
    try {
      const pending = await this.hasPending();
      if (!pending) return;
      await dbRef.set(appState.db);
      await this.clearQueue();
      await this.setMeta('lastSyncAt', nowISO());
      console.log('[sync] synced on reconnect');
    } catch (e) {
      console.warn('[sync] retry failed:', e.message);
    }
  },

  // ───────── Handle incoming remote data ─────────
  async handleRemoteUpdate(remoteData) {
    if (!remoteData || typeof remoteData !== 'object') return;
    const migrated = migrateDB(remoteData);
    const pending = await this.hasPending();

    if (pending) {
      // Local changes pending — merge, local newer items win
      const merged = this.mergeDB(appState.db, migrated);
      const localStr = JSON.stringify(appState.db);
      const mergedStr = JSON.stringify(merged);
      if (mergedStr !== localStr) {
        appState.db = merged;
        saveCache(merged);
        render();
      }
      // Push our merged state
      this.syncNow();
    } else {
      // No pending changes — accept remote if different
      const localStr = JSON.stringify(appState.db);
      const remoteStr = JSON.stringify(migrated);
      if (remoteStr !== localStr) {
        appState.db = migrated;
        saveCache(migrated);
        render();
      }
    }
  },

  // ───────── Init ─────────
  init() {
    window.addEventListener('online', () => {
      console.log('[sync] reconnected');
      this.syncNow();
    });
    // Attempt initial sync after short delay
    setTimeout(() => { if (navigator.onLine) this.syncNow(); }, 3000);
  }
};
