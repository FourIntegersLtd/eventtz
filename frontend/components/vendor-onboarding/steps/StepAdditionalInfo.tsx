"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { STEP_COPY } from "../onboardingCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { inputClass, labelClass } from "./form-primitives";

export type StepAdditionalInfoProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  uploadingDoc: Record<"foodHygiene" | "indemnity" | "other", boolean>;
  onUploadAdditionalDoc: (
    kind: "foodHygiene" | "indemnity" | "other",
    file: File,
  ) => void | Promise<void>;
  onRemoveAdditionalDoc: (kind: "foodHygiene" | "indemnity") => void;
  onRemoveOtherDoc: (url: string) => void;
};

function DocUploadRow({
  label,
  helpText,
  persistedUrl,
  uploading,
  inputId,
  onUpload,
  onRemove,
}: {
  label: string;
  helpText: string;
  persistedUrl: string;
  uploading?: boolean;
  inputId: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      {label ? <label className={labelClass()}>{label}</label> : null}
      <p className="mb-2 text-xs text-neutral-500">{helpText}</p>
      {persistedUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
            Document uploaded
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/80 p-5 text-center">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            id={inputId}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className={`inline-flex cursor-pointer flex-col items-center gap-1.5 text-primary ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Upload className="h-5 w-5" strokeWidth={1.5} />
            <span className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
              {uploading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Uploading…
                </>
              ) : (
                "Upload document"
              )}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

export function StepAdditionalInfo({
  data,
  update,
  uploadingDoc,
  onUploadAdditionalDoc,
  onRemoveAdditionalDoc,
  onRemoveOtherDoc,
}: StepAdditionalInfoProps) {
  const copy = STEP_COPY[8];

  return (
    <div className="space-y-8">
      <OnboardingQuestionLayout headline={copy.headline} subtext={copy.subtext} />

      <OnboardingSubQuestion headline="Food hygiene certificate" indexOffset={3}>
        <DocUploadRow
          label=""
          helpText="If you handle or serve food, clients feel safer booking a certified vendor."
          persistedUrl={data.foodHygieneCertNamePersisted}
          uploading={uploadingDoc.foodHygiene}
          inputId="doc-food-hygiene"
          onUpload={(f) => void onUploadAdditionalDoc("foodHygiene", f)}
          onRemove={() => onRemoveAdditionalDoc("foodHygiene")}
        />
      </OnboardingSubQuestion>

      <OnboardingSubQuestion headline="Indemnity / insurance certificate" indexOffset={6}>
        <DocUploadRow
          label=""
          helpText="Public liability or indemnity insurance, if you have it."
          persistedUrl={data.indemnityCertNamePersisted}
          uploading={uploadingDoc.indemnity}
          inputId="doc-indemnity"
          onUpload={(f) => void onUploadAdditionalDoc("indemnity", f)}
          onRemove={() => onRemoveAdditionalDoc("indemnity")}
        />
      </OnboardingSubQuestion>

      <OnboardingSubQuestion headline="Other supporting documents" indexOffset={9}>
        <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/80 p-5 text-center">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            id="doc-other"
            disabled={uploadingDoc.other}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUploadAdditionalDoc("other", f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor="doc-other"
            className={`inline-flex cursor-pointer flex-col items-center gap-1.5 text-primary ${
              uploadingDoc.other ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Upload className="h-5 w-5" strokeWidth={1.5} />
            <span className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
              {uploadingDoc.other ? (
                <>
                  <LoadingSpinner size="sm" />
                  Uploading…
                </>
              ) : (
                "Upload another document"
              )}
            </span>
          </label>
        </div>
        {data.otherDocsNamesPersisted.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {data.otherDocsNamesPersisted.map((url) => (
              <li
                key={url}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
              >
                <FileText className="h-4 w-4 shrink-0 text-neutral-500" />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                  Document uploaded
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveOtherDoc(url)}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </OnboardingSubQuestion>

      <OnboardingSubQuestion headline="Dietary details (optional)" indexOffset={12}>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={data.isHalal}
            onChange={(e) => update({ isHalal: e.target.checked })}
          />
          <span>
            My food is halal
            <span className="mt-0.5 block text-xs font-normal text-neutral-500">
              Only relevant if you offer food or catering services.
            </span>
          </span>
        </label>
        <div className="mt-4">
          <label className={labelClass()}>Allergen information (optional)</label>
          <textarea
            className={`${inputClass()} min-h-[80px]`}
            value={data.allergenInfo}
            onChange={(e) => update({ allergenInfo: e.target.value })}
            placeholder="e.g. Contains nuts and dairy; gluten-free options available on request"
          />
        </div>
      </OnboardingSubQuestion>
    </div>
  );
}
