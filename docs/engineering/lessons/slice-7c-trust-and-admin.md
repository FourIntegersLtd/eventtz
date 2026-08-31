# Slice 7c — Trust, vendor onboarding & admin

### User story

A **new vendor** completes multi-step onboarding at `/vendor/profile`, uploads portfolio media to S3, and submits for admin review. Once **approved** and **Stripe-ready** (or admin-waived), they appear on explore (Slice 2 `visibility.py`). They share a **tiered client referral link** (`?vref=`) that discounts the Eventtz service fee for referred clients (Slice 3a). After events, **clients leave reviews**; either party can open **disputes** that may hold payout (Slice 6). **Admins** use `/admin/*` to approve vendors, oversee commerce, manage trust (reviews/disputes/chat), partner referral programs, and the public blog.

**Prerequisites:** Slice 1 (auth, `require_admin`), Slice 2 (visibility), Slice 3a (vendor referral on enquire), Slice 6 (payout hold on dispute).

**Out of scope:** Help center article CMS (static content only), vendor copilot listing optimizer (`VendorListingOptimizerPanel`).

---

## What changed since last lesson (2026-08-31)

| Area | Before | Now |
|------|--------|-----|
| Settings referrals UI | Simple code field + share link | Tier table, one-time **Create code** flow, `CopyToClipboardButton` on code + link |
| Code changes | Editable after set | Locked after first set — backend `REFERRAL_CODE_LOCKED` |
| Referral bookings table | Current code only | **Code used** column when historical codes differ from today's code |
| Pricing on existing rows | Re-validated live code | `booking_discount.py` two-phase: live validation at enquire; stored code on row thereafter |
| Frontend tier math | Duplicated in settings | Shared `bookingServiceFee.ts` — `REFERRAL_FEE_TIERS`, `formatBookingMoneyLabel` |

Plain English: vendors pick a referral code once, see tier savings in a table, and copy code/link with one tap. Bookings keep the code they were created with even if the vendor later rotates or disables the live code.

---

## What trust & admin does

```typescript
// Vendor onboarding: upload → S3 → profile JSON
const uploaded = await uploadImage(file);
update({ portfolioImages: [...data.portfolioImages, uploaded.public_url] });

// Client referral preview at enquire (Slice 3a)
const preview = await fetchVendorReferralPreview(vendorUserId, code, vendorPortionGbp);

// Admin approves vendor → explore listing unlocks (if Stripe ready)
await patchVendorApproval(vendorUserId, { approval_status: "approved" });
```

| Piece | Role |
|--------|------|
| `VendorOnboarding` | Multi-step wizard + live profile editor |
| `useOnboardingMedia` | S3 uploads for portfolio, video, certs |
| `mediaApi.ts` | `POST /media/images`, `/media/files` |
| `media/s3.py` | boto3 upload to public bucket |
| `visibility.py` | Single rule: approved + Stripe ready (or admin waive) |
| `vendorReferralsApi.ts` | Referral info, preview, bookings, one-time set code |
| `SettingsReferralsSection.tsx` | Tier table, create-once code, copy buttons |
| `SettingsReferralBookingsTable.tsx` | Attributed bookings + historical **Code used** column |
| `bookingServiceFee.ts` | Shared tier math + `formatBookingMoneyLabel` (settings + enquire) |
| `vendor_referrals/tiers.py` | Tiered fee discounts off Eventtz service fee |
| `reviews.py` | One review per completed booking |
| `disputes.py` | Problem reports; can block payout release |
| Admin console | `/admin/dashboard`, `/directory`, `/commerce`, `/trust`, `/referrals`, `/blog` |
| `referrals/attribution.py` | Partner slug at **vendor signup** (Slice 1) |

Plain English: **onboarding** collects trust signals (portfolio, insurance docs, pricing). **Visibility** gates the marketplace. **Referrals** are two programs: vendors recruit clients (fee discount), partners recruit vendors (attribution at signup). **Admin** is the control plane for approvals, money, trust, and content.

---

## What happens at a glance

```
Vendor signs up (optional ?ref=partner-slug from Slice 1)
    → try_attribute_vendor_signup → referral_attributions row

Vendor completes /vendor/profile wizard
    → PUT /vendor/profile (JSON steps) + POST /media/images|files (S3)
    → Submit for review → approval_status pending

Admin /admin/directory → approve vendor
    → approval_status = approved
    → visibility.py: listed if Stripe charges+payouts OR listing_override=visible

Vendor enables client referrals in Settings
    → client_referral_code on vendors row
    → share link: /client/browse/{id}?vref={code}

Client enquires with ?vref= (Slice 3a)
    → resolve_referral_pricing_inputs → tier discount on service fee
    → vendor_referral_code stored on booking_requests

Event completes → client posts review
    → booking_reviews row → vendor profile stats update

Dispute opened on booking
    → dispute_cases row → notify_user(dispute_changed)
    → payout release blocked until resolved (Slice 6)

Admin /admin/trust → reviews moderation, dispute resolution, support chat
```

