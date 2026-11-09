# CLAUDE.md – WeatherDashboard (Tom A. Østrem)

Repo `tomandreas/WeatherDashboard` → Vercel `wxdashboard.vercel.app` (local clone `C:\Users\tom_o\Documents\Repos\WeatherDashboard`). One page with three apps: **TAF Timeline**, **LOOME Night Ops**, **Vessels** (AIS map). Read this file first in every session; it wins over `..\CLAUDE.md` (Repos root, general rules) if they conflict.

The ForeFlight AIS layer itself (Cloudflare Worker `worker.js`, ForeFlight pack, symbology, Fixed Offshore Installations source data) is **not in this repo**; its notes are in `C:\Users\tom_o\Documents\Repos\ChatGPT\claude\CLAUDE.md`. This repo's dashboard depends on the Worker's endpoints (listed below).

## Working rules (from Tom — always follow)
1. **Never build until Tom says "build"** (or "bygg"); this includes bug fixes (diagnose, propose, wait). Collect requests in the to-do list meanwhile.
2. **"Build" = everything on the to-do list.** Start every build summary with the list of what is included.
3. **For every change, evaluate unintended consequences** and state them (before build when discussing, and in the build summary).
4. Ask before building when a design choice is open; give a recommendation.
5. File names never change. Version history follows the **Versioning convention** below.
6. **Language: always answer in English, even when Tom writes Norwegian.** Short answers: result or to-do list first, then unintended consequences.
7. Layer use is **by agreement with Tom A. Østrem only**; no price anywhere in docs.
8. Test every build (see Testing) at phone, iPad portrait/landscape and PC, light + dark theme.
9. **Where files go.** Write build files straight into this clone (`Documents\Repos\WeatherDashboard`). Tom commits, pushes and deploys himself. Never write scratch files into his folders; never overwrite a file Tom may have edited since you read it (check, re-read if changed). `ChatGPT\claude` is only for Claude memories, never for app builds.
10. **Workflow:** before changing anything list every file you need and read them in one pass; then make all edits; then run the tests once (again only after fixing a failure).
11. **At the end of each build update this file** (versions, to-do list, decisions) and bump `page-version`, the header version, the title tooltip, `versions.json` and the archive copy.
12. **Commands for Tom:** every PowerShell block starts with `cd C:\Users\tom_o\Documents\Repos\WeatherDashboard`; one command per line; no `&&`; say explicitly what to copy, test, deploy, commit and push, and whether any SQL or migration is needed (none for this repo so far).

## Pushing a build (Tom)
Files are already in the clone, so after a build:
```
cd C:\Users\tom_o\Documents\Repos\WeatherDashboard
git pull
git add -A
git commit -m "Dashboard v1.NN"
git push
```
Vercel deploys automatically. If the Worker changed, deploy it first (see Deploy order).

## Components and where they live
| Component | Location | Current version |
|---|---|---|
| Cloudflare Worker (AIS → KML/JSON) | `worker.js` → Cloudflare Workers, `foreflight-ais.tom-ostrem-airlift-github.workers.dev` (Workers Paid) | **1.10** |
| ForeFlight content pack | `AIS_Foreflight_Layer.zip` (manifest, `layers/*.kmz`, `navdata/Read me - AIS layer.pdf`) | **1.6** |
| WeatherDashboard | GitHub repo `WeatherDashboard` → Vercel `wxdashboard.vercel.app` (`index.html`, `versions.json`, `index.vNN.html`) | **1.21** (TAF Timeline v1.27, LOOME Night Ops v1.9, Vessels v1.16) |
| Vessel photo upload API | `api/vessel-photo.js` (Vercel function) | v1.1 + `setMmsi` action |
| Admin tool | `admin.html` + `api/vessel-admin.js` (Vercel) | 1.0 |
| Photo repo | GitHub `tomandreas/ais-photos` → `https://tomandreas.github.io/ais-photos/` (`photos.json`, `vessels.json`, `MMSI-n.jpg`) | — |
| LOOME Night Ops stand-alone | GitHub repo `tomandreas/LOOME` (`index.html`, `sw.js`, `manifest.json`, `versions.json`, icons; same LOOME code as the dashboard pane, own page) | **1.9** |
| LOOME Night Ops in the AW169 calculator (Norway edition) | `sun-moon.html` in GitHub repo `tomandreas/Airlift-AW169Calculator` (public; Claude can read it, only Tom can push). Norway-only gazetteer, `← Tools` back link, own icons, map limited to Norway, no service worker | **1.9** (updated 2026-11-06) |
| Legend PDF generator | `tools/pdf/build_legend_pdf.py` (ReportLab, icons in `tools/pack/icons/`) | PDF v1.6 |

