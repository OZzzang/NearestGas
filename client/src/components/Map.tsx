/**
 * Map — Google Maps (via @vis.gl/react-google-maps), one Advanced Marker per station, plus a
 * "you are here" dot and a translucent circle at the search origin/radius so it's visually
 * clear where every station's distance is measured from. Each pin is colored + labeled by
 * brand (see BRAND_STYLES below — a color + short abbreviation, deliberately not a logo
 * image, to avoid any trademark/asset-licensing question) so stations are distinguishable at
 * a glance; the cheapest station (by the currently selected fuel grade) additionally gets a
 * gold border and a slightly larger pin. Each station's info window repeats that same
 * color+abbreviation badge next to the name, and includes a "View on Google Maps" link
 * (opens Google's own place page in a new tab) since our own marker replaces whatever native
 * POI icon Google might have shown there.
 */
import { useEffect, useState } from "react";
import {
  AdvancedMarker,
  APIProvider,
  Circle,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
} from "@vis.gl/react-google-maps";
import type { FuelType, LatLng, Station } from "../types";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Advanced Markers (used below for every pin) require a Map ID. "DEMO_MAP_ID" is a
// placeholder Google provides for exactly this — it works for local dev with no setup,
// but Google's docs say not to ship it to production; set VITE_GOOGLE_MAPS_MAP_ID to a
// real Map ID (Cloud Console > Google Maps Platform > Map Management) before deploying.
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

const ORIGIN_CIRCLE_STYLE = {
  strokeColor: "#2563eb",
  strokeWeight: 2,
  fillColor: "#2563eb",
  fillOpacity: 0.08,
};

// Sentinel id for the search-origin marker in `openMarkerId` state — distinct from any
// real `sourceStationId`.
const ORIGIN_MARKER_ID = "__origin__";

// Per-brand marker styling — a short abbreviation + each brand's real public brand color,
// deliberately *not* their logo artwork (no image assets, no trademark/copyright exposure)
// while still making stations visually distinguishable by brand at a glance. Keys must match
// `KNOWN_BRANDS` in server/src/providers/gasQuebecProvider.ts exactly, since that's where
// `station.brand` comes from. Reused for both the map pin's glyph and the matching badge in
// the info window (see StationMarker below), so the two always agree.
interface BrandStyle {
  abbr: string;
  background: string;
  glyphColor?: string;
}

const BRAND_STYLES: Record<string, BrandStyle> = {
  "Petro-Canada": { abbr: "PC", background: "#ed1c24" },
  "Canadian Tire": { abbr: "CT", background: "#da291c" },
  "Circle K": { abbr: "CK", background: "#ee1c25" },
  "Couche-Tard": { abbr: "CD", background: "#f47b20" },
  Ultramar: { abbr: "U", background: "#00529b" },
  Esso: { abbr: "E", background: "#0033a0" },
  Costco: { abbr: "C", background: "#e31837" },
  Shell: { abbr: "S", background: "#ffd500", glyphColor: "#dd1d21" },
  Olco: { abbr: "O", background: "#f7941d" },
  "Pétro-T": { abbr: "PT", background: "#6d6e71" },
  Irving: { abbr: "I", background: "#00563f" },
  Chevron: { abbr: "CV", background: "#0056a4" },
};
const DEFAULT_BRAND_STYLE: BrandStyle = { abbr: "⛽", background: "#6b7280" };

function brandStyleFor(brand: string | null) {
  return (brand ? BRAND_STYLES[brand] : undefined) ?? DEFAULT_BRAND_STYLE;
}