---

## Example: vendor goes live end-to-end

1. Creator shares `https://eventtz.com/signup/vendor?ref=foodieemma` (partner referral).
2. Vendor registers → `try_attribute_vendor_signup` links `referral_attributions`.
3. Vendor uploads 6 portfolio photos via `uploadImage` → S3 URLs in `profile_form_data`.
4. Submits onboarding → `approval_status: pending`.
5. Admin approves on `/admin/directory`; vendor completes Stripe Connect.
6. `account.updated` webhook sets `stripe_charges_enabled` + `stripe_payouts_enabled`.
7. `apply_public_listing_filters` now includes vendor on `/client/browse`.
8. Vendor sets referral code `482910` in Settings → shares browse link with `?vref=482910`.
9. Client books with referral → £10–£15 off Eventtz fee per tier (Slice 3a).
10. After completion, client reviews; admin can hide abusive reviews on `/admin/trust`.

---

## Complete route — vendor onboarding

### Frontend

1. `frontend/app/vendor/(portal)/profile/page.tsx` — thin shell → `VendorOnboarding`
2. `frontend/features/vendor/onboarding/VendorOnboarding.tsx` — wizard vs live-edit layouts
3. `frontend/features/vendor/onboarding/useVendorOnboardingController.ts` — step state, save, submit
4. `frontend/features/vendor/onboarding/useOnboardingSteps.ts` — step navigation logic
5. `frontend/features/vendor/onboarding/useOnboardingPersistence.ts` — autosave to API
6. `frontend/features/vendor/onboarding/useOnboardingMedia.ts` — upload orchestration
7. `frontend/features/vendor/onboarding/OnboardingStepContent.tsx` — per-step forms
8. `frontend/features/vendor/onboarding/steps/Step*.tsx` — Account, Business, Portfolio, Pricing, …
9. `frontend/features/vendor/onboarding/serializeVendorPayload.ts` — API payload shape
10. `frontend/features/vendor/onboarding/vendorOnboardingValidation.ts` — Zod per step
11. `frontend/lib/mediaApi.ts` — `uploadImage`, `uploadFile`
12. `frontend/lib/vendorProfileApi.ts` — `GET/PUT /vendor/profile`

### Backend

13. `backend/app/features/vendors/http/profile.py` — profile GET/PUT
14. `backend/app/features/vendors/profile.py` — upsert vendor row + JSON payload
15. `backend/app/features/vendors/http/moderation.py` — submit for review
16. `backend/app/features/vendors/visibility.py` — public listing rules
17. `backend/app/features/media/http/routes.py` — upload endpoints
18. `backend/app/features/media/upload.py` — validation + key naming
19. `backend/app/features/media/s3.py` — boto3 client, `upload_bytes`, `public_object_url`

---

## Complete route — vendor client referrals (tiered)

### Frontend

1. `frontend/lib/vendorReferralsApi.ts` — referral info, preview, bookings, set code
2. `frontend/features/settings/SettingsReferralsSection.tsx` — tier table + one-time code creation
3. `frontend/features/settings/SettingsReferralBookingsTable.tsx` — attributed bookings + code-used column
4. `frontend/lib/bookingServiceFee.ts` — shared tier thresholds and money labels
5. `frontend/features/client/browse/useVendorReferralPreview.ts` — live preview in enquire modal
6. `frontend/lib/vendorReferralAttribution.ts` — `?vref=` capture from URL
7. `frontend/features/bookings/BookingPricingBreakdown.tsx` — shows code + discount

### Backend

7. `backend/app/features/vendor_referrals/http/vendor.py` — vendor referral routes
8. `backend/app/features/vendor_referrals/http/public.py` — `referral-preview` on explore
9. `backend/app/features/vendor_referrals/service.py` — `get_vendor_client_referral_info`
10. `backend/app/features/vendor_referrals/tiers.py` — `REFERRAL_FEE_TIERS`
11. `backend/app/features/vendor_referrals/validate.py` — `resolve_referral_pricing_inputs` (live enquire validation)
12. `backend/app/features/vendor_referrals/booking_discount.py` — stored-code pricing on existing rows
13. `backend/app/features/vendor_referrals/bookings.py` — referral booking list for vendor
14. `backend/app/features/vendor_referrals/codes.py` — set code once (`REFERRAL_CODE_LOCKED`)
15. `backend/app/features/bookings/create.py` — stores `vendor_referral_code` on enquire

