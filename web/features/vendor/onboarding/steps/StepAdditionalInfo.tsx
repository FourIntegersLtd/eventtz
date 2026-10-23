"use client";

import { FileText, Upload } from "lucide-react";
import { useRef } from "react";
import { SOCIAL_PLATFORM_OPTIONS } from "../../../../lib/vendorOnboarding/constants";
import {
  createVendorSocialLink,
  type SocialPlatform,
  type VendorOnboardingData,
  type VendorOnboardingUpdate,
} from "../../../../lib/vendorOnboarding/types";
import { uploadedFileDisplayName } from "../../../../lib/vendorOnboarding/uploadedFileDisplayName";
import { Checkbox } from "../../../../components/ui/Checkbox";
import { TextField } from "../../../../components/ui/TextField";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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

/** Platforms the design shows as fixed fields; any other platform is an extra row. */
const PRIMARY_PLATFORMS: SocialPlatform[] = ["instagram", "website"];

/** Platforms a vendor can add beyond the two fixed fields, in the order they are offered. */
const EXTRA_PLATFORMS: SocialPlatform[] = ["tiktok", "facebook", "twitter"];

/** Row style from design V07: a hairline under each document. */
const DOCUMENT_ROW_STYLE = {
  padding: "14px 0",
  borderBottom: "1px solid var(--ez-line)",
} as const;

/**
 * One document row (design V07): icon tile, title and hint, then either an Upload button
 * or an Uploaded badge with Replace (and Remove where the document can be cleared).
 */
