/** Preview slug for a referral partner signup link (`frontend/features/admin/referrals/referralSlugPreview.ts`). */

export function referralSlugPreview(displayName: string): string {
  return (
    displayName
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "creator"
  );
}
