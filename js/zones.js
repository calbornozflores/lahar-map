/* Point-in-polygon lookup over the vectorized SERNAGEOMIN zones (GeoJSON, lon/lat). Most severe zone wins. */
(function (root) {
  const RANK = { 'muy alto': 4, 'alto': 3, 'moderado': 2, 'bajo': 1 };

  function inRing(x, y, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function inPoly(x, y, poly) {
    if (!inRing(x, y, poly[0])) return false;
    for (let k = 1; k < poly.length; k++) if (inRing(x, y, poly[k])) return false;
    return true;
  }

  function zoneAt(haz, lat, lon) {
    let best = null;
    haz.features.forEach(f => {
      const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      if (polys.some(p => inPoly(lon, lat, p)) && (!best || RANK[f.properties.nivel] > RANK[best.nivel])) best = f.properties;
    });
    return best;
  }

  const api = { zoneAt, inPoly };
  root.Lahar = Object.assign(root.Lahar || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
