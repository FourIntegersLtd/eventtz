"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { VENDOR_PROFILE_FORBIDDEN } from "@/lib/auth-messages";
import {
  fetchVendorProfile,
  getApiErrorDetail,
  isVendorProfileForbiddenError,
  saveVendorProfile,
} from "@/lib/vendorProfileApi";
import { isHttpStatus } from "@/lib/api-errors";
import { uploadFile, uploadImage } from "@/lib/mediaApi";
import { portfolioFileKey } from "@/lib/portfolioFileKey";
import {
  fetchStripePaymentsStatus,
  postConnectStripeAccount,
  type VendorPaymentsStatus,
} from "@/lib/vendorPaymentsApi";
import {
  SKIP_PORTFOLIO_IMAGE_ANALYSIS,
  postAnalyzePortfolioImage,
  postGenerateVendorBio,
  vendorOnboardingAiErrorMessage,
} from "@/lib/vendorOnboardingAiApi";
import { useToast } from "@/components/ui/Toast";
import { buildDraftBio, validateStep } from "./onboardingLogic";
import {
  mergePayloadIntoVendorData,
  normalizeVendorPayload,
  vendorDataToPayload,
} from "./serializeVendorPayload";
import { initialVendorOnboardingData, type VendorOnboardingData } from "./types";

export type PortfolioImageQualityRow = {
  ok: boolean;
  score?: number;
  summary: string;
  loading?: boolean;
  skipped?: boolean;
};

