// /api/vessel-admin — management of vessel photos and the vessel list (used by admin.html)
// POST JSON { code, action, ... }   — every request needs the admin code
//   load                                   → { vessels, photos }  (fresh from GitHub)
//   setCredit   { mmsi, file, credit }
//   reorder     { mmsi, files: [...] }     (new order; first is shown first in ForeFlight)
//   deletePhoto { mmsi, file }             (permanent)
//   movePhoto   { mmsi, file, toMmsi }     (to another listed vessel; gets the next free number there)
//   editVessel  { mmsi | name, newName?, newMmsi? }   (MMSI change renames the photo files)
//   deleteVessel{ mmsi | name, withPhotos? }
//
// Vercel environment variables: ADMIN_CODE (required), GITHUB_TOKEN (same token as the upload), PHOTOS_REPO (default tomandreas/ais-photos)

const REPO = process.env.PHOTOS_REPO || 'tomandreas/ais-photos';
const BRANCH = 'main';
const GH = 'https://api.github.com/repos/' + REPO + '/contents/';
const VALID_MMSI = /^[2-7]\d{8}$/;
const SAFE_FILE = /^\d{9}-\d+\.jpg$/;
const norm = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();

function gh(path, opts = {}) {
  return fetch(GH + encodeURIComponent(path) + (opts.method ? '' : '?ref=' + BRANCH), {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'WeatherDashboard-vessel-admin',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}
async function getFile(path) {
  const r = await gh(path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub read ' + path + ': HTTP ' + r.status);
  return r.json();   // { content (base64), sha, ... }
}
async function readJson(path, fallback) {
  const f = await getFile(path);
  return f ? { data: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')), sha: f.sha } : { data: fallback, sha: null };
}
async function putFile(path, base64, message, sha) {
  return gh(path, { method: 'PUT', body: JSON.stringify({ message, content: base64, branch: BRANCH, ...(sha ? { sha } : {}) }) });
}
async function deleteFile(path, message) {
  const f = await getFile(path);
  if (!f) return;   // already gone
  const r = await gh(path, { method: 'DELETE', body: JSON.stringify({ message, sha: f.sha, branch: BRANCH }) });
  if (!r.ok) throw new Error('GitHub delete ' + path + ': HTTP ' + r.status);
}
async function updateJson(path, fallback, change, message) {
  for (let i = 0; i < 4; i++) {
    const { data, sha } = await readJson(path, fallback);
    const next = change(data);
    if (next === null) return data;
    const r = await putFile(path, Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf8').toString('base64'), message, sha);
    if (r.ok) return next;
    if (r.status !== 409 && r.status !== 422) throw new Error('GitHub write ' + path + ': HTTP ' + r.status);
  }
  throw new Error('Could not update ' + path + ' (busy), try again');
}
const fileNo = f => Number((String(f).match(/-(\d+)\.jpg$/) || [])[1] || 0);

// Copy a photo to <toMmsi>-<n>.jpg (next free number), returns the new file name
async function copyPhoto(file, toMmsi, photos, message) {
  const src = await getFile(file);
  if (!src) throw new Error(file + ' not found in the repo');
  let n = (photos[toMmsi] || []).reduce((m, p) => Math.max(m, fileNo(p.file)), 0) + 1;
  for (let i = 0; i < 10; i++, n++) {
    const name = toMmsi + '-' + n + '.jpg';
    const r = await putFile(name, src.content.replace(/\n/g, ''), message);
    if (r.ok) return name;
    if (r.status !== 422) throw new Error('GitHub write ' + name + ': HTTP ' + r.status);
  }
  throw new Error('No free file name for ' + toMmsi);
}

function findVessel(list, b) {
  if (b.mmsi) return list.find(v => String(v.mmsi) === String(b.mmsi));
  return list.find(v => !v.mmsi && norm(v.name) === norm(b.name));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ADMIN_CODE || !process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'Admin is not configured on the server' });
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'Bad request' }); }
  if (String(b.code || '') !== process.env.ADMIN_CODE) return res.status(403).json({ error: 'Wrong admin code' });
  const mmsi = b.mmsi ? String(b.mmsi) : '';
  const file = b.file ? String(b.file) : '';
  if (file && !SAFE_FILE.test(file)) return res.status(400).json({ error: 'Bad file name' });

  try {
    switch (b.action) {
      case 'load': {
        const [v, p] = await Promise.all([readJson('vessels.json', []), readJson('photos.json', {})]);
        return res.status(200).json({ vessels: v.data, photos: p.data });
      }

      case 'setCredit': {
        const credit = String(b.credit || '').replace(/\s+/g, ' ').trim().slice(0, 100);
        if (!credit) return res.status(400).json({ error: 'Credit cannot be empty' });
        await updateJson('photos.json', {}, d => {
          const p = (d[mmsi] || []).find(x => x.file === file);
          if (!p) throw new Error('Photo not found');
          if (p.credit === credit) return null;
          p.credit = credit; return d;
        }, 'photos.json: credit for ' + file);
        return res.status(200).json({ ok: true });
      }

      case 'reorder': {
        const files = Array.isArray(b.files) ? b.files.map(String) : [];
        await updateJson('photos.json', {}, d => {
          const list = d[mmsi] || [];
          if (files.length !== list.length || !files.every(f => list.some(p => p.file === f))) throw new Error('Photo list changed, reload and try again');
          d[mmsi] = files.map(f => list.find(p => p.file === f)); return d;
        }, 'photos.json: reorder ' + mmsi);
        return res.status(200).json({ ok: true });
      }

      case 'deletePhoto': {
        await updateJson('photos.json', {}, d => {
          const list = d[mmsi] || [];
          if (!list.some(p => p.file === file)) return null;
          d[mmsi] = list.filter(p => p.file !== file);
          if (!d[mmsi].length) delete d[mmsi];
          return d;
        }, 'photos.json: remove ' + file);
        await deleteFile(file, 'Delete photo ' + file + ' (admin)');
        return res.status(200).json({ ok: true });
      }

      case 'movePhoto': {
        const to = String(b.toMmsi || '');
        if (!VALID_MMSI.test(to)) return res.status(400).json({ error: 'Target MMSI must be 9 digits starting with 2–7' });
        if (to === mmsi) return res.status(400).json({ error: 'Photo is already on that vessel' });
        const vessels = (await readJson('vessels.json', [])).data;
        if (!vessels.some(v => String(v.mmsi) === to)) return res.status(400).json({ error: 'No vessel with MMSI ' + to + ' in the list' });
        const photos = (await readJson('photos.json', {})).data;
        const entry = (photos[mmsi] || []).find(p => p.file === file);
        if (!entry) return res.status(400).json({ error: 'Photo not found' });
        const newFile = await copyPhoto(file, to, photos, 'Move photo ' + file + ' to ' + to + ' (admin)');
        await updateJson('photos.json', {}, d => {
          d[mmsi] = (d[mmsi] || []).filter(p => p.file !== file); if (!d[mmsi].length) delete d[mmsi];
          (d[to] = d[to] || []).push({ ...entry, file: newFile }); return d;
        }, 'photos.json: move ' + file + ' → ' + newFile);
        await deleteFile(file, 'Remove ' + file + ' after move (admin)');
        return res.status(200).json({ ok: true, file: newFile });
      }

      case 'editVessel': {
        const newName = b.newName ? norm(b.newName).slice(0, 60) : null;
        const newMmsi = b.newMmsi ? String(b.newMmsi).trim() : null;
        if (newMmsi && !VALID_MMSI.test(newMmsi)) return res.status(400).json({ error: 'MMSI must be 9 digits starting with 2–7' });
        const vessels = (await readJson('vessels.json', [])).data;
        const v = findVessel(vessels, b);
        if (!v) return res.status(400).json({ error: 'Vessel not found' });
        const oldMmsi = v.mmsi ? String(v.mmsi) : null;
        const mmsiChange = newMmsi && newMmsi !== oldMmsi;
        if (mmsiChange && vessels.some(x => String(x.mmsi) === newMmsi)) return res.status(400).json({ error: 'MMSI ' + newMmsi + ' is already used by another vessel' });

        // An MMSI change renames the photo files: copy to the new MMSI, update photos.json, then remove the old files
        let moved = [];
        if (mmsiChange && oldMmsi) {
          const photos = (await readJson('photos.json', {})).data;
          for (const p of photos[oldMmsi] || []) moved.push({ ...p, file: await copyPhoto(p.file, newMmsi, { [newMmsi]: moved }, 'Rename ' + p.file + ' for MMSI change (admin)'), old: p.file });
          if (moved.length) await updateJson('photos.json', {}, d => {
            delete d[oldMmsi];
            d[newMmsi] = moved.map(({ old, ...p }) => p); return d;
          }, 'photos.json: MMSI ' + oldMmsi + ' → ' + newMmsi);
        }
        await updateJson('vessels.json', [], d => {
          const x = findVessel(d, b);
          if (!x) throw new Error('Vessel not found');
          if (newName) x.name = newName;
          if (newMmsi) x.mmsi = newMmsi;
          d.sort((a, c) => a.name.localeCompare(c.name)); return d;
        }, 'vessels.json: edit ' + (oldMmsi || v.name));
        for (const m of moved) await deleteFile(m.old, 'Remove ' + m.old + ' after MMSI change (admin)');
        return res.status(200).json({ ok: true, renamed: moved.map(m => m.file) });
      }

      case 'deleteVessel': {
        const vessels = (await readJson('vessels.json', [])).data;
        const v = findVessel(vessels, b);
        if (!v) return res.status(400).json({ error: 'Vessel not found' });
        const m = v.mmsi ? String(v.mmsi) : null;
        const photos = (await readJson('photos.json', {})).data;
        const list = m ? photos[m] || [] : [];
        if (list.length && !b.withPhotos) return res.status(409).json({ error: 'This vessel has ' + list.length + ' photo(s). Confirm to delete them too.', code: 'has_photos', count: list.length });
        if (list.length) {
          await updateJson('photos.json', {}, d => { delete d[m]; return d; }, 'photos.json: remove all photos of ' + m);
          for (const p of list) await deleteFile(p.file, 'Delete ' + p.file + ' with vessel (admin)');
        }
        await updateJson('vessels.json', [], d => d.filter(x => x !== findVessel(d, b)), 'vessels.json: delete ' + (m || v.name));
        return res.status(200).json({ ok: true });
      }

      case 'verify':
        return res.status(200).json({ ok: true });

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
}
