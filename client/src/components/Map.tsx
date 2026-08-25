/**
 * Map — Leaflet + OpenStreetMap tiles via react-leaflet, one marker per station, plus a
 * "you are here" dot and a translucent circle at the search origin/radius so it's
 * visually clear where every station's distance is measured from. The cheapest station
 * (by the currently selected fuel grade) gets a distinct marker so it stands out
 * without needing to cross-reference the list.
 */
import { useEffect, useRef } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FuelType, LatLng, Station } from "../types";

// Leaflet's default marker icon is a set of image files referenced by a relative path
// baked into leaflet.js — that path assumes a plain `<script>` include, so it 404s once
// Vite bundles and hashes the images under a different URL. The fix is always the same:
// delete the broken default and hand Leaflet the actual bundled URLs (Vite resolves
// these `import`s to real asset paths at build time).
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// `<Marker icon={undefined}>` isn't the same as omitting `icon` — react-leaflet copies
// it onto the underlying Leaflet marker's options as an explicit `undefined`, which
// shadows the prototype default instead of falling back to it, and crashes when
// Leaflet tries to render the (now-missing) icon. So every marker gets an explicit
// icon: this one for the regular case, `cheapestIcon` below for the highlighted one.
const defaultIcon = new L.Icon.Default();

const cheapestIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "marker-cheapest",
});

// The search origin isn't a station, so it gets a "you are here"-style dot instead of a
// pin — a shape difference reads faster than another pin color would, especially once
// several pins are already clustered nearby.
const originIcon = L.divIcon({
  className: "marker-origin",
  html: '<span class="marker-origin__dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const ORIGIN_CIRCLE_STYLE = { color: "#2563eb", weight: 2, fillColor: "#2563eb", fillOpacity: 0.08 };

interface MapProps {
  center: LatLng;
  radiusKm: number;
  stations: Station[];
  fuel: FuelType;
  cheapestId: string | null;
  selectedId: string | null;
}

// `useMap()` only works *inside* a `<MapContainer>`, so recentering has to live in its
// own child component rather than in `Map` itself — `Map` renders the `MapContainer`,
// it isn't inside one.
function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center, map]);
  return null;
}

// Reacts to a station being clicked in `StationList`: pans to its marker and opens its
// popup, so "select in the list" and "show on the map" are the same piece of state
// rather than two things that could drift out of sync.
function FocusSelected({
  selectedId,
  markerRefs,
}: {
  selectedId: string | null;
  markerRefs: React.RefObject<Record<string, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const marker = markerRefs.current[selectedId];
    if (!marker) return;
    map.panTo(marker.getLatLng());
    marker.openPopup();
  }, [selectedId, map, markerRefs]);
  return null;
}

export function Map({ center, radiusKm, stations, fuel, cheapestId, selectedId }: MapProps) {
  // Keyed by sourceStationId so FocusSelected can look up the Leaflet marker instance
  // for whichever station was just clicked in the list, without re-querying the DOM.
  const markerRefs = useRef<Record<string, L.Marker>>({});

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />
      <FocusSelected selectedId={selectedId} markerRefs={markerRefs} />
      <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={ORIGIN_CIRCLE_STYLE} />
      <Marker position={[center.lat, center.lng]} icon={originIcon}>
        <Popup>
          Search location
          <br />
          Showing stations within {radiusKm} km
        </Popup>
      </Marker>
      {stations.map((station) => {
        const price = station.prices[fuel];
        const isCheapest = station.sourceStationId === cheapestId;
        return (
          <Marker
            key={station.sourceStationId}
            position={[station.location.coordinates[1], station.location.coordinates[0]]}
            icon={isCheapest ? cheapestIcon : defaultIcon}
            ref={(instance) => {
              if (instance) markerRefs.current[station.sourceStationId] = instance;
              else delete markerRefs.current[station.sourceStationId];
            }}
          >
            <Popup>
              <strong>{station.name}</strong>
              <br />
              {station.address}
              <br />
              {price !== null ? `${price.toFixed(1)} ¢/L` : "Price unavailable"}
              {isCheapest && <div className="popup-cheapest-tag">Cheapest nearby</div>}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
