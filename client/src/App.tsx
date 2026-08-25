/**
 * App — Phase 3 (frontend map MVP): SearchBar + geolocation + Map + StationList, wired
 * to GET /api/stations. `location` is the one piece of state everything else derives
 * from — set it (via geolocation or a typed address) and the effect below fetches
 * fresh stations for it.
 */
import { useEffect, useMemo, useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { Map } from "./components/Map";
import { StationList } from "./components/StationList";
import { SubscriptionPicker } from "./components/SubscriptionPicker";
import { ApiError, fetchNearbyStations } from "./lib/api";
import type { FuelType, LatLng, Station } from "./types";
import "./App.css";

// Coverage is Quebec-only (see PLAN.md — active provider is Gas Quebec), so default to
// downtown Montreal rather than, say, (0, 0), before the user picks a real location.
const DEFAULT_LOCATION: LatLng = { lat: 45.5017, lng: -73.5673 };
const DEFAULT_RADIUS_KM = 2;
// A driving/walking-distance range for "gas near me" — the server itself allows up to
// 200km (routes/stations.ts: `z.coerce.number().positive().max(200)`), but nobody
// detours 100km for cheaper gas, so the options offered here stay realistic.
const RADIUS_OPTIONS_KM = [1, 2, 3, 5, 10, 25];

function App() {
  const [location, setLocation] = useState<LatLng>(DEFAULT_LOCATION);
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [fuel, setFuel] = useState<FuelType>("regular");
  const [stations, setStations] = useState<Station[]>([]);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which station the map is currently focused on, driven by clicking a row in
  // StationList. Reset on every fresh fetch below so a selection from a previous
  // search doesn't linger and point at a station that's no longer in the list.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which fuel loyalty programs the user says they belong to — feeds the Phase 5
  // chatbot recommendation, not the /api/stations fetch above, so it deliberately
  // isn't in that effect's dependency array.
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());

  function toggleProgram(id: string) {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchNearbyStations({ ...location, radius, fuel });
        // A slower request that started earlier could resolve after a newer one — this
        // guard (set on cleanup, checked before committing state) stops it from
        // clobbering the result of a request the user has since moved past.
        if (!cancelled) {
          setStations(result.stations);
          setAttribution(result.attribution);
          setSelectedId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load stations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [location, radius, fuel]);

  const cheapestId = useMemo(() => {
    let best: Station | null = null;
    for (const station of stations) {
      const price = station.prices[fuel];
      if (price === null) continue;
      const bestPrice = best?.prices[fuel];
      if (best === null || bestPrice === null || bestPrice === undefined || price < bestPrice) {
        best = station;
      }
    }
    return best?.sourceStationId ?? null;
  }, [stations, fuel]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>NearestGas</h1>
        <p className="app__tagline">Find the cheapest nearby gas (Quebec coverage)</p>
      </header>

      <div className="app__controls">
        <SearchBar onLocationFound={setLocation} />
        <label className="app__select">
          Within:
          <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
        <label className="app__select">
          Fuel:
          <select value={fuel} onChange={(event) => setFuel(event.target.value as FuelType)}>
            <option value="regular">Regular</option>
            <option value="premium">Premium</option>
            <option value="diesel">Diesel</option>
          </select>
        </label>
      </div>

      <SubscriptionPicker selectedIds={selectedProgramIds} onToggle={toggleProgram} />

      {error && <p className="app__error">{error}</p>}
      {loading && <p className="app__loading">Loading stations…</p>}

      <div className="app__main">
        <Map
          center={location}
          radiusKm={radius}
          stations={stations}
          fuel={fuel}
          cheapestId={cheapestId}
          selectedId={selectedId}
        />
        <StationList
          stations={stations}
          fuel={fuel}
          cheapestId={cheapestId}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {attribution && <footer className="app__attribution">{attribution}</footer>}
    </div>
  );
}

export default App;
