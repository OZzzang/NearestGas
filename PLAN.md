# NearestGas — Fullstack Gas Price Finder with an AI Chatbot

## Status (update this section as phases complete)

- ✅ **Phase 1 — Scaffold: DONE.** `client/` (Vite + React + TS + react-leaflet installed) and
  `server/` (Express + TS, ESM, structure per below) both scaffolded, type-check clean, and
  verified to build/run. `README.md`, `LICENSE` (MIT), root `.gitignore` added.
- ✅ **Phase 2 — Data layer: DONE.** `Station` + `GeocodeCache` Mongoose models (2dsphere +
  TTL indexes), `FuelPriceProvider` interface, `stationsService` cache-first `$geoNear` flow,
  `geocodeService` (Nominatim, cached), `GET /api/stations` and `GET /api/geocode` routes wired
  in. Type-checks and builds clean; the provider and geocoder were both smoke-tested live
  (real Montreal-area station data and a real Nominatim lookup — see below for details).
  **Provider pivot from the original plan:** research this phase (see "Fuel data provider —
  final decision" below) found the two originally-named providers (Barchart, Apify GasBuddy
  scraper) were both bad fits — Barchart's `getFuelPrices` is trucking/commercial-fuel-stop
  data, not consumer retail stations, and GasBuddy-derived scraping (Apify or the unofficial
  GraphQL API) turns out to violate GasBuddy's own Terms of Service. After surveying the wider
  market (Zyla, CollectAPI, Kalibrate, TomTom, HERE — all either enterprise-gated, low-quality/
  unverified, or ToS-restricted), the **Gas Quebec API** (`gasquebec.ca`, free, unauthenticated,
  official Régie de l'énergie du Québec data) was the only free + legitimate + verified
  station-level option, so it's now the active provider. **This scopes the app's live-data
  coverage to Quebec** (`providers/gasQuebecProvider.ts` enforces this; Gas Quebec's own API
  rejects coordinates outside lat 44–63 / lng -80 to -57) — still fully demonstrates the map,
  caching, and chatbot stack. `FUEL_API_KEY` is now optional in `config.ts` since this provider
  needs no key.
- ✅ **Phase 3 — Frontend map MVP: DONE.** `types.ts` (mirrors server `Station`/response
  shapes), `lib/api.ts` (typed `fetchNearbyStations`/`geocodeAddress` wrappers),
  `hooks/useGeolocation.ts`, and `SearchBar` + `Map` + `StationList` components, all wired
  together in `App.tsx` (Quebec-default center, fuel-grade selector, cheapest-station
  highlighting on both map and list). Default Vite scaffold content (`App.tsx`/`App.css`/
  `index.css`, template assets) fully replaced. Verified live end-to-end in a real browser
  (frontend + backend running together): "use my location" defaults through to a Montreal
  fetch, typed-address search ("Quebec City, QC") geocodes and recenters the map + refetches
  the list, sort-by-price/distance and the fuel selector all work, and the cheapest station is
  highlighted consistently on the map (distinct marker) and list (green row).
  **Bug found + fixed during this verification:** `Map.tsx` originally passed
  `icon={isCheapest ? cheapestIcon : undefined}` to react-leaflet's `Marker` — an explicit
  `undefined` icon prop overwrites Leaflet's built-in default icon option instead of falling
  back to it, crashing every non-highlighted marker (`Cannot read properties of undefined
  (reading 'createIcon')`) and leaving the whole app blank. Fixed by always passing an
  explicit icon (a `new L.Icon.Default()` for the normal case).
- ✅ **Phase 3 follow-ups (post-MVP polish, requested after the initial Phase 3 pass):**
  - **Click-to-focus:** `StationList` rows are now clickable (`onSelect`/`selectedId` passed
    down from `App`) — clicking one pans the map to that station's marker and opens its popup
    (`Map.tsx`'s `FocusSelected` child component, which holds a `markerRefs` map keyed by
    `sourceStationId` so it can look up the right Leaflet marker instance). The row also gets a
    blue selection ring, layered independently of the cheapest station's green highlight so
    both can show at once. Selection resets to `null` on every fresh fetch.
  - **Adjustable search radius:** a "Within" `<select>` next to the fuel selector
    (`RADIUS_OPTIONS_KM` in `App.tsx`) drives the existing `radius` query param — options are
    kept realistic (`1, 2, 3, 5, 10, 25` km, default `2`) rather than exposing the server's full
    200km cap, since nobody detours 100km for cheaper gas.
  - **Search-origin marker + radius circle:** `Map.tsx` now renders a "you are here"-style dot
    (`L.divIcon`, styled via `.marker-origin__dot`, deliberately a different *shape* than the
    station pins so it reads instantly) at the search center, plus a translucent `Circle` sized
    to the current radius — so it's visually obvious where every station's distance is measured
    from and how far the current search actually reaches.
  - Verified live in-browser: changing "Within" refetches with the new `radius`; clicking a
    non-cheapest list row correctly pans + pops open its marker; the origin dot + circle render
    at the searched location with the map's other pins visible relative to it.
- ✅ **Phase 4 — Subscriptions/deals: DONE.** `Program` (name + `brands: string[]` +
  description) and `Deal` (per-program perk, `discountCentsPerLitre: number | null` — `null`
  for points-based perks or a program like Costco's where the saving is already baked into the
  posted price) Mongoose models; `server/src/seed/seedPrograms.ts` (`npm run seed`, idempotent —
  clears + re-inserts) seeded with 7 real Canadian programs matched to the brands
  `gasQuebecProvider` can infer (Petro-Points, PC Optimum, Costco Gas, Triangle Rewards, Journie
  Rewards, Ultramar Récompenses, Shell Go+) — discount figures are labeled illustrative, not a
  live quote of real promotional terms. `dealsService.getAllPrograms()` + `GET /api/programs`
  (mounted in `index.ts`) serve them; client `SubscriptionPicker` component fetches and renders
  them as checkboxes, wired into `App.tsx` via new `selectedProgramIds` state (a `Set<string>`,
  deliberately outside the stations-fetch effect's dependency array since it's for the Phase 5
  chatbot request, not the map). Verified live in-browser: all 7 programs load as checkboxes
  under the search controls, and clicking one toggles its checked state correctly.
- ✅ **Phase 5 — Chatbot: DONE (2026-09-01).** `server/src/lib/gemini.ts` (configured
  `GoogleGenAI` client + `CHAT_MODEL` constant), `chatService.ts` (deterministic
  effective-¢/L math per candidate station — posted price minus the sum of any selected
  program's non-null per-litre deals for that station's brand — computed in code, then
  handed to Gemini as JSON context so it only reasons/explains, never computes or
  invents a price), `POST /api/chat` (`routes/chat.ts`, same Quebec lat/lng bounds as
  `/api/stations`, mounted in `index.ts`), and a `Chatbot` component wired into
  `App.tsx` with `location`/`radius`/`fuel`/`selectedProgramIds`. `types.ts`/`lib/api.ts`
  got `ChatRequest`/`ChatResponse`/`ChatMessage` + a `postChat` POST wrapper (the one
  POST in `api.ts` — everything else there is a GET with query params). Verified live
  end-to-end in-browser: typing "Which station is cheapest for me?" into the new chat
  panel returns a real Gemini reply naming the actual cheapest station from the list
  (Esso, 196.9¢/L) with correct distance; a Petro-Points-selected follow-up correctly
  kept recommending the true cheapest (Costco) since Petro-Points didn't change the
  ranking in that test; an off-topic message ("write me a poem about spring") was
  declined per the system instruction and redirected back to a real recommendation —
  confirming the guardrail works.
  **Model note:** `gemini-3.7-flash` (the owner's original choice) was hitting a
  genuine, sustained `503 UNAVAILABLE "high demand"` from Google during this session
  (confirmed via `ai.models.list()` that the model id itself is real, and that
  `gemini-3.5-flash` succeeds against the same key/code path) — briefly hit a `429
  RESOURCE_EXHAUSTED` "prepayment credits depleted" too during testing, which then
  cleared on its own. Owner chose to keep `CHAT_MODEL` on **`gemini-3.5-flash`** (now
  verified working end-to-end) rather than revert to the still-503ing `gemini-3.7-flash`
  — swap `CHAT_MODEL` in `lib/gemini.ts` back later if 3.7 access matters more than
  uptime.
- 🔄 **Chatbot model switched from Claude Haiku 4.5 to Gemini 3.7 Flash** (owner's choice,
  2026-08-25). `@anthropic-ai/sdk` removed, `@google/genai` (v2.18.0) installed;
  `ANTHROPIC_API_KEY` renamed to `GEMINI_API_KEY` throughout `config.ts`/`.env(.example)`.
  `chatService` itself isn't built yet (Phase 5) — this was a config/plan-only change.
- `server/.env` now has both `MONGODB_URI` and `GEMINI_API_KEY` set — the server boots and
  full end-to-end (frontend + backend) testing is unblocked, even though `chatService` itself
  isn't wired up until Phase 5. `FUEL_API_KEY` is not needed (see above).
- 🔄 **Map switched from Leaflet/OpenStreetMap to Google Maps** (owner's choice, 2026-08-29) —
  the owner didn't like Leaflet's look. `client/src/components/Map.tsx` rewritten on
  `@vis.gl/react-google-maps` (Google's actively-maintained library): Advanced Markers (`Pin`)
  replace Leaflet icons (red pins, green for the cheapest station), `InfoWindow` replaces
  `Popup`, and the library's built-in `Circle` component replaces Leaflet's. `leaflet` +
  `react-leaflet` + `@types/leaflet` removed; `@vis.gl/react-google-maps` + `@types/google.maps`
  (devDependency, needed for the `google.maps.*` ambient types — `tsconfig.app.json`'s `types`
  array had to be widened from just `["vite/client"]` to include `"google.maps"`, since a
  non-empty `types` array otherwise excludes all other ambient `@types/*` packages) added.
  New env vars: `VITE_GOOGLE_MAPS_API_KEY` (required — the map renders an inline error state
  without it) and `VITE_GOOGLE_MAPS_MAP_ID` (optional, defaults to Google's `DEMO_MAP_ID`
  testing placeholder — Advanced Markers require a Map ID; **don't ship `DEMO_MAP_ID` to
  production**, create a real one in Cloud Console > Google Maps Platform > Map Management).
  **Bug found + fixed during verification:** each `StationMarker`/`OriginMarker` initially held
  its own local "is my info window open" state, so clicking a second marker (or list row) left
  the first marker's `InfoWindow` open too — Google's `InfoWindow` instances don't auto-close
  each other the way Leaflet's `map.openPopup()` does by default. Fixed by lifting to a single
  `openMarkerId` piece of state in `Map`, so at most one info window is open at a time, matching
  the old Leaflet behavior. Verified live in-browser end-to-end: pins render, marker click opens
  its info window and closes any other, selecting a list row pans + opens the matching marker
  and closes the previous one, and the cheapest station's green pin shows the "Cheapest nearby"
  tag correctly.
- 🔄 **Station markers switched to Google's stock pin look** (owner's choice, 2026-08-29,
  follow-up to the Google Maps switch above) — regular stations now render Google's own
  default red teardrop pin instead of a custom-colored one; only the cheapest station still
  gets a distinct (green) `Pin`. **Bug found + fixed:** `<AdvancedMarker>` only falls back to
  Google's default pin when it receives **no `children` prop at all** — a falsy child like
  `{isCheapest && <Pin/>}` still counts as "content provided" and rendered a literal 0×0 empty
  marker (confirmed via `getBoundingClientRect()` in-browser: 3 of 4 station markers had
  `width: 0, height: 0`). Fixed in `StationMarker` (`Map.tsx`) by branching to two entirely
  separate `<AdvancedMarker>` elements — one with a `Pin` child (cheapest), one with none
  (everyone else) — rather than conditionally rendering a child inside one element. Verified
  live in-browser via DOM measurement (all 4 markers back to their correct 26×38 pin size) and
  a screenshot (3 default red pins + 1 green pin, click-to-open info windows still working).
- 🔄 **Regular station markers removed entirely — now rely on Google's own native POI icons**
  (owner's choice, 2026-08-29, second follow-up to the Google Maps switch) — the owner wanted
  to click a station on the map and see *Google's own* info about it, not a custom marker.
  `Map.tsx`'s per-station `AdvancedMarker`/`Pin`/`InfoWindow` loop was removed for every
  station except the cheapest one (renamed `CheapestMarker`); regular stations now render
  nothing of our own — Google's base map already shows clickable business-POI icons (gas
  pumps, restaurants, etc.), and clicking one opens *Google's own* default info card (name,
  address, accessibility info, a link into Google Maps) automatically, since neither
  `clickableIcons` nor `event.stop()` is touched anywhere in the app. Also simplified:
  `markerRefs`/`onMarkerReady` (previously threaded through every `StationMarker` so
  `FocusSelected` could look up a marker instance to pan to) is gone — `FocusSelected` now
  reads the selected station's lat/lng straight out of the `stations` prop, since panning
  never actually needed a marker, only coordinates.
  **Known limitation (inherent to the platform, not fixable in our code):** Google's own POI
  icons/labels don't reliably render until fairly close zoom — the app's default zoom (13,
  matching a 1–5km search radius) is too far out for most small business icons, including gas
  stations, to show at all; the user has to zoom in (verified against a real, non-embedded
  google.com/maps tab at the same coordinates) before Google's icon for a given station
  appears and becomes clickable. Also, a station in our data with no matching Google-tagged
  POI at all won't be clickable no matter the zoom — there's no code fix for this, it's a
  tradeoff of the "use Google's own data" approach vs. our previous custom-marker one.
  Verified live in-browser: no marker renders for regular stations at any zoom; the cheapest
  station's green pin still renders and opens its own info window; clicking a real POI icon in
  the embedded map (tested on a restaurant icon, since it renders at lower zoom than the gas
  stations in this test dataset did) pops Google's own native info card, confirming the
  click-to-Google-info mechanism works with zero extra code once our own marker is out of the
  way.
- 🔄 **Reverted to our own marker per station, plus a "View on Google Maps" link** (owner's
  choice, 2026-08-29, third follow-up — the previous change above left the map with "no tags
  at all" at the app's normal zoom level, exactly the known limitation called out at the time)
  — `Map.tsx`'s per-station `AdvancedMarker` (the same `isCheapest ? <Pin/> : nothing`
  branching from two entries back) is back for every station, not just the cheapest, so a pin
  always shows regardless of whether Google has a POI icon there or what zoom the map is at.
  Each station's `InfoWindow` now also has a "View on Google Maps ↗" link (`googleMapsUrl()`
  in `Map.tsx`) — `target="_blank"`, opens `google.com/maps/search/?api=1&query=<name>
  <address>` in a new tab. **Design note:** tried a coordinates-based query
  (`query=<lat>,<lng>`) first since it needs no guessing about address formatting, but verified
  live that it lands on a bare lat/lng-labeled pin with no business info — switched to a
  name+address text query, verified live that it correctly resolves to the station's actual
  Google Maps listing (photo, rating, hours, Google's own live fuel prices, address, website).
  Verified live in-browser end-to-end: all 4 station markers render (3 default red pins + 1
  green cheapest pin), clicking one opens its info window with the price and the Google Maps
  link, and clicking that link opens the correct real listing in a new tab.
- 🔄 **Fixed low-contrast info window text** (owner's report, 2026-08-29, follow-up to the
  above) — the owner said the text looked "too transparent/light" when a marker's info window
  was open. **Cause:** `color` is an inherited CSS property, and `:root` in `index.css` sets it
  to `--text`, which in dark mode (`prefers-color-scheme: dark`) is a light gray-blue meant for
  the app's own dark background — but Google's `InfoWindow` bubble is rendered into the same
  DOM tree and is always a plain white/light background regardless of the app's theme, so that
  light-mode-only color cascaded in and read as washed-out. **Fix:** wrapped each info window's
  content in a `.map-popup` div (`Map.tsx`) and, in `App.css`, gave that class its own
  `--text`/`--cheapest`/`--accent` overrides pinned to their light-mode values, so info window
  text stays readable regardless of which theme the rest of the app is in. Verified live in
  dark mode (the theme the report was made in): station name, address, price, the green
  "Cheapest nearby" tag, and the "View on Google Maps" link are all now solid and legible
  against the white info window bubble.
- 🔄 **Fixed info-window link spacing + added per-brand marker icons** (owner's report,
  2026-08-29, follow-up to the above) — two asks in one pass:
  - **Spacing bug:** the owner said the "View on Google Maps" link sat too close to the price
    "on some markers." **Cause:** the price was a bare text node (no wrapping element), so on
    non-cheapest markers — which had nothing else between it and the link — it flowed inline
    on the same line as `.popup-gmaps-link` (an `inline-block`, whose `margin-top` has nothing
    above it to push away from on the same line). The cheapest-only `.popup-cheapest-tag` div
    happened to force a line break by accident, which is why only non-cheapest markers showed
    the bug. **Fix:** wrapped the price in its own `<div>` in `StationMarker` (`Map.tsx`) so
    every station's info window has consistent block-level spacing regardless of whether the
    cheapest tag is present.
  - **Per-brand marker icons:** the owner asked for station icons on each marker. Before
    building anything, flagged that using real brand logo image assets would mean downloading
    files from brand websites (needs per-file go-ahead) and embedding trademarked artwork —
    the owner asked directly whether that's legally fine for a non-commercial project;
    answered honestly that isn't something to certify (trademark law isn't only about
    monetization, though non-commercial/informational use like this is generally treated
    leniently) and proposed a safer default that gets the same practical benefit. **Implemented:**
    `BRAND_STYLES` in `Map.tsx` — a short abbreviation (e.g. "PC", "E", "S") + each brand's
    real public brand *color* (not logo artwork) per entry in `KNOWN_BRANDS`
    (`server/src/providers/gasQuebecProvider.ts`), rendered via `Pin`'s `background`/`glyph`/
    `glyphColor` props; a brand with no match (or `station.brand === null`) falls back to a
    neutral gray pin with a generic fuel-pump emoji glyph (`DEFAULT_BRAND_STYLE`). The cheapest
    station keeps its distinct treatment via a gold `borderColor` + slightly larger `scale`
    instead of the plain green pin used before, so brand color is visible on every marker
    including the cheapest one.
  Verified live in-browser: Esso markers show a dark-blue pin with a white "E", Shell a yellow
  pin with a red "S", Petro-Canada a red pin with a white "PC"; the cheapest station's pin has
  a visible gold border and is slightly larger than the rest; clicking any marker still opens
  its info window with the price on its own line, properly spaced above the Google Maps link.
- 🔄 **Added the same brand badge to the info window** (owner's follow-up, 2026-08-29) — the
  owner initially asked for the brand badge inside the marker's glyph too (tried a generic
  fuel-pump SVG icon replacing the letter, mid-implementation), then interrupted to clarify
  the actual ask was narrower: leave the map pins exactly as they were (brand color + letter),
  and instead repeat that same badge inside the info window that opens on click. Reverted the
  fuel-pump-icon attempt. `StationMarker` (`Map.tsx`) now renders a `.popup-badge` span (same
  `background`/`glyphColor`/`abbr` from `BRAND_STYLES` as the marker's own `Pin`) as the first
  thing inside the info window. Owner then asked for that badge to move to its own line at the
  top (was inline next to the name) and be bigger, plus for the popup's spacing to be tightened
  overall. Restructured every line of the info window (name, address, price) into its own block
  `<div>` — badge now stacks above the name instead of sitting beside it — and sized the badge
  up from 20px to 36px (`.popup-badge` in `App.css`), removing the now-unused flex-row wrapper
  it previously needed. Verified live in-browser: Shell's info window shows a large yellow
  circular "S" badge at the top, directly above "Shell", with no extra gap before the address/
  price/link below it.
- 🔄 **Added per-IP rate limiting on `/api/chat`** (owner's request, 2026-09-01, prompted
  by hitting the Gemini account's own credits limit during Phase 5 testing) — every
  chat request is a real, billed Gemini call, unlike the other routes, so it's the one
  endpoint that needed its own throttle before the owner tops up billing.
  `express-rate-limit` (`^8.7.0`) added; `routes/chat.ts` applies a 10 requests/minute
  per-IP limiter (`standardHeaders: true` — `RateLimit-*`/`Retry-After` response headers
  — so a well-behaved client can back off instead of hammering it) directly on the
  `POST /` handler, ahead of the zod body validation. `index.ts` also gained
  `app.set("trust proxy", 1)` — without it, every request behind Render's one reverse-
  proxy hop in production would resolve to the proxy's own IP, so every visitor would
  share a single 10/min budget instead of getting their own; `1` trusts exactly that one
  hop's `X-Forwarded-For` entry rather than the whole header (which a client could
  otherwise spoof to bypass the limiter). Verified live: the first 10 rapid-fire
  requests each reached Gemini (and failed on the account's own depleted-credits error,
  unrelated to this change); the 11th came back `429` with `{"error":"Too many chat
  requests — please wait a minute and try again."}` before reaching Gemini at all, and
  the response headers showed `RateLimit-Remaining: 0` / `Retry-After: 52`.
- 🐛 **Fixed a real bug: out-of-Quebec searches showed raw JSON as the error** (found
  during a broader app test pass, 2026-09-01) — `geocodeAddress`/Nominatim isn't bounded
  to Quebec, so a real, valid address outside it (tested with "Toronto, ON") geocodes
  successfully and then only fails downstream at `/api/stations`'s zod validation
  (`lat`/`lng` bounds). `client/src/lib/api.ts`'s `request()`/`postChat()` were rendering
  that failure's `error` field — a zod `flatten().fieldErrors` object, e.g. `{"lat":
  ["lat must be within Quebec (44-63)"]}` — via `JSON.stringify`, so the user saw that
  literal JSON blob instead of a sentence. **Fix:** added `errorMessage()` in `api.ts`,
  shared by both wrappers, that joins a `fieldErrors`-shaped object's messages into one
  readable string (falls back to a plain string `error` or a generic "Request failed"
  as before). Verified live: the same Toronto search now shows `lat must be within
  Quebec (44-63)` instead of the raw object, while the previously-loaded (stale but
  still valid) Montreal results correctly stay on screen rather than being cleared.
  **Also ruled out during this pass:** the subscription checkboxes appeared to reset
  after this same failed search, which looked like a second bug — traced it to the
  browser-automation `form_input` tool setting a checkbox's DOM `.checked` without
  firing React's change event, so it visually "stuck" until the next re-render silently
  reverted it to React's real (never-updated) state. A real mouse click on the same
  checkbox was confirmed to persist correctly across re-renders — not an app bug, an
  automation-tool artifact.
- ✅ **Full app pass, 2026-09-01 (after the owner topped up Gemini billing).** Beyond the
  chatbot bug fix and rate limiter above, this pass also verified: diesel fuel type
  (stations with no diesel price correctly show `—` and are excluded from the cheapest
  calculation rather than sorting as free/zero); selecting multiple fuel programs at
  once; an empty address search correctly no-ops client-side rather than firing a
  request; and the chatbot's full round-trip with real Gemini credits restored — asked
  "Which diesel station is cheapest?" and got back a reply correctly grounded in the
  actual displayed diesel prices, correctly comparing the two same-priced Esso stations
  by distance. `gemini-3.5-flash` + the new rate limiter both confirmed working
  together. "Use my location" remains unverified by automation (native OS/browser
  permission prompt outside the page — verified live by a human in an earlier session
  per Phase 3 above); everything else in the app has no known open bugs.
- 🔄 **Phase 6 groundwork (2026-09-01):** `render.yaml` added (a Render Blueprint deploying
  both services in one pass, secrets left as `sync: false` so nothing sensitive is
  committed); `README.md` rewritten to match current reality (was still describing
  Leaflet and "chatbot not built yet"); scaffold branding cleaned up — `client/public/
  icons.svg` (a dead, unused sprite sheet of Discord/Bluesky/GitHub/X icons) deleted,
  and `favicon.svg` (a generic purple scaffold blob) replaced with a simple fuel-drop
  icon in the app's own accent color. Per the owner's request, portfolio/resume/
  internship framing was also stripped from this file's design-rationale sections
  (the "Why/goal" paragraph, the TypeScript/stationsService/chatService rationale, the
  "narrate the TypeScript" instruction) — those decisions still stand, just described
  as plain engineering rationale now. `README.md`'s deployment instructions were
  removed per the same request (it now covers only what the app is and how to run it
  locally; `render.yaml` and this file's own Deployment section still have the real
  steps).
- 🐛 **Fixed a real production bug: geocoding 502ed on every request** (found live on
  the deployed Render app, 2026-09-01, immediately after first deploy) — the owner
  reported every address/postal-code search failing on `https://nearestgas-web.onrender.com`.
  Diagnosed by isolating the failure: `/api/health` was fine, `/api/stations` for an
  *uncached* location succeeded (a fresh, live Gas Quebec provider call — proving
  outbound internet access worked from Render in general), but `/api/geocode` 502ed on
  every query, including full addresses independently confirmed (via a direct curl from
  outside Render) to have real Nominatim matches. That isolates the failure to Nominatim
  specifically rejecting/being unreachable from Render's servers — a known, documented
  issue: Nominatim's usage policy blocks/throttles shared cloud-hosting IP ranges
  (Render, Heroku, AWS Lambda, etc. all hit this) even with a compliant `User-Agent`,
  since many unrelated apps share overlapping egress IPs. **Fix, at the owner's choice:**
  swapped `geocodeService.ts` from Nominatim to the **Google Geocoding API** — same
  public interface and Mongo caching, just a different upstream call
  (`components=country:CA` mirrors the old `countrycodes=ca`). Needs its own **server-
  side** key, `GOOGLE_GEOCODING_API_KEY` (added to `config.ts`'s required env, `server/
  .env.example`, and `render.yaml`) — deliberately separate from the client's
  `VITE_GOOGLE_MAPS_API_KEY` since this one is called server-side (no browser `Referer`
  to restrict against) and should be API-restricted (Geocoding API only) rather than
  restricted by HTTP referrer. **Still needs:** the owner creating that key in Cloud
  Console (Geocoding API enabled, key restricted) and setting it locally + on Render —
  not yet verified live end-to-end pending that key.
- **Nothing has been committed to git.** The owner handles all git operations themselves —
  never run `git init`/`add`/`commit`/`push` on this project.

## Fuel data provider — final decision (supersedes "The gas-price data problem" below)

The section below this one ("The gas-price data problem…") reflects the *original* Phase-1
plan and is kept for the historical reasoning, but its recommendation is outdated — Phase 2
research determined it doesn't hold up:

- **Barchart `getFuelPrices`**: its response fields (`weighScales`, `truckSpaces`,
  `dieselLanes`, `showers`, a diesel-centric `productName` filter) indicate this is a
  commercial/trucking fuel-stop API, not consumer retail gas stations.
- **Apify GasBuddy scraper / unofficial GasBuddy GraphQL access (`py-gasbuddy`)**: GasBuddy's
  own Terms of Service explicitly prohibit automated scraping/scripted access to their data.
  Both routes are built on a ToS violation, not just a reliability risk.
- **Zyla "Real-Time Canadian Fuel Prices API" / "Canada Fuel Stations API" (same underlying
  product listed twice) and CollectAPI's Gas Price API**: same thin response shape (station
  name + address + price, no lat/lng), $37.99+/mo minimum, and Zyla's own published sample
  response shows `price: null` for every example station — reliability unconfirmed.
- **Kalibrate, TomTom Fuel Prices API, HERE Fuel Prices API**: real, legitimate industry data,
  but all enterprise-gated — no self-serve signup (HERE's is explicitly automotive-OEM-only).

**Active provider: Gas Quebec API** (`https://www.gasquebec.ca/api`, OpenAPI spec at
`gasquebec.ca/openapi.json`) — free, unauthenticated, 120 req/min per IP, real Régie de
l'énergie du Québec data, verified live against `GET /api/stations/nearby?lat&lng&radius&
fuelType&limit&sort`. Returns `regular`/`premium`/`diesel` ¢/L per station (no midgrade — the
Quebec market doesn't report one, so the `Station` model was adjusted to match reality rather
than the original 4-grade assumption) plus lat/lng, address, and city; no `brand` field, so
`gasQuebecProvider.ts` infers it via substring match against a known-brand list. Mandatory
attribution text (`GAS_QUEBEC_ATTRIBUTION` in `gasQuebecProvider.ts`) is threaded through
`stationsService` into every `/api/stations` response for the frontend to display in Phase 3.
**Coverage is Quebec-only** — this is the real tradeoff for "free + legit + station-level";
revisit if the project later wants to expand beyond Quebec (the `FuelPriceProvider` interface
makes swapping/adding a provider a one-file change).

## Context

**What we're building:** A web app that finds the best nearby gas prices for a person's
location (current GPS or a typed-in address) and shows the stations on a map — "Google Maps,
but for the cheapest gas." On top of that, an **AI chatbot** recommends the single best station
given the user's fuel subscriptions/memberships (Petro-Canada Petro-Points, Esso/PC Optimum,
Costco Gas, Journie Rewards, Canadian Tire Triangle, etc.) and any active deals. The chatbot
does *only* this task and politely declines anything else.

**Market: Canada.** The owner is based in Canada, so this targets **Canadian** gas prices:
prices are in **cents per litre (¢/L)**, currency is **CAD**, and the fuel-program list is the
Canadian one (above). Location search accepts Canadian postal codes / addresses / cities.

**Why / goal:** A fullstack app with a real, useful core (find the cheapest nearby gas) plus a
genuine LLM integration (a chatbot that recommends the best station given the user's fuel
programs) layered on top. The design prioritizes: clear, readable code where "what is what" is
obvious; a real, demonstrable feature set (REST API, MongoDB geospatial queries, external-API
integration, caching, LLM integration); no login/auth; and easy deployment on the owner's
existing paid **Render** plan.

**Decisions already made (with the owner):**
- **Real data, not mock.** Gas prices come from a real, low-cost third-party API (see below).
- **TypeScript** for both frontend and backend, throughout.
- **Gemini** (via `@google/genai`) powers the chatbot — the owner's choice (switched from the
  original Claude Haiku 4.5 plan on 2026-08-25); cheap, fast, generous free tier, ideal for
  this constrained recommender task. **Active model is `gemini-3.5-flash`** (`CHAT_MODEL` in
  `server/src/lib/gemini.ts`) — see the 2026-09-01 Status entries above for why (`gemini-3.7-flash`
  hit a sustained outage during Phase 5 testing).
- **Map:** Google Maps via `@vis.gl/react-google-maps` (switched from Leaflet/OpenStreetMap
  2026-08-29, owner's choice — see Status above). Requires a `VITE_GOOGLE_MAPS_API_KEY`.

## The gas-price data problem (and how we solve it)

There is **no free, official, station-level Canadian gas price API** — GasBuddy covers Canada but
has no public API, and government data (Natural Resources Canada, via
[OilPriceAPI](https://www.oilpriceapi.com/gasoline-prices/canada)) is only *province-level weekly
averages*, not individual stations — so it can't drive a "nearest stations" map.

The realistic low-cost, **station-level, Canadian** options are marketplace / pay-as-you-go:
- [Barchart OnDemand `getFuelPrices`](https://www.barchart.com/ondemand/api/getFuelPrices)
  — supports **Canadian postal codes** + coordinates + radius, returns stations. **Primary
  recommendation** (Canada coverage + docs).
- [Apify "Fuel Price Scraper"](https://apify.com/johnvc/fuelprices) — GasBuddy-derived, covers
  Canadian locations, returns postal code, cash/credit ¢/L, distance. Pay-per-result (cheapest),
  but it's scraping (ToS/reliability caveats). Alternative.

Final provider choice happens at signup time (needs the owner's API key either way); both sit
behind the same interface, so the pick is low-risk and swappable.

### How the data flows — ONE provider, ONE model (not multiple providers combined)

To clear up the earlier confusion: **we use a single active provider at a time.** The
`FuelPriceProvider` interface is *not* about querying several sources at once — it's a single
**seam** so that, if the chosen vendor changes its pricing/terms, we swap it by editing **one
file** (`providers/*.ts`) and nothing else. Whatever that one provider returns is **normalized
into one `Station` shape** and stored in **one** MongoDB `stations` collection. MongoDB is just a
**cache** of that provider's data. The flow:

```
request → check MongoDB stations ($near, fresh?) ──hit──► return cached stations
                     │ miss / stale
                     ▼
        the ONE active FuelPriceProvider  ─► normalize to Station ─► geocode if needed
                     │                                            (Google Geocoding, cached)
                     ▼
        upsert into MongoDB stations (2dsphere + TTL) ─► return
```

Benefits: few external calls → low cost, fast, resilient to rate limits; we still **showcase
MongoDB geospatial queries** even with real data; and the vendor is swappable in one place.
Providers that return only an address (no lat/lng) are geocoded via the **Google Geocoding API**
(server-side key, restricted to that one API — see the 2026-09-01 Status entry on why this
isn't Nominatim anymore) and cached in Mongo so each address is geocoded at most once.

## Architecture overview

```
Browser (React + TS + Google Maps)
   │  1. gets location (GPS or typed address → /api/geocode)
   │  2. GET /api/stations?lat&lng&radius&fuel  → nearby stations (map pins + list)
   │  3. POST /api/chat  { message, subscriptions } → best-station recommendation
   ▼
Express + TS API  ──────────────────────────────────────────────
   • stationsService: Mongo cache ($near) → on miss, FuelPriceProvider → geocode → cache
   • dealsService:    app-owned subscriptions/programs + active deals (seeded, editable)
   • chatService:     compute effective prices in code, then Gemini reasons+explains
   ▼                         ▼                          ▼
MongoDB Atlas (free M0)   Gas Quebec API             Gemini API (@google/genai)
  - stations (2dsphere,     (free, unauthenticated,    model: gemini-3.5-flash
    TTL cache; ¢/L)          Quebec coverage)
  - programs / deals
  - geocodeCache
```

## Tech stack (concrete)

- **Frontend:** React + TypeScript via **Vite** (fast, modern, minimal config — not the
  deprecated CRA). `@vis.gl/react-google-maps` for the map (needs `VITE_GOOGLE_MAPS_API_KEY`).
  Native `fetch` (or `axios`) for API calls. Plain CSS or CSS modules (keep styling
  simple/readable).
- **Backend:** Node + **Express** + TypeScript. **Mongoose** (typed ODM) for MongoDB.
  `@google/genai` for Gemini. `dotenv` for secrets, `cors`, `zod` for request/env validation
  (light touch), `tsx`/`ts-node` for dev, `tsc` build.
- **Database:** **MongoDB Atlas M0 (free)** — Render doesn't host Mongo; Atlas free tier is the
  standard pairing and connects via `MONGODB_URI`.
- **Deploy (Render):** backend = **Web Service**; frontend = **Static Site**. Secrets
  (`GEMINI_API_KEY`, `MONGODB_URI`, `FUEL_API_KEY`) set as Render env vars.

## Project structure (monorepo, two clear apps)

```
NearestGas/
  client/                      # React + TS (Vite)
    src/
      components/  Map.tsx, StationList.tsx, SearchBar.tsx, Chatbot.tsx, SubscriptionPicker.tsx
      hooks/       useGeolocation.ts, useStations.ts
      lib/         api.ts       # typed fetch wrappers
      types.ts                  # shared client-side types (Station, Program, ChatResponse)
      App.tsx, main.tsx
  server/                      # Express + TS
    src/
      index.ts                  # app bootstrap, middleware, route mounting
      routes/      stations.ts, chat.ts, geocode.ts, deals.ts
      services/    stationsService.ts, chatService.ts, dealsService.ts, geocodeService.ts
      providers/   fuelProvider.ts        # FuelPriceProvider interface
                   gasQuebecProvider.ts   # concrete adapter (swappable)
      models/      Station.ts, Program.ts, Deal.ts, GeocodeCache.ts   # Mongoose schemas + TS types
      lib/         gemini.ts              # configured Gemini client
      seed/        seedPrograms.ts        # subscriptions + demo deals
      config.ts                            # typed env loading (zod)
    .env.example
  README.md                     # setup, run, deploy, architecture diagram
```

## Backend design

**Models (Mongoose schemas with matching TS interfaces):**
- `Station`: `{ sourceStationId, name, brand, address, city,
  location: { type:'Point', coordinates:[lng,lat] }, prices: { regular, premium, diesel },
  fetchedAt }` — prices stored in **¢/L (CAD)**. No `midgrade`: the active provider (Gas
  Quebec) doesn't report one, and Quebec retail stations generally don't sell it, so the
  model matches what's real rather than the original 4-grade assumption. **2dsphere index on
  `location`**, TTL index on `fetchedAt` (6h) so stale cache auto-expires. Implemented in
  `server/src/models/Station.ts`.
- `Program`: Canadian fuel subscription/membership — `{ id, name, type:'membership'|'rewards'|
  'card', discount: { kind:'centsOffPerLitre'|'percent', amount }, applicableBrands: string[],
  membershipCostCad? }`. Seed examples: Petro-Canada Petro-Points, Esso/Mobil + PC Optimum,
  Journie Rewards (Chevron/Ultramar/Pioneer/Fas Gas), Shell Go+/Air Miles, Canadian Tire Triangle,
  Costco Gas (membership).
- `Deal`: `{ programId|brand, description, discount, validFrom, validTo }`.
- `GeocodeCache`: `{ query, location }` so each address/typed search is geocoded once.

**Endpoints:**
- `GET /api/stations?lat&lng&radius&fuel` → stationsService: query Mongo `$near`; on cache miss
  or thin results, call `FuelPriceProvider.getStations()`, geocode any address-only stations,
  upsert into Mongo, return combined list (map pins + list view).
- `GET /api/geocode?q=<address>` → geocodeService: Google Geocoding lookup (cached) → `{lat,lng}` for the
  typed-location search box.
- `GET /api/deals` and `GET /api/programs` → dealsService reads seeded reference data.
- `POST /api/chat` `{ message, subscriptions: string[], lat, lng }` → chatService (below).

**Key service logic — `stationsService`:** the cache-first pattern is the centerpiece of this
service. Reuse the same fetch/upsert path everywhere; keep the provider call behind the interface.

**Chatbot service (`chatService`) — the AI integration:**
1. Get nearby stations (via stationsService) + the user's selected `subscriptions` + active deals.
2. **In code**, compute each station's *effective* ¢/L (posted ¢/L − applicable per-litre
   discounts; factor membership cost in CAD where relevant) — deterministic math, so prices are
   never hallucinated.
3. Call **Gemini** (`ai.models.generateContent({ model: CHAT_MODEL /* gemini-3.5-flash */, contents,
   config: { systemInstruction, maxOutputTokens: ~1024 } })`) with a tight **system instruction**
   that (a) constrains it to *only* gas-station recommendation, declining off-topic asks, and
   (b) is given the structured stations + effective prices + subscriptions as context (via
   `contents`). Gemini picks the best station and explains the reasoning conversationally
   (membership tradeoffs, "worth the detour?", grade choice).
   - This "deterministic data + LLM for reasoning/explanation" split is a standard retrieve-then-
     reason pattern, and keeps numbers accurate.
   - Streaming (`ai.models.generateContentStream(...)`) is an optional enhancement for a nicer
     typing effect.

Use `@google/genai`: `new GoogleGenAI({ apiKey: config.geminiApiKey })`, then
`ai.models.generateContent(...)` — verify the exact current API shape against the SDK's docs
when `chatService` is actually implemented (Phase 5), since this is a fast-moving SDK.

## Frontend design

- **`SearchBar`**: "Use my location" (browser Geolocation API via `useGeolocation`) or type an
  address (→ `/api/geocode`). An adjustable "Within" radius selector (1–25 km, see Status above)
  sits alongside it in `App.tsx`'s controls row and feeds the same `/api/stations` fetch.
- **`Map`** (`@vis.gl/react-google-maps`): Google Maps tiles; recenters on the chosen location.
  An Advanced Marker per station, colored + labeled by brand (`BRAND_STYLES` in `Map.tsx` — a
  short abbreviation like "PC"/"E"/"S" plus each brand's real public brand color, deliberately
  not logo artwork, to sidestep any trademark/asset-licensing question) regardless of whether
  Google's own base map has a POI icon there or what zoom the map is at; a brand not in the
  list (or `station.brand === null`) falls back to a neutral gray pin. The cheapest station
  additionally gets a gold border and a slightly larger pin. Each station's info window opens
  with that same brand badge at the top (`.popup-badge`, same color + abbreviation as the
  marker's own `Pin`, so the popup visually echoes the pin just clicked), then the name,
  address, price, and a "View on Google Maps ↗" link (`googleMapsUrl()`, a
  `google.com/maps/search` URL built from the station's name + address) that opens that
  station's real Google Maps listing in a new tab.
  Clicking a station in `StationList` pans the map there and opens its info window (at most one
  of our own info windows open at a time, tracked via a single `openMarkerId` in `Map`, since
  Google's `InfoWindow`s don't auto-close each other the way Leaflet's popups did). A "you are
  here" dot + translucent circle mark the search origin and current radius.
- **`StationList`**: sortable list (by price / distance) mirroring the map pins; clicking a row
  selects it (see `Map` above) and shows a blue ring independent of the cheapest highlight.
- **`SubscriptionPicker`**: checkboxes for the user's fuel programs (no login — just client state,
  optionally persisted to `localStorage`).
- **`Chatbot`**: simple chat panel → `POST /api/chat` with message + selected subscriptions +
  current location; renders Gemini's recommendation.
- **`lib/api.ts` + `types.ts`**: typed fetch wrappers and shared types so the client is fully typed
  end-to-end.
- **Prices display** as `¢/L` (CAD), e.g. `145.9 ¢/L`; the cheapest (effective) station is
  highlighted on both map and list.
- **Styling:** light, clean **custom CSS** (simple cards, highlighted cheapest station, tidy chat
  panel) — a touch polished, no heavy UI framework, kept readable. Fine to stay near-default.

## Deployment (Render + Atlas)

1. **MongoDB Atlas** free M0 cluster → `MONGODB_URI` (allow Render egress IPs / 0.0.0.0 for dev).
2. **Backend** → Render **Web Service** (Node): build `npm install && npm run build`, start
   `node dist/index.js`; env vars `MONGODB_URI`, `GEMINI_API_KEY`, `FUEL_API_KEY`,
   `CLIENT_ORIGIN`.
3. **Frontend** → Render **Static Site**: build `npm run build`, publish `client/dist`, env vars
   `VITE_API_URL` → backend URL, `VITE_GOOGLE_MAPS_API_KEY` (restricted to the deployed origin),
   and `VITE_GOOGLE_MAPS_MAP_ID` (a real Map ID — don't ship the `DEMO_MAP_ID` dev placeholder).
   Enable CORS on the backend for the static-site origin.
4. Run the seed script once (programs + demo deals) against Atlas.

## Implementation phases (milestone order)

1. ✅ **Scaffold** monorepo: `client` (Vite React TS) + `server` (Express TS), `.env.example`,
   README skeleton, Atlas connection. Verify both run locally.
2. ✅ **Data layer:** Mongoose models + indexes; `FuelPriceProvider` interface + first concrete
   provider; `stationsService` cache-first flow; `geocodeService`. Verify `GET /api/stations`
   returns real, cached stations.
3. ✅ **Frontend map MVP:** SearchBar + geolocation + Map + StationList wired to `/api/stations`.
   Verify pins + prices render for a real location.
4. ✅ **Subscriptions/deals:** models + seed + `SubscriptionPicker`. Verify programs load and select.
5. ✅ **Chatbot:** `chatService` (effective-price math + Gemini + constrained system
   instruction) + `Chatbot` UI. Verify it recommends a best station and refuses off-topic requests.
6. ➡️ **Polish + deploy (in progress):** styling, error/empty states, README (setup +
   architecture), deploy to Render, smoke-test end-to-end in production.

## Prerequisites the owner must provide (at implementation time)

- **Gemini API key** (from aistudio.google.com) → `GEMINI_API_KEY`. ✅ done.
- **MongoDB Atlas** free cluster → `MONGODB_URI`. ✅ done.
- **Google Maps JavaScript API key** (Cloud Console, Maps JavaScript API enabled) →
  `VITE_GOOGLE_MAPS_API_KEY`. ✅ done (2026-08-29).
- ~~A fuel-price API key~~ — not needed; the active provider (Gas Quebec) is free and
  unauthenticated.
  (Runnable locally end-to-end once `GEMINI_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` are set;
  deploys to the existing Render plan.)

## Verification (end-to-end)

- **Backend:** `curl "/api/stations?lat=..&lng=..&radius=5&fuel=regular"` returns real stations;
  a second identical call is served from the Mongo cache (no new provider call — confirm via logs).
  `/api/geocode?q=<address>` returns coordinates. `POST /api/chat` returns a best-station rec and
  refuses an off-topic prompt (e.g. "write me a poem").
- **Frontend:** load app → "use my location" (or type an address) → map shows priced pins + list;
  pick subscriptions → ask the chatbot → get a grounded recommendation with reasoning.
- **Prod smoke test:** repeat the above against the deployed Render URLs.
