/**
 * Normalize a screenshot value into a usable <img> src.
 *
 * Screenshots may arrive either as a full data URL (e.g. `data:image/jpeg;base64,...`
 * produced by html2canvas) or as raw base64 (as the RFC annotation protocol allows).
 * Prefixing a value that is already a data URL yields a broken image — this helper
 * passes through complete data URLs and only prefixes bare base64.
 */
export function toDataUrl(screenshot: string | undefined | null): string | undefined {
  if (!screenshot) return undefined;
  const value = screenshot.trim();
  if (value === '') return undefined;
  if (value.startsWith('data:')) return value;
  // Assume PNG for bare base64 payloads (matches prior default behavior).
  return `data:image/png;base64,${value}`;
}
