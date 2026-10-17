/**
 * The companies that handle personal information for Eventtz, shown on the
 * Privacy and Cookie policies. Keep it in plain English and in step with the
 * providers the app really uses (`api/app/adapters/`, `web/`).
 */
const ROWS = [
  {
    service: "Supabase",
    purpose: "Stores our database (your account, bookings and messages)",
    location: "EU (Frankfurt) / USA",
  },
  {
    service: "Stripe",
    purpose: "Takes card payments and pays vendors",
    location: "USA",
  },
  {
    service: "Vercel",
    purpose: "Runs the website you see",
    location: "USA / worldwide",
  },
  {
    service: "Railway",
    purpose: "Runs our servers",
    location: "USA / EU",
  },
  {
    service: "Resend",
    purpose: "Sends our emails (booking updates, password resets)",
    location: "USA",
  },
  {
    service: "OpenAI",
    purpose: "Writes optional suggestions when a vendor sets up their profile",
    location: "USA",
  },
  {
    service: "Mixpanel",
    purpose: "Counts which pages are visited and which steps people take, so we can improve Eventtz",
    location: "USA",
  },
  {
    service: "Sentry",
    purpose: "Tells us when something breaks on the website (sees your user number, not your email)",
    location: "USA / EU",
  },
  {
    service: "Cursor",
    purpose:
      "Helps our engineers deal with bug, booking and payment reports (sees the report and your account email)",
    location: "USA",
  },
  {
    service: "Amazon Web Services (S3)",
    purpose: "Stores photos, videos and documents you upload, and images in our emails",
    location: "United Kingdom (London)",
  },
  {
    service: "getAddress.io",
    purpose: "Finds and checks UK addresses",
    location: "United Kingdom",
  },
  {
    service: "Ordnance Survey Places",
    purpose: "Finds UK place names and where they are on the map",
    location: "United Kingdom",
  },
  {
    service: "Photon (Komoot)",
    purpose: "Suggests places as you type a location",
    location: "EU (Germany)",
  },
] as const;

/** A table of the companies above, with what each does and where. */
export function ThirdPartyServicesTable() {
  return (
    <div className="compliance-table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Company</th>
            <th scope="col">What it does for us</th>
            <th scope="col">Where it handles information</th>
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
