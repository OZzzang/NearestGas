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
- ➡️ **Phase 4 — Subscriptions/deals: NEXT.** `Program`/`Deal` Mongoose models + seed script +
  `SubscriptionPicker` component. Verify programs load and are selectable client-side.
- 🔄 **Chatbot model switched from Claude Haiku 4.5 to Gemini 3.7 Flash** (owner's choice,
  2026-08-25). `@anthropic-ai/sdk` removed, `@google/genai` (v2.18.0) installed;
  `ANTHROPIC_API_KEY` renamed to `GEMINI_API_KEY` throughout `config.ts`/`.env(.example)`.
  `chatService` itself isn't built yet (Phase 5) — this was a config/plan-only change.
- `server/.env` now has both `MONGODB_URI` and `GEMINI_API_KEY` set — the server boots and
  full end-to-end (frontend + backend) testing is unblocked, even though `chatService` itself
  isn't wired up until Phase 5. `FUEL_API_KEY` is not needed (see above).
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

**Why / goal:** This is a portfolio/resume project. Its purpose is to give the owner hands-on
experience (a) building and shipping a fullstack app and (b) integrating a basic AI system
(an LLM chatbot) into that app — the two things current tech internships look for. So the design
prioritizes: clear, readable code where "what is what" is obvious; a genuinely demonstrable
skill set (REST API, MongoDB geospatial queries, external-API integration, caching, LLM
integration); no login/auth; and easy deployment on the owner's existing paid **Render** plan.

**Decisions already made (with the owner):**
- **Real data, not mock.** Gas prices come from a real, low-cost third-party API (see below).
- **TypeScript** for both frontend and backend. The owner knows some JavaScript and wants TS
  concepts explained carefully *as we build* — so implementation must narrate the TS parts
  (types, interfaces, generics, typed async, Mongoose typing, etc.), not just produce code.
- **Gemini 3.7 Flash** (`gemini-3.7-flash`, via `@google/genai`) powers the chatbot — the
  owner's choice (switched from the original Claude Haiku 4.5 plan on 2026-08-25); cheap,
  fast, generous free tier, ideal for this constrained recommender task.
- **Map:** Leaflet + OpenStreetMap via `react-leaflet` — free, no API key, no billing.

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
                     │                                                    (Nominatim, cached)
                     ▼
        upsert into MongoDB stations (2dsphere + TTL) ─► return
```

Benefits: few external calls → low cost, fast, resilient to rate limits; we still **showcase
MongoDB geospatial queries** even with real data; and the vendor is swappable in one place.
Providers that return only an address (no lat/lng) are geocoded via **Nominatim (OpenStreetMap,
free — covers Canada)** and cached in Mongo so each address is geocoded at most once.

## Architecture overview

```
Browser (React + TS + Leaflet)
   │  1. gets location (GPS or typed address → /api/geocode)
   │  2. GET /api/stations?lat&lng&radius&fuel  → nearby stations (map pins + list)
   │  3. POST /api/chat  { message, subscriptions } → best-station recommendation
   ▼
Express + TS API  ──────────────────────────────────────────────
   • stationsService: Mongo cache ($near) → on miss, FuelPriceProvider → geocode → cache
   • dealsService:    app-owned subscriptions/programs + active deals (seeded, editable)
   • chatService:     compute effective prices in code, then Gemini 3.7 Flash reasons+explains
   ▼                         ▼                          ▼
MongoDB Atlas (free M0)   Gas Quebec API             Gemini API (@google/genai)
  - stations (2dsphere,     (free, unauthenticated,    model: gemini-3.7-flash
    TTL cache; ¢/L)          Quebec coverage)
  - programs / deals
  - geocodeCache
