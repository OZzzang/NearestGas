/**
 * SearchBar — the two ways to tell the app where you are: "Use my location" (browser
 * geolocation, via useGeolocation) or type an address/postal code (geocoded through
 * GET /api/geocode). Either path ends the same way: calling `onLocationFound` with a
 * `LatLng`, so `App` doesn't need to know or care which one the user picked.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useGeolocation } from "../hooks/useGeolocation";
import { ApiError, geocodeAddress } from "../lib/api";
import type { LatLng } from "../types";

interface SearchBarProps {
  onLocationFound: (location: LatLng) => void;
}

export function SearchBar({ onLocationFound }: SearchBarProps) {
  const { location, loading: locating, error: locateError, requestLocation } = useGeolocation();
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // `useGeolocation` reports its result as state rather than a promise (see that file's
  // comment on why), so this effect is what forwards a successful lookup up to `App`
  // once it lands.
  useEffect(() => {
    if (location) {
      onLocationFound(location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  async function handleAddressSubmit(event: FormEvent) {
    event.preventDefault();
    if (!address.trim()) return;

    setGeocoding(true);
    setGeocodeError(null);
    try {
      const result = await geocodeAddress(address.trim());
      onLocationFound(result);
    } catch (error) {
      setGeocodeError(error instanceof ApiError ? error.message : "Couldn't find that location");
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="search-bar">
      <form onSubmit={handleAddressSubmit} className="search-bar__form">
        <input
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Enter an address or postal code (Quebec)"
          className="search-bar__input"
        />
        <button type="submit" disabled={geocoding} className="search-bar__button">
          {geocoding ? "Searching…" : "Search"}
        </button>
      </form>
      <button
        type="button"
        onClick={requestLocation}
        disabled={locating}
        className="search-bar__button search-bar__button--secondary"
      >
        {locating ? "Locating…" : "Use my location"}
      </button>
      {(geocodeError || locateError) && (
        <p className="search-bar__error">{geocodeError ?? locateError}</p>
      )}
    </div>
  );
}
