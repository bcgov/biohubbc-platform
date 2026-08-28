import jwt from 'jsonwebtoken';
import { PRIMARY_KID, TEST_AUDIENCE, TEST_ISSUER, TEST_SOURCE, testKeys } from './test-setup.js';

export interface SignTokenOptions {
  privateKey?: string;
  kid?: string;
  audience?: string;
  issuer?: string;
  source?: string;
  ctx?: string;
  scope?: string;
  jti?: string;
  expiresIn?: string | number;
  /** Omit claims entirely, to exercise the missing-claim paths. */
  omit?: Array<'ctx' | 'jti' | 'scope' | 'source'>;
}

/**
 * Sign a tile token for tests.
 *
 * @param {SignTokenOptions} [options={}]
 * @return {*}  {string}
 */
export const signTestToken = (options: SignTokenOptions = {}): string => {
  const payload: Record<string, unknown> = {
    source: options.source ?? TEST_SOURCE,
    ctx: options.ctx ?? 'ctx-test',
    scope: options.scope ?? 'tiles:read'
  };

  for (const claim of options.omit ?? []) {
    delete payload[claim];
  }

  const omitJti = (options.omit ?? []).includes('jti');

  return jwt.sign(payload, options.privateKey ?? testKeys.primaryPrivateKey, {
    algorithm: 'RS256',
    keyid: options.kid ?? PRIMARY_KID,
    audience: options.audience ?? TEST_AUDIENCE,
    issuer: options.issuer ?? TEST_ISSUER,
    // `jti` is set through the signing options rather than the payload, so omitting it means not
    // passing `jwtid` at all.
    ...(omitJti ? {} : { jwtid: options.jti ?? `jti-${Math.random().toString(36).slice(2)}` }),
    expiresIn: options.expiresIn ?? '15m'
  });
};

/**
 * Build an Authorization header value.
 *
 * @param {SignTokenOptions} [options={}]
 * @return {*}  {string}
 */
export const bearer = (options: SignTokenOptions = {}): string => `Bearer ${signTestToken(options)}`;
