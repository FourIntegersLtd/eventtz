"use client";

import {
  Briefcase,
  CalendarDays,
  Clock,
  Fingerprint,
  Images,
  Mail,
  MapPin,
  Package,
  PartyPopper,
  Phone,
  Sparkles,
  Truck,
  User,
  Building2,
} from "lucide-react";
import { VendorPortfolioThumbGrid } from "@/components/vendor/VendorPortfolioThumbGrid";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { formatMoneyLabel, payloadStr } from "./vendorFormatters";
import {
  PackageRow,
  ProfileField,
  ProfileSection,
  RateCard,
  TagPills,
  type VendorProfileData,
} from "./vendorDetailsShared";

type Props = {
  vendor: AdminVendorRow;
  profile: VendorProfileData;
};

export function VendorDetailsOverviewSection({ vendor, profile }: Props) {
  const {
    businessName,
    p,
    packages,
    portfolioUrls,
    services,
    eventTypes,
    travelPolicy,
    deliveryModes,
    phone,
    contactName,
    payloadEmail,
    loginEmail,
    travelRadiusLabel,
    socialLinks,
  } = profile;

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <ProfileSection icon={Fingerprint} title="Account">
          <ProfileField icon={Building2} label="Business name" value={businessName} />
          {contactName ? (
            <ProfileField icon={User} label="Contact name" value={contactName} />
          ) : null}
          <ProfileField icon={Mail} label="Email" value={loginEmail} />
          {payloadEmail && payloadEmail !== loginEmail ? (
            <ProfileField icon={Mail} label="Profile email" value={payloadEmail} />
          ) : null}
          <ProfileField icon={Phone} label="Phone" value={phone || "—"} />
          <ProfileField icon={Fingerprint} label="User id" value={vendor.user_id} mono />
          {socialLinks.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-500">Social</p>
              <ul className="space-y-1 text-sm text-neutral-800">
                {socialLinks.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </ProfileSection>

        <ProfileSection icon={MapPin} title="Location">
          <ProfileField icon={MapPin} label="Base city" value={payloadStr(p, "baseCity") || "—"} />
          <ProfileField icon={Truck} label="Travel radius" value={travelRadiusLabel} />
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">Delivery modes</p>
            <TagPills items={deliveryModes} />
          </div>
          <ProfileField icon={Truck} label="Travel / delivery policy" value={travelPolicy} />
        </ProfileSection>
      </div>

      <ProfileSection icon={Briefcase} title="Business & services">
        <div className="space-y-5">
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Services
            </p>
            <TagPills items={services} />
          </div>
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <PartyPopper className="h-3.5 w-3.5" aria-hidden />
              Event types
            </p>
            <TagPills items={eventTypes} />
          </div>
        </div>
      </ProfileSection>

      <ProfileSection icon={Clock} title="Rates">
        <div className="grid gap-4 sm:grid-cols-2">
          <RateCard icon={Clock} label="Hourly" value={payloadStr(p, "hourlyRate")} />
          <RateCard icon={CalendarDays} label="Daily" value={payloadStr(p, "dailyRate")} />
        </div>
      </ProfileSection>

      {packages.length > 0 ? (
        <ProfileSection icon={Package} title={`Packages (${packages.length})`}>
          <ul className="rounded-xl border border-neutral-200/80 bg-neutral-50/40 px-5 py-2">
            {packages.map((pkg, i) => {
              const row =
                typeof pkg === "object" && pkg !== null ? (pkg as Record<string, unknown>) : {};
              const title = payloadStr(row, "title") || `Package ${i + 1}`;
              const price = formatMoneyLabel(payloadStr(row, "price"));
              const duration = payloadStr(row, "duration") || "—";
              return (
                <PackageRow
                  key={`${String(row.id ?? i)}`}
                  title={title}
                  price={price}
                  duration={duration}
                />
              );
            })}
          </ul>
        </ProfileSection>
      ) : null}

      {portfolioUrls.length > 0 ? (
        <ProfileSection icon={Images} title={`Portfolio (${portfolioUrls.length})`}>
          <VendorPortfolioThumbGrid urls={portfolioUrls} />
        </ProfileSection>
      ) : null}
    </div>
  );
}