```

## Tech stack (concrete)

- **Frontend:** React + TypeScript via **Vite** (fast, modern, minimal config — not the
  deprecated CRA). `react-leaflet` + `leaflet` for the map. Native `fetch` (or `axios`) for API
  calls. Plain CSS or CSS modules (keep styling simple/readable).
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
- `GET /api/geocode?q=<address>` → geocodeService: Nominatim lookup (cached) → `{lat,lng}` for the
  typed-location search box.
- `GET /api/deals` and `GET /api/programs` → dealsService reads seeded reference data.
- `POST /api/chat` `{ message, subscriptions: string[], lat, lng }` → chatService (below).

**Key service logic — `stationsService`:** the cache-first pattern is the centerpiece resume
skill. Reuse the same fetch/upsert path everywhere; keep the provider call behind the interface.

**Chatbot service (`chatService`) — the AI integration:**
1. Get nearby stations (via stationsService) + the user's selected `subscriptions` + active deals.
2. **In code**, compute each station's *effective* ¢/L (posted ¢/L − applicable per-litre
   discounts; factor membership cost in CAD where relevant) — deterministic math, so prices are
   never hallucinated.
3. Call **Gemini 3.7 Flash** (`ai.models.generateContent({ model: 'gemini-3.7-flash', contents,
   config: { systemInstruction, maxOutputTokens: ~1024 } })`) with a tight **system instruction**
   that (a) constrains it to *only* gas-station recommendation, declining off-topic asks, and
   (b) is given the structured stations + effective prices + subscriptions as context (via
   `contents`). Gemini picks the best station and explains the reasoning conversationally
   (membership tradeoffs, "worth the detour?", grade choice).
   - This "deterministic data + LLM for reasoning/explanation" split is the exact retrieve-then-
     reason pattern internships want, and keeps numbers accurate.
   - Streaming (`ai.models.generateContentStream(...)`) is an optional enhancement for a nicer
     typing effect.

Use `@google/genai`: `new GoogleGenAI({ apiKey: config.geminiApiKey })`, then
`ai.models.generateContent(...)` — verify the exact current API shape against the SDK's docs
when `chatService` is actually implemented (Phase 5), since this is a fast-moving SDK.

## Frontend design

- **`SearchBar`**: "Use my location" (browser Geolocation API via `useGeolocation`) or type an
  address (→ `/api/geocode`).
- **`Map`** (`react-leaflet`): OSM tiles, a marker per station with a price popup; recenters on the
  chosen location. Cheapest station highlighted.
- **`StationList`**: sortable list (by price / distance) mirroring the map pins.
- **`SubscriptionPicker`**: checkboxes for the user's fuel programs (no login — just client state,
  optionally persisted to `localStorage`).
- **`Chatbot`**: simple chat panel → `POST /api/chat` with message + selected subscriptions +
  current location; renders Gemini's recommendation.
- **`lib/api.ts` + `types.ts`**: typed fetch wrappers and shared types so the client is fully typed
  end-to-end — a natural place to teach TS interfaces/generics.
- **Prices display** as `¢/L` (CAD), e.g. `145.9 ¢/L`; the cheapest (effective) station is
  highlighted on both map and list.
- **Styling:** light, clean **custom CSS** (simple cards, highlighted cheapest station, tidy chat
  panel) — a touch polished, no heavy UI framework, kept readable. Fine to stay near-default.

## Deployment (Render + Atlas)

1. **MongoDB Atlas** free M0 cluster → `MONGODB_URI` (allow Render egress IPs / 0.0.0.0 for dev).
2. **Backend** → Render **Web Service** (Node): build `npm install && npm run build`, start
   `node dist/index.js`; env vars `MONGODB_URI`, `GEMINI_API_KEY`, `FUEL_API_KEY`,
   `CLIENT_ORIGIN`.
3. **Frontend** → Render **Static Site**: build `npm run build`, publish `client/dist`, env var
   `VITE_API_URL` → backend URL. Enable CORS on the backend for the static-site origin.
4. Run the seed script once (programs + demo deals) against Atlas.

## Implementation phases (milestone order)

1. **Scaffold** monorepo: `client` (Vite React TS) + `server` (Express TS), `.env.example`,
   README skeleton, Atlas connection. Verify both run locally.
2. **Data layer:** Mongoose models + indexes; `FuelPriceProvider` interface + first concrete
   provider; `stationsService` cache-first flow; `geocodeService`. Verify `GET /api/stations`
   returns real, cached stations.
3. **Frontend map MVP:** SearchBar + geolocation + Map + StationList wired to `/api/stations`.
   Verify pins + prices render for a real location.
4. **Subscriptions/deals:** models + seed + `SubscriptionPicker`. Verify programs load and select.
5. **Chatbot:** `chatService` (effective-price math + Gemini 3.7 Flash + constrained system
   instruction) + `Chatbot` UI. Verify it recommends a best station and refuses off-topic requests.
6. **Polish + deploy:** styling, error/empty states, README (setup + architecture), deploy to
   Render, smoke-test end-to-end in production.

Throughout: **narrate the TypeScript** — explain each new type/interface/generic and typed async
pattern as it's introduced, since the owner is learning TS while building.

## Prerequisites the owner must provide (at implementation time)

- **Gemini API key** (from aistudio.google.com) → `GEMINI_API_KEY` (for Gemini 3.7 Flash).
- **MongoDB Atlas** free cluster → `MONGODB_URI`. ✅ done.
- ~~A fuel-price API key~~ — not needed; the active provider (Gas Quebec) is free and
  unauthenticated.
  (Runnable locally end-to-end once `GEMINI_API_KEY` is set; deploys to the existing Render plan.)

## Verification (end-to-end)

- **Backend:** `curl "/api/stations?lat=..&lng=..&radius=5&fuel=regular"` returns real stations;
  a second identical call is served from the Mongo cache (no new provider call — confirm via logs).
  `/api/geocode?q=<address>` returns coordinates. `POST /api/chat` returns a best-station rec and
  refuses an off-topic prompt (e.g. "write me a poem").
- **Frontend:** load app → "use my location" (or type an address) → map shows priced pins + list;
  pick subscriptions → ask the chatbot → get a grounded recommendation with reasoning.
- **Prod smoke test:** repeat the above against the deployed Render URLs.
