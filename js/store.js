/* "Mis puntos" persistence. Key and record shape are a compatibility contract with points already saved in
   users' browsers and with exported files: {id, name, legend, color, lat, lon}. */
(function (root) {
  const KEY = 'lahar_puntos_v1', SEED_KEY = 'lahar_seeded_v1';
  const HEX = /^#[0-9a-f]{6}$/i;

  /* `storage` is localStorage (or a stand-in); every access is guarded because it can throw or be absent.
     `opts.seed` is an optional starter record ({id,name,legend,color,lat,lon}) added once on first use; the
     private build passes one via config.js, the public build passes none (no personal data ships in this file). */
  function createStore(storage, opts = {}) {
    const seed = opts.seed || null;
    let items = [], failed = false;
    const get = k => { try { return storage.getItem(k); } catch (e) { return null; } };
    const set = (k, v) => { try { storage.setItem(k, v); failed = false; } catch (e) { failed = true; } };
    try { items = JSON.parse(get(KEY) || '[]'); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
    const persist = () => set(KEY, JSON.stringify(items));
    if (seed && !get(SEED_KEY)) {
      if (!items.length) items.push({ ...seed });
      set(SEED_KEY, '1');
      persist();
    }
    const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    return {
      all: () => items,
      find: id => items.find(x => x.id === id),
      get failed() { return failed; },
      add(rec) { const p = { id: newId(), ...rec }; items.push(p); persist(); return p; },
      update(id, rec) { const p = items.find(x => x.id === id); if (p) { Object.assign(p, rec); persist(); } return p; },
      remove(id) { items = items.filter(x => x.id !== id); persist(); },
      exportJson: () => JSON.stringify(items, null, 1),
      /* merge by id; ignore records without numeric lat/lon; returns how many were imported */
      importJson(text) {
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) throw new Error('not an array');
        let n = 0;
        arr.forEach(r => {
          if (typeof r.lat !== 'number' || typeof r.lon !== 'number') return;
          const rec = { id: r.id || newId(), name: String(r.name || 'Punto'), legend: String(r.legend || ''),
                        color: HEX.test(r.color) ? r.color : '#2563eb', lat: r.lat, lon: r.lon };
          const i = items.findIndex(x => x.id === rec.id);
          if (i >= 0) items[i] = rec; else items.push(rec);
          n++;
        });
        persist();
        return n;
      },
    };
  }

  const api = { createStore, STORE_KEY: KEY };
  root.Lahar = Object.assign(root.Lahar || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
