/* GA43 (SERNAGEOMIN 2025, 1:25.000) hazard layers: lava, PDC, lahares, balísticos + "peligro máximo".
 * Each layer is a separate classic script (ga43_<id>.js -> window.GA43[id]), injected the first time its checkbox is ticked,
 * so the page loads without them and it still works from file://. Drawn on a canvas renderer in its own pane; the
 * slider only changes that layer's fillOpacity. The pure helper `describe` is exported for node --test. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* HTML lines for the layers that answer at a point: [{nombre, props}] */
  function describe(hits) {
    if (!hits.length) return '';
    return '<hr style="margin:4px 0"><b>GA43 (2025)</b><br>' + hits.map(h =>
      esc(h.nombre) + ': <b>' + esc(h.props.nivel) + '</b>' +
      (h.props.peligros_dominantes ? ' <small>(' + esc(h.props.peligros_dominantes.split('+').join(' + ')) + ')</small>' : '')).join('<br>');
  }

  function init(map, config, hooks) {
    const $ = id => document.getElementById(id);
    const layers = config.ga43 || [];
    const state = {};   // id -> {layer, data, on, alpha, loading}
    const rows = $('ga43rows');
    if (!rows) return { infoHtml: () => '', state };

    const rgbOf = (cfg, nivel) => { const c = cfg.clases.find(k => k.nivel === nivel); return c ? 'rgb(' + c.rgb.join(',') + ')' : '#888'; };

    function build(cfg, data) {
      const st = state[cfg.id];
      st.data = data;
      st.layer = L.geoJSON(data, {
        pane: 'ga43-' + cfg.id, interactive: false, renderer: L.canvas({ pane: 'ga43-' + cfg.id, padding: 0.5 }),
        style: f => ({ stroke: false, fillColor: rgbOf(cfg, f.properties.nivel), fillOpacity: st.alpha / 100 }),
      });
    }

    function legend() {
      const html = layers.filter(c => state[c.id].on).map(c =>
        '<div><b>' + esc(c.nombre) + '</b></div>' + c.clases.map(k =>
          '<div><span class="sw" style="background:rgb(' + k.rgb.join(',') + ')"></span>' + esc(k.nivel) + (k.texto ? ' — <small>' + esc(k.texto) + '</small>' : '') + '</div>').join('')).join('');
      const box = $('ga43legend');
      if (box) { box.innerHTML = html; box.hidden = !html; }
    }

    function setOn(cfg, on) {
      const st = state[cfg.id];
      st.on = on;
      $('g43a-' + cfg.id).disabled = !on;
      const apply = () => { if (st.on) st.layer.addTo(map); else map.removeLayer(st.layer); legend(); };
      if (st.layer) return apply();
      if (!on || st.loading) return;
      st.loading = true; $('g43s-' + cfg.id).textContent = 'cargando…';
      const s = document.createElement('script');
      s.src = 'ga43_' + cfg.id + '.js';
      s.onload = () => { st.loading = false; $('g43s-' + cfg.id).textContent = ''; build(cfg, root.GA43[cfg.id]); apply(); };
      s.onerror = () => { st.loading = false; st.on = false; $('g43c-' + cfg.id).checked = false; $('g43a-' + cfg.id).disabled = true; $('g43s-' + cfg.id).textContent = 'no se pudo cargar'; };
      document.head.appendChild(s);
    }

    layers.forEach((cfg, i) => {
      map.createPane('ga43-' + cfg.id).style.zIndex = 405 + i;   // above the image overlays (400), below markers (600)
      state[cfg.id] = { alpha: cfg.alpha, on: false };
      const row = document.createElement('div');
      row.className = 'g43row';
      row.innerHTML = '<label><input type="checkbox" id="g43c-' + cfg.id + '"> ' + esc(cfg.nombre) + (cfg.fig ? ' <small>(fig. ' + cfg.fig + ')</small>' : '') + '</label>' +
        ' <span class="v" id="g43v-' + cfg.id + '">' + cfg.alpha + '%</span> <small id="g43s-' + cfg.id + '"></small>' +
        '<input type="range" id="g43a-' + cfg.id + '" min="0" max="100" value="' + cfg.alpha + '" disabled aria-label="Transparencia: ' + esc(cfg.nombre) + '">';
      rows.appendChild(row);
      $('g43c-' + cfg.id).onchange = e => setOn(cfg, e.target.checked);
      $('g43a-' + cfg.id).oninput = e => {
        const st = state[cfg.id];
        st.alpha = +e.target.value; $('g43v-' + cfg.id).textContent = st.alpha + '%';
        if (st.layer) st.layer.setStyle({ fillOpacity: st.alpha / 100 });
      };
    });

    /* GA43 answer at a point, from the layers that are on and loaded */
    function infoHtml(lat, lon) {
      const hits = [];
      layers.forEach(cfg => {
        const st = state[cfg.id];
        if (!st.on || !st.data) return;
        const z = hooks.zoneAt(st.data, lat, lon);
        if (z) hits.push({ nombre: cfg.nombre, props: z });
      });
      return describe(hits);
    }
    return { infoHtml, state };
  }

  const api = { describe, initGa43: init };
  root.Lahar = Object.assign(root.Lahar || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