**Cross-ref Slice 3a:** referral code flows from `?vref=` → `useVendorReferralPreview` → `postBookingRequest({ vendor_referral_code })` → `resolve_referral_pricing_inputs` at create time. See `slice-3a-client-booking-enquire.md` Steps 5–7.

---

## Complete route — reviews

### Frontend

1. `frontend/features/client/bookings/ClientBookingReviewForm.tsx` — post-completion form
2. `frontend/features/reviews/ReviewPhotoPicker.tsx` — optional images via `uploadImage`
3. `frontend/app/vendor/(portal)/profile/reviews/page.tsx` — vendor's received reviews
4. `frontend/lib/reviewsApi.ts` — `postBookingReview`
5. Dashboard nudge — Slice 7a `needsReview` + `?rate={n}` deep link

### Backend

6. `backend/app/features/bookings/reviews.py` — create, list, stats, featured snippets
7. `backend/app/features/bookings/http/` — client review routes
8. `backend/app/features/vendors/http/explore.py` — merges `review_average` into explore rows

**Rule:** Reviews only after booking `status === "completed"`. One review per `booking_request_id`.

---

## Complete route — disputes

### Frontend

1. `frontend/features/bookings/BookingDisputeSection.tsx` — inline on booking detail (client + vendor)
2. `frontend/features/disputes/ParticipantDisputesPortalView.tsx` — `/client/disputes`, `/vendor/disputes`
3. `frontend/features/disputes/ParticipantDisputeDetailPanel.tsx` — case detail
4. `frontend/lib/bookingDisputesApi.ts` — fetch/post dispute endpoints
5. `frontend/lib/bookingDisputeHelpers.ts` — `canOpenDisputeForBookingStatus`

### Backend

6. `backend/app/features/bookings/disputes.py` — participant create/list
7. `backend/app/features/bookings/participant_dispute_handlers.py` — HTTP thin layer
8. `backend/app/features/admin/dispute_admin_commands.py` — admin resolve/refund
9. `backend/app/features/admin/http/platform_trust.py` — admin dispute API

**Payout interaction:** Open disputes can block `payout_released` (Slice 6). SSE `dispute_changed` refreshes UI (Slice 7b).

---

## Complete route — admin console

### Frontend pages

| Route | Feature view | Purpose |
|-------|--------------|---------|
| `/admin/dashboard` | `AdminDashboardView` | KPIs, attention list, charts |
| `/admin/directory` | `AdminVendorsView`, clients tab | Vendor approval, listing overrides |
| `/admin/commerce` | commerce views | Bookings + financials overview |
| `/admin/trust` | `AdminDisputesView`, `AdminReviewsView` | Disputes + review moderation |
| `/admin/trust/reviews/[id]` | `AdminReviewDetailView` | Single review hide/show |
| `/admin/bookings/[id]` | `AdminBookingDetailView` | Booking diagnostics + admin actions |
| `/admin/referrals` | `AdminReferralsView` | Partner creator links |
| `/admin/referrals/[partnerId]` | `AdminReferralSignupsView` | Vendor signups per partner |
| `/admin/blog` | `AdminBlogEditorView` | CMS for public `/blog` |
| `/admin/messages` | `AdminMessagesInboxView` | Support chat with users |
| `/admin/team` | `AdminTeamView` | Admin user management |
| `/admin/audit` | audit views | Admin action log |

### Backend (`backend/app/features/admin/http/`)

1. `platform_dashboard.py` — summary counts
2. `platform_directory.py` — vendor/client search + approval patches
3. `platform_bookings.py` — commerce booking lists
4. `platform_financials.py` — revenue/payout metrics
5. `platform_trust.py` — disputes + reviews admin
6. `vendors.py` — vendor detail + approval actions
7. `referrals/http/admin.py` — partner CRUD (separate feature package)

### Auth

All admin routes use `require_admin(request, response)` from Slice 1. Fine-grained dispute permissions via `validate_dispute_patch_permissions`.

---

## Complete route — partner referrals (vendor signup)

Distinct from **vendor client referrals** (`?vref=` on browse).

### Frontend

