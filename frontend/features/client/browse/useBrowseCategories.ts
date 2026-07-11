"use client";

import { useMemo } from "react";
import { EVENTTZ_BROWSE_CATEGORIES } from "@/features/client/browse/browseCategoriesData";

export function useBrowseCategories(query: string) {
  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EVENTTZ_BROWSE_CATEGORIES;
    return EVENTTZ_BROWSE_CATEGORIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.subtopics.some((s) => s.toLowerCase().includes(q)),
    );
  }, [query]);

  return { filteredCategories };
}
