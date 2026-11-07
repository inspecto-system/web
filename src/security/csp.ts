/**
 * Content Security Policy of the web app (SECURITY.md §10). Scripts and styles run only with the
 * nonce of the response; the API is on the same origin behind nginx (ADR-013), so `connect-src`
 * needs nothing else. Photos are shown as blob: URLs of authenticated downloads.
 *
 * @param nonce random value of this response
 * @param development `next dev` needs `eval` for React's error overlay; production never does
 */
export function contentSecurityPolicy(nonce: string, development: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
