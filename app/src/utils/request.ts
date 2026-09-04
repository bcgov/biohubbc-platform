/**
 * Determines whether an unknown request failure represents cancellation.
 *
 * Supports both standard abort-style names and the cancellation message used
 * by the configured HTTP client.
 *
 * @param {unknown} error - Value rejected by an asynchronous request.
 * @returns {boolean} True when the request was intentionally cancelled.
 */
export const isAbortError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'CanceledError' || error.message === 'canceled')
  );
};