## Tom's GitHub repositories (all public, `github.com/tomandreas/<name>`)
Claude can read every one of them (git clone works); Claude cannot push to any. Tom commits and pushes the files Claude delivers.
| Repo | What it is |
|---|---|
| `WeatherDashboard` | Weather dashboard → Vercel `wxdashboard.vercel.app`: TAF Timeline + LOOME + Vessels, `admin.html`, `api/*.js`, `versions.json`, `index.vNN.html` |
| `LOOME` | Stand-alone LOOME Night Ops (sun, twilight, moonlight; installable with `sw.js`) |
| `WxWindow` | Stand-alone TAF Timeline **v1.27** (`wxwindow.vercel.app`; has `minima.js`, `versions/`, `api/`) |
| `Airlift-AW169Calculator` | AW169 tools site: payload calculator, ferry planner, limitations, operations, performance, `sun-moon.html` (LOOME Norway edition), opening-hours workflow |
| `ais-photos` | Vessel photos for the AIS layer and dashboard (`photos.json`, `vessels.json`, `MMSI-n.jpg`); GitHub Pages |
| `FSPlanning` | Static web app mapping every handcrafted airport in MSFS 2024 (has its own README) |
| `H145TrainingPrep` | "H145 Sim Eval Prep" (single `index.html`) |

Local clones: `C:\Users\tom_o\Documents\Repos\<repo>` (git installed, global name/email set; clone of ais-photos intentionally not made). Before copying files in and pushing, always `git pull` first — the calculator repo has a nightly bot (02:15 UTC, `data/ops_hours.json`) that commits on its own; `ais-photos` receives uploads directly.

Not in any of these repos (kept with Tom): Worker `worker.js` and the ForeFlight pack. The private memory repo for Claude files is `github.com/tomandreas/ChatGPT` (local clone `C:\Users\tom_o\Documents\Repos\ChatGPT`); it holds only Claude context and memories, in its `claude\` folder, and this `CLAUDE.md` is there. No app builds in it.

## Versioning convention (same in every repo — Tom decided 2026-11-06)
- Each repo has a `versions.json` in its root (multi-file format: `files → "<page>.html" → {current, versions:[{v, label, file, archived, note, bytes, sha}]}`; `v` is the sequential log number used in the archive name, `label` is the human version such as 1.21; an entry whose archive copy does not exist anywhere carries `"missing": true`; an optional top-level `_note` explains the log) and a **`versions/`** folder with the archive copies, named `<page>.v<NN>.html` (e.g. `versions/index.v21.html`, `versions/ferry.v6.html`). Nothing reads these files at runtime; they are our change log and rollback copies.
- The live file always keeps its normal name (`index.html`, `sun-moon.html`, …). The repo root holds only live files, `versions.json` and the `versions/` folder.
- **Every delivery** into this clone `Repos\<repo>\` contains: the new live file (overwriting the previous one), its own copy as `versions/<page>.v<NN>.html`, the previous live file archived as `versions/<page>.v<NN-1>.html` if it is not already there (for a repo's first delivery take it from the repo itself), and the updated `versions.json`. Tom reviews, commits and pushes from that clone.
- Claude cannot push to GitHub, and cannot rename or delete files in the repos. Moves and deletions are given to Tom as `git mv` / `git rm` commands.

### Secrets (names only — values are with Tom)
- Cloudflare Worker: `BW_CLIENT_ID`, `BW_CLIENT_SECRET` (BarentsWatch client `tom.ostrem@airlift.no:foreflight-ais`, scope `ais`), optional `RIG_MMSI`, `ROT_MIN` (default 5 °/min), `HIDE_MMSI`, `PHOTOS_URL`, `DASHBOARD_ORIGINS` (default `https://wxdashboard.vercel.app`).
- Vercel: `GITHUB_TOKEN` (fine-grained, ais-photos Contents R/W), `UPLOAD_CODE`, `ADMIN_CODE`, optional `PHOTOS_REPO`.

