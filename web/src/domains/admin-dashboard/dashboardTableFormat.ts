/** Formats GMV for the dashboard daily table (two decimal pounds, no thousands separator). */

export function formatDashboardGmvGbp(gmvGbp: number): string {
  return `£${gmvGbp.toFixed(2)}`;
}
