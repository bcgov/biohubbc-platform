/**
 * Anchor rows processed per keyset page in security-scope anchor maintenance.
 */
export const SECURITY_SCOPE_ANCHOR_BATCH_SIZE = Number(process.env.SECURITY_SCOPE_ANCHOR_BATCH_SIZE ?? 5000);
