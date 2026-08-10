"use client";

function slugifyPreview(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "creator"
  );
}

export { slugifyPreview };
