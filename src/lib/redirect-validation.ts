/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows relative paths starting with "/".
 * Returns "/dashboard" for any invalid or external URL.
 */
export function getSafeRedirectUrl(url: string | null): string {
  const fallback = "/dashboard";
  if (!url) return fallback;

  // Must start with a single "/" and not "//" (which browsers treat as protocol-relative)
  if (!url.startsWith("/") || url.startsWith("//")) return fallback;

  // Block any URL with a protocol scheme (e.g., "javascript:", "data:")
  try {
    // If URL constructor succeeds with a base, it's a valid relative path
    const parsed = new URL(url, "http://localhost");
    if (parsed.origin !== "http://localhost") return fallback;
  } catch {
    return fallback;
  }

  return url;
}
