// /api/vessel-photo — upload a vessel photo to the ais-photos repo (used by the Vessels section).
//   POST JSON { code, name, mmsi?, photographer, consent: true, image: <base64 JPEG, already resized in the browser> }
//   → { ok, mmsi, name, file, credit }
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

async function lookupMmsi(name) {
  const r = await fetch(WORKER + '/vessels.csv');
  if (!r.ok) throw new Error('AIS lookup unavailable');
  const want = norm(name), hits = new Set();
  for (const line of (await r.text()).split('\n').slice(1)) {
    const m = line.match(/^(\d{9}),"((?:[^"]|"")*)"/);
    if (m && norm(m[2].replace(/""/g, '"')) === want) hits.add(m[1]);
  }
  if (hits.size === 1) return [...hits][0];
  if (hits.size > 1) throw new Error('Several vessels named ' + want + ' in AIS data. Enter the MMSI.');
  throw new Error(want + ' is not in the current AIS data. Enter the MMSI.');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GITHUB_TOKEN || !process.env.UPLOAD_CODE) return res.status(500).json({ error: 'Upload is not configured on the server' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (String(b.code || '') !== process.env.UPLOAD_CODE) return res.status(403).json({ error: 'Wrong upload code' });
    if (b.consent !== true) return res.status(400).json({ error: 'Permission to share must be confirmed' });
    const photographer = String(b.photographer || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!photographer) return res.status(400).json({ error: 'Name of photographer is required' });
    let name = norm(b.name).slice(0, 60);
    let mmsi = b.mmsi ? String(b.mmsi).trim() : '';
    if (mmsi && !/^\d{9}$/.test(mmsi)) return res.status(400).json({ error: 'MMSI must be 9 digits' });
    const img = Buffer.from(String(b.image || ''), 'base64');
    if (img.length < 1000 || img[0] !== 0xff || img[1] !== 0xd8) return res.status(400).json({ error: 'Not a JPEG image' });
    if (img.length > MAX_BYTES) return res.status(400).json({ error: 'Image too large' });

    // Resolve MMSI: given → vessel list → live AIS data by name
    const vessels = (await readJson('vessels.json', [])).data;
    if (!mmsi) {
      const v = vessels.find(x => norm(x.name) === name && x.mmsi);
      mmsi = v ? String(v.mmsi) : await lookupMmsi(name);
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
      const byN = d.find(x => norm(x.name) === name && !x.mmsi);
      if (byN) byN.mmsi = mmsi; else d.push({ name, mmsi });
      d.sort((a, c) => a.name.localeCompare(c.name));
      return d;
    }, 'vessels.json: ' + name + ' ' + mmsi);

    return res.status(200).json({ ok: true, mmsi, name, file, credit });
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
}
