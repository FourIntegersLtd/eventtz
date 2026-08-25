"use client";

import { useCallback, useState } from "react";
import { reverseGeocodeLocation } from "@/lib/photonLocationAutocomplete";
import type { MarketplaceSearchState } from "@/lib/marketplaceSearchParams";

type UseBrowseGeolocationOptions = {
  state: MarketplaceSearchState;
  onCommit: (next: MarketplaceSearchState) => void;
  enabled?: boolean;
};

export function useBrowseGeolocation({
  state,
  onCommit,
  enabled = true,
}: UseBrowseGeolocationOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyLocation = useCallback(
    (location: string) => {
      onCommit({
        ...state,
        location,
        sort: state.sort === "relevance" ? "proximity" : state.sort,
        page: 1,
      });
    },
    [onCommit, state],
  );

  const requestCurrentLocation = useCallback(async (): Promise<string | null> => {
    if (!enabled) return null;
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Location is not available in this browser.");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
        );
      });

      const label = await reverseGeocodeLocation(coords.latitude, coords.longitude, {
        countryCode: state.country,
      });
      if (!label) {
        setError("Could not determine your city from your location.");
        return null;
      }

      applyLocation(label);
      return label;
    } catch (err) {
      const code = err instanceof GeolocationPositionError ? err.code : null;
      if (code === 1) {
        setError("Location permission was denied.");
      } else {
        setError("Could not get your location. Try again or enter a city manually.");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyLocation, enabled, state.country]);

  return {
    loading,
    error,
    requestCurrentLocation,
    clearError: () => setError(null),
  };
}