### Deploy order (always)
1. Worker first (`wrangler deploy`) when the dashboard depends on new endpoints.
2. Dashboard (`index.html` + `index.vNN.html` + `versions.json`, and any `api/*.js`) → push to WeatherDashboard (Vercel auto-deploys).
3. ForeFlight pack only when layers/icons/PDF change → Tom imports `AIS_Foreflight_Layer.zip` on the iPads.
4. After each build Tom commits and pushes the target repo (always `git pull` first). He pushes the private `ChatGPT` repo only when `CLAUDE.md` or other memories changed, which is normally at the end of a build since `CLAUDE.md` is updated then.

## Worker 1.10 — endpoints
- `/` KML for ForeFlight: params `bbox`, `types`, `vec`, `shape`, `maxage`, `mapheading`. Layers in the pack: AIS South (56–65.5N, 0–13E), AIS North (65–82N, 4–35E), AIS Tankers and Rigs (56–82N, 0–35E, types tanker,rig,heavylift).
- `/fixed.kml` Fixed Offshore Installations layer (refresh 60 s). `/fixed.json` same for dashboard (`sup:1` when shown via AIS).
- `/live.json` dashboard map: `?bbox=S,W,N,E` | `?mmsi=a,b` | `?name=EXACT`; `&air=1` adds aircraft. CORS to dashboard only.
- `/track.json?mmsi=…&min=60` breadcrumbs from BarentsWatch historic API (`historic.ais.barentswatch.no/v1/historic/tracks/{mmsi}/{from}/{to}`), cached 25 s.
- `/vessels.csv` (aircraft excluded), `/status` (version, ROT format, photos, `aisModel` full/basic).
- AIS source: `live.ais.barentswatch.no/v1/latest/combined?modelType=Full` (falls back to basic hourly if refused). Destination/ETA from Full model; ETA "1 Jan 00:00" = not set.
- Filters: MMSI 111… (SAR aircraft) **never in ForeFlight**; on dashboard only with `&air=1`. `HIDE_MMSI` hides vessels. SOG ≥102.2 kt = not available. Stale >30 min grey, removed >180 min.
- Photos: `photos.json` re-read every 2 min.

## WeatherDashboard Vessels (v1.16) — behaviour to preserve
- Wide screens (≥1100 px): one page scroll; TAF + LOOME side by side, Vessel Information full width below ("Vessel Information" heading aligned with "Live Traffic"). Phones: Vessels tab. "VESSELS ↓" button next to IFR/VFR switch.
- Search: choosing a vessel shows it alone ("← All results (n)"); card shows position age, SOG/COG, destination, ETA (LT), station ETA, mini-map (⤢ Expand), photos, upload. Save MMSI for listed vessels without MMSI (upload code).
- Upload checks: MMSI required only if vessel has none; Find MMSI (AIS lookup + picker); format `^[2-7]\d{8}$`; name≠AIS → hard stop ("Use AIS name"); MMSI not in AIS → "Upload anyway"; no duplicate MMSI; same name/different MMSI → "Add as separate"/"Go to existing".
- Map (Leaflet 1.9.4 from cdnjs, OSM + OpenSeaMap seamarks [off by default on phones]): one shared canvas renderer `L.canvas({padding:0.15})` passed as map `renderer` — **never add a second canvas** (it swallows taps). Tiles `keepBuffer:1, updateWhenZooming:false`. Refresh 30 s. Ship symbols on canvas from zoom 7, names+speed from zoom 9, vectors 2 px grey from zoom 8. Aircraft layer (helicopter symbol, navy, no vectors).
- Layers panel: Tankers, Rigs & heavy-lift, Cargo, Service/offshore, Passenger, Fishing/other, Aircraft (SAR), Fixed offshore installations, Stations, Vessel names & speed, Vectors & turn curves, Seamarks, Only vessels with photos (saved in localStorage `ves.layers`).
- Selection: tap selects (ring, breadcrumbs, info box); ✕ keeps selection; tap same target again deselects; double tap <0.4 s ignored; collapsing card in list deselects.
- Breadcrumbs (selected target only): grey 3 px dots, no line, fade to 25 %; vessels 1 dot / 2 min for 60 min (±60 s); aircraft 1 dot / 30 s for 45 min (±15 s); gaps where no report.
- ETA to point: target = open sea, station, fixed installation, or vessel/aircraft (**intercept**: earliest meeting point, A at own speed, B constant course/speed; "No intercept at current speed"; A <0.5 kt → no ETA). Dashed line + label (LT), persisted in localStorage `ves.eta`, ✕ removes, Esc cancels.
- All ETAs in Norwegian local time "15:42 LT" (Europe/Oslo, DST automatic).
- Stations (dark blue stars, names): Holmengrå 60.85/4.4316, Fedje vest 60.7667/4.465, Skudefjorden 59.033/5.167, Crew Change Bergen 60.22883/4.51117, Ona Pilotboarding 62.933/6.45, Fruholmen 71.092/23.45, Crew Change Hammerfest 71.1505/23.07967.
- Station ETA for tankers, rigs, heavy-lift: destination FROM>TO (separators `=>`,`->`,`>`,` - `), arrival port wins, then departure: Mongstad/NO MON → Holmengrå; Sture/NO STU → Fedje vest; Kårstø/NO KAR → Skudefjorden; Melkøya/NO MLK → Fruholmen; else nearest. Label "(to X)"/"(from X)".
- Theme: dark default; light theme uses petrol accent #27535C. Version shown in header ("v1.21"); bump `page-version`, header, title tooltip, `versions.json` (+ `index.vNN.html`) each build.

