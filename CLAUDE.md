# CLAUDE.md – WeatherDashboard (Tom A. Østrem)

Repo `tomandreas/WeatherDashboard` → Vercel `wxdashboard.vercel.app` (local clone `C:\Users\tom_o\Documents\Repos\WeatherDashboard`). One page with three apps: **TAF Timeline**, **LOOME Night Ops**, **Vessels** (AIS map). Read this file first in every session; it wins over the general rules (`CentralMemories\GENERAL_RULES.md`, cross-app status in `CentralMemories\STATUS.md`; on Tom's PCs also loaded through the `Repos\CLAUDE.md` stub) if they conflict. Cloud sessions (claude.ai/code) have no Repos folder: attach the GitHub repo `tomandreas/CentralMemory` and read those files from it.

The ForeFlight AIS layer itself (Cloudflare Worker `worker.js`, ForeFlight pack, symbology, Fixed Offshore Installations source data) is **not in this repo**; its notes are in `C:\Users\tom_o\Documents\Repos\CentralMemories\SHARED_TECHNICAL_KNOWLEDGE.md` (ST-07; full original in `CentralMemories\archive\ChatGPT-claude__CLAUDE.md`); the source is in `ChatGPT\current\` and `ChatGPT\build\` (copy in `CentralMemories\workers\foreflight-ais\`). This repo's dashboard depends on the Worker's endpoints (listed below).

## Working rules (from Tom — always follow)
1. **Never build until Tom says "build"** (or "bygg"); this includes bug fixes (diagnose, propose, wait). Collect requests in the to-do list meanwhile.
2. **"Build" = everything on the to-do list.** Start every build summary with the list of what is included.
3. **For every change, evaluate unintended consequences** and state them (before build when discussing, and in the build summary).
4. Ask before building when a design choice is open; give a recommendation.
5. File names never change. Version history follows the **Versioning convention** below.
6. **Language: always answer in English, even when Tom writes Norwegian.** Short answers: result or to-do list first, then unintended consequences.
7. Layer use is **by agreement with Tom A. Østrem only**; no price anywhere in docs.
8. Test every build (see Testing) at phone, iPad portrait/landscape and PC, light + dark theme.
9. **Where files go.** Write build files straight into this clone (`Documents\Repos\WeatherDashboard`). If this session can push, Claude commits and pushes (never secrets); otherwise Tom does. Deploys: Vercel deploys the dashboard on push; `taf-alerts` is deployed with `npx wrangler deploy` (Claude Code on Tom's PC may run it as part of a build; cloud sessions cannot reach api.cloudflare.com, so then it is Tom's step); `foreflight-ais` is always pasted by Tom in the Cloudflare dashboard. Never write scratch files into his folders; never overwrite a file Tom may have edited since you read it (check, re-read if changed). Claude memories go only in `CentralMemories` (`ChatGPT\claude` is frozen), never in an app repo.
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
| WeatherDashboard | GitHub repo `WeatherDashboard` → Vercel `wxdashboard.vercel.app` (`index.html`, `versions.json`, `versions/index.vNN.html`) | **1.23** (TAF Timeline v1.28, LOOME Night Ops v1.9, Vessels v1.17) |
| Vessel photo upload API | `api/vessel-photo.js` (Vercel function) | v1.1 + `setMmsi` action |
| Admin tool | `admin.html` + `api/vessel-admin.js` (Vercel) | 1.0 |
| TAF bell Worker | `CentralMemories\workers\taf-alerts\` (`worker.js`, `wrangler.toml`, `make-vapid.mjs`, `test.mjs`, `README.md`) → Cloudflare Worker `taf-alerts.tom-ostrem-airlift-github.workers.dev` (KV `ALERTS`, cron every 2 min). Deployed with `npx wrangler deploy` from that folder | **1.0** (built and deployed 2026-11-17) |
| Service worker | `sw.js` | Network-first offline cache of the page, `minima.js`, manifest and icons; never caches `api/`. Since 1.23 also `push` and `notificationclick` handlers for the TAF bell |
| PWA manifest | `manifest.json` | Installable app (name "WeatherDashboard", standalone, dark theme colour) |
| Approach minima data | `minima.js` | Generated from the minima workbook (AIRAC 2026-09-03: ILS/LPV/LOC/LNAV/VOR, MSA, RVR by DH and approach lights). Replace the file for each AIRAC update |
| TAF/METAR proxy | `api/wx.js` | Vercel function proxying raw TAF/METAR (aviationweather.gov and MET Norway); needs Vercel env var `MET_USER_AGENT` |
| Photo repo | GitHub `tomandreas/ais-photos` → `https://tomandreas.github.io/ais-photos/` (`photos.json`, `vessels.json`, `MMSI-n.jpg`) | — |
| LOOME Night Ops stand-alone | GitHub repo `tomandreas/LOOME` (`index.html`, `sw.js`, `manifest.json`, `versions.json`, icons; same LOOME code as the dashboard pane, own page) | **1.9** |
| LOOME Night Ops in the AW169 calculator (Norway edition) | `sun-moon.html` in GitHub repo `tomandreas/Airlift-AW169Calculator` (public; Claude can read it, only Tom can push). Norway-only gazetteer, `← Tools` back link, own icons, map limited to Norway, no service worker | **1.9** (updated 2026-11-06) |
| Legend PDF generator | `tools/pdf/build_legend_pdf.py` (ReportLab, icons in `tools/pack/icons/`) — **not in this repo** (no `tools/` folder here; kept with Tom) | PDF v1.6 |

## Tom's GitHub repositories

The full list of Tom's repositories (public and private, with status and local clone; 15 on GitHub after two were deleted on 2026-11-17) is kept in `CentralMemories\PROJECT_REGISTRY.md`; cross-app status in `CentralMemories\STATUS.md`. Repos this dashboard depends on: `LOOME`, `WxWindow`, `Airlift-AW169Calculator`, `ais-photos` (GitHub Pages). Not all repos are public.

Local clones: `C:\Users\tom_o\Documents\Repos\<repo>` (git installed, global name/email set; clone of ais-photos intentionally not made). Before copying files in and pushing, always `git pull` first — the calculator repo has a nightly bot (02:15 UTC, `data/ops_hours.json`) that commits on its own; `ais-photos` receives uploads directly.

Not in any of these repos: Worker `worker.js` and the ForeFlight pack. Their source is in the private repo `github.com/tomandreas/ChatGPT` (`current\`, `build\`; local clone `C:\Users\tom_o\Documents\Repos\ChatGPT`), with a copy in `CentralMemories\workers\foreflight-ais\` since 2026-11-17. Claude memories and shared knowledge live in `CentralMemories` (`ChatGPT\claude\` is frozen).

## Versioning convention (same in every repo — Tom decided 2026-11-06)
- Each repo has a `versions.json` in its root (multi-file format: `files → "<page>.html" → {current, versions:[{v, label, file, archived, note, bytes, sha}]}`; `v` is the sequential log number used in the archive name, `label` is the human version such as 1.21; an entry whose archive copy does not exist anywhere carries `"missing": true`; an optional top-level `_note` explains the log) and a **`versions/`** folder with the archive copies, named `<page>.v<NN>.html` (e.g. `versions/index.v21.html`, `versions/ferry.v6.html`). Nothing reads these files at runtime; they are our change log and rollback copies.
- The live file always keeps its normal name (`index.html`, `sun-moon.html`, …). The repo root holds only live files, `versions.json` and the `versions/` folder.
- **Every delivery** into this clone `Repos\<repo>\` contains: the new live file (overwriting the previous one), its own copy as `versions/<page>.v<NN>.html`, the previous live file archived as `versions/<page>.v<NN-1>.html` if it is not already there (for a repo's first delivery take it from the repo itself), and the updated `versions.json`. Committed and pushed per rule 9 (Claude when the session can push, otherwise Tom).
- Moves and deletions are done with `git mv` / `git rm`: Claude runs them when the session can push, otherwise they are given to Tom as commands.

### Secrets (names only — values are with Tom)
- Cloudflare Worker: `BW_CLIENT_ID`, `BW_CLIENT_SECRET` (BarentsWatch client `tom.ostrem@airlift.no:foreflight-ais`, scope `ais`), optional `RIG_MMSI`, `ROT_MIN` (default 5 °/min), `HIDE_MMSI`, `PHOTOS_URL`, `DASHBOARD_ORIGINS` (default `https://wxdashboard.vercel.app`).
- Cloudflare Worker `taf-alerts`: secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (made by `make-vapid.mjs`, piped straight into `wrangler secret put`, never shown or pasted in chat); vars in its `wrangler.toml`: `VAPID_SUBJECT`, `ALLOWED_ORIGINS`, `MET_USER_AGENT`.
- Vercel: `GITHUB_TOKEN` (fine-grained, ais-photos Contents R/W), `UPLOAD_CODE`, `ADMIN_CODE`, optional `PHOTOS_REPO`.

### Deploy order (always)
0. `taf-alerts` Worker (only when it changed or is new): `npx wrangler deploy` from `CentralMemories\workers\taf-alerts`; it must be live before a dashboard that has the TAF bell.
1. Worker first (Cloudflare dashboard: Workers & Pages > foreflight-ais > Edit code > paste `worker.js` > Deploy (all deployments so far are "Manually deployed", source Dashboard, verified by Tom 2026-11-17)) when the dashboard depends on new endpoints. Roll back under Deployments in the same Worker. No `wrangler.toml` exists.
2. Dashboard (`index.html` + `index.vNN.html` + `versions.json`, and any `api/*.js`) → push to WeatherDashboard (Vercel auto-deploys).
3. ForeFlight pack only when layers/icons/PDF change → Tom imports `AIS_Foreflight_Layer.zip` on the iPads.
4. After each build Tom commits and pushes the target repo (always `git pull` first). Memories and notes are committed to `CentralMemories` at the end of a build; `ChatGPT` only when the Worker source changed.

## Worker 1.10 — endpoints
- `/` KML for ForeFlight: params `bbox`, `types`, `vec`, `shape`, `maxage`, `mapheading`. Layers in the pack: AIS South (56–65.5N, 0–13E), AIS North (65–82N, 4–35E), AIS Tankers and Rigs (56–82N, 0–35E, types tanker,rig,heavylift).
- `/fixed.kml` Fixed Offshore Installations layer (refresh 60 s). `/fixed.json` same for dashboard (`sup:1` when shown via AIS).
- `/live.json` dashboard map: `?bbox=S,W,N,E` | `?mmsi=a,b` | `?name=EXACT`; `&air=1` adds aircraft. CORS to dashboard only.
- `/track.json?mmsi=…&min=60` breadcrumbs from BarentsWatch historic API (`historic.ais.barentswatch.no/v1/historic/tracks/{mmsi}/{from}/{to}`), cached 25 s.
- `/vessels.csv` (aircraft excluded), `/status` (version, ROT format, photos, `aisModel` full/basic).
- AIS source: `live.ais.barentswatch.no/v1/latest/combined?modelType=Full` (falls back to basic hourly if refused). Destination/ETA from Full model; ETA "1 Jan 00:00" = not set.
- Filters: MMSI 111… (SAR aircraft) **never in ForeFlight**; on dashboard only with `&air=1`. `HIDE_MMSI` hides vessels. SOG ≥102.2 kt = not available. Stale >30 min grey, removed >180 min.
- Photos: `photos.json` re-read every 2 min.

## WeatherDashboard Vessels (v1.17) — behaviour to preserve
- Wide screens (≥1100 px): one page scroll; TAF + LOOME side by side, Vessel Information full width below ("Vessel Information" heading aligned with "Live Traffic"). Phones: Vessels tab. "VESSELS ↓" button next to IFR/VFR switch.
- Search: choosing a vessel shows it alone ("← All results (n)"); card shows position age, SOG/COG, destination, ETA (LT), station ETA, mini-map (⤢ Expand), photos, upload. Save MMSI for listed vessels without MMSI (upload code).
- Upload checks: MMSI required only if vessel has none; Find MMSI (AIS lookup + picker); format `^[2-7]\d{8}$`; name≠AIS → hard stop ("Use AIS name"); MMSI not in AIS → "Upload anyway"; no duplicate MMSI; same name/different MMSI → "Add as separate"/"Go to existing".
- Map (Leaflet 1.9.4 from cdnjs, OSM + OpenSeaMap seamarks [off by default on phones]): one shared canvas renderer `L.canvas({padding:0.15})` passed as map `renderer` — **never add a second canvas** (it swallows taps). Tiles `keepBuffer:1, updateWhenZooming:false`. Refresh 30 s. Ship symbols on canvas from zoom 7, names+speed from zoom 9, vectors 2 px grey from zoom 8. Aircraft layer (helicopter symbol, navy, no vectors).
- Layers panel: Tankers, Rigs & heavy-lift, Cargo, Service/offshore, Passenger, Fishing/other, Aircraft (SAR), Fixed offshore installations, Stations, Vessel names & speed, Vectors & turn curves, Seamarks, Only vessels with photos (saved in localStorage `ves.layers`).
- Selection: tap selects (ring, breadcrumbs, info box); ✕ keeps selection; tap same target again deselects; double tap <0.4 s ignored; collapsing card in list deselects.
- Breadcrumbs (selected target only): grey 3 px dots, no line, fade to 25 %; vessels 1 dot / 2 min for 60 min (±60 s); aircraft 1 dot / 30 s for 45 min (±15 s); gaps where no report.
- ETA to point: target = open sea, station, fixed installation, or vessel/aircraft (**intercept**: earliest meeting point, A at own speed, B constant course/speed; "No intercept at current speed"; A <0.5 kt → no ETA). Dashed line + label (LT), persisted in localStorage `ves.eta`, ✕ removes, Esc cancels.
- All ETAs in Norwegian local time "15:42 LT" (Europe/Oslo, DST automatic).
- Stations (dark blue stars, names): Holmengrå 60.85/4.4316, Fedje vest 60.7667/4.465, Skudefjorden 59.033/5.167, Crew Change Bergen 60.22883/4.51117, Ona Pilotboarding 62.933/6.45, Fruholmen 71.092/23.45, Crew Change Hammerfest 71.1505/23.07967, Grip Ytre 63.25/7.5983 (63°15.0'N 007°35.9'E, added 2026-11-15; last in the list because terminal rules refer to stations by position).
- Station ETA for tankers, rigs, heavy-lift: destination FROM>TO (separators `=>`,`->`,`>`,` - `), arrival port wins, then departure: Mongstad/NO MON → Holmengrå; Sture/NO STU → Fedje vest; Kårstø/NO KAR → Skudefjorden; Melkøya/NO MLK → Fruholmen; else nearest. Label "(to X)"/"(from X)".
- Theme: dark default; light theme uses petrol accent #27535C. Version shown in header (now "v1.23"); bump `page-version`, header, title tooltip, `versions.json` (+ `index.vNN.html`) each build.

## TAF Timeline v1.28 — behaviour to preserve
- Flight sliders: flight time starts at 1:00 and counts as set; set departure OR ETA and the other is calculated (ETA first: departure = ETA − flight time, never before now). Departure, flight time and ETA are saved per device in `taft.flight` (only when departure and ETA are both set) and restored on load if the departure is still in the future. When the departure time has passed (checked every 30 s and on return to the app) or on Clear: blank departure/ETA, flight time 1:00, saved state removed. A changed flight time alone is not saved. Same code in WxWindow (v1.28).
- TAF bell (dashboard only): one bell on the TAF line of each card with a TAF. Outline = off, solid amber = armed. Tap: asks notification permission (first time), subscribes, tells the `taf-alerts` Worker, which remembers the TAF issue time that is current. One push when a TAF with a LATER issue time appears (new issue, amendment or correction), then the alert is deleted and the bell returns to an outline (server is the truth; the page syncs via `/status` on start and on return, and the service worker messages an open page when the push arrives). Tap a solid bell: cancels. TAF only, never METAR. Without push support (a Safari tab on iOS) the tap shows "Notifications only work in the app added to the Home Screen". Worker source of truth: `CentralMemories\workers\taf-alerts\`.

## TO-DO for next build
(empty — built 2026-11-17: Dashboard 1.23 / TAF Timeline v1.28 (flight sliders 1:00 default, persistent, reset when the departure passes; TAF bell), WxWindow 1.28 (sliders), new Worker `taf-alerts` 1.0, `sw.js` push handlers. Earlier build 2026-11-15: Dashboard 1.22 / Vessels v1.17: new station Grip Ytre (63.25 / 7.5983), nearest-station logic only. Earlier build 2026-11-11: `api/vessel-photo.js` replaced with the content of the root `vessel-photo.js`, which restores the `setMmsi` action (Save MMSI); dashboard stays 1.21, `index.html` unchanged; CLAUDE.md component list and paths corrected. Earlier build 2026-11-06: WxWindow TAF Timeline v1.27 (aligned with the dashboard); calculator `sun-moon.html` LOOME 1.9; version history harmonized in all repos; deliveries are in each repo's local clone under `Repos\`)

## Decisions (rejected / settled — do not re-propose)
- ICAO location indicator on fixed installations (ForeFlight, dashboard info card, AIS info box, Worker `/fixed.json`, PDF): dropped by Tom, 2026-11-04. `data/icao_by_installation.json` is kept for reference only.
- LOOME: **moon** azimuth + elevation only (built, v1.9). No sun azimuth/elevation, and the sun and moon curve and its (screen-reader) label "Sun altitude through the day" stay exactly as before. Do not rename it.
- LOOME moon card: azimuth is true bearing with "°T" (integer); elevation is refraction-corrected, signed, one decimal, "Below horizon" under it when negative; no refraction wording. Twilight bands and lux calculation unchanged.
- The floating-glass UI concept (Tom liked it) is **parked**: do not restyle LOOME now. The moon graphic and the sun and moon curve stay exactly as they are; Tom will circle back if he decides on an upgrade.
- There are **three** LOOME copies: dashboard pane, stand-alone, and the AW169 calculator (`sun-moon.html`). Apply every LOOME change to all three.
- The stand-alone LOOME and the dashboard LOOME share the same code and version number (airport naming from v1.8: a large/medium airport within 10 NM names the place). Apply every LOOME change to both.

- WxWindow (stand-alone TAF Timeline, `wxwindow.vercel.app`, linked from the calculator) is kept in step with the dashboard TAF Timeline by hand: v1.27 on 2026-11-06, v1.28 on 2026-11-17 (flight sliders; the TAF bell is dashboard-only, Tom 2026-11-17). Dashboard-only theming (`__wdC`, `COLORS` proxy, `__wdTaf`) is not ported. Every future TAF change must be applied to both.
- Calculator ops hours (`data/ops_hours.json`, `scripts/`, `.github/workflows/`) is left untouched by every build (Tom, 2026-11-06).
- Version harmonization (2026-11-06): `versions/` folder + root `versions.json` in every repo; a version log that had ended up in the LOOME repo was moved to the calculator repo.

- Station Grip Ytre (Tom, 2026-11-15): added as a normal station with **no terminal-to-station rule**; it is used only as the nearest station. Do not add a rule unless Tom names a terminal.

- TAF flight sliders (Tom, 2026-11-17): flight time defaults to 1:00; the saved flight times are cleared when the DEPARTURE time passes (not when the ETA passes); Clear also returns to 1:00.
- TAF bell (Tom, 2026-11-17): a NEW separate Worker `taf-alerts` (not inside `foreflight-ais`, to keep the SAR layer safe); any later TAF issue counts as new (amendments and corrections too); TAF only; one notification per tap; dashboard only (WxWindow is another site and would need its own subscription).

## Known items / on hold
- TAF bell: Tom confirmed on his iPhone (home-screen app) on 2026-11-17 that it works (bell armed through the live `taf-alerts` Worker, waiting for the next TAF). Android/desktop untested. `taf-alerts` deploy is Tom's step (the device shell cannot reach api.cloudflare.com).
- Point 5 (disable zoom animation on phones) — on hold unless iOS reloads persist.
- LOOME internal scroll restore doesn't apply on wide screens (single page scroll) — accepted.
- The calculator's `versions.json` is stale for every page except `sun-moon.html` (last entries 2026-09-30; their archive copies exist in no repo). Re-log them when those pages are next changed.
- Photos: 63 vessels+ in ais-photos; credits shown under each image.

## Testing
The Playwright scripts used so far (`sweep.py` full regression across 5 viewports/themes, `seltest.py` selection/ETA, `zoometa.py` out-of-view ETA, `leak2.py` canvas/tile memory) are **not in this repo** (kept with Tom from the original handover). If they are missing, write fresh Playwright checks that mock the Worker/GitHub; with the device shell, also test against the live Worker.
