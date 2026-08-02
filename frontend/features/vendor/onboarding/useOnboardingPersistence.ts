"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { VENDOR_PROFILE_FORBIDDEN } from "@/lib/auth-messages";
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
import { buildDraftBio } from "./onboardingLogic";
import { normalizePublicBioText } from "./reviewDisplayHelpers";
import { mapLegacyOnboardingStep } from "./onboardingProgress";
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
  const [bioVariant, setBioVariant] = useState(0);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string>("draft");
  const [approvalStatus, setApprovalStatus] = useState<VendorApprovalStatus>("pending");
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

  const applyVendorProfileResponse = useCallback(
    (res: Awaited<ReturnType<typeof fetchVendorProfile>>) => {
      setProfileStatus(res.status ?? "draft");
      if (res.approval_status === "approved") {
        setApprovalStatus("approved");
      } else if (res.approval_status === "banned") {
        setApprovalStatus("banned");
      } else {
        setApprovalStatus("pending");
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
          normalizeVendorPayload(res.payload),
          user.email ?? "",
        );
        setData({
          ...initialVendorOnboardingData,
          ...merged,
          email: merged.email?.trim() || user.email || "",
          password: "",
        });
        if (res.status === "submitted") {
          setStep(isWalkthrough ? 1 : res.approval_status === "approved" ? 1 : 9);
        } else {
          const cs = res.current_step ?? 1;
          setStep(
            isWalkthrough
              ? 1
              : mapLegacyOnboardingStep(cs, merged.onboardingFlowVersion ?? 1),
          );
        }
        setLoadStatus("ready");
      } catch (e) {
        if (cancelled) return;
        if (isVendorProfileForbiddenError(e)) {
          setAccessDenied(true);
          setAccessDeniedMessage(getApiErrorDetail(e) ?? VENDOR_PROFILE_FORBIDDEN);
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

  const onRegenerateBio = useCallback(() => {
    setBioVariant((v) => {
      const next = v + 1;
      setData((prev) => ({
        ...prev,
        aiBioDraft: buildDraftBio(prev, next),
      }));
      return next;
    });
  }, []);

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
          payload: vendorDataToPayload(nextData),
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
        normalizeVendorPayload(res.payload),
        user.email ?? "",
      );
      setData({
        ...initialVendorOnboardingData,
        ...merged,
        email: merged.email?.trim() || user.email || "",
        password: "",
      });
      if (res.approval_status === "approved") {
        setStatusCheckFeedback({
          tone: "success",
          title: "You're approved!",
          description: "Your profile is live. Head to your dashboard to manage bookings.",
        });
        showToast({
          title: "You're approved!",
          description: "Your dashboard is ready — welcome to Eventtz.",
          tone: "success",
        });
      } else if (res.approval_status === "banned") {
        setStatusCheckFeedback({
          tone: "warning",
          title: "Profile not visible",
          description: "An admin has restricted this profile. Contact support if you believe this is a mistake.",
        });
      } else if (res.status === "submitted") {
        setStatusCheckFeedback({
          tone: "info",
          title: "Still under review",
          description: "No change yet — we'll email you when your profile goes live (usually 1–3 business days).",
        });
        showToast({
          title: "Still under review",
          description: "We'll email you when your profile goes live.",
          tone: "neutral",
        });
      } else {
        setStatusCheckFeedback({
          tone: "info",
          title: "Status checked",
          description: "Your profile hasn't been submitted for review yet.",
        });
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
  }, [user?.email, applyVendorProfileResponse, showToast]);

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
    refreshingStatus,
    statusCheckFeedback,
    accessDenied,
    accessDeniedMessage,
    lockedPendingReview,
    applyVendorProfileResponse,
    onRegenerateBio,
    onGenerateBioWithAI,
    onRefreshStatus,
    persistAdditionalInfoFiles,
    userId: user?.id,
  };
}
