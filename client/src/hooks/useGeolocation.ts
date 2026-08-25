/**
 * useGeolocation — wraps the browser's Geolocation API (`navigator.geolocation`) in a
 * React hook. The browser API itself is callback-based (`getCurrentPosition(onSuccess,
 * onError)`), not `Promise`-based, so this hook's job is turning those callbacks into
 * React state the rest of the app can just read.
 */
import { useCallback, useState } from "react";
import type { LatLng } from "../types";

interface GeolocationState {
  location: LatLng | null;
  loading: boolean;
  error: string | null;
}

// The return type is written out explicitly (rather than left to inference) so it's
// obvious at the call site what shape you get back: the current state, plus a function
// to trigger a new lookup.
export function useGeolocation(): GeolocationState & { requestLocation: () => void } {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: false,
    error: null,
  });

  // `useCallback` gives this function a stable identity across re-renders, so a
  // `<button onClick={requestLocation}>` doesn't need to re-attach its handler every
  // time `App` re-renders.
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ location: null, loading: false, error: "Geolocation isn't supported by this browser" });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          location: { lat: position.coords.latitude, lng: position.coords.longitude },
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({ location: null, loading: false, error: error.message });
      },
    );
  }, []);

  return { ...state, requestLocation };
}
