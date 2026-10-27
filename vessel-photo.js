// /api/vessel-photo — vessel photos for the Vessels section (v1.1)
//   POST JSON { code, name, mmsi?, listName?, photographer, consent: true, force?, separate?, image: <base64 JPEG> }
//        → { ok, mmsi, name, file, credit }
//        409 { error, code: 'name_mismatch' | 'not_in_ais' | 'name_exists' | 'mmsi_required', ... } — checks the user must resolve
//   POST JSON { code, action: 'setMmsi', name, mmsi } → { ok } — link a listed vessel without MMSI to its AIS MMSI
//   GET ?find=NAME   → { candidates: [{ mmsi, name, type, lastSeen }] } from current AIS data
//   GET ?types=1     → { types: { mmsi: 'Tanker' | ... } } for the vessels in vessels.json
// The photo is saved as <MMSI>-<n>.jpg (next free number) and added to photos.json and vessels.json.
//
// Vercel → Settings → Environment Variables:
//   GITHUB_TOKEN   fine-grained token with Contents: Read and write on the ais-photos repo only (required)
//   UPLOAD_CODE    the shared upload code (required)
//   PHOTOS_REPO    owner/repo (default tomandreas/ais-photos)
//   AIS_WORKER_URL AIS Worker base URL, used to look up MMSI by name (default the foreflight-ais Worker)

const REPO = process.env.PHOTOS_REPO || 'tomandreas/ais-photos';
const BRANCH = 'main';
const WORKER = (process.env.AIS_WORKER_URL || 'https://foreflight-ais.tom-ostrem-airlift-github.workers.dev').replace(/\/$/, '');
const GH = 'https://api.github.com/repos/' + REPO + '/contents/';
const MAX_BYTES = 1.5 * 1024 * 1024;

const norm = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();