// Universal Google Maps URL that searches by name + address — works with no API key or
// place ID, and (unlike searching by raw coordinates) lands on the actual business listing
// if Google has one, rather than just dropping a pin labeled with a lat/lng string.
function googleMapsUrl(station: Station): string {
  const query = encodeURIComponent(`${station.name} ${station.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

interface MapProps {
  center: LatLng;
  radiusKm: number;
  stations: Station[];
  fuel: FuelType;
  cheapestId: string | null;
  selectedId: string | null;
}

// `useMap()` only works *inside* a `<GoogleMap>`, so recentering has to live in its own
// child component rather than in `Map` itself — `Map` renders the `GoogleMap`, it isn't
// inside one.
function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map?.panTo(center);
  }, [center, map]);
  return null;
}

// Reacts to a station being clicked in `StationList`: pans the map to its coordinates,
// read straight from `stations` rather than a marker instance — panning never actually
// needed one, only the lat/lng. Opening the info window is handled by the parent `Map`
// component's `openMarkerId` state, which each `StationMarker`'s `isOpen` prop keys off.
function FocusSelected({ selectedId, stations }: { selectedId: string | null; stations: Station[] }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId || !map) return;
    const station = stations.find((s) => s.sourceStationId === selectedId);
    if (!station) return;
    map.panTo({ lat: station.location.coordinates[1], lng: station.location.coordinates[0] });
  }, [selectedId, map, stations]);
  return null;
}

function OriginMarker({
  center,
  radiusKm,
  isOpen,
  onOpen,
  onClose,
}: {
  center: LatLng;
  radiusKm: number;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker position={center} ref={markerRef} onClick={onOpen}>
        <span className="marker-origin__dot" />
      </AdvancedMarker>
      {isOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose}>
          <div className="map-popup">
            Search location
            <br />
            Showing stations within {radiusKm} km
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function StationMarker({
  station,
  fuel,
  isCheapest,
  isOpen,
  onOpen,
  onClose,
}: {
  station: Station;
  fuel: FuelType;
  isCheapest: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const price = station.prices[fuel];
  const position = { lat: station.location.coordinates[1], lng: station.location.coordinates[0] };
  const brandStyle = brandStyleFor(station.brand);

  return (
    <>
      <AdvancedMarker position={position} ref={markerRef} onClick={onOpen}>
        <Pin
          background={brandStyle.background}
          glyphColor={brandStyle.glyphColor ?? "#ffffff"}
          glyph={brandStyle.abbr}
          borderColor={isCheapest ? "#eab308" : "#00000055"}
          scale={isCheapest ? 1.15 : 1}
        />
      </AdvancedMarker>
      {isOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose}>
          <div className="map-popup">
            <span
              className="popup-badge"
              style={{ background: brandStyle.background, color: brandStyle.glyphColor ?? "#ffffff" }}
            >
              {brandStyle.abbr}
            </span>
            {/* Every line below is its own block — a bare text node here would flow
                inline with whatever follows it (see the price/link case this was fixed
                for previously) instead of stacking. */}
            <div className="popup-title">{station.name}</div>
            <div>{station.address}</div>
            <div>{price !== null ? `${price.toFixed(1)} ¢/L` : "Price unavailable"}</div>
            {isCheapest && <div className="popup-cheapest-tag">Cheapest nearby</div>}
            <a href={googleMapsUrl(station)} target="_blank" rel="noopener noreferrer" className="popup-gmaps-link">
              View on Google Maps ↗
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function Map({ center, radiusKm, stations, fuel, cheapestId, selectedId }: MapProps) {
  // At most one info window open at a time — mirrors Leaflet's default single-open-popup
  // behavior (map.openPopup closes whichever popup was previously open), which Google
  // Maps' InfoWindow doesn't do on its own since each one is an independent instance.
  const [openMarkerId, setOpenMarkerId] = useState<string | null>(null);

  // Selecting a row in StationList should open that station's info window on the map
  // too, not just pan to it. Adjusting state during render (React's documented
  // alternative to an effect here) since this reacts to a prop change, not an external
  // system.
  const [prevSelected, setPrevSelected] = useState(selectedId);
  if (selectedId !== prevSelected) {
    setPrevSelected(selectedId);
    if (selectedId) setOpenMarkerId(selectedId);
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="map map--error">
        Google Maps API key missing. Set VITE_GOOGLE_MAPS_API_KEY in client/.env — see client/.env.example.
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        className="map"
        mapId={GOOGLE_MAPS_MAP_ID}
        defaultCenter={center}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        <Recenter center={center} />
        <FocusSelected selectedId={selectedId} stations={stations} />
        <Circle center={center} radius={radiusKm * 1000} {...ORIGIN_CIRCLE_STYLE} />
        <OriginMarker
          center={center}
          radiusKm={radiusKm}
          isOpen={openMarkerId === ORIGIN_MARKER_ID}
          onOpen={() => setOpenMarkerId(ORIGIN_MARKER_ID)}
          onClose={() => setOpenMarkerId(null)}
        />
        {stations.map((station) => (
          <StationMarker
            key={station.sourceStationId}
            station={station}
            fuel={fuel}
            isCheapest={station.sourceStationId === cheapestId}
            isOpen={openMarkerId === station.sourceStationId}
            onOpen={() => setOpenMarkerId(station.sourceStationId)}
            onClose={() => setOpenMarkerId(null)}
          />
        ))}
      </GoogleMap>
    </APIProvider>
  );
}
