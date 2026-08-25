/**
 * StationList — the same stations shown on the map, as a sortable list. Sorting is
 * derived state (computed fresh from `stations`/`sortBy` on every render) rather than
 * something stored separately — that's what keeps the list and the map from ever
 * disagreeing about what data they're showing.
 */
import { useMemo, useState } from "react";
import type { FuelType, Station } from "../types";

type SortBy = "price" | "distance";

interface StationListProps {
  stations: Station[];
  fuel: FuelType;
  cheapestId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StationList({ stations, fuel, cheapestId, selectedId, onSelect }: StationListProps) {
  const [sortBy, setSortBy] = useState<SortBy>("price");

  const sorted = useMemo(() => {
    // Copy before sorting — `Array.prototype.sort` mutates in place, and mutating the
    // `stations` prop directly would be a side effect the parent component never asked for.
    const copy = [...stations];
    if (sortBy === "distance") {
      return copy.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    // Stations with no price for the selected grade sort to the bottom either way.
    return copy.sort((a, b) => {
      const priceA = a.prices[fuel];
      const priceB = b.prices[fuel];
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return priceA - priceB;
    });
  }, [stations, sortBy, fuel]);

  if (stations.length === 0) {
    return <p className="station-list__empty">No stations found nearby yet.</p>;
  }

  return (
    <div className="station-list">
      <div className="station-list__sort">
        <span>Sort by:</span>
        <button
          type="button"
          className={sortBy === "price" ? "active" : ""}
          onClick={() => setSortBy("price")}
        >
          Price
        </button>
        <button
          type="button"
          className={sortBy === "distance" ? "active" : ""}
          onClick={() => setSortBy("distance")}
        >
          Distance
        </button>
      </div>
      <ul>
        {sorted.map((station) => {
          const price = station.prices[fuel];
          const isCheapest = station.sourceStationId === cheapestId;
          const isSelected = station.sourceStationId === selectedId;
          const classNames = ["station-list__item"];
          if (isCheapest) classNames.push("station-list__item--cheapest");
          if (isSelected) classNames.push("station-list__item--selected");
          return (
            <li
              key={station.sourceStationId}
              className={classNames.join(" ")}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(station.sourceStationId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(station.sourceStationId);
                }
              }}
            >
              <div className="station-list__item-main">
                <span className="station-list__name">{station.name}</span>
                <span className="station-list__price">
                  {price !== null ? `${price.toFixed(1)} ¢/L` : "—"}
                </span>
              </div>
              <div className="station-list__item-sub">
                <span>{station.address}</span>
                <span>{station.distanceKm.toFixed(1)} km</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
