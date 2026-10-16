/** Labels for plan-mode section option counts. */

export function planOptionsLabel(totalCount: number): string {
  if (totalCount <= 0) return "No options yet";
  if (totalCount === 1) return "1 option";
  return `${totalCount} options`;
}
