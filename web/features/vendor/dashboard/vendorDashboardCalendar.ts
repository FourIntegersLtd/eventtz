/** One cell in the vendor dashboard month grid. */
export type DashboardCalendarCell = {
  day: number | null;
  dateKey: string | null;
  booked: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function localDateKeyFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Build a Monday-first grid for `viewMonth` (any date in that month). */
export function buildDashboardMonthGrid(
  viewMonth: Date,
  bookedDateKeys: ReadonlySet<string>,
): DashboardCalendarCell[] {
  const year = viewMonth.getFullYear();
  const monthIndex = viewMonth.getMonth();
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayFirstOffset = (first.getDay() + 6) % 7;
  const cells: DashboardCalendarCell[] = [];

  for (let index = 0; index < mondayFirstOffset; index += 1) {
    cells.push({ day: null, dateKey: null, booked: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = localDateKeyFromParts(year, monthIndex, day);
    cells.push({
      day,
      dateKey,
      booked: bookedDateKeys.has(dateKey),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateKey: null, booked: false });
  }
  while (cells.length < 35) {
    cells.push({ day: null, dateKey: null, booked: false });
  }
  return cells.slice(0, 35);
}

export function formatDashboardMonthTitle(viewMonth: Date): string {
  return viewMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
