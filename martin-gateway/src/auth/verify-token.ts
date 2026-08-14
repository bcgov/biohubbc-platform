import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../errors/tile-error.js';
import { getLogger } from '../utils/logger.js';

const defaultLog = getLogger('auth/verify-token');

/** Claims the gateway relies on. Deliberately minimal: no user identity, no search expression. */
export interface MartinTokenClaims {
  /** Audience. Must match the configured tile audience. */
  aud: string;
  /** Issuer. Must match the configured issuer (the BioHub API). */
  iss: string;
  /** The single source this token may read. */
  source: string;
  /** Opaque server side context identifier, forwarded to Martin as the only trusted parameter. */
  ctx: string;
  /** Granted scope. */
  scope: string;
  /** Token identifier, used as the rate limiting key and the only safe log handle for a token. */
  jti: string;
  /** Expiry, seconds since epoch. */
  exp: number;
}

/**
 * Public keys by `kid`.
 *
 * Loading a directory rather than a single key is what makes rotation possible: publishing a second
 * `<kid>.pem` lets the gateway accept tokens signed by either key while the API cuts over, after
 * which the retired key is removed.
 */
let publicKeysByKid: Map<string, string> | null = null;

/**
 * Assert the key id the API signs with is among the loaded public keys.
 *
 * Nothing else links the two: the key files are named by whoever created the secret, and a
 * mis-named file (`public.pem` instead of `<kid>.pem`) passes every health check while the gateway
 * 401s every tile with "unknown key". Failing startup instead surfaces the mismatch as a
 * crashloop with an explicit message. Skipped when no expected kid is configured.
 *
 * @param {Map<string, string>} keys - Public keys loaded from the key directory, by key id.
 * @param {(string | null)} expectedKid - Key id the API signs with, or null when unconfigured.
 * @return {void}
 * @throws {Error} When the expected key id is configured but absent.
 */
export const assertExpectedKidPresent = (keys: Map<string, string>, expectedKid: string | null): void => {
  if (!expectedKid) {
    return;
  }

  if (!keys.has(expectedKid)) {
    throw new Error(
      `Expected public key "${expectedKid}.pem" (MARTIN_TOKEN_KID) was not found; loaded kids: ${[...keys.keys()].join(
        ', '
      )}. Tokens minted by the API could never be verified.`
    );
  }
};

/**
 * Load the public keys from the configured directory.
 *
 * Called once at startup so a missing or empty key directory - or a key directory that cannot
 * verify what the API signs - fails the deployment rather than every tile request.
 *
 * @return {*}  {Map<string, string>}
 */
export const loadPublicKeys = (): Map<string, string> => {
  const keys = new Map<string, string>();

  const entries = fs.readdirSync(config.publicKeyDir);

  for (const entry of entries) {
    if (!entry.endsWith('.pem')) {
      continue;
    }

    const kid = path.basename(entry, '.pem');
    keys.set(kid, fs.readFileSync(path.join(config.publicKeyDir, entry), 'utf8'));
  }

  if (!keys.size) {
    throw new Error(`No .pem public keys found in MARTIN_TOKEN_PUBLIC_KEY_DIR: ${config.publicKeyDir}`);
  }

  assertExpectedKidPresent(keys, config.expectedKid);

  defaultLog.info({ message: 'Loaded tile token public keys', kids: [...keys.keys()] });

  publicKeysByKid = keys;

  return keys;
};

/**
 * Reset the cached keys. Test seam.
 *
 * @return {void}
 */
export const resetPublicKeys = () => {
  publicKeysByKid = null;
};

/**
 * Verify a tile token and return its claims.
 *
 * Verification is local: no call is made to the API on the tile path. Failures are deliberately
 * split so the frontend can react correctly:
 * - 401 means "get a new token" (missing, malformed, expired, wrongly signed, unknown key).
 * - 403 means "this token will never work for this request" (wrong source, insufficient scope).
 *
 * @param {(string | undefined)} authorizationHeader
 * @param {string} requestedSource
 * @return {*}  {MartinTokenClaims}
 */
export const verifyMartinToken = (
  authorizationHeader: string | undefined,
  requestedSource: string
): MartinTokenClaims => {
  if (!authorizationHeader) {
    throw unauthorized('Missing Authorization header');
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw unauthorized('Malformed Authorization header');
  }

  if (!publicKeysByKid) {
    loadPublicKeys();
  }

  const decoded = jwt.decode(token, { complete: true });

  if (!decoded || typeof decoded === 'string') {
    throw unauthorized('Malformed tile token');
  }

  const kid = decoded.header.kid;

  if (!kid) {
    throw unauthorized('Tile token is missing a key id');
  }

  const publicKey = publicKeysByKid?.get(kid);

  if (!publicKey) {
    throw unauthorized('Tile token was signed with an unknown key');
  }

  let claims: MartinTokenClaims;

  try {
    // Pinning `algorithms` is what prevents an algorithm confusion attack, where a token declares
    // `alg: none` or a symmetric algorithm and the public key is treated as a shared secret.
    claims = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: config.tokenAudience,
      issuer: config.tokenIssuer
    }) as MartinTokenClaims;
  } catch (_error) {
    // Never surface the underlying jsonwebtoken message: it distinguishes expiry from a bad
    // signature, which is more than a caller needs.
    throw unauthorized();
  }

  if (!claims.jti || !claims.ctx) {
    throw unauthorized('Tile token is missing required claims');
  }

  const scopes = String(claims.scope || '').split(' ');

  if (!scopes.includes(config.requiredScope)) {
    throw forbidden('Tile token does not grant tile access');
  }

  if (claims.source !== requestedSource) {
    throw forbidden('Tile token does not grant access to this source');
  }

  return claims;
};
