/**
 * Build a deterministic identity cache key from ordered identity parts.
 *
 * This is shared by contributor codeset services to avoid duplicating string
 * composition logic while keeping service-specific identity semantics local.
 */
export const makeIdentityKey = (...parts: Array<string | number>): string => parts.join('::');
