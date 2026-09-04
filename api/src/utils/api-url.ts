/**
 * Build the canonical API base URL from runtime environment vars.
 *
 * Localhost gets http://; everything else gets https:// — matches the deploy pattern
 * where local dev runs plain HTTP and any non-localhost host is behind TLS.
 *
 * Used wherever a fully-qualified URL needs to be returned to a client (e.g. the
 * download endpoint's `download_url` response field).
 *
 * @return {string} The base URL (no trailing slash).
 */
export function getApiBaseUrl(): string {
  const host = process.env.API_HOST || 'localhost';
  const port = process.env.API_PORT || '6200';
  return host === 'localhost' ? `http://${host}:${port}` : `https://${host}`;
}