function DocumentRow({
  title,
  hint,
  uploadedLabels,
  uploading,
  onUpload,
  onRemove,
}: {
  title: string;
  hint: string;
  /** Display names of the files already stored for this row; empty when none. */
  uploadedLabels: string[];
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasUpload = uploadedLabels.length > 0;
  return (
    <div className="ez-list-row" style={DOCUMENT_ROW_STYLE}>
      <span className="ez-icon-tile">
        <FileText strokeWidth={1.75} aria-hidden />
      </span>
      <div className="ez-list-row__main">
        <span className="ez-strong">{title}</span>
        <span className="ez-small">{hint}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        aria-label={title}
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
      {hasUpload ? <Badge tone="success">Uploaded</Badge> : null}
      <Button
        variant={hasUpload ? "ghost" : "secondary"}
        size="sm"
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {hasUpload ? null : <Upload size={18} strokeWidth={1.75} aria-hidden />}
        {uploading ? "Uploading…" : hasUpload ? "Replace" : "Upload document"}
      </Button>
      {hasUpload && onRemove ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          data-design-extra="doc-remove"
          onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
}

/** Step 8 (design V07): online links, dietary details and supporting documents, all optional. */
export function StepAdditionalInfo({
  data,
  update,
  uploadingDoc,
  onUploadAdditionalDoc,
  onRemoveAdditionalDoc,
  onRemoveOtherDoc,
}: StepAdditionalInfoProps) {
  const handleFor = (platform: SocialPlatform) =>
    data.socialLinks.find((link) => link.platform === platform)?.handle ?? "";

  /** Sets the first link of a platform, creating it on first input. */
  const setHandle = (platform: SocialPlatform, handle: string) => {
    const exists = data.socialLinks.some((link) => link.platform === platform);
    if (exists) {
      let patched = false;
      update({
        socialLinks: data.socialLinks.map((link) => {
          if (link.platform !== platform || patched) return link;
          patched = true;
          return { ...link, handle };
        }),
      });
      return;
    }
    update({ socialLinks: [...data.socialLinks, { ...createVendorSocialLink(platform), handle }] });
  };

  const extraLinks = data.socialLinks.filter((link) => !PRIMARY_PLATFORMS.includes(link.platform));
  const nextExtraPlatform = EXTRA_PLATFORMS.find(
    (platform) => !data.socialLinks.some((link) => link.platform === platform),
  );
  const placeholderFor = (platform: SocialPlatform) =>
    SOCIAL_PLATFORM_OPTIONS.find((option) => option.value === platform)?.placeholder ?? "";
  const labelFor = (platform: SocialPlatform) =>
    SOCIAL_PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ?? platform;

  return (
    <div className="ez-stack">
      <div className="ez-stack ez-stack--sm">
        <h3 className="ez-h3">
          Find you online <span className="ez-label__opt">(optional)</span>
        </h3>
        <div className="ez-form-grid">
          <TextField
            label="Instagram"
            value={handleFor("instagram")}
            placeholder={placeholderFor("instagram")}
            onChange={({ target: { value } }) => setHandle("instagram", value)}
          />
          <TextField
            label="Website"
            value={handleFor("website")}
            placeholder={placeholderFor("website")}
            onChange={({ target: { value } }) => setHandle("website", value)}
          />
          {extraLinks.map((link) => (
            <TextField
              key={link.id}
              label={labelFor(link.platform)}
              value={link.handle}
              placeholder={placeholderFor(link.platform)}
              onChange={({ target: { value } }) =>
                update({
                  socialLinks: data.socialLinks.map((item) =>
                    item.id === link.id ? { ...item, handle: value } : item,
                  ),
                })
              }
            />
          ))}
        </div>
        {nextExtraPlatform ? (
          <div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() =>
                update({
                  socialLinks: [...data.socialLinks, createVendorSocialLink(nextExtraPlatform)],
                })
              }>
              Add {labelFor(nextExtraPlatform)}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="ez-stack ez-stack--sm">
        <h3 className="ez-h3">
          Dietary details <span className="ez-label__opt">(optional)</span>
        </h3>
        <Checkbox checked={data.isHalal} onChange={(checked) => update({ isHalal: checked })}>
          Halal
        </Checkbox>
        <Checkbox checked={data.isVegan} onChange={(checked) => update({ isVegan: checked })}>
          Vegan options available
        </Checkbox>
        <Checkbox checked={data.isVegetarian} onChange={(checked) => update({ isVegetarian: checked })}>
          Vegetarian options available
        </Checkbox>
        <Checkbox checked={data.isGlutenFree} onChange={(checked) => update({ isGlutenFree: checked })}>
          Gluten-free options available
        </Checkbox>
        <TextField
          label={
            <>
              Allergen information <span className="ez-label__opt">(optional)</span>
            </>
          }
          value={data.allergenInfo}
          placeholder="e.g. Contains nuts and dairy; gluten-free options available on request"
          onChange={({ target: { value } }) => update({ allergenInfo: value })}
        />
      </div>

      <div className="ez-stack ez-stack--sm">
        <h3 className="ez-h3">Documents</h3>
        <p className="ez-small">
          If you handle or serve food, clients feel safer booking a certified vendor.
        </p>
        <DocumentRow
          title="Food hygiene certificate"
          hint="Level 2 or above."
          uploadedLabels={
            data.foodHygieneCertNamePersisted
              ? [
                  uploadedFileDisplayName(
                    data.foodHygieneCertNamePersisted,
                    data.uploadedFileLabels,
                    "Food hygiene certificate",
                  ),
                ]
              : []
          }
          uploading={uploadingDoc.foodHygiene}
          onUpload={(file) => void onUploadAdditionalDoc("foodHygiene", file)}
        />
        <DocumentRow
          title="Indemnity / insurance certificate"
          hint="Public liability or indemnity insurance, if you have it."
          uploadedLabels={
            data.indemnityCertNamePersisted
              ? [
                  uploadedFileDisplayName(
                    data.indemnityCertNamePersisted,
                    data.uploadedFileLabels,
                    "Indemnity / insurance certificate",
                  ),
                ]
              : []
          }
          uploading={uploadingDoc.indemnity}
          onUpload={(file) => void onUploadAdditionalDoc("indemnity", file)}
        />
        <DocumentRow
          title="Other supporting documents"
          hint="Licences, awards or references."
          uploadedLabels={[]}
          uploading={uploadingDoc.other}
          onUpload={(file) => void onUploadAdditionalDoc("other", file)}
        />
        {data.otherDocsNamesPersisted.map((url) => (
          <div className="ez-list-row" style={DOCUMENT_ROW_STYLE} key={url}>
            <span className="ez-icon-tile">
              <FileText strokeWidth={1.75} aria-hidden />
            </span>
            <div className="ez-list-row__main">
              <span className="ez-strong">
                {uploadedFileDisplayName(url, data.uploadedFileLabels, "Document")}
              </span>
            </div>
            <Badge tone="success">Uploaded</Badge>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onRemoveOtherDoc(url)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