function gh(path, opts = {}) {
  return fetch(GH + encodeURIComponent(path).replace(/%2F/g, '/') + (opts.method ? '' : '?ref=' + BRANCH), {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'WeatherDashboard-vessel-photo',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

async function readJson(path, fallback) {
  const r = await gh(path);
  if (r.status === 404) return { data: fallback, sha: null };
  if (!r.ok) throw new Error('GitHub read ' + path + ': HTTP ' + r.status);
  const j = await r.json();
  return { data: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')), sha: j.sha };
}

async function put(path, base64, message, sha) {
  return gh(path, { method: 'PUT', body: JSON.stringify({ message, content: base64, branch: BRANCH, ...(sha ? { sha } : {}) }) });
}

// Read-modify-write a JSON file, retrying if someone else changed it in between
async function updateJson(path, fallback, change, message) {
  for (let i = 0; i < 4; i++) {
    const { data, sha } = await readJson(path, fallback);
    const next = change(data);
    if (next === null) return; // nothing to change
    const body = Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf8').toString('base64');
    const r = await put(path, body, message, sha);
    if (r.ok) return;
    if (r.status !== 409 && r.status !== 422) throw new Error('GitHub write ' + path + ': HTTP ' + r.status);
  }
  throw new Error('Could not update ' + path + ' (busy), try again');
}

// Current AIS data from the Worker, cached for 2 minutes per server instance
let aisCache = null, aisTime = 0;
async function ais() {
  if (aisCache && Date.now() - aisTime < 120000) return aisCache;
  const r = await fetch(WORKER + '/vessels.csv');
  if (!r.ok) throw new Error('AIS lookup unavailable');
  const rows = [];
  for (const line of (await r.text()).split('\n').slice(1)) {
    const m = line.match(/^(\d{9}),"((?:[^"]|"")*)",([^,]*),(.*)$/);
    if (m) rows.push({ mmsi: m[1], name: norm(m[2].replace(/""/g, '"')), type: typeLabel(Number(m[3])), lastSeen: m[4] });
  }
  aisCache = rows; aisTime = Date.now();
  return rows;
}
function typeLabel(t) {
  if (t >= 80 && t <= 89) return 'Tanker';
  if (t >= 70 && t <= 79) return 'Cargo';
  if ((t >= 60 && t <= 69) || (t >= 40 && t <= 49)) return 'Passenger';
  if (t === 30) return 'Fishing';
  if ((t >= 31 && t <= 34) || (t >= 50 && t <= 59) || (t >= 90 && t <= 99)) return 'Service';
  return t ? 'Other' : '';
}
const VALID_MMSI = /^[2-7]\d{8}$/;   // ship station MMSI
function conflict(res, code, msg, extra) { return res.status(409).json({ error: msg, code, ...(extra || {}) }); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    try {
      const q = req.query || {};
      if (q.find) {
        const want = norm(q.find), rows = await ais();
        let c = rows.filter(r => r.name === want);
        if (!c.length) c = rows.filter(r => r.name.includes(want)).slice(0, 10);
        return res.status(200).json({ candidates: c });
      }
      if (q.types) {
        const list = (await readJson('vessels.json', [])).data, rows = await ais(), by = {};
        for (const r of rows) by[r.mmsi] = r.type;
        const types = {};
        for (const v of list) if (v.mmsi && by[v.mmsi]) types[v.mmsi] = by[v.mmsi];
        return res.status(200).json({ types });
      }
      return res.status(400).json({ error: 'Unknown request' });
    } catch (e) { return res.status(400).json({ error: String(e.message || e) }); }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  if (!process.env.GITHUB_TOKEN || !process.env.UPLOAD_CODE) return res.status(500).json({ error: 'Upload is not configured on the server' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (String(b.code || '') !== process.env.UPLOAD_CODE) return res.status(403).json({ error: 'Wrong upload code' });
    if (b.action === 'setMmsi') {
      const nm = norm(b.name), mm = String(b.mmsi || '').trim();
      if (!VALID_MMSI.test(mm)) return res.status(400).json({ error: 'MMSI must be 9 digits starting with 2–7' });
      const hit = (await ais()).find(r => r.mmsi === mm);
      if (!hit) return res.status(400).json({ error: 'MMSI ' + mm + ' is not in the current AIS data' });
      if (hit.name !== nm) return res.status(400).json({ error: 'MMSI ' + mm + ' is "' + hit.name + '" in AIS, not "' + nm + '"' });
      await updateJson('vessels.json', [], d => {
        if (d.some(x => String(x.mmsi) === mm)) throw new Error('MMSI ' + mm + ' is already in the vessel list');
        const v = d.find(x => !x.mmsi && norm(x.name) === nm);
        if (!v) throw new Error(nm + ' (without MMSI) not found in the vessel list');
        v.mmsi = mm; return d;
      }, 'vessels.json: MMSI ' + mm + ' for ' + nm);
      return res.status(200).json({ ok: true, mmsi: mm, name: nm });
    }
    if (b.consent !== true) return res.status(400).json({ error: 'Permission to share must be confirmed' });
    const photographer = String(b.photographer || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!photographer) return res.status(400).json({ error: 'Name of photographer is required' });
    let name = norm(b.name).slice(0, 60);
    let mmsi = b.mmsi ? String(b.mmsi).trim() : '';
    if (mmsi && !VALID_MMSI.test(mmsi)) return res.status(400).json({ error: 'MMSI must be 9 digits starting with 2–7' });
    const listName = b.listName ? norm(b.listName) : null;
    const img = Buffer.from(String(b.image || ''), 'base64');
    if (img.length < 1000 || img[0] !== 0xff || img[1] !== 0xd8) return res.status(400).json({ error: 'Not a JPEG image' });
    if (img.length > MAX_BYTES) return res.status(400).json({ error: 'Image too large' });

    // Resolve the vessel. A vessel already listed with an MMSI uploads as before, with no checks.
    const vessels = (await readJson('vessels.json', [])).data;
    const listedWithMmsi = !mmsi && vessels.find(x => norm(x.name) === name && x.mmsi);
    if (listedWithMmsi) mmsi = String(listedWithMmsi.mmsi);
    else {
      if (!mmsi) return conflict(res, 'mmsi_required', 'Enter the MMSI (use Find MMSI to look it up).');
      const byMmsi = vessels.find(x => String(x.mmsi) === mmsi);
      if (byMmsi) {
        name = byMmsi.name;   // same MMSI = same vessel, never a duplicate
      } else {
        const hit = (await ais()).find(r => r.mmsi === mmsi);
        if (hit && hit.name !== name)
          return conflict(res, 'name_mismatch', 'MMSI ' + mmsi + ' is "' + hit.name + '" in AIS, not "' + name + '".', { aisName: hit.name });
        if (!hit && !b.force)
          return conflict(res, 'not_in_ais', 'MMSI ' + mmsi + ' is not in the current AIS data. Check the number.');
        const sameName = vessels.find(x => norm(x.name) === name && x.mmsi && String(x.mmsi) !== mmsi);
        if (sameName && !b.separate)
          return conflict(res, 'name_exists', 'A vessel named ' + name + ' already exists (MMSI ' + sameName.mmsi + ').', { existing: { name: sameName.name, mmsi: String(sameName.mmsi) } });
      }
    }
    if (!name) { const v = vessels.find(x => String(x.mmsi) === mmsi); name = v ? v.name : 'MMSI ' + mmsi; }

    // Next free number: start after what photos.json lists, skip any file that already exists
    const photos = (await readJson('photos.json', {})).data;
    let n = (photos[mmsi] || []).reduce((mx, p) => Math.max(mx, Number((p.file.match(/-(\d+)\.jpg$/) || [])[1] || 0)), 0) + 1;
    let file;
    for (let i = 0; i < 8; i++, n++) {
      file = mmsi + '-' + n + '.jpg';
      const r = await put(file, img.toString('base64'), 'Add photo ' + file + ' (' + name + ') via WeatherDashboard');
      if (r.ok) break;
      if (r.status !== 422) throw new Error('GitHub write ' + file + ': HTTP ' + r.status); // 422 = file exists
      file = null;
    }
    if (!file) throw new Error('Could not find a free file name, try again');
    const credit = 'Photo: ' + photographer;

    await updateJson('photos.json', {}, d => {
      const list = d[mmsi] || (d[mmsi] = []);
      if (!list.some(p => p.file === file)) list.push({ file, credit });
      return d;
    }, 'photos.json: add ' + file);

    await updateJson('vessels.json', [], d => {
      const byM = d.find(x => String(x.mmsi) === mmsi);
      if (byM) return null;
      const byN = d.find(x => !x.mmsi && (norm(x.name) === name || (listName && norm(x.name) === listName)));
      if (byN) { byN.mmsi = mmsi; byN.name = name; } else d.push({ name, mmsi });
      d.sort((a, c) => a.name.localeCompare(c.name));
      return d;
    }, 'vessels.json: ' + name + ' ' + mmsi);

    return res.status(200).json({ ok: true, mmsi, name, file, credit });
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
}