1. Signup flow passes `referralCode` → `AuthProvider.signUp(..., referralCode)`
2. `frontend/lib/auth-api.ts` — `referral_code` on signup body
3. `frontend/features/admin/referrals/AdminReferralsView.tsx` — create partner links
4. `frontend/features/admin/referrals/CopyReferralLinkButton.tsx`
5. `frontend/lib/adminReferralsApi.ts`

### Backend

6. `backend/app/features/auth/http/routes.py` — signup attribution hook
7. `backend/app/features/referrals/attribution.py` — `try_attribute_vendor_signup`
8. `backend/app/features/referrals/partners.py` — partner rows + slug lookup
9. `backend/app/features/referrals/http/admin.py` — `/admin/referrals/partners`

**Cross-ref Slice 1:** Vendor signup with `referral_code` in body triggers first-touch partner attribution. Clients signing up do **not** use this path.

---

## Step 1 — Vendor onboarding wizard

**Entry:** `/vendor/profile` renders `VendorOnboarding`.

**Two layouts:**
- **Wizard** — `?walkthrough=1` or vendor not yet live (`!vendorIsLiveApproved`)
- **Live edit** — approved vendors edit sections via tabs without linear steps

Controller exposes step state, save, portfolio counts, approval status:

```31:84:frontend/features/vendor/onboarding/VendorOnboarding.tsx
  const {
    step,
    data,
    ...
    approvalStatus,
    listingVisible,
    payoutsVerified,
    ...
    goNext,
    goBack,
    navigateToStep,
    update,
    ...
    onUploadPortfolioVideo,
    onUploadProfileImage,
  } = useVendorOnboardingController({ isWalkthrough });
```

**Backend profile load:**

```21:32:backend/app/features/vendors/http/profile.py
@router.get("/profile", response_model=VendorProfileState)
def get_vendor_profile_state(request: Request, response: Response) -> VendorProfileState:
    ...
    row = get_vendor_profile(uid, refresh_payouts=True)
```

Submit for review transitions `onboarding_status` / `approval_status` via moderation routes (admin queue on `/admin/directory`).

---

## Step 2 — S3 media uploads

**Frontend API** — extended timeouts for large files:

```15:24:frontend/lib/mediaApi.ts
export async function uploadImage(file: File): Promise<ImageUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<ImageUploadResult>("/api/v1/media/images", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: IMAGE_UPLOAD_TIMEOUT_MS,
  });
  return res.data;
}
```

```27:35:frontend/lib/mediaApi.ts
export async function uploadFile(file: File): Promise<ImageUploadResult> {
  ...
  const res = await api.post<ImageUploadResult>("/api/v1/media/files", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: FILE_UPLOAD_TIMEOUT_MS,
  });
  return res.data;
}
```

**Backend routes** — any signed-in user (vendor onboarding uses vendor session):

```16:26:backend/app/features/media/http/routes.py
@router.post("/images", response_model=ImageUploadResponse)
async def upload_image(
    file: UploadFile,
    user: Annotated[dict[str, Any], Depends(get_current_user_dep)],
) -> ImageUploadResponse:
    uploaded = await upload_user_image(user_id=str(user.get("id") or ""), file=file)
    return ImageUploadResponse(
        bucket=uploaded.bucket,
        path=uploaded.path,
        public_url=uploaded.public_url,
    )
```

**S3 layer:**

```69:77:backend/app/features/media/s3.py
def upload_bytes(*, key: str, body: bytes, content_type: str) -> str:
    settings = get_settings()
    bucket = settings.aws_s3_bucket_name.strip()
    ...
    get_s3_client().upload_fileobj(BytesIO(body), bucket, key, ExtraArgs=extra)
    return public_object_url(key)
```

Config gates: `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_REGION` in `backend/.env.example`. Missing config → `ServiceUnavailableError`.

**`useOnboardingMedia`** orchestrates:
- Portfolio images → `uploadImage` + optional AI quality check
- Portfolio video / PDF certs → `uploadFile`
- Profile photo → `uploadImage` + `persistProfileImageUrl`
- Tracks per-file quality scores; blocks submit until `MIN_PORTFOLIO_IMAGES` met

Returned `public_url` strings are stored in `vendors.profile_form_data` JSON — not binary in Postgres.

---

## Step 3 — Visibility gate (Slice 2 cross-ref)

**File:** `visibility.py` — single source of truth for explore listing:

