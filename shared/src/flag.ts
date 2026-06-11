/** ISO-3166 alpha-2 country code -> regional-indicator flag emoji, or null if invalid. */
export function flagEmoji(countryCode: string): string | null {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const A = 0x1f1e6; // regional indicator 'A'
  const base = 'A'.charCodeAt(0);
  return String.fromCodePoint(A + (cc.charCodeAt(0) - base), A + (cc.charCodeAt(1) - base));
}
