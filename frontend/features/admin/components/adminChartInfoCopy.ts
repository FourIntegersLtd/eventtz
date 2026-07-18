/** Plain-English chart explanations for admin graph cards. */

export const MARKETPLACE_CHART_INFO = {
  overview: {
    title: "Marketplace overview",
    what: "A quick snapshot of marketplace health for the dates you picked: how many requests came in, how often they become finished bookings, and how many jobs were completed.",
    how: "Enquiries counts new client booking requests. Conversion is finished bookings divided by enquiries, with average vendor reply time underneath. Completed is finished jobs, with average paid booking value underneath. Quotes sent by vendors are left out of enquiries.",
  },
  demand: {
    title: "Demand over time",
    what: "How many new booking requests from clients came in each month. This shows demand only, not payments or finished jobs.",
    how: "We count new booking requests from clients in the dates you picked, then group them by month. Quotes sent by vendors are left out.",
  },
  completed: {
    title: "Bookings over time",
    what: "How many bookings finished successfully each month. The client paid and the job was marked done.",
    how: "We count bookings that finished in the dates you picked, then group them by the month they finished. Cancelled or unpaid requests are left out.",
  },
  category: {
    title: "Category performance",
    what: "Which service types get the most booking requests, such as photography, catering, or rentals. Useful for seeing where demand is strongest.",
    how: "Each request is linked to the vendor’s main service type. We add up requests for each type in the dates you picked and show the busiest ones.",
  },
  failures: {
    title: "Failed demand",
    what: "Why some booking requests never became a finished booking, such as no vendor reply, a client cancel, or a payment that did not go through.",
    how: "We look at requests that did not finish and have a recorded reason. Each slice is one reason, sized by how often it happened in the dates you picked.",
  },
  locations: {
    title: "Top locations",
    what: "Which places get the most booking requests. Ranked by how many enquiries came from each area, with a conversion rate next to the count.",
    how: "We group requests by the vendor’s city when we have one, otherwise by the event postcode area. Places are sorted by enquiry count. The percentage is finished bookings divided by enquiries for that place.",
  },
  vendors: {
    title: "Top vendors",
    what: "Which vendors completed the most paid work in the dates you picked, with money earned and how often requests turn into finished jobs.",
    how: "Vendors are ranked by finished bookings first, then by money from those jobs. Response time is the average time they took to reply. The percentage is finished bookings divided by enquiries for that vendor.",
  },
} as const;

export const FINANCIALS_CHART_INFO = {
  clientSpend: {
    title: "Client spend (paid)",
    what: "Total money clients paid for bookings each day. This is what customers spent before our fee and the vendor’s share are split out.",
    how: "For each day in the dates you picked, we add up what clients paid on bookings paid that day.",
  },
  feesAndPaid: {
    title: "Fees & paid bookings",
    what: "Two views of the same paid activity: Eventtz’s fee earned each day, and how many bookings were paid that day.",
    how: "Platform fee adds up our share on bookings paid each day. Paid bookings counts those payments. Unpaid or abandoned checkouts are left out.",
  },
} as const;

export const DASHBOARD_CHART_INFO = {
  signups: {
    title: "Signups",
    what: "How many new client and vendor accounts signed up each day.",
    how: "We count new accounts by signup date in the period you pick, split into clients and vendors.",
  },
  pipeline: {
    title: "Booking pipeline",
    what: "A snapshot of where all bookings sit right now: waiting, accepted, finished, declined, or cancelled. This is current totals, not a trend over time.",
    how: "We add up bookings by where they stand today. Changing the period above does not change this snapshot.",
  },
} as const;
