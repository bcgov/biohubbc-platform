import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { HTTP500 } from '../errors/http-error';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('services/martin-token-service');

/** Default lifetime of a tile token, seconds. */
const DEFAULT_TOKEN_TTL_SECONDS = 900;

export interface MartinTokenClaims {
  /** The single source the token grants access to. */
  source: string;
  /** Opaque server side context identifier. Resolves to the caller's authorization, server side. */
  ctx: string;
}

export interface MintedMartinToken {
  token: string;
  expiresIn: number;
  jti: string;
}

/**
 * Cached signing key. Read once and reused: the mint endpoint is unauthenticated, so re-reading the
 * key from disk per request would be an easy way to generate IO load.
 */
let cachedPrivateKey: string | null = null;

/**
 * Reset the cached signing key. Test seam.
 */
export const resetMartinTokenSigningKey = () => {
  cachedPrivateKey = null;
};

/**
 * Read the RS256 signing key.
 *
 * @return {*}  {string}
 */
const getPrivateKey = (): string => {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  const keyPath = process.env.MARTIN_TOKEN_PRIVATE_KEY_PATH;

  if (!keyPath) {
    throw new HTTP500('Tile tokens are not configured');
  }

  try {
    cachedPrivateKey = fs.readFileSync(keyPath, 'utf8');
  } catch (error) {
    defaultLog.error({ label: 'getPrivateKey', message: 'unable to read tile token signing key', error });
    throw new HTTP500('Tile tokens are not configured');
  }

  return cachedPrivateKey;
};

/**
 * Service for minting short lived vector tile tokens.
 *
 * Asymmetric (RS256) rather than symmetric signing, so the Martin Gateway only ever holds the public
 * key and cannot mint tokens of its own. The `kid` header lets the gateway hold several public keys
 * at once, which is what makes rotation possible without downtime.
 */
export class MartinTokenService {
  /**
   * Mint a tile token.
   *
   * The claims are deliberately minimal. In particular the token carries NO user identifier, NO
   * security scope ids, and NO search expression: it carries an opaque context id that only the
   * database can resolve. A token is therefore useless for learning anything about the caller, and a
   * client cannot widen its own access by editing it.
   *
   * @param {MartinTokenClaims} claims
   * @return {*}  {MintedMartinToken}
   */
  mintToken(claims: MartinTokenClaims): MintedMartinToken {
    const privateKey = getPrivateKey();

    const keyId = process.env.MARTIN_TOKEN_KID;

    if (!keyId) {
      throw new HTTP500('Tile tokens are not configured');
    }

    const expiresIn = Number(process.env.MARTIN_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS;
    const jti = uuidv4();

    const token = jwt.sign({ source: claims.source, ctx: claims.ctx, scope: 'tiles:read' }, privateKey, {
      algorithm: 'RS256',
      keyid: keyId,
      audience: process.env.MARTIN_TOKEN_AUD || 'biohub-tiles',
      issuer: process.env.MARTIN_TOKEN_ISS || 'biohub-api',
      jwtid: jti,
      expiresIn
    });

    return { token, expiresIn, jti };
  }

  /**
   * Build the tile URL template the client passes to MapLibre.
   *
   * Relative by default (`/martin/...`). In OpenShift the gateway is exposed under `/martin` on the
   * app's own hostname, so tiles are same origin; locally the app's dev server proxies `/martin` to
   * the gateway. Keeping it relative means no environment specific host has to be threaded through.
   *
   * @param {string} source
   * @return {*}  {string}
   */
  getMartinUrlTemplate(source: string): string {
    const baseUrl = process.env.MARTIN_EXTERNAL_URL || '/martin';

    return `${baseUrl.replace(/\/$/, '')}/${source}/{z}/{x}/{y}`;
  }
}
