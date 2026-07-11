const ROWS = [
  {
    service: "Supabase",
    purpose: "Authentication, database, and file storage",
    location: "EU (Frankfurt) / USA",
  },
  {
    service: "Stripe",
    purpose: "Card payments and vendor payouts (Stripe Connect)",
    location: "USA",
  },
  {
    service: "Vercel",
    purpose: "Frontend hosting and content delivery",
    location: "USA / global edge",
  },
  {
    service: "Railway",
    purpose: "Backend API hosting",
    location: "USA / EU",
  },
  {
    service: "OpenAI",
    purpose: "Optional AI assistance during vendor onboarding (e.g. bio suggestions)",
    location: "USA",
  },
  {
    service: "getAddress.io",
    purpose: "UK address lookup and validation",
    location: "United Kingdom",
  },
  {
    service: "Ordnance Survey Places",
    purpose: "UK place-name search and geocoding",
    location: "United Kingdom",
  },
] as const;

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
          {ROWS.map((row) => (
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
