# NearestGas

Find the cheapest nearby gas station, see it on a map, and ask an AI chatbot which station is
actually the best deal once your fuel memberships and rewards programs are factored in.

## Features

- **Location search** — use your current location (browser geolocation) or type an address/
  postal code, geocoded via Nominatim.
- **Map + list view** — nearby gas stations plotted on a Google Map (brand-colored markers, no
  logo artwork — see [Architecture notes](#architecture-notes)), mirrored in a list sortable by
  price or distance. Prices shown in ¢/L (CAD). Click a station's marker (or a row in the list)
  to see its address and price, plus a link straight to that station's real listing on Google
  Maps.
- **Adjustable search radius** (1–25 km) — shown on the map as a circle around a "you are here"
  marker at the search origin, so it's visually clear where every station's distance is measured
  from.
- **Fuel grade selector** — regular / premium / diesel, each with its own live price.
- **Cheapest-station highlighting** — the cheapest station for the selected grade gets a distinct
  marker on the map and a highlighted row in the list.
- **Fuel loyalty programs** — pick which Canadian fuel programs you belong to (Petro-Points, PC
  Optimum, Costco Gas, Triangle Rewards, Journie Rewards, Ultramar Récompenses, Shell Go+).
- **AI chatbot** — ask which station is the best deal for you. The app computes each candidate
  station's *effective* ¢/L in code (posted price minus your selected programs' applicable
  discounts) — deterministic, never hallucinated — and Gemini reasons over that data to
  recommend one and explain why. It only answers gas-station questions and declines anything
  else. Rate-limited per IP since every request is a billed Gemini call (see
  [Architecture notes](#architecture-notes)).
- **Cache-first backend** — results are served from a MongoDB geospatial cache and only refreshed
  from the live provider on a cache miss or after the 6h TTL expires.
- **No login required.**

## Coverage

Live gas price data currently covers **Quebec only**, via the [Gas Quebec API](https://www.gasquebec.ca)
(free, unauthenticated, real Régie de l'énergie du Québec data — see `PLAN.md` for why this
provider was chosen over the alternatives). The `FuelPriceProvider` interface keeps this
swappable: adding wider coverage later is a one-file change, not a rewrite.

`PLAN.md`'s `## Status` section is the live, phase-by-phase history of everything built and
verified so far.

## Architecture notes

A few decisions worth knowing before reading the code:

- **Effective price is computed server-side, in code — never by the model.** `chatService`
  works out each candidate station's discounted ¢/L from your selected programs' deals before
  Gemini ever sees the data; Gemini's only job is picking one and explaining the reasoning. This
  keeps the numbers trustworthy regardless of what the model does.
- **Station markers use brand *color*, not logo artwork.** `BRAND_STYLES` in `Map.tsx` renders a
  short abbreviation (e.g. "PC", "E", "S") on each brand's real public color, to get the same
  practical benefit as a logo without embedding trademarked images.
- **`/api/chat` is rate-limited per IP** (10 requests/minute, `express-rate-limit`) — every
  request is a real, billed Gemini call, so this is the one route that needs its own throttle
  independent of the app's normal usage. In production behind Render's reverse proxy,
  `app.set("trust proxy", 1)` in `index.ts` keeps per-IP limiting accurate instead of treating
  every visitor as one shared IP.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript (Vite), `@vis.gl/react-google-maps` (Google Maps) for the map |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB (Atlas free tier), Mongoose — geospatial (`2dsphere`) cache of station data |
| Gas price data | [Gas Quebec API](https://www.gasquebec.ca) (free, unauthenticated, Quebec coverage), behind a swappable provider interface |
| Geocoding | Nominatim (OpenStreetMap), cached |
| AI | Google Gemini API, `gemini-3.5-flash` via `@google/genai` |

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
- A [Gemini API key](https://aistudio.google.com/) — the server requires this to boot (env
  validation is all-or-nothing) and it powers the chatbot
- A [Google Maps JavaScript API key](https://console.cloud.google.com/google/maps-apis/credentials)
  (Maps JavaScript API enabled) — the map renders an error state without it
- No fuel-price API key needed — the active provider (Gas Quebec) is free and unauthenticated

### Backend

```bash
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI and GEMINI_API_KEY
npm run seed             # one-time: seeds fuel loyalty programs + demo deals
npm run dev               # starts the API on http://localhost:4000
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
coverage is Quebec-only for now, see [Coverage](#coverage)), pick your fuel programs, and ask the
chatbot for a recommendation.

## License

MIT — see [`LICENSE`](./LICENSE).
