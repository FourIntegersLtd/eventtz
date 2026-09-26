const THIRD_PARTY_SERVICES = [
  { service: "Supabase", purpose: "Authentication and database", location: "EU (Frankfurt) / USA" },
  { service: "Stripe", purpose: "Card payments and vendor payouts (Stripe Connect)", location: "USA" },
  { service: "Vercel", purpose: "Frontend hosting and content delivery", location: "USA / global edge" },
  { service: "Railway", purpose: "Backend API hosting", location: "USA / EU" },
  { service: "Resend", purpose: "Transactional and account email delivery", location: "USA" },
  {
    service: "OpenAI",
    purpose: "Optional AI assistance during vendor onboarding (e.g. bio suggestions)",
    location: "USA",
  },
  {
    service: "Mixpanel",
    purpose: "Product analytics (page views, sign-in, marketplace funnel)",
    location: "USA",
  },
  {
    service: "Sentry",
    purpose: "Application error monitoring (user id only; no email)",
    location: "USA / EU",
  },
  {
    service: "Cursor",
    purpose: "Engineering automation for bug, booking, and payment support reports (message and account email)",
    location: "USA",
  },
  {
    service: "Amazon Web Services (S3)",
    purpose: "User photos, videos, documents, and email template images",
    location: "United Kingdom (eu-west-2)",
  },
  { service: "getAddress.io", purpose: "UK address lookup and validation", location: "United Kingdom" },
  {
    service: "Ordnance Survey Places",
    purpose: "UK place-name search and geocoding",
    location: "United Kingdom",
  },
  { service: "Photon (Komoot)", purpose: "Place search and location autocomplete", location: "EU (Germany)" },
] as const;

/** The third-party processors table shared by the Cookie and Privacy policies. Ported verbatim from the baseline. */
export function ThirdPartyServicesTable() {
  return (
    <div className="compliance-table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col">Purpose</th>
            <th scope="col">Typical location</th>
          </tr>
        </thead>
        <tbody>
          {THIRD_PARTY_SERVICES.map((row) => (
            <tr key={row.service}>
              <td>{row.service}</td>
              <td>{row.purpose}</td>
              <td>{row.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
