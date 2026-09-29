/* Ruler UI: a Leaflet control + result panel. Temporary by design (nothing is stored).
   Lahar.initMeasure(map) -> { get active() } ; the info-popup click handler must ignore clicks while active. */
(function (root) {
  const M = () => root.Lahar;
  const $ = id => document.getElementById(id);
  const COLOR = '#2563eb';

  function initMeasure(map) {
    let active = false, closed = false, finished = false, pts = [];
    const layer = L.layerGroup().addTo(map);
    const shapeGroup = L.layerGroup().addTo(layer), vertexGroup = L.layerGroup().addTo(layer);
    let line = null, rubber = null, vmarkers = [];

    const ll = i => pts[i];
    const chip = (html, cls) => L.divIcon({ className: '', html: '<span class="mlbl ' + (cls || '') + '">' + html + '</span>', iconSize: null });
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    function renderShape() {
      shapeGroup.clearLayers();
      if (pts.length < 1) { renderResult(); return; }
      line = closed && pts.length > 2
        ? L.polygon(pts, { color: COLOR, weight: 3, fillColor: COLOR, fillOpacity: 0.15, interactive: false })
        : L.polyline(pts, { color: COLOR, weight: 3, interactive: false });
      line.addTo(shapeGroup);
      const n = pts.length, segs = closed && n > 2 ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        L.marker(mid(a, b), { icon: chip(M().fmtDist(M().haversine(a, b))), interactive: false, keyboard: false }).addTo(shapeGroup);
      }
      renderResult();
    }

    function renderMarkers() {
      vertexGroup.clearLayers();
      vmarkers = pts.map((p, i) => {
        const m = L.marker(p, { draggable: true, icon: L.divIcon({ className: 'mvertex', iconSize: [14, 14] }), keyboard: false }).addTo(vertexGroup);
        m.on('drag', () => { const q = m.getLatLng(); pts[i] = [q.lat, q.lng]; renderShape(); });
        return m;
      });
      renderShape();
    }

    function text() {
      if (pts.length < 2) return '';
      const d = M().pathLength(pts, closed);
      if (closed && pts.length > 2) {
        if (M().selfIntersects(pts)) return 'Área no válida: el contorno se cruza · Perímetro ' + M().fmtDist(d);
        return 'Área ' + M().fmtArea(M().ringArea(pts)) + ' · Perímetro ' + M().fmtDist(d);
      }
      return 'Distancia ' + M().fmtDist(d);
    }

    function renderResult() {
      const t = text();
      $('mres').textContent = t || (pts.length ? 'Haz clic para añadir otro punto' : 'Haz clic en el mapa para empezar a medir');
      $('mres').classList.toggle('bad', /no válida/.test(t));
      $('mundo').disabled = pts.length === 0;
      $('mclear').disabled = pts.length === 0;
      $('mcopy').disabled = !t;
      $('mclose').disabled = pts.length < 3;
      $('mclose').textContent = closed ? 'Abrir línea' : 'Cerrar polígono';
    }

    function add(latlng) {
      if (closed || finished) return;
      pts.push([latlng.lat, latlng.lng]);
      renderMarkers();
    }
    const clear = () => { pts = []; closed = false; finished = false; removeRubber(); renderMarkers(); };
    function undo() { if (!pts.length) return; pts.pop(); if (pts.length < 3) closed = false; finished = false; renderMarkers(); }
    function toggleClose() { if (pts.length < 3) return; closed = !closed; removeRubber(); renderMarkers(); }
    function removeRubber() { if (rubber) { map.removeLayer(rubber); rubber = null; } }

    function on() {
      if (active) return;
      active = true;
      map.closePopup();
      map.doubleClickZoom.disable();
      map.getContainer().classList.add('measuring');
      $('measure').hidden = false;
      $('mbtn').classList.add('active');
      renderResult();
    }
    function off() {
      if (!active) return;
      clear();
      active = false;
      map.doubleClickZoom.enable();
      map.getContainer().classList.remove('measuring');
      $('measure').hidden = true;
      $('mbtn').classList.remove('active');
    }

    map.on('click', e => { if (active) add(e.latlng); });
    map.on('dblclick', () => {          // the two clicks of a double click each added a vertex: drop the duplicate, stop
      if (!active || closed) return;
      if (pts.length > 1) pts.pop();
      finished = true; removeRubber(); renderMarkers();
    });
    map.on('mousemove', e => {
      if (!active || closed || finished || !pts.length) return;
      const last = pts[pts.length - 1], q = [e.latlng.lat, e.latlng.lng];
      if (!rubber) rubber = L.polyline([last, q], { color: COLOR, weight: 2, dashArray: '4 6', interactive: false }).addTo(map);
      else rubber.setLatLngs([last, q]);
    });
    document.addEventListener('keydown', e => {
      if (!active || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
      if (e.key === 'Escape') off();
      else if (e.key === 'Enter') { finished = true; removeRubber(); }
    });

    $('mundo').onclick = undo;
    $('mclose').onclick = toggleClose;
    $('mclear').onclick = clear;
    $('mexit').onclick = off;
    $('mcopy').onclick = async () => {
      const t = text();
      try { await navigator.clipboard.writeText(t); $('mnote').textContent = 'Copiado: ' + t; }
      catch (e) { $('mnote').textContent = 'No se pudo copiar; selecciona el texto manualmente.'; }
    };

    const Ctl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const div = L.DomUtil.create('div', 'leaflet-bar');
        const a = L.DomUtil.create('a', '', div);
        a.id = 'mbtn'; a.href = '#'; a.title = 'Medir distancia y área'; a.setAttribute('role', 'button'); a.setAttribute('aria-label', 'Medir distancia y área');
        a.textContent = '📏';
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.on(a, 'click', ev => { L.DomEvent.preventDefault(ev); active ? off() : on(); });
        return div;
      },
    });
    new Ctl().addTo(map);
    L.DomEvent.disableClickPropagation($('measure'));

    return { get active() { return active; } };
  }

  root.Lahar = Object.assign(root.Lahar || {}, { initMeasure });
})(window);
