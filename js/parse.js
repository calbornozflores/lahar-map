/* "lat, lon" or a long Google Maps URL -> [lat, lon] inside Chile, else null. Mirrors parse_input.py
   (short goo.gl links need a redirect, which a browser cannot follow: paste the long link instead). */
(function (root) {
  const NUM = '(-?\\d+(?:\\.\\d+)?)';
  const PATS = [
    new RegExp('^\\s*' + NUM + '\\s*[,;]\\s*' + NUM + '\\s*$'),
    new RegExp('!3d' + NUM + '!4d' + NUM),
    new RegExp('@' + NUM + ',' + NUM),
    new RegExp('/maps/search/' + NUM + ',\\+?' + NUM),
    new RegExp('[?&](?:q|ll|query)=' + NUM + '(?:,|%2C)\\s*' + NUM, 'i'),
  ];

  function parsePoint(text) {
    let t;
    try { t = decodeURIComponent(text.trim()); } catch (e) { t = text.trim(); }
    for (const re of PATS) {
      const m = t.match(re);
      if (m) {
        const a = parseFloat(m[1]), b = parseFloat(m[2]);
        return (a >= -56 && a <= -17 && b >= -76 && b <= -66) ? [a, b] : null;
      }
    }
    return null;
  }

  const api = { parsePoint };
  root.Lahar = Object.assign(root.Lahar || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
