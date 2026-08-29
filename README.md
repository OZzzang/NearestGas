# NearestGas

Find the cheapest nearby gas station and see it on a map. Eventually: ask an AI chatbot which
station is actually the best deal once your fuel memberships and rewards programs are factored
in (see [Roadmap](#roadmap-not-yet-built) below — that part isn't built yet).

## Features

- **Location search** — use your current location (browser geolocation) or type an address/
  postal code, geocoded via Nominatim.
- **Map + list view** — nearby gas stations plotted on a Google Map, mirrored in a list sortable
  by price or distance. Prices shown in ¢/L (CAD). Click a station's marker (or a row in the
  list) to see its address and price, plus a link straight to that station's real listing on
  Google Maps.
- **Adjustable search radius** (1–25 km) — shown on the map as a circle around a "you are here"
  marker at the search origin, so it's visually clear where every station's distance is measured
  from.
- **Fuel grade selector** — regular / premium / diesel, each with its own live price.
- **Cheapest-station highlighting** — the cheapest station for the selected grade gets a distinct
  marker on the map and a highlighted row in the list.
- **Cache-first backend** — results are served from a MongoDB geospatial cache and only refreshed
  from the live provider on a cache miss or after the 6h TTL expires.
- **No login required.**

## Coverage

Live gas price data currently covers **Quebec only**, via the [Gas Quebec API](https://www.gasquebec.ca)
(free, unauthenticated, real Régie de l'énergie du Québec data — see `PLAN.md` for why this
provider was chosen over the alternatives). The `FuelPriceProvider` interface keeps this
swappable: adding wider coverage later is a one-file change, not a rewrite.

## Roadmap (not yet built)

- **Fuel subscriptions/rewards programs** (Petro-Points, PC Optimum, Journie Rewards, Costco Gas,
  Canadian Tire Triangle, etc.) and a picker UI to select the ones you have.
- **AI chatbot** (Gemini 3.7 Flash) — once subscriptions are wired up, it will recommend the best
  station given your programs and any active deals, computing effective ¢/L in code and using the
  model only to reason about and explain the recommendation. It will only answer gas-station
  questions and decline anything else.

`PLAN.md`'s `## Status` section is the live, phase-by-phase tracker for what's done vs. next.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript (Vite), `@vis.gl/react-google-maps` (Google Maps) for the map |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB (Atlas free tier), Mongoose — geospatial (`2dsphere`) cache of station data |
| Gas price data | [Gas Quebec API](https://www.gasquebec.ca) (free, unauthenticated, Quebec coverage), behind a swappable provider interface |
| Geocoding | Nominatim (OpenStreetMap), cached |
| AI (planned, not yet wired up) | Google Gemini API, `gemini-3.7-flash` via `@google/genai` |
| Deployment | Render (Web Service for the API, Static Site for the frontend) |

## Project structure

```
NearestGas/
  client/     # React + TypeScript frontend (Vite)
  server/     # Express + TypeScript API
  PLAN.md     # full architecture & implementation plan, plus the live status tracker
```

See [`PLAN.md`](./PLAN.md) for the complete architecture, data flow, and design rationale
(including why gas price data is real rather than mocked, how the geospatial cache works, and
the reasoning behind the Gas Quebec provider pick).

## Getting started

You will need:
- Node.js 20+ (built and tested on Node 24)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free (M0) cluster connection string
- A [Gemini API key](https://aistudio.google.com/) — the server currently requires this to boot
  (env validation is all-or-nothing) even though the chatbot itself isn't built yet
- A [Google Maps JavaScript API key](https://console.cloud.google.com/google/maps-apis/credentials)
  (Maps JavaScript API enabled) — the map renders an error state without it
- No fuel-price API key needed — the active provider (Gas Quebec) is free and unauthenticated

### Backend

```bash
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI and GEMINI_API_KEY
npm run dev             # starts the API on http://localhost:4000
```

`GET http://localhost:4000/api/health` should respond `{"status":"ok"}` once it's running.

### Frontend

```bash
cd client
npm install
cp .env.example .env    # fill in VITE_GOOGLE_MAPS_API_KEY; VITE_API_URL defaults to localhost:4000
npm run dev              # starts the app on http://localhost:5173
```

Both `npm run dev` commands watch for changes and reload automatically. Run them in two separate
terminals, then open http://localhost:5173 — try "Use my location" or type a Quebec address (data
coverage is Quebec-only for now, see [Coverage](#coverage)).

## License

MIT — see [`LICENSE`](./LICENSE).
