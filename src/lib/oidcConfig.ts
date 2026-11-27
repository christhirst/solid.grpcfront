/**
 * Parses the OIDC_SCOPE env value into the space-separated string required by OAuth 2.0.
 * Accepts comma, whitespace or newline separated lists. Values are passed through exactly
 * as configured (case and order preserved, nothing added). Returns undefined when empty.
 */
export function parseOidcScope(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}