export function useVendorOnboardingController(options?: { isWalkthrough?: boolean }) {
  const isWalkthrough = options?.isWalkthrough ?? false;
  const router = useRouter();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<VendorOnboardingData>(initialVendorOnboardingData);
  const [businessNameError, setBusinessNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [bioVariant, setBioVariant] = useState(0);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string>("draft");
  const [approvalStatus, setApprovalStatus] = useState<VendorApprovalStatus>("pending");
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<VendorPaymentsStatus | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeConnectError, setStripeConnectError] = useState<string | null>(null);

  const [portfolioQuality, setPortfolioQuality] = useState<
    Record<string, PortfolioImageQualityRow>
  >({});
  const [portfolioQualityAccepted, setPortfolioQualityAccepted] = useState<
    Record<string, boolean>
  >({});

  const portfolioAnalysisInFlight = useRef<Set<string>>(new Set());
  const portfolioAnalysisDone = useRef<Set<string>>(new Set());

  const portfolioQualityRef = useRef(portfolioQuality);
  portfolioQualityRef.current = portfolioQuality;
  const portfolioQualityAcceptedRef = useRef(portfolioQualityAccepted);
  portfolioQualityAcceptedRef.current = portfolioQualityAccepted;

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
          setStep(isWalkthrough ? 1 : res.approval_status === "approved" ? 1 : 10);
        } else {
          const cs = res.current_step ?? 1;
          setStep(isWalkthrough ? 1 : Math.min(Math.max(cs, 1), 9));
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
  }, [authLoading, user?.id, user?.email, applyVendorProfileResponse, isWalkthrough]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    if (lockedPendingReview && step !== 10) {
      setStep(10);
    }
  }, [loadStatus, lockedPendingReview, step]);

  /** Analyse new portfolio files (step 6) with OpenAI vision. */
  useEffect(() => {
    if (step !== 6) return;
    const keys = data.portfolioFiles.map(portfolioFileKey);
    for (const k of [...portfolioAnalysisDone.current]) {
      if (!keys.includes(k)) {
        portfolioAnalysisDone.current.delete(k);
        portfolioAnalysisInFlight.current.delete(k);
      }
    }
    for (const f of data.portfolioFiles) {
      const k = portfolioFileKey(f);
      if (portfolioAnalysisDone.current.has(k)) continue;
      if (portfolioAnalysisInFlight.current.has(k)) continue;

      portfolioAnalysisInFlight.current.add(k);

      if (SKIP_PORTFOLIO_IMAGE_ANALYSIS) {
        portfolioAnalysisDone.current.add(k);
        setPortfolioQuality((prev) => ({
          ...prev,
          [k]: {
            ok: true,
            score: 3,
            summary: "Automatic image check is turned off — you can continue.",
            loading: false,
            skipped: true,
          },
        }));
        portfolioAnalysisInFlight.current.delete(k);
        continue;
      }

      setPortfolioQuality((prev) => ({
        ...prev,
        [k]: { ok: true, summary: "", loading: true },
      }));

      void postAnalyzePortfolioImage(f)
        .then((r) => {
          portfolioAnalysisDone.current.add(k);
          setPortfolioQuality((prev) => ({
            ...prev,
            [k]: { ok: r.ok, score: r.score, summary: r.summary, loading: false },
          }));
        })
        .catch(() => {
          portfolioAnalysisDone.current.add(k);
          setPortfolioQuality((prev) => ({
            ...prev,
            [k]: {
              ok: true,
              score: 3,
              summary: "Could not verify automatically — you can still continue.",
              loading: false,
              skipped: true,
            },
          }));
        })
        .finally(() => {
          portfolioAnalysisInFlight.current.delete(k);
        });
    }
  }, [step, data.portfolioFiles]);

  const refreshStripeStatus = useCallback(async () => {
    try {
      const res = await fetchStripePaymentsStatus();
      setStripeStatus(res);
    } catch {
      // Non-fatal: the onboarding step still works without a live status readout.
    }
  }, []);

  useEffect(() => {
    if (loadStatus !== "ready" || !user?.id) return;
    void refreshStripeStatus();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "return" || params.get("stripe") === "refresh") {
      params.delete("stripe");
      const next = params.toString();
      router.replace(next ? `/vendor/profile?${next}` : "/vendor/profile");
    }
  }, [loadStatus, user?.id, refreshStripeStatus, router]);

  const update = useCallback(
    (patch: Partial<VendorOnboardingData>) => {
      if (lockedPendingReview) return;
      setData((prev) => ({ ...prev, ...patch }));
      setFormError(null);
    },
    [lockedPendingReview],
  );

  const onConnectStripe = useCallback(async () => {
    setConnectingStripe(true);
    setStripeConnectError(null);
    try {
      update({ stripeConnectStarted: true });
      await saveVendorProfile({
        current_step: step,
        payload: vendorDataToPayload({ ...data, stripeConnectStarted: true }),
      });
      const { onboarding_url } = await postConnectStripeAccount();
      window.location.href = onboarding_url;
    } catch {
      setStripeConnectError(
        "We couldn't start Stripe Connect onboarding. Check your connection and try again.",
      );
      setConnectingStripe(false);
    }
  }, [data, step, update]);

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
      const nextData = { ...data, aiBioDraft: bio };
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

  const removePortfolioFileAtIndex = useCallback(
    (idx: number) => {
      const f = data.portfolioFiles[idx];
      if (!f) return;
      const k = portfolioFileKey(f);
      portfolioAnalysisDone.current.delete(k);
      portfolioAnalysisInFlight.current.delete(k);
      setPortfolioQuality((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      setPortfolioQualityAccepted((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      update({
        portfolioFiles: data.portfolioFiles.filter((_, i) => i !== idx),
      });
    },
    [data.portfolioFiles, update],
  );

  const acceptPortfolioQualityAnyway = useCallback((key: string) => {
    setPortfolioQualityAccepted((prev) => ({ ...prev, [key]: true }));
    setFormError(null);
  }, []);

  const onViewProfileReview = useCallback(() => {
    if (lockedPendingReview) return;
    setFormError(null);
    setStep(9);
  }, [lockedPendingReview]);

  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const onUploadPortfolioVideo = useCallback(
    async (file: File) => {
      setUploadingVideo(true);
      setVideoUploadError(null);
      try {
        const uploaded = await uploadFile(file);
        setData((prev) => ({
          ...prev,
          portfolioVideo: null,
          portfolioVideoNamePersisted: uploaded.public_url,
        }));
      } catch {
        setVideoUploadError("Could not upload video. Check your connection and try again.");
      } finally {
        setUploadingVideo(false);
      }
    },
    [],
  );

  const onRemovePortfolioVideo = useCallback(() => {
    setData((prev) => ({ ...prev, portfolioVideo: null, portfolioVideoNamePersisted: "" }));
  }, []);

  const onRemovePersistedPortfolioImage = useCallback((url: string) => {
    setData((prev) => ({
      ...prev,
      portfolioFileNamesPersisted: prev.portfolioFileNamesPersisted.filter(
        (u) => u !== url,
      ),
      profileImageUrl: prev.profileImageUrl === url ? "" : prev.profileImageUrl,
    }));
  }, []);

  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [profileImageError, setProfileImageError] = useState<string | null>(null);

  const onUploadProfileImage = useCallback(
    async (file: File) => {
      if (!user?.id) {
        setProfileImageError("Please sign in again, then retry your upload.");
        return;
      }
      setUploadingProfileImage(true);
      setProfileImageError(null);
      try {
        const uploaded = await uploadImage(file);
        setData((prev) => ({ ...prev, profileImageUrl: uploaded.public_url }));
      } catch {
        setProfileImageError(
          "Could not upload profile image. Check your connection and try again.",
        );
      } finally {
        setUploadingProfileImage(false);
      }
    },
    [user?.id],
  );

  const [uploadingDoc, setUploadingDoc] = useState<
    Record<"foodHygiene" | "indemnity" | "other", boolean>
  >({ foodHygiene: false, indemnity: false, other: false });

  const onUploadAdditionalDoc = useCallback(
    async (kind: "foodHygiene" | "indemnity" | "other", file: File) => {
      setUploadingDoc((prev) => ({ ...prev, [kind]: true }));
      try {
        const uploaded = await uploadFile(file);
        setData((prev) => {
          if (kind === "foodHygiene") {
            return { ...prev, foodHygieneCertFile: null, foodHygieneCertNamePersisted: uploaded.public_url };
          }
          if (kind === "indemnity") {
            return { ...prev, indemnityCertFile: null, indemnityCertNamePersisted: uploaded.public_url };
          }
          return {
            ...prev,
            otherDocsFiles: [],
            otherDocsNamesPersisted: [...prev.otherDocsNamesPersisted, uploaded.public_url],
          };
        });
      } catch {
        showToast({ title: "Upload failed. Check your connection and try again.", tone: "error" });
      } finally {
        setUploadingDoc((prev) => ({ ...prev, [kind]: false }));
      }
    },
    [showToast],
  );

  const onRemoveAdditionalDoc = useCallback(
    (kind: "foodHygiene" | "indemnity") => {
      setData((prev) =>
        kind === "foodHygiene"
          ? { ...prev, foodHygieneCertFile: null, foodHygieneCertNamePersisted: "" }
          : { ...prev, indemnityCertFile: null, indemnityCertNamePersisted: "" },
      );
    },
    [],
  );

  const onRemoveOtherDoc = useCallback((url: string) => {
    setData((prev) => ({
      ...prev,
      otherDocsNamesPersisted: prev.otherDocsNamesPersisted.filter((u) => u !== url),
    }));
  }, []);

  /** Uploads any additional-info files still pending as raw `File`s (defensive — files are
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
    if (!user?.email) return;
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
      if (res.status === "submitted" && res.approval_status === "approved") {
        setStep(1);
      }
    } catch {
      setFormError("We couldn't refresh your status. Please try again.");
    } finally {
      setRefreshingStatus(false);
    }
  }, [user?.email, applyVendorProfileResponse]);

  const primaryLabel = useMemo(() => {
    if (isWalkthrough && step === 9) return "Finish walkthrough";
    if (profileStatus === "submitted" && approvalStatus === "approved") {
      return "Save changes";
    }
    if (step === 9) return "Confirm";
    if (step === 10) return "OK";
    return "Next";
  }, [step, profileStatus, approvalStatus, isWalkthrough]);

  const goNext = useCallback(async () => {
    if (step === 10 || saving || loadStatus !== "ready" || authLoading) return;
    if (lockedPendingReview) return;
    if (businessNameError && step === 2) {
      setFormError("Fix business name before continuing.");
      return;
    }
    const workingData: VendorOnboardingData =
      step === 2
        ? {
            ...data,
            aiBioDraft: data.aiBioDraft.trim() ? data.aiBioDraft : buildDraftBio(data, bioVariant),
          }
        : data;
    const err = validateStep(step, workingData);
    if (err) {
      setFormError(err);
      return;
    }
    if (step === 2) {
      setData(workingData);
    }

    if (step === 6) {
      for (const f of workingData.portfolioFiles) {
        const k = portfolioFileKey(f);
        const q = portfolioQualityRef.current[k];
        if (q?.loading) {
          setFormError("Still checking your images…");
          return;
        }
      }
      for (const f of workingData.portfolioFiles) {
        const k = portfolioFileKey(f);
        const q = portfolioQualityRef.current[k];
        if (!q || q.skipped) continue;
        if (!q.ok && !portfolioQualityAcceptedRef.current[k]) {
          setFormError(
            "One or more images may look low quality to clients. Replace them or tap “Use this image anyway” for each one you want to keep.",
          );
          return;
        }
      }
    }

    const isLive = profileStatus === "submitted" && approvalStatus === "approved";
    const walkthroughFinish = isWalkthrough && step === 9 && isLive;
    const nextStep = step === 9 ? (isLive && !isWalkthrough ? 9 : 10) : step + 1;
    setSaving(true);
    setFormError(null);
    try {
      let dataToSave: VendorOnboardingData = workingData;
      if (step === 6) {
        if (!user?.id) {
          setFormError("Please sign in again, then retry your upload.");
          return;
        }
        if (workingData.portfolioFiles.length > 0) {
          const uploaded = await Promise.all(
            workingData.portfolioFiles.map((f) => uploadImage(f)),
          );
          const nextPersisted = [
            ...workingData.portfolioFileNamesPersisted,
            ...uploaded.map((u) => u.public_url),
          ];
          dataToSave = {
            ...workingData,
            portfolioFiles: [],
            portfolioFileNamesPersisted: nextPersisted,
          };
          setData(dataToSave);
        }
      }
      if (step === 8) {
        dataToSave = await persistAdditionalInfoFiles(dataToSave);
        setData(dataToSave);
      }
      const res = await saveVendorProfile({
        current_step: walkthroughFinish ? 9 : nextStep,
        payload: vendorDataToPayload(dataToSave),
        status: step === 9 && !walkthroughFinish ? "submitted" : undefined,
      });
      applyVendorProfileResponse(res);
      if (walkthroughFinish) {
        showToast({ title: "Walkthrough complete", tone: "success" });
        router.push("/vendor/settings");
        return;
      }
      if (isLive && !isWalkthrough) {
        showToast({ title: "Changes saved", tone: "success" });
      } else {
        setStep(nextStep);
      }
    } catch (e) {
      const detail =
        getApiErrorDetail(e) ??
        "We couldn't save your changes. Check your connection and try again.";
      if (isHttpStatus(e, 409)) {
        setBusinessNameError(detail);
        if (step !== 2) {
          setFormError(`${detail} Go back to Business to choose another name.`);
        } else {
          setFormError(detail);
        }
      } else {
        setFormError(detail);
      }
    } finally {
      setSaving(false);
    }
  }, [
    step,
    saving,
    loadStatus,
    authLoading,
    lockedPendingReview,
    profileStatus,
    approvalStatus,
    businessNameError,
    data,
    bioVariant,
    applyVendorProfileResponse,
    persistAdditionalInfoFiles,
    router,
    user?.id,
    isWalkthrough,
    showToast,
  ]);

  const goBack = useCallback(() => {
    setFormError(null);
    if (lockedPendingReview) return;
    if (step <= 1 || step === 10) return;
    setStep((s) => s - 1);
  }, [lockedPendingReview, step]);

  const navigateToStep = useCallback(
    (target: number) => {
      if (lockedPendingReview) return;
      if (target < 1 || target > 9) return;
      setFormError(null);
      setStep(target);
    },
    [lockedPendingReview],
  );

  return {
    step,
    data,
    businessNameError,
    formError,
    setFormError,
    loadStatus,
    saving,
    generatingBio,
    approvalStatus,
    refreshingStatus,
    accessDenied,
    accessDeniedMessage,
    lockedPendingReview,
    primaryLabel,
    profileStatus,
    setBusinessNameError,
    onRegenerateBio,
    onGenerateBioWithAI,
    onViewProfileReview,
    onRefreshStatus,
    goNext,
    goBack,
    navigateToStep,
    update,
    authLoading,
    portfolioQuality,
    portfolioQualityAccepted,
    removePortfolioFileAtIndex,
    acceptPortfolioQualityAnyway,
    onRemovePersistedPortfolioImage,
    uploadingProfileImage,
    profileImageError,
    onUploadProfileImage,
    uploadingVideo,
    videoUploadError,
    onUploadPortfolioVideo,
    onRemovePortfolioVideo,
    uploadingDoc,
    onUploadAdditionalDoc,
    onRemoveAdditionalDoc,
    onRemoveOtherDoc,
    stripeStatus,
    connectingStripe,
    stripeConnectError,
    onConnectStripe,
    isWalkthrough,
  };
}
