"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { uploadFile, uploadImage } from "@/lib/mediaApi";
import { portfolioFileKey } from "@/lib/portfolioFileKey";
import {
  SKIP_PORTFOLIO_IMAGE_ANALYSIS,
  postAnalyzePortfolioImage,
} from "@/lib/vendorOnboardingAiApi";
import type { useToast } from "@/components/ui/Toast";
import type { VendorOnboardingData } from "./types";

export type PortfolioImageQualityRow = {
  ok: boolean;
  score?: number;
  summary: string;
  loading?: boolean;
  skipped?: boolean;
};

type UseOnboardingMediaOptions = {
  step: number;
  data: VendorOnboardingData;
  setData: Dispatch<SetStateAction<VendorOnboardingData>>;
  update: (patch: Partial<VendorOnboardingData>) => void;
  userId: string | undefined;
  showToast: ReturnType<typeof useToast>["showToast"];
  setFormError: (error: string | null) => void;
};

export function useOnboardingMedia({
  step,
  data,
  setData,
  update,
  userId,
  showToast,
  setFormError,
}: UseOnboardingMediaOptions) {
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

  const acceptPortfolioQualityAnyway = useCallback(
    (key: string) => {
      setPortfolioQualityAccepted((prev) => ({ ...prev, [key]: true }));
      setFormError(null);
    },
    [setFormError],
  );

  const onRemovePersistedPortfolioImage = useCallback((url: string) => {
    setData((prev) => ({
      ...prev,
      portfolioFileNamesPersisted: prev.portfolioFileNamesPersisted.filter(
        (u) => u !== url,
      ),
      profileImageUrl: prev.profileImageUrl === url ? "" : prev.profileImageUrl,
    }));
  }, [setData]);

  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const onUploadPortfolioVideo = useCallback(async (file: File) => {
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
  }, [setData]);

  const onRemovePortfolioVideo = useCallback(() => {
    setData((prev) => ({ ...prev, portfolioVideo: null, portfolioVideoNamePersisted: "" }));
  }, [setData]);

  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [profileImageError, setProfileImageError] = useState<string | null>(null);

  const onUploadProfileImage = useCallback(
    async (file: File) => {
      if (!userId) {
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
    [userId, setData],
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
    [showToast, setData],
  );

  const onRemoveAdditionalDoc = useCallback(
    (kind: "foodHygiene" | "indemnity") => {
      setData((prev) =>
        kind === "foodHygiene"
          ? { ...prev, foodHygieneCertFile: null, foodHygieneCertNamePersisted: "" }
          : { ...prev, indemnityCertFile: null, indemnityCertNamePersisted: "" },
      );
    },
    [setData],
  );

  const onRemoveOtherDoc = useCallback(
    (url: string) => {
      setData((prev) => ({
        ...prev,
        otherDocsNamesPersisted: prev.otherDocsNamesPersisted.filter((u) => u !== url),
      }));
    },
    [setData],
  );

  const preparePortfolioFilesForSave = useCallback(
    async (workingData: VendorOnboardingData): Promise<VendorOnboardingData> => {
      if (workingData.portfolioFiles.length === 0) {
        return workingData;
      }
      if (!userId) {
        throw new Error("Please sign in again, then retry your upload.");
      }
      const uploaded = await Promise.all(
        workingData.portfolioFiles.map((f) => uploadImage(f)),
      );
      const nextPersisted = [
        ...workingData.portfolioFileNamesPersisted,
        ...uploaded.map((u) => u.public_url),
      ];
      return {
        ...workingData,
        portfolioFiles: [],
        portfolioFileNamesPersisted: nextPersisted,
      };
    },
    [userId],
  );

  const validatePortfolioQualityForNext = useCallback(
    (workingData: VendorOnboardingData): string | null => {
      for (const f of workingData.portfolioFiles) {
        const k = portfolioFileKey(f);
        const q = portfolioQualityRef.current[k];
        if (q?.loading) {
          return "Still checking your images…";
        }
      }
      for (const f of workingData.portfolioFiles) {
        const k = portfolioFileKey(f);
        const q = portfolioQualityRef.current[k];
        if (!q || q.skipped) continue;
        if (!q.ok && !portfolioQualityAcceptedRef.current[k]) {
          return "One or more images may look low quality to clients. Replace them or tap “Use this image anyway” for each one you want to keep.";
        }
      }
      return null;
    },
    [],
  );

  return {
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
    preparePortfolioFilesForSave,
    validatePortfolioQualityForNext,
  };
}
