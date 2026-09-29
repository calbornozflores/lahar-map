/* Ruler maths on a sphere (haversine + Chamberlain-Duquette area). Points are [lat, lon].
   Checked against the WGS84 ellipsoid (pyproj.Geod) at this latitude: <0.3 % distance, <0.1 % area,
   far below the basemap / SERNAGEOMIN georeference uncertainty. */
(function (root) {
  const R = 6371008.8;
  const rad = d => d * Math.PI / 180;

  function haversine(a, b) {
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function pathLength(pts, closed = false) {
    let m = 0;
    for (let i = 1; i < pts.length; i++) m += haversine(pts[i - 1], pts[i]);
    if (closed && pts.length > 2) m += haversine(pts[pts.length - 1], pts[0]);
    return m;
  }

  function ringArea(pts) {
    if (pts.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [la1, lo1] = pts[i], [la2, lo2] = pts[(i + 1) % pts.length];
      s += rad(lo2 - lo1) * (2 + Math.sin(rad(la1)) + Math.sin(rad(la2)));
    }
    return Math.abs(s * R * R / 2);
  }

  const ringPerimeter = pts => pathLength(pts, true);

  // planar test in lon/lat: fine at parcel scale; used only to warn about bow-tie polygons
  function orient(p, q, r) { return Math.sign((q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])); }
  function segCross(a, b, c, d) { return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b); }
  function selfIntersects(pts) {
    const n = pts.length;
    if (n < 4) return false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;   // adjacent edges share a vertex
        if (segCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
      }
    }
    return false;
  }

  const group = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const comma = (x, d) => x.toFixed(d).replace('.', ',');
  const fmtDist = m => m < 1000 ? Math.round(m) + ' m' : comma(m / 1000, 2) + ' km';
  const fmtArea = m2 => group(m2) + ' m²' + (m2 >= 1000 ? ' · ' + comma(m2 / 10000, 2) + ' ha' : '');

  const api = { haversine, pathLength, ringArea, ringPerimeter, selfIntersects, fmtDist, fmtArea };
  root.Lahar = Object.assign(root.Lahar || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