```43:49:backend/app/features/vendors/visibility.py
def apply_public_listing_filters(query: Any) -> Any:
    """Narrow a `vendors` query to rows that may appear publicly."""
    return (
        query.eq("approval_status", "approved")
        .neq("listing_override", "hidden")
        .or_(f"listing_override.eq.visible,and({_STRIPE_READY_FILTER})")
    )
```

| Condition | Listed? |
|-----------|---------|
| `approval_status != approved` | No |
| `listing_override = hidden` | No |
| `listing_override = visible` | Yes (admin waiver — Stripe not required) |
| `auto` + Stripe charges + payouts enabled | Yes |
| `auto` + Stripe incomplete | No |

Admin approval alone does **not** guarantee explore visibility unless override or Stripe ready.

---

## Step 4 — Vendor client referrals (tiered)

**Tiers** — discount off **Eventtz service fee**, not vendor portion. Backend source of truth in `tiers.py`; frontend mirrors in `bookingServiceFee.ts`:

```5:8:frontend/lib/bookingServiceFee.ts
export const REFERRAL_FEE_TIERS = [
  { minSpendGbp: 600, feeDiscountGbp: 15 },
  { minSpendGbp: 400, feeDiscountGbp: 10 },
] as const;
```

```7:11:backend/app/features/vendor_referrals/tiers.py
REFERRAL_FEE_TIERS: tuple[dict[str, float], ...] = (
    {"min_spend_gbp": 600.0, "fee_discount_gbp": 15.0},
    {"min_spend_gbp": 400.0, "fee_discount_gbp": 10.0},
)
```

| Vendor portion (line items) | Fee discount |
|----------------------------|--------------|
| ≥ £600 | £15 off service fee |
| ≥ £400 | £10 off service fee |
| &lt; £400 | £0 (code may still validate) |

**Two-phase pricing model** (`booking_discount.py`):

| Phase | When | Rule |
|-------|------|------|
| Live validation | Enquire / browse preview | `resolve_referral_pricing_inputs` in `validate.py` — strict code + vendor match |
| Stored code | Existing booking rows | `build_pricing_breakdown_for_booking_row` — honor `vendor_referral_code` on row; skip only on proven cross-vendor mismatch |

```1:10:backend/app/features/vendor_referrals/booking_discount.py
"""
Bridge booking rows to referral-aware pricing.

Two-phase model:
- **Enquire / browse:** ``resolve_referral_pricing_inputs`` in ``validate.py`` (strict live validation).
- **Existing booking:** ``build_pricing_breakdown_for_booking_row`` only — honor stored
  ``vendor_referral_code`` and tier spend; skip discount only on proven cross-vendor mismatch.
"""
```

**Vendor info API:**

```20:47:backend/app/features/vendor_referrals/service.py
def get_vendor_client_referral_info(vendor_user_id: str) -> dict[str, Any] | None:
    ...
    if str(row.get("approval_status") or "") != "approved":
        return None
    code = normalize_client_referral_code(row.get("client_referral_code")) or ""
    ...
    return {
        "referral_code": code,
        "share_link": vendor_client_referral_browse_url(uid, code) if code else "",
        "service_fee_percent": float(BOOKING_SERVICE_FEE_PERCENT),
        "tiers": referral_tiers_for_display(),
        "enabled": enabled,
    }
```

**Browse preview** (enquire modal):

```61:71:frontend/lib/vendorReferralsApi.ts
export async function fetchVendorReferralPreview(
  vendorUserId: string,
  code: string,
  vendorPortionGbp: number,
): Promise<VendorReferralPreview> {
  const { data } = await api.get<VendorReferralPreview>(
    `/api/v1/vendors/explore/vendor/${encodeURIComponent(vendorUserId)}/referral-preview`,
    { params: { code, vendor_portion_gbp: vendorPortionGbp } },
  );
  return data;
}
```

**Slice 3a integration** — at booking create, `resolve_referral_pricing_inputs` validates code against vendor, computes tier from vendor portion sum, stores normalized code on row. Accept/pay/receipt totals use `booking_discount.py` to re-read the stored code.

**Vendor settings** — `SettingsReferralsSection`:

- Tier savings table (uses `formatBookingMoneyLabel` from `bookingServiceFee.ts`)
- **Create code once** — custom digits or random 6-digit; no edits after set (`REFERRAL_CODE_LOCKED`)
- `CopyToClipboardButton` on code and share link when code exists

```98:105:backend/app/features/vendor_referrals/codes.py
    existing = normalize_client_referral_code(row.get("client_referral_code"))
    if existing:
        if generate:
            raise ValueError(referral_messages.REFERRAL_CODE_LOCKED)
        requested = normalize_client_referral_code(raw_code)
        if requested == existing:
            return existing
        raise ValueError(referral_messages.REFERRAL_CODE_LOCKED)
```

