/** Plain-English chart explanations for vendor analytics. */

export const VENDOR_CHART_INFO = {
  overview: {
    title: "Your overview",
    what: "A quick snapshot of your bookings for the dates you picked: how many enquiries you got, how often they become finished jobs, and how many you completed.",
    how: "Enquiries counts new booking requests. Conversion is finished bookings divided by enquiries, with your average reply time underneath. Completed is finished jobs, with total revenue underneath.",
  },
  enquiries: {
    title: "Enquiries over time",
    what: "How many new booking requests you received each month.",
    how: "We count new requests in the dates you picked and group them by month.",
  },
  revenue: {
    title: "Revenue over time",
    what: "How much you earned from paid bookings each month.",
    how: "We add up paid booking totals for jobs in the dates you picked, grouped by month.",
  },
  funnel: {
    title: "Booking funnel",
    what: "Where interest turns into work: profile views, enquiries, accepted, paid, and completed.",
    how: "Each slice is a stage in your funnel for the dates you picked. Larger slices mean more activity at that stage.",
  },
  response: {
    title: "Response time",
    what: "How long you took on average to reply to enquiries each month.",
    how: "We measure time from enquiry to your first reply, average it by month, and show it in hours.",
  },
  rating: {
    title: "Customer rating",
    what: "Your average customer rating each month (out of 5).",
    how: "We average ratings left on completed bookings in each month.",
  },
} as const;
