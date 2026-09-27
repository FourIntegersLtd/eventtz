/** Validates blog editor fields before save, matching `frontend/lib/validation/settingsAdmin.ts` `adminBlogSaveSchema`. */

export type BlogSaveValidationInput = {
  title: string;
  subtitle?: string | null;
  slug?: string | null;
};

export function validateBlogSaveFields(input: BlogSaveValidationInput): string | null {
  const title = input.title.trim();
  if (!title) return "Enter a title.";
  if (title.length > 300) return "Title is too long.";
  const subtitle = (input.subtitle ?? "").trim();
  if (subtitle.length > 500) return "Subtitle is too long.";
  const slug = (input.slug ?? "").trim();
  if (slug.length > 200) return "Slug is too long.";
  return null;
}