```29:41:frontend/features/settings/SettingsReferralBookingsTable.tsx
  const showCodeColumn = bookings.some(
    (row) => row.referral_code && row.referral_code !== currentReferralCode,
  );
  ...
            {showCodeColumn ? <th className="px-4 py-3">Code used</th> : null}
```

Shows **Code used** when attributed bookings used a historical code that differs from the vendor's current code.

---

## Step 5 — Partner referrals at signup (Slice 1 cross-ref)

When a **vendor** registers with a partner slug, attribution is recorded once:

```78:81:backend/app/features/auth/http/routes.py
            if body.user_type == "vendor" and body.referral_code:
                from app.features.referrals.attribution import try_attribute_vendor_signup

                try_attribute_vendor_signup(user_id=str(uid), referral_code=body.referral_code)
```

```16:34:backend/app/features/referrals/attribution.py
def try_attribute_vendor_signup(*, user_id: str, referral_code: str | None) -> bool:
    """Record first-touch referral for a new vendor. Never raises."""
    code = normalize_slug(referral_code or "")
    if not code:
        return False
    partner = get_active_partner_by_slug(code)
    ...
    get_db().table("referral_attributions").insert(row).execute()
```

**Frontend path:** `AuthProvider.signUp(email, password, "vendor", referralCode)` → `auth-api.ts` sends `referral_code` in POST body. Signup URL pattern: `/signup/vendor?ref={partner-slug}`.

**Admin management** — `/admin/referrals` creates partners (Instagram creator links); `/admin/referrals/{partnerId}` lists attributed vendor signups and shoutout completion status.

**Not the same as `?vref=`:** Partner referrals track **vendor acquisition**; vendor client referrals track **client bookings** with fee discounts.

---

## Step 6 — Reviews

**Client form** — rating required, body required, optional photos:

```55:69:frontend/features/client/bookings/ClientBookingReviewForm.tsx
  const submit = async () => {
    setError(null);
    const parsed = parseForm(reviewSchema, { rating, body, image_urls: imageUrls });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    ...
          return await postBookingReview(bookingId, parsed.data);
```

**Dashboard nudge** (Slice 7a) deep-links with `?rate={1-5}` to pre-select stars.

**Backend** — `reviews.py`:
- `create_review_for_booking` — guards completed status, one-per-booking
- `get_review_stats_for_vendors` — `review_average`, `review_count` on explore
- `featured_snippets_for_vendor_ids` — planner cards show excerpt
- Admin `set_review_hidden` — soft-hide abusive content (`hidden_at`)

**Vendor profile** — `/vendor/profile/reviews` lists received reviews (read-only).

---

## Step 7 — Disputes (booking detail header)

**Participant UI** on booking detail — three presentation modes:

| Mode | Where | UX |
|------|-------|-----|
| `header` | `BookingDetailPanel` top-right (default on client/vendor list+detail) | Compact **Help** button → drawer |
| `inline` | Card embedded in detail body | Full dispute card |
| `drawer` | Legacy compact row | Full-width row opening slide-over |

**Header mode** — compact trigger in the detail shell:

```211:238:frontend/features/bookings/BookingDisputeSection.tsx
  if (presentation === "header") {
    return (
      <>
        <ConfirmDialog
          isOpen={submitConfirmOpen}
          title={BOOKING_CONFIRM_COPY.openDispute.title}
          ...
        />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Help and disputes"
        >
          ...
          <span>Help</span>
          {!loading && hasActive ? (
```

Wired from client/vendor booking views with `presentation="header"` (see `ClientBookingsView.tsx` / `VendorBookingsView.tsx`).

**Open new dispute** — gated by `canOpenDisputeForBookingStatus(bookingStatus)` matching backend `_ALLOWED_BOOKING_STATUSES_FOR_NEW_DISPUTE` (`pending`, `accepted`, `completed`).

**Backend create** — `disputes.py`:
- Validates party membership
- Links `conversation_id` from booking or DM pair lookup
- `send_admin_dispute_opened_email` + `notify_user(..., "dispute_changed")`

**Portal list** — `/client/disputes`, `/vendor/disputes` for all cases.

**Admin resolution** — `/admin/trust` disputes tab:
- Assign admin, status transitions (`open` → `under_review` → `resolved` / `closed`)
- Resolution notes (client-facing + internal)
- Optional refund amount — ties to Slice 6 payment reversal flows
- `insert_admin_audit_log` on sensitive patches

