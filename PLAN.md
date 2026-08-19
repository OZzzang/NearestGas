# NearestGas — Fullstack Gas Price Finder with an AI Chatbot

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
- **Claude Haiku 4.5** (`claude-haiku-4-5`) powers the chatbot — cheapest capable model, ideal
  for this constrained recommender task.
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
   • chatService:     compute effective prices in code, then Claude Haiku 4.5 reasons+explains
   ▼                         ▼                          ▼
MongoDB Atlas (free M0)   Third-party fuel API      Anthropic API (@anthropic-ai/sdk)
  - stations (2dsphere,     (Barchart / Apify,         model: claude-haiku-4-5
    TTL cache; ¢/L)          Canada, one active)
  - programs / deals
  - geocodeCache
```

## Tech stack (concrete)

- **Frontend:** React + TypeScript via **Vite** (fast, modern, minimal config — not the
  deprecated CRA). `react-leaflet` + `leaflet` for the map. Native `fetch` (or `axios`) for API
  calls. Plain CSS or CSS modules (keep styling simple/readable).
- **Backend:** Node + **Express** + TypeScript. **Mongoose** (typed ODM) for MongoDB.
  `@anthropic-ai/sdk` for Claude. `dotenv` for secrets, `cors`, `zod` for request/env validation
  (light touch), `tsx`/`ts-node` for dev, `tsc` build.
- **Database:** **MongoDB Atlas M0 (free)** — Render doesn't host Mongo; Atlas free tier is the
  standard pairing and connects via `MONGODB_URI`.
- **Deploy (Render):** backend = **Web Service**; frontend = **Static Site**. Secrets
  (`ANTHROPIC_API_KEY`, `MONGODB_URI`, `FUEL_API_KEY`) set as Render env vars.

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
                   barchartProvider.ts    # concrete adapter (swappable)
      models/      Station.ts, Program.ts, Deal.ts, GeocodeCache.ts   # Mongoose schemas + TS types
      lib/         anthropic.ts           # configured Anthropic client
      seed/        seedPrograms.ts        # subscriptions + demo deals
      config.ts                            # typed env loading (zod)
    .env.example
  README.md                     # setup, run, deploy, architecture diagram
```

## Backend design

**Models (Mongoose schemas with matching TS interfaces):**
- `Station`: `{ name, brand, address, location: { type:'Point', coordinates:[lng,lat] },
  prices: { regular, midgrade, premium, diesel }, postedAt, fetchedAt }` — prices stored in
  **¢/L (CAD)**. **2dsphere index on `location`**, TTL index on `fetchedAt` (e.g. 6–24h) so stale
  cache auto-expires.
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
3. Call **Claude Haiku 4.5** (`client.messages.create`, `model: 'claude-haiku-4-5'`,
   `max_tokens: ~1024`) with a tight **system prompt** that (a) constrains it to *only* gas-station
   recommendation, declining off-topic asks, and (b) is given the structured stations + effective
   prices + subscriptions as context. Claude picks the best station and explains the reasoning
   conversationally (membership tradeoffs, "worth the detour?", grade choice).
   - This "deterministic data + LLM for reasoning/explanation" split is the exact retrieve-then-
     reason pattern internships want, and keeps numbers accurate.
   - Streaming (`client.messages.stream`) is an optional enhancement for a nicer typing effect.

Use `@anthropic-ai/sdk` per the loaded `claude-api` skill: default client (`new Anthropic()` reads
`ANTHROPIC_API_KEY`), plain `messages.create` — no extended thinking needed for this task.

## Frontend design

- **`SearchBar`**: "Use my location" (browser Geolocation API via `useGeolocation`) or type an
  address (→ `/api/geocode`).
- **`Map`** (`react-leaflet`): OSM tiles, a marker per station with a price popup; recenters on the
  chosen location. Cheapest station highlighted.
- **`StationList`**: sortable list (by price / distance) mirroring the map pins.
- **`SubscriptionPicker`**: checkboxes for the user's fuel programs (no login — just client state,
  optionally persisted to `localStorage`).
- **`Chatbot`**: simple chat panel → `POST /api/chat` with message + selected subscriptions +
  current location; renders Claude's recommendation.
- **`lib/api.ts` + `types.ts`**: typed fetch wrappers and shared types so the client is fully typed
  end-to-end — a natural place to teach TS interfaces/generics.
- **Prices display** as `¢/L` (CAD), e.g. `145.9 ¢/L`; the cheapest (effective) station is
  highlighted on both map and list.
- **Styling:** light, clean **custom CSS** (simple cards, highlighted cheapest station, tidy chat
  panel) — a touch polished, no heavy UI framework, kept readable. Fine to stay near-default.

## Deployment (Render + Atlas)

1. **MongoDB Atlas** free M0 cluster → `MONGODB_URI` (allow Render egress IPs / 0.0.0.0 for dev).
2. **Backend** → Render **Web Service** (Node): build `npm install && npm run build`, start
   `node dist/index.js`; env vars `MONGODB_URI`, `ANTHROPIC_API_KEY`, `FUEL_API_KEY`,
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
5. **Chatbot:** `chatService` (effective-price math + Claude Haiku 4.5 + constrained system
   prompt) + `Chatbot` UI. Verify it recommends a best station and refuses off-topic requests.
6. **Polish + deploy:** styling, error/empty states, README (setup + architecture), deploy to
   Render, smoke-test end-to-end in production.

Throughout: **narrate the TypeScript** — explain each new type/interface/generic and typed async
pattern as it's introduced, since the owner is learning TS while building.

## Prerequisites the owner must provide (at implementation time)

- **Anthropic API key** → `ANTHROPIC_API_KEY` (for Haiku 4.5).
- **A fuel-price API key** → sign up for the chosen Canadian provider (recommend starting with
  Barchart OnDemand `getFuelPrices`; the Apify GasBuddy scraper is a drop-in alternative behind the
  same interface).
- **MongoDB Atlas** free cluster → `MONGODB_URI`.
  (Runnable locally end-to-end once these three exist; deploys to the existing Render plan.)

## Verification (end-to-end)

- **Backend:** `curl "/api/stations?lat=..&lng=..&radius=5&fuel=regular"` returns real stations;
  a second identical call is served from the Mongo cache (no new provider call — confirm via logs).
  `/api/geocode?q=<address>` returns coordinates. `POST /api/chat` returns a best-station rec and
  refuses an off-topic prompt (e.g. "write me a poem").
- **Frontend:** load app → "use my location" (or type an address) → map shows priced pins + list;
  pick subscriptions → ask the chatbot → get a grounded recommendation with reasoning.
- **Prod smoke test:** repeat the above against the deployed Render URLs.
