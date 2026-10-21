// /api/wx — thin proxy for raw TAF/METAR text.
//   GET /api/wx?ids=ENZV,ENBR   → { fetchedAt, stations: { ENZV: {...} } }
//   GET /api/wx?list=NO         → { stations: [{ id, name, taf, lat, lon }], withPositions }  (Norwegian METAR/TAF stations; lat/lon are null if NOAA gives none)
// Decoding happens in the page, so every source goes through the same parser.

const AWC = 'https://aviationweather.gov/api/data';
const MET = 'https://api.met.no/weatherapi/tafmetar/1.0';
// MET Norway requires an identifying User-Agent with contact info.
// Set MET_USER_AGENT in Vercel → Settings → Environment Variables.
const UA = process.env.MET_USER_AGENT || 'TAF-Timeline/1.0 (contact: set MET_USER_AGENT)';

const cache = new Map(); // per-instance memory cache: key → { t, data }
function cached(key, maxAgeMs) {
  const c = cache.get(key);
  return c && Date.now() - c.t < maxAgeMs ? c.data : null;
}
function store(key, data) { cache.set(key, { t: Date.now(), data }); return data; }

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
  const txt = await r.text();
  return txt.trim() ? JSON.parse(txt) : [];
}
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
  return r.text();
}
// MET Norway returns every message of the day; keep the last one.
function lastMessage(txt, prefix) {
  const msgs = txt.split('=').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!msgs.length) return null;
  let m = msgs[msgs.length - 1];
  if (!m.startsWith(prefix)) m = prefix + ' ' + m;
  return m + '=';
}
const cleanName = n => (n ? String(n).replace(/,\s*[A-Z0-9]{1,3},\s*[A-Z]{2}$/, '').replace(/,\s*[A-Z]{2}$/, '') : null);
const epoch = v => (v == null ? null : typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v) || null);

// End of a TAF's validity (epoch ms), read from its "ddhh/ddhh" period. Day and hour are resolved against `ref`.
function tafEnd(raw, ref) {
  const m = /\b(\d{2})(\d{2})\/(\d{2})(\d{2})\b/.exec(raw || '');
  if (!m) return null;
  const dd = +m[3], hh = +m[4], r = new Date(ref);
  let best = null;
  for (let k = -1; k <= 1; k++) {
    const dim = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + k + 1, 0)).getUTCDate();
    if (dd > dim) continue;
    const t = Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + k, dd, hh);   // hour 24 rolls over to the next day
    if (best === null || Math.abs(t - ref) < Math.abs(best - ref)) best = t;
  }
  return best;
}
const tafExpired = (raw, ref, now) => { const e = tafEnd(raw, ref || now); return e != null && e <= now; };

async function fromNOAA(ids) {
  const q = encodeURIComponent(ids.join(','));
  const [tafs, metars] = await Promise.all([
    getJSON(`${AWC}/taf?ids=${q}&format=json`),
    getJSON(`${AWC}/metar?ids=${q}&format=json`)
  ]);
  const out = {};
  for (const t of tafs || []) {
    const id = t.icaoId;
    if (!id || out[id]?.taf) continue;
    out[id] = out[id] || { source: 'NOAA' };
    out[id].taf = t.rawTAF || t.rawText || null;
    out[id].tafIssue = epoch(t.issueTime);
    out[id].name = out[id].name || cleanName(t.name);
  }
  for (const m of metars || []) {
    const id = m.icaoId;
    if (!id) continue;
    out[id] = out[id] || { source: 'NOAA' };
    if (out[id].metar) continue; // newest first
    out[id].metar = m.rawOb || m.rawText || null;
    out[id].metarTime = epoch(m.obsTime ?? m.reportTime);
    out[id].name = out[id].name || cleanName(m.name);
  }
  return out;
}

async function fromMET(id) {
  const [taf, metar] = await Promise.all([
    getText(`${MET}/taf.txt?icao=${id}`).then(t => lastMessage(t, 'TAF')).catch(() => null),
    getText(`${MET}/metar.txt?icao=${id}`).then(t => lastMessage(t, 'METAR')).catch(() => null)
  ]);
  if (!taf && !metar) return null;
  return { source: 'MET Norway', taf, metar };
}

async function stationList() {
  const hit = cached('list:NO2', 24 * 3600e3);
  if (hit) return hit;
  // lat 82 so that Svalbard (78 N) is included
  const rows = await getJSON(`${AWC}/stationinfo?bbox=55,-5,82,35&format=json`);
  const list = (Array.isArray(rows) ? rows : [])
    .filter(s => /^EN[A-Z]{2}$/.test(s.icaoId || ''))
    .map(s => {
      const types = [].concat(s.siteType || []).join(',');
      const num = v => (v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v);
      // if NOAA gives no site type, assume the station has a TAF rather than hiding it
      return { id: s.icaoId, name: s.site || s.name || '', taf: types ? /TAF/.test(types) : true, lat: num(s.lat ?? s.latitude), lon: num(s.lon ?? s.longitude) };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!list.length) return null;                                   // never keep an empty answer
  return store('list:NO2', { stations: list, withPositions: list.filter(s => s.lat !== null && s.lon !== null).length });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (req.query.list) {
      const l = await stationList();
      if (!l) { res.setHeader('Cache-Control', 'no-store'); return res.status(502).json({ error: 'NOAA returned no stations' }); }
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
      return res.status(200).json(l);
    }
    const ids = String(req.query.ids || '')
      .toUpperCase().split(',').map(s => s.trim())
      .filter(s => /^[A-Z0-9]{4}$/.test(s));
    const uniq = [...new Set(ids)].sort().slice(0, 30);
    if (!uniq.length) return res.status(400).json({ error: 'Add ?ids=ICAO,ICAO' });

    const key = 'wx:' + uniq.join(',');
    const hit = cached(key, 60e3);
    if (hit) { res.setHeader('Cache-Control', 's-maxage=60'); return res.status(200).json(hit); }

    let stations = {}, errors = [];
    try { stations = await fromNOAA(uniq); } catch (e) { errors.push(String(e.message || e)); }

    // MET Norway fallback for Norwegian stations NOAA did not return a TAF for, or whose NOAA TAF has expired
    const now = Date.now();
    const missing = uniq.filter(id => id.startsWith('EN') && !stations[id]?.taf);
    const expired = uniq.filter(id => id.startsWith('EN') && stations[id]?.taf && tafExpired(stations[id].taf, stations[id].tafIssue, now));
    const ask = [...missing, ...expired];
    const met = await Promise.all(ask.map(id => fromMET(id).catch(() => null)));
    ask.forEach((id, i) => {
      const m = met[i];
      if (!m) return;
      if (missing.includes(id)) {
        stations[id] = { ...(stations[id] || {}), ...Object.fromEntries(Object.entries(m).filter(([, v]) => v)) };
        if (m.taf) stations[id].source = 'MET Norway';
      } else if (m.taf && !tafExpired(m.taf, stations[id].tafIssue, now)) {
        // replace only the TAF; keep NOAA's METAR and its observation time
        stations[id].taf = m.taf; stations[id].tafIssue = null; stations[id].source = 'MET Norway';
      }
    });

    const data = { fetchedAt: Date.now(), stations, errors };
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    return res.status(200).json(store(key, data));
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