---

## Step 8 — Admin dashboard attention

**File:** `AdminDashboardView` — KPI cards + attention list (mirrors client dashboard pattern):

```38:50:frontend/features/admin/dashboard/AdminDashboardView.tsx
  const attentionItems = useMemo((): AdminAttentionItem[] => {
    if (!summary) return [];
    const items: AdminAttentionItem[] = [];
    const openDisputes = metricsForAttention?.open_disputes_count ?? 0;

    if (summary.vendors_pending > 0) {
      items.push({
        id: "vendors-pending",
        title: `Review ${summary.vendors_pending} vendor application${summary.vendors_pending === 1 ? "" : "s"}`,
        href: "/admin/directory?tab=vendors",
        ctaLabel: "Review",
        tone: "urgent",
      });
```

Typical attention items: pending vendor applications, open disputes, flagged reviews, unread support messages.

---

## Step 9 — Admin directory (vendor approval)

**`/admin/directory`** — vendor tab shows submission queue with:
- `AdminVendorSubmissionReview` — checklist, media rail, approval actions
- `VendorDetailsModal` — full profile inspection
- `VendorMarketplaceStatusBanner` — approval + Stripe + override status
- `AdminListingMediaEditor` — fix broken cover images

**Approval patch** sets `approval_status` (`pending` → `approved` / `rejected` / `returned_for_edits`). Returned vendors see banner in `VendorOnboarding`:

```15:15:frontend/features/vendor/onboarding/VendorOnboarding.tsx
import { RETURNED_FOR_EDITS_BODY, RETURNED_FOR_EDITS_TITLE } from "./returnedForEditsCopy";
```

**Listing override** — `visible` / `hidden` / `auto` per `visibility.py`; separate from approval status.

---

## Step 10 — Admin commerce

**`/admin/commerce`** — operational view of marketplace money flow:
- Booking lists with status/payment filters (`platform_bookings.py`)
- Financial summaries — GMV, fees, payouts (`platform_financials.py`)
- Links to `/admin/bookings/[id]` for per-booking admin commands (payment patch, recovery, diagnostics)

Admin booking detail (`AdminBookingDetailView`) exposes actions not available to participants: force status, resend notifications, Stripe diagnostics, receipt regeneration.

---

## Step 11 — Admin trust

**`/admin/trust`** — two sub-areas:

**Disputes** (`AdminDisputesView`):
- Filter by status, assignee
- `DisputeActionPanel` — status patch, resolution, refund
- `DisputeResolveModal` — structured close flow
- Chat link when `conversation_id` present

**Reviews** (`AdminReviewsView`):
- List with rating, vendor, visibility flag
- `AdminReviewDetailView` — hide/show toggle (`set_review_hidden`)
- Hidden reviews excluded from public vendor profile + explore stats

**API** — `platform_trust.py`:

```1:2:backend/app/features/admin/http/platform_trust.py
"""Admin console: disputes, reviews, and chat messages."""
```

Also exposes admin conversation message read for support oversight.

---

## Step 12 — Admin referrals + blog

**Partner referrals** (`/admin/referrals`):

```72:78:frontend/features/admin/referrals/AdminReferralsView.tsx
      <AdminPageHeader
        subtitle="Create trackable vendor signup links for Instagram creators. Share the link; vendors who register appear under that creator."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreateOpen(true)}>
            Create creator link
          </Button>
        }
      />
```

Backend `referrals/http/admin.py` — `GET/POST /admin/referrals/partners`, signup list per partner, shoutout completion patch.

**Blog** (`/admin/blog`):
- `AdminBlogEditorView` + `BlogRichTextEditor`
- Cover images via `uploadImage` (same S3 pipeline)
- Public posts at `/blog` served from `backend/app/features/blog/`

---

## Referral programs compared

| Program | URL param | Who benefits | When attributed | Admin UI |
|---------|-----------|--------------|-----------------|----------|
| Partner (creator) | `?ref=` on vendor signup | Partner tracks vendor signups | Vendor `POST /auth/signup` | `/admin/referrals` |
| Vendor client | `?vref=` on browse | Client gets fee discount | Booking create (Slice 3a) | Vendor Settings → Referrals |

---

## Auth summary

| Layer | Guard |
|-------|--------|
| Vendor profile/onboarding | `require_vendor` |
| Media upload | `get_current_user_dep` (any signed-in user) |
| Vendor referral settings | `require_vendor` + approved |
| Referral preview (public) | Explore route; no auth required |
| Reviews | `require_client` + booking party |
| Disputes | Client or vendor on booking |
| Admin console | `require_admin` |
| Admin dispute patch | `validate_dispute_patch_permissions` |

