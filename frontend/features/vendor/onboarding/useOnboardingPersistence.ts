"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-messages";
import {
  fetchVendorProfile,
  getApiErrorDetail,
  isVendorProfileForbiddenError,
  saveVendorProfile,
} from "@/lib/vendorProfileApi";
import { uploadFile } from "@/lib/mediaApi";
import {
  postGenerateVendorBio,
  vendorOnboardingAiErrorMessage,
} from "@/lib/vendorOnboardingAiApi";
import {
  needsMorePortfolioPhotos as dataNeedsMorePortfolioPhotos,
  normalizePublicBioText,
  portfolioImageCountFromData,
} from "./reviewDisplayHelpers";
import { isReturnedForEdits, resolveOnboardingStepFromProfile } from "./onboardingProgress";
import { RETURNED_FOR_EDITS_FEEDBACK } from "./returnedForEditsCopy";
import {
  mergePayloadIntoVendorData,
  normalizeVendorPayload,
  vendorDataToPayload,
} from "./serializeVendorPayload";
import { initialVendorOnboardingData, type VendorOnboardingData, type VendorStatusCheckFeedback } from "./types";

type UseOnboardingPersistenceOptions = {
  isWalkthrough: boolean;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  showToast: ReturnType<typeof import("@/components/ui/Toast").useToast>["showToast"];
};

