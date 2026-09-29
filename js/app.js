/* Map + UI wiring. Data globals: CONFIG (config.js), HAZ and CAUCES (peligro.js). Logic lives in parse/zones/store. */
(function () {
  const { parsePoint, zoneAt, createStore } = window.Lahar;
  const $ = id => document.getElementById(id);
  const B = CONFIG.bounds;
  const PUBLIC = !!CONFIG.public;   // public build: no printed-map layer, no seed point, no CLI hints
  const narrow = window.innerWidth < 700;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- map and layers ----------
  const map = L.map('map', { zoomControl: true }).setView([-39.30, -71.98], 11);
  const ruler = window.Lahar.initMeasure(map);
  const bases = {
    // maxZoom = deepest level that really has tiles here (probed): Esri serves a "Map data not yet available"
    // placeholder from z19 in this region, so the map is stopped at 18 instead of showing it. OSM: 19, OpenTopoMap: 17.
    'Satélite (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Esri' }),
    'Calles (OSM)': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
    'Topográfico (OpenTopoMap)': L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' }),
  };
  bases['Satélite (Esri)'].addTo(map);
  // the map's max zoom follows the active basemap; pull the view back if the new one goes less deep
  map.on('baselayerchange', () => { if (map.getZoom() > map.getMaxZoom()) map.setZoom(map.getMaxZoom()); });
  const haz = L.imageOverlay('hazard_overlay.png', B, { opacity: .6 }).addTo(map);
  const orig = PUBLIC ? null : L.imageOverlay('map_overlay.webp', B, { opacity: 0 }).addTo(map);
  const vec = L.geoJSON(HAZ, { style: () => ({ color: '#000', weight: 1, fillOpacity: 0 }) });
  const cauces = L.geoJSON(CAUCES, {
    style: { color: '#1d4ed8', weight: 2 },
    onEachFeature: (f, l) => l.bindTooltip(f.properties.cauce + ' (OSM, aprox.)'),
  }).addTo(map);
  const batch = L.layerGroup().addTo(map);
  const CAT = { ALTO: '#dc2626', MODERADO: '#f59e0b', BAJO: '#16a34a', SIN_DATO: '#6b7280' };
  CONFIG.puntos.forEach(r => {
    L.circleMarker([r.lat, r.lon], { radius: 7, color: '#000', weight: 1, fillColor: CAT[r.categoria_alerta], fillOpacity: 1 })
      .bindPopup('<b>' + esc(r.nombre || r.input) + '</b><br>' + esc(r.categoria_alerta) + ' · zona: ' + esc(r.zona_sernageomin || '—') + '<br>' + esc(r.nota))
      .addTo(batch);
  });
  const mineLayer = L.layerGroup().addTo(map), tmp = L.layerGroup().addTo(map);
  const overlays = { 'Peligro (clases)': haz };
  if (orig) overlays['Mapa impreso'] = orig;
  Object.assign(overlays, { 'Cauces OSM': cauces, 'Contorno vectorial': vec });
  if (!PUBLIC) overlays['Puntos batch'] = batch;
  overlays['Mis puntos'] = mineLayer;
  L.control.layers(bases, overlays, { collapsed: narrow, position: 'topleft' }).addTo(map);

  const bindOpacity = (id, layer, label) => {
    const e = $(id), v = $(label);
    const f = () => { layer.setOpacity(e.value / 100); v.textContent = e.value + '%'; };
    e.oninput = f; f();
  };
  bindOpacity('o1', haz, 'v1');
  if (orig) bindOpacity('o2', orig, 'v2'); else $('lblorig').hidden = true;
  $('vec').onchange = e => e.target.checked ? vec.addTo(map) : map.removeLayer(vec);

  // ---------- static content from config ----------
  $('zlegend').innerHTML = CONFIG.legend.map(z => '<div><span class="sw" style="background:rgb(' + z.rgb.join(',') + ')"></span>' + esc(z.zona) + ' — ' + esc(z.nivel) + '</div>').join('');
  $('avisos').textContent = 'AVISO: heurística de screening, no cartografía oficial. Pedir el Certificado de Informaciones Previas. (detalle)';
  $('avisotxt').textContent = ' ' + CONFIG.aviso + ' Georreferencia aproximada (±50 m); la zona vectorizada puede no coincidir con el impreso en bordes.';
  $('avisod').open = !narrow;
  if (PUBLIC) $('aviso').classList.add('strong');
  if (CONFIG.credits) $('credits').innerHTML = CONFIG.credits;
  document.querySelectorAll('.fold').forEach(b => {
    const panel = b.closest('.panel');
    if (narrow) { panel.classList.add('closed'); b.setAttribute('aria-expanded', 'false'); }
    b.onclick = () => {
      const closed = panel.classList.toggle('closed');
      b.setAttribute('aria-expanded', String(!closed));
      if (narrow && !closed) document.querySelectorAll('.fold').forEach(o => { if (o !== b) { o.closest('.panel').classList.add('closed'); o.setAttribute('aria-expanded', 'false'); } });
    };
  });
  ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#9333ea', '#000000'].forEach(c => {
    const b = document.createElement('span');
    b.className = 'sw'; b.style.cssText = 'background:' + c + ';cursor:pointer;margin-left:3px';
    b.onclick = () => { $('cl').value = c; };
    $('sw').appendChild(b);
  });

  // ---------- zone info ----------
  const zoneCache = new Map();
  const zoneOf = (lat, lon) => {
    const k = lat + ',' + lon;
    if (!zoneCache.has(k)) zoneCache.set(k, zoneAt(HAZ, lat, lon));
    return zoneCache.get(k);
  };
  const zoneHtml = (lat, lon) => {
    const z = zoneOf(lat, lon);
    return z ? 'Zona SERNAGEOMIN: <b>' + esc(z.zona) + '</b> (' + esc(z.nivel) + ')' : 'Sin zona coloreada / fuera del mapa';
  };
  const gm = (lat, lon) => '<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + lat + ',' + lon + '">Google Maps</a>';
  const cmd = (lat, lon) => PUBLIC ? '' : '<code>uv run lahar-check "' + lat.toFixed(6) + ', ' + lon.toFixed(6) + '"</code>';

  map.on('click', e => {
    if (ruler.active) return;   // the ruler owns clicks while measuring
    const { lat, lng } = e.latlng, z = zoneOf(lat, lng);
    const inside = lat >= B[0][0] && lat <= B[1][0] && lng >= B[0][1] && lng <= B[1][1];
    const zt = z ? '<b>' + esc(z.zona) + '</b> — ' + esc(z.nivel) + '<br><small>' + esc(z.descripcion) + '</small>'
      : (inside ? 'Fuera de zonas de peligro coloreadas (relieve/lago/sin clasificar)' : 'Fuera del mapa SERNAGEOMIN');
    L.popup({ maxWidth: narrow ? 240 : 300 }).setLatLng(e.latlng).setContent(
      lat.toFixed(6) + ', ' + lng.toFixed(6) + '<br>' + zt + '<br>' + gm(lat, lng) + (PUBLIC ? '' : '<br>' + cmd(lat, lng)) +
      '<br><a href="#" data-act="use" data-lat="' + lat + '" data-lon="' + lng + '">Usar estas coordenadas en el formulario</a>').openOn(map);
  });

  // ---------- Mis puntos ----------
  const store = createStore(window.localStorage, { seed: CONFIG.seed });
  const markers = {};
  let editing = null;
  const msg = t => { $('qmsg').textContent = t || ''; };
  if (store.failed) msg('No pude guardar en el navegador (usa Exportar).');

  const pin = c => L.divIcon({
    className: '', iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -9],
    html: '<div style="width:14px;height:14px;border-radius:50%;background:' + esc(c) + ';border:2px solid #fff;box-shadow:0 0 0 1.5px #000,0 1px 4px #0006"></div>',
  });
  const popupOf = p => '<b>' + esc(p.name) + '</b>' + (p.legend ? '<br>' + esc(p.legend) : '') + '<br>' + p.lat.toFixed(6) + ', ' + p.lon.toFixed(6) +
    '<br>' + zoneHtml(p.lat, p.lon) + '<br>' + gm(p.lat, p.lon) + (PUBLIC ? '' : '<br>' + cmd(p.lat, p.lon)) +
    '<div style="margin-top:4px"><button data-act="edit" data-id="' + esc(p.id) + '">Editar</button> <button data-act="del" data-id="' + esc(p.id) + '">Eliminar</button></div>';

  function renderMarkers() {
    mineLayer.clearLayers();
    store.all().forEach(p => {
      const m = L.marker([p.lat, p.lon], { icon: pin(p.color), draggable: true, title: p.name }).addTo(mineLayer).bindPopup(() => popupOf(p), { maxWidth: narrow ? 240 : 300 });
      m.on('dragend', () => { const ll = m.getLatLng(); store.update(p.id, { lat: ll.lat, lon: ll.lng }); renderList(); });
      markers[p.id] = m;
    });
  }

  function renderList() {
    const items = store.all();
    $('mylist').innerHTML = items.length ? items.map(p => {
      const z = zoneOf(p.lat, p.lon), n = esc(p.name);
      return '<div class="pt"><span class="sw" style="background:' + esc(p.color) + '"></span>' +
        '<a href="#" data-act="go" data-id="' + esc(p.id) + '"><b>' + n + '</b></a>' + (p.legend ? ' — ' + esc(p.legend) : '') +
        (z ? ' <small>[' + esc(z.zona) + ']</small>' : '') +
        ' <button type="button" class="ico" title="Editar" aria-label="Editar ' + n + '" data-act="edit" data-id="' + esc(p.id) + '">✎</button>' +
        '<button type="button" class="ico" title="Eliminar" aria-label="Eliminar ' + n + '" data-act="del" data-id="' + esc(p.id) + '">🗑</button></div>';
    }).join('') : '<i>Sin puntos guardados</i>';
  }
  const render = () => { renderMarkers(); renderList(); };

  function goPoint(id) {
    const p = store.find(id);
    if (!p) return;
    map.setView([p.lat, p.lon], Math.max(map.getZoom(), 15));
    if (markers[id]) markers[id].openPopup();
  }
  function resetForm() {
    editing = null;
    ['q', 'nm', 'lg'].forEach(i => { $(i).value = ''; });
    $('ftitle').textContent = 'Mis puntos'; $('save').textContent = 'Guardar punto'; $('cancel').hidden = true;
  }
  function editPoint(id) {
    const p = store.find(id);
    if (!p) return;
    map.closePopup(); editing = id;
    $('q').value = p.lat.toFixed(6) + ', ' + p.lon.toFixed(6); $('nm').value = p.name; $('lg').value = p.legend || ''; $('cl').value = p.color;
    $('ftitle').textContent = 'Editando: ' + p.name; $('save').textContent = 'Actualizar punto'; $('cancel').hidden = false; msg();
    $('ctl').classList.remove('closed');
  }
  function delPoint(id) {
    const p = store.find(id);
    if (!p || !confirm('¿Eliminar "' + p.name + '"?')) return;
    store.remove(id);
    if (editing === id) resetForm();
    map.closePopup(); render();
  }
  function useCoords(lat, lon) {
    $('q').value = Number(lat).toFixed(6) + ', ' + Number(lon).toFixed(6);
    map.closePopup(); $('ctl').classList.remove('closed'); $('nm').focus();
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const id = el.dataset.id;
    ({ go: () => goPoint(id), edit: () => editPoint(id), del: () => delPoint(id), use: () => useCoords(el.dataset.lat, el.dataset.lon) })[el.dataset.act]();
  });

  $('pform').onsubmit = e => {
    e.preventDefault(); msg();
    const c = parsePoint($('q').value.split('\n')[0] || '');
    if (!c) return msg('Coordenadas no interpretables (o fuera de Chile). Link corto de goo.gl: pega el largo.');
    const rec = { name: $('nm').value.trim() || ('Punto ' + (store.all().length + 1)), legend: $('lg').value.trim(), color: $('cl').value, lat: c[0], lon: c[1] };
    const p = editing ? store.update(editing, rec) : store.add(rec);
    resetForm(); render(); goPoint(p.id);
  };
  $('cancel').onclick = resetForm;
  $('go').onclick = () => {
    msg(); tmp.clearLayers();
    const bad = [], ok = [];
    $('q').value.split('\n').map(x => x.trim()).filter(Boolean).forEach((ln, i) => {
      if (/goo\.gl/.test(ln)) { bad.push(ln + ' (link corto: pega el link largo)'); return; }
      const c = parsePoint(ln);
      if (!c) { bad.push(ln); return; }
      ok.push(L.marker(c).addTo(tmp).bindPopup('<b>Punto ' + (i + 1) + ' (sin guardar)</b><br>' + c[0].toFixed(6) + ', ' + c[1].toFixed(6) + '<br>' + zoneHtml(c[0], c[1]) + '<br>' + gm(c[0], c[1])));
    });
    if (bad.length) msg('No interpretado: ' + bad.join(' | '));
    if (ok.length) { map.flyToBounds(L.featureGroup(ok).getBounds().pad(0.3), { maxZoom: 16 }); ok[0].openPopup(); }
  };
  $('exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }));
    a.download = 'mis_puntos_lahares.json'; a.click();
  };
  $('imp').onclick = () => $('impf').click();
  $('impf').onchange = async e => {
    try { store.importJson(await e.target.files[0].text()); render(); msg(); }
    catch (err) { msg('Archivo inválido.'); }
    e.target.value = '';
  };

  render();

  // #lat,lon,zoom[,mapOpacity%] deep-links a view
  const h = location.hash.slice(1).split(',').map(Number);
  if (h.length >= 3 && h.every(v => !isNaN(v))) {
    map.setView([h[0], h[1]], h[2]);
    if (orig && h[3] !== undefined) { $('o2').value = h[3]; $('o2').oninput(); }
  } else map.fitBounds(B);
})();