---

## Analytics (Mixpanel)

| Event | When |
|-------|------|
| `review_submitted` | Client posts review |
| Dispute open | Tracked in `BookingDisputeSection` submit |
| Onboarding step | Vendor wizard progression (where instrumented) |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Upload fails immediately | `s3.py` `s3_configured()` — missing AWS env vars |
| Upload timeout on mobile | `mediaApi.ts` — `IMAGE_UPLOAD_TIMEOUT_MS` (120s) |
| Vendor approved but not on browse | `visibility.py` — Stripe flags false, override `auto` |
| `?vref=` no discount | `useVendorReferralPreview` — portion below £400 tier |
| Referral code invalid | `validate.py` — wrong vendor or disabled referrals |
| Partner attribution missing | Signup must be `user_type=vendor` with `referral_code` in body |
| Cannot post review | Booking not `completed` or review already exists |
| Dispute button disabled | `bookingDisputeHelpers.canOpenDisputeForBookingStatus` |
| Payout stuck | Open dispute — check Slice 6 + admin trust resolution |
| Admin 403 | `require_admin` — user lacks admin role |
| Review still visible after hide | `hidden_at` filter on public queries; explore cache |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| S3 URLs in JSON profile (not DB blobs) | **Leave it alone** — standard pattern |
| `visibility.py` single module | **Leave it alone** — prevents explore/profile drift |
| Tiered fee discount (not vendor portion) | **Leave it alone** — protects vendor earnings |
| Separate partner vs client referral systems | **Leave it alone** — different attribution models |
| Admin audit log on trust actions | **Leave it alone** — required for compliance |
| Dispute blocks payout | **Leave it alone** — client protection (Slice 6) |

---

## Key concepts from this slice

- **Onboarding** — wizard collects trust payload; media in S3, metadata in Postgres JSON.
- **Visibility triad** — `approval_status` + Stripe Connect + `listing_override`.
- **Two referral programs** — partner (`?ref=` signup) vs vendor client (`?vref=` booking).
- **Tiered fee discount** — off Eventtz 5% service fee based on vendor portion spend; shared tier constants in `bookingServiceFee.ts` + `tiers.py`.
- **Two-phase referral pricing** — live validation at enquire; stored `vendor_referral_code` on row for all later totals.
- **One-time referral code** — `REFERRAL_CODE_LOCKED` after first set; historical codes visible in referral bookings table.
- **Reviews** — one per completed booking; admin can hide.
- **Disputes** — participants open; admin resolves; may hold payout.
- **Admin console** — directory (people), commerce (money), trust (safety), referrals (growth), blog (content).

---

## Out of scope (footnotes)

- **Help center** — static help articles and FAQ navigation; not part of trust/admin ops.
- **Vendor copilot** (`VendorListingOptimizerPanel`, `vendorCopilotApi`) — AI listing suggestions during onboarding edit; separate from approval workflow.

---

## TL;DR

- **Onboarding** = `/vendor/profile` wizard + `uploadImage`/`uploadFile` → S3 → `PUT /vendor/profile`.
- **Go live** = admin approve + Stripe ready (or `listing_override=visible`).
- **Client referrals** = vendor `?vref=` code → tiered fee discount on enquire (Slice 3a); code locked after first create.
- **Partner referrals** = `?ref=` on vendor signup → `referral_attributions` (Slice 1 signup path).
- **Reviews** = post-`completed` only; one per booking; admin can hide.
- **Disputes** = booking detail **Help** header button + `/admin/trust`; may block payout (Slice 6).
- **Admin** = `/admin/dashboard`, `/directory`, `/commerce`, `/trust`, `/referrals`, `/blog`.
- **Email** = dispute/contact notifications via `dispatch.py` (Slice 7b).

---

## Related lessons

- Slice 1: `slice-1-auth-me.md` (signup, `require_admin`, session)
- Slice 2: `slice-2-client-browse.md` (`visibility.py`, explore filters)
- Slice 3a: `slice-3a-client-booking-enquire.md` (`?vref=`, `vendor_referral_code`)
- Slice 6: `slice-6-vendor-payout.md` (dispute payout hold)
- Slice 7a: `slice-7a-client-workspace.md` (review nudge on dashboard)
- Slice 7b: `slice-7b-comms-realtime.md` (dispute SSE, admin contact email)
