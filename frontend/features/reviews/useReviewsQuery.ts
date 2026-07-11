"use client";

import { useCallback, useEffect, useState } from "react";

export function useReviewsQuery<T>(fetcher: () => Promise<T>, errorMessage = "Could not load reviews.") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch {
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetcher, errorMessage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
