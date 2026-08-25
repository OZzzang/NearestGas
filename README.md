# NearestGas

Find the cheapest nearby gas station in Canada, see it on a map, and ask an AI chatbot which
station is actually the best deal once your fuel memberships and rewards programs are factored
in.

## Features

- **Location search** — use your current location (browser geolocation) or type in a Canadian
  address/postal code.
- **Map + list view** — nearby gas stations plotted on an OpenStreetMap/Leaflet map, with a
  sortable list alongside it. Prices shown in ¢/L (CAD).
- **Fuel programs** — pick the memberships/rewards programs you have (Petro-Points, PC Optimum,
  Journie Rewards, Costco Gas, Canadian Tire Triangle, etc.).
- **AI chatbot** — ask it for the best station given your location and programs; it computes
  effective per-litre prices in code and uses Claude to reason about and explain the
  recommendation. It only answers gas-station questions — anything else, it politely declines.
- **No login required.**

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript (Vite), `react-leaflet` for the map |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB (Atlas free tier), Mongoose — geospatial (`2dsphere`) cache of station data |
| Gas price data | A real third-party Canadian fuel-price API, behind a swappable provider interface |
| Geocoding | Nominatim (OpenStreetMap), cached |
| AI | Anthropic API, `claude-haiku-4-5` |
| Deployment | Render (Web Service for the API, Static Site for the frontend) |

## Project structure

```
NearestGas/
  client/     # React + TypeScript frontend (Vite)
  server/     # Express + TypeScript API
  PLAN.md     # full architecture & implementation plan
```

See [`PLAN.md`](./PLAN.md) for the complete architecture, data flow, and design rationale
(including why gas price data is real rather than mocked, and how caching works).

## Getting started

You will need:
- Node.js 20+ (built and tested on Node 24)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free (M0) cluster connection string
- An [Anthropic API key](https://console.anthropic.com/)
- An API key for the chosen Canadian fuel-price provider (see `PLAN.md` for options)

### Backend

```bash
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI, ANTHROPIC_API_KEY, FUEL_API_KEY
npm run dev             # starts the API on http://localhost:4000
```

`GET http://localhost:4000/api/health` should respond `{"status":"ok"}` once it's running.

### Frontend

```bash
cd client
npm install
npm run dev              # starts the app on http://localhost:5173
```

Both `npm run dev` commands watch for changes and restart/reload automatically. Run them in
two separate terminals.

## License

MIT — see [`LICENSE`](./LICENSE).