## TO-DO for next build
(empty — built 2026-11-06: WxWindow TAF Timeline v1.27 (aligned with the dashboard); calculator `sun-moon.html` LOOME 1.9; version history harmonized in all repos; deliveries are in each repo's local clone under `Repos\`)

## Decisions (rejected / settled — do not re-propose)
- ICAO location indicator on fixed installations (ForeFlight, dashboard info card, AIS info box, Worker `/fixed.json`, PDF): dropped by Tom, 2026-11-04. `data/icao_by_installation.json` is kept for reference only.
- LOOME: **moon** azimuth + elevation only (built, v1.9). No sun azimuth/elevation, and the sun and moon curve and its (screen-reader) label "Sun altitude through the day" stay exactly as before. Do not rename it.
- LOOME moon card: azimuth is true bearing with "°T" (integer); elevation is refraction-corrected, signed, one decimal, "Below horizon" under it when negative; no refraction wording. Twilight bands and lux calculation unchanged.
- The floating-glass UI concept (Tom liked it) is **parked**: do not restyle LOOME now. The moon graphic and the sun and moon curve stay exactly as they are; Tom will circle back if he decides on an upgrade.
- There are **three** LOOME copies: dashboard pane, stand-alone, and the AW169 calculator (`sun-moon.html`). Apply every LOOME change to all three.
- The stand-alone LOOME and the dashboard LOOME share the same code and version number (airport naming from v1.8: a large/medium airport within 10 NM names the place). Apply every LOOME change to both.

- WxWindow (stand-alone TAF Timeline, `wxwindow.vercel.app`, linked from the calculator) is kept in step with the dashboard TAF Timeline by hand: v1.27 on 2026-11-06. Dashboard-only theming (`__wdC`, `COLORS` proxy, `__wdTaf`) is not ported. Every future TAF change must be applied to both.
- Calculator ops hours (`data/ops_hours.json`, `scripts/`, `.github/workflows/`) is left untouched by every build (Tom, 2026-11-06).
- Version harmonization (2026-11-06): `versions/` folder + root `versions.json` in every repo; a version log that had ended up in the LOOME repo was moved to the calculator repo.

## Known items / on hold
- Point 5 (disable zoom animation on phones) — on hold unless iOS reloads persist.
- LOOME internal scroll restore doesn't apply on wide screens (single page scroll) — accepted.
- The calculator's `versions.json` is stale for every page except `sun-moon.html` (last entries 2026-09-30; their archive copies exist in no repo). Re-log them when those pages are next changed.
- Photos: 63 vessels+ in ais-photos; credits shown under each image.

## Testing
The Playwright scripts used so far (`sweep.py` full regression across 5 viewports/themes, `seltest.py` selection/ETA, `zoometa.py` out-of-view ETA, `leak2.py` canvas/tile memory) are **not in this repo** (kept with Tom from the original handover). If they are missing, write fresh Playwright checks that mock the Worker/GitHub; with the device shell, also test against the live Worker.
