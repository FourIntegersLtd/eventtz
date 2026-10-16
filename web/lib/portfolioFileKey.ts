/** Stable key for a local File in onboarding (names can repeat). */
export function portfolioFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