export function useOnboardingPersistence({
  isWalkthrough,
  step,
  setStep,
  showToast,
}: UseOnboardingPersistenceOptions) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<VendorOnboardingData>(initialVendorOnboardingData);
  const [formError, setFormErrorState] = useState<string | null>(null);
  const [formErrorAlertKey, setFormErrorAlertKey] = useState(0);
  const setFormError = useCallback((message: string | null) => {
    setFormErrorState(message);
    if (message) {
      setFormErrorAlertKey((key) => key + 1);
    }
  }, []);
  const bioVariant = 0;
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string>("draft");
  const [approvalStatus, setApprovalStatus] = useState<VendorApprovalStatus>("pending");
  const [listingVisible, setListingVisible] = useState(false);
  const [payoutsVerified, setPayoutsVerified] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [statusCheckFeedback, setStatusCheckFeedback] = useState<VendorStatusCheckFeedback | null>(
    null,
  );
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const lockedPendingReview = useMemo(() => {
    return (
      profileStatus === "submitted" &&
      (approvalStatus === "pending" || approvalStatus === "banned")
    );
  }, [profileStatus, approvalStatus]);

  const portfolioImageCount = useMemo(
    () => portfolioImageCountFromData(data),
    [data],
  );

  const needsMorePortfolioPhotos = useMemo(
    () => dataNeedsMorePortfolioPhotos(data),
    [data],
  );

  const canAddPortfolioWhilePending = useMemo(
    () =>
      profileStatus === "submitted" &&
      approvalStatus === "pending" &&
      needsMorePortfolioPhotos,
    [profileStatus, approvalStatus, needsMorePortfolioPhotos],
  );

  const returnedForEdits = useMemo(
    () =>
      isReturnedForEdits({
        onboarding_status: profileStatus,
        approval_status: approvalStatus,
        current_step: step,
        returnedForEditsAt: data.returnedForEditsAt,
      }),
    [profileStatus, approvalStatus, step, data.returnedForEditsAt],
  );

  const applyVendorProfileResponse = useCallback(
    (res: Awaited<ReturnType<typeof fetchVendorProfile>>) => {
      setProfileStatus(res.onboarding_status ?? "draft");
      if (res.approval_status === "approved") {
        setApprovalStatus("approved");
      } else if (res.approval_status === "banned") {
        setApprovalStatus("banned");
      } else {
        setApprovalStatus("pending");
      }
      setListingVisible(Boolean(res.listing_visible));
      setPayoutsVerified(Boolean(res.payouts_verified));
      if ((res.onboarding_status ?? "draft") === "submitted") {
        setData((prev) => (prev.returnedForEditsAt ? { ...prev, returnedForEditsAt: "" } : prev));
        // Drop leftover “returned for edits” copy from the load so submit shows pending.
        setStatusCheckFeedback(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoadStatus("ready");
      return;
    }
    let cancelled = false;
    setAccessDenied(false);
    setAccessDeniedMessage(null);
    (async () => {
      try {
        const res = await fetchVendorProfile();
        if (cancelled) return;
        setAccessDenied(false);
        applyVendorProfileResponse(res);
        const merged = mergePayloadIntoVendorData(
          normalizeVendorPayload(res.profile_form_data),
          user.email ?? "",
        );
        setData({
          ...initialVendorOnboardingData,
          ...merged,
          email: merged.email?.trim() || user.email || "",
          password: "",
        });
        setStep(
          isWalkthrough
            ? 1
            : resolveOnboardingStepFromProfile(
                res,
                merged.onboardingFlowVersion ?? 1,
                false,
              ),
        );
        setLoadStatus("ready");
      } catch (e) {
        if (cancelled) return;
        if (isVendorProfileForbiddenError(e)) {
          setAccessDenied(true);
          setAccessDeniedMessage(getApiErrorDetail(e) ?? GENERIC_AUTH_ERROR);
          setLoadStatus("ready");
          return;
        }
        setLoadStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, user?.email, applyVendorProfileResponse, isWalkthrough, setStep]);

  const update = useCallback(
    (patch: Partial<VendorOnboardingData>) => {
      if (lockedPendingReview) return;
      setData((prev) => ({ ...prev, ...patch }));
      setFormError(null);
    },
    [lockedPendingReview],
  );

  const onGenerateBioWithAI = useCallback(async () => {
    if (lockedPendingReview) return;
    setGeneratingBio(true);
    setFormError(null);
    try {
      const payload = vendorDataToPayload(data);
      const { bio } = await postGenerateVendorBio(payload);
      const nextData = { ...data, aiBioDraft: normalizePublicBioText(bio) };
      setData(nextData);
      try {
        const res = await saveVendorProfile({
          current_step: step,
          profile_form_data: vendorDataToPayload(nextData),
        });
        applyVendorProfileResponse(res);
      } catch {
        setFormError(
          "Your bio is ready in the box above, but it didn’t save to your profile. Check your connection and try “Generate bio with AI” again, or tap Next to save.",
        );
      }
    } catch (e) {
      setFormError(vendorOnboardingAiErrorMessage(e));
    } finally {
      setGeneratingBio(false);
    }
  }, [data, lockedPendingReview, step, applyVendorProfileResponse]);

  /** Uploads any additional-info files still pending as raw `File`s (defensive - files are
   * normally uploaded immediately on selection via `onUploadAdditionalDoc`). */
  const persistAdditionalInfoFiles = useCallback(
    async (d: VendorOnboardingData): Promise<VendorOnboardingData> => {
      let next = d;
      if (next.foodHygieneCertFile) {
        const uploaded = await uploadFile(next.foodHygieneCertFile);
        next = { ...next, foodHygieneCertFile: null, foodHygieneCertNamePersisted: uploaded.public_url };
      }
      if (next.indemnityCertFile) {
        const uploaded = await uploadFile(next.indemnityCertFile);
        next = { ...next, indemnityCertFile: null, indemnityCertNamePersisted: uploaded.public_url };
      }
      if (next.otherDocsFiles.length > 0) {
        const uploaded = await Promise.all(next.otherDocsFiles.map((f) => uploadFile(f)));
        next = {
          ...next,
          otherDocsFiles: [],
          otherDocsNamesPersisted: [
            ...next.otherDocsNamesPersisted,
            ...uploaded.map((u) => u.public_url),
          ],
        };
      }
      return next;
    },
    [],
  );

  const onRefreshStatus = useCallback(async () => {
    if (!user?.email) {
      setStatusCheckFeedback({
        tone: "error",
        title: "We couldn't verify your account",
        description: "Sign out and sign in again, then try once more.",
      });
      return;
    }
    setRefreshingStatus(true);
    setFormError(null);
    try {
      const res = await fetchVendorProfile();
      applyVendorProfileResponse(res);
      const merged = mergePayloadIntoVendorData(
        normalizeVendorPayload(res.profile_form_data),
        user.email ?? "",
      );
      setData({
        ...initialVendorOnboardingData,
        ...merged,
        email: merged.email?.trim() || user.email || "",
        password: "",
      });
      if (res.approval_status === "approved" && !res.listing_visible && !res.payouts_verified) {
        setStatusCheckFeedback({
          tone: "warning",
          title: "Approved - one step left",
          description:
            "Finish payout setup so clients can find and book you. Your profile stays hidden until then.",
        });
        showToast({
          title: "Approved - finish payout setup",
          description: "Your profile goes live once your payout details are verified.",
          tone: "neutral",
        });
      } else if (res.approval_status === "approved" && !res.listing_visible) {
        // Payouts are fine, so this is an admin holding the listing back.
        setStatusCheckFeedback({
          tone: "warning",
          title: "Profile temporarily hidden",
          description:
            "Our team has paused your listing while they take another look. We'll email you as soon as it's back up.",
        });
      } else if (res.approval_status === "approved") {
        setStatusCheckFeedback({
          tone: "success",
          title: "You're approved!",
          description: "Your profile is live. Head to your dashboard to manage bookings.",
        });
        showToast({
          title: "You're approved!",
          description: "Your dashboard is ready. Welcome to Eventtz.",
          tone: "success",
        });
      } else if (res.approval_status === "banned") {
        setStatusCheckFeedback({
          tone: "warning",
          title: "Profile not visible",
          description: "An admin has restricted this profile. Contact support if you believe this is a mistake.",
        });
      } else if (res.onboarding_status === "submitted") {
        setStatusCheckFeedback({
          tone: "info",
          title: "Still under review",
          description: "No change yet. We'll email you when your profile goes live (usually 1–3 business days).",
        });
        showToast({
          title: "Still under review",
          description: "We'll email you when your profile goes live.",
          tone: "neutral",
        });
      } else {
        // "Check approval status" only appears on the post-submit screen (step 9).
        // Any non-submitted status here means admin returned the profile for edits.
        const flowVersion = merged.onboardingFlowVersion ?? 1;
        const editStep = resolveOnboardingStepFromProfile(
          {
            ...res,
            onboarding_status: res.onboarding_status ?? "draft",
          },
          flowVersion,
          isWalkthrough,
        );
        setStep(editStep);
        setStatusCheckFeedback(RETURNED_FOR_EDITS_FEEDBACK);
      }
    } catch {
      setStatusCheckFeedback({
        tone: "error",
        title: "Couldn't refresh your status",
        description: "Check your connection and try again in a moment.",
      });
    } finally {
      setRefreshingStatus(false);
    }
  }, [user?.email, applyVendorProfileResponse, showToast, isWalkthrough, step, setStep]);

  const persistProfileImageUrl = useCallback(
    async (url: string) => {
      if (approvalStatus === "banned") return;
      const nextData = { ...data, profileImageUrl: url };
      setData(nextData);
      setSaving(true);
      setFormError(null);
      try {
        const res = await saveVendorProfile({
          current_step: step,
          profile_form_data: vendorDataToPayload(nextData),
        });
        applyVendorProfileResponse(res);
        showToast({ title: "Profile photo updated", tone: "success" });
      } catch (e) {
        setFormError(
          getApiErrorDetail(e) ??
            "Photo uploaded but could not save to your profile. Try again.",
        );
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [
      approvalStatus,
      data,
      step,
      applyVendorProfileResponse,
      showToast,
      setData,
      setSaving,
      setFormError,
    ],
  );

  return {
    data,
    setData,
    update,
    formError,
    formErrorAlertKey,
    setFormError,
    bioVariant,
    loadStatus,
    saving,
    setSaving,
    generatingBio,
    profileStatus,
    approvalStatus,
    listingVisible,
    payoutsVerified,
    refreshingStatus,
    statusCheckFeedback,
    accessDenied,
    accessDeniedMessage,
    lockedPendingReview,
    portfolioImageCount,
    needsMorePortfolioPhotos,
    canAddPortfolioWhilePending,
    returnedForEdits,
    applyVendorProfileResponse,
    onGenerateBioWithAI,
    onRefreshStatus,
    persistAdditionalInfoFiles,
    persistProfileImageUrl,
    userId: user?.id,
  };
}
