/**
 * Gateway configuration, parsed once at startup from the environment.
 *
 * Every value is validated eagerly so a misconfigured deployment fails fast on boot rather than on
 * the first tile request.
 */

/**
 * Read a required string environment variable.
 *
 * @param {string} name
 * @return {*}  {string}
 */
const requireString = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

/**
 * Read an optional numeric environment variable.
 *
 * @param {string} name
 * @param {number} defaultValue
 * @return {*}  {number}
 */
const readNumber = (name: string, defaultValue: number): number => {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number, received: ${raw}`);
  }

  return value;
};

/**
 * Read a comma separated list environment variable.
 *
 * @param {string} name
 * @param {string} defaultValue
 * @return {*}  {string[]}
 */
const readList = (name: string, defaultValue: string): string[] => {
  return (process.env[name] || defaultValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const minZoom = readNumber('MARTIN_MIN_ZOOM', 0);
const maxZoom = readNumber('MARTIN_MAX_ZOOM', 15);

if (minZoom < 0 || maxZoom > 30 || minZoom > maxZoom) {
  throw new Error(`Invalid zoom bounds: MARTIN_MIN_ZOOM=${minZoom}, MARTIN_MAX_ZOOM=${maxZoom}`);
}

const allowedSources = readList('MARTIN_ALLOWED_SOURCES', 'search');

if (!allowedSources.length) {
  throw new Error('MARTIN_ALLOWED_SOURCES must list at least one source');
}

export const config = {
  /** Port the gateway listens on. */
  port: readNumber('MARTIN_GATEWAY_PORT', 6300),

  /** Base URL of the upstream Martin instance. In OpenShift this is a loopback sidecar address. */
  martinUrl: process.env.MARTIN_URL || 'http://127.0.0.1:3000',

  /** Milliseconds to wait for Martin before giving up on a tile. */
  martinTimeoutMs: readNumber('MARTIN_TIMEOUT_MS', 10000),

  /** Directory of PEM public keys. Each file is named `<kid>.pem`, which enables key rotation. */
  publicKeyDir: requireString('MARTIN_TOKEN_PUBLIC_KEY_DIR'),

  /**
   * Key id the API is configured to sign with. Optional; when set, startup asserts a matching
   * `<kid>.pem` is among the loaded public keys. Without the assertion, a mis-named key file
   * passes every health check and silently 401s every tile instead.
   */
  expectedKid: process.env.MARTIN_TOKEN_KID || null,

  /** Expected `aud` claim. */
  tokenAudience: process.env.MARTIN_TOKEN_AUD || 'biohub-tiles',

  /** Expected `iss` claim. */
  tokenIssuer: process.env.MARTIN_TOKEN_ISS || 'biohub-api',

  /** Scope the token must carry to fetch tiles. */
  requiredScope: process.env.MARTIN_TOKEN_SCOPE || 'tiles:read',

  /** Sources the gateway will proxy. Anything else is rejected, whether or not Martin publishes it. */
  allowedSources,

  /** Inclusive zoom bounds. Requests outside the range are rejected without reaching Martin. */
  minZoom,
  maxZoom,

  /** Tile cache lifetime, seconds. Also bounds how long a revoked feature can linger in a tile. */
  cacheTtlSeconds: readNumber('MARTIN_CACHE_TTL_SECONDS', 300),

  /** Maximum total size of cached tile bodies, bytes. */
  cacheMaxBytes: readNumber('MARTIN_CACHE_MAX_BYTES', 52428800),

  /**
   * Opaque version string mixed into every cache key. Bumping it at deploy time invalidates all
   * cached tiles, which is how a tile function change is rolled out.
   */
  sourceVersion: process.env.MARTIN_SOURCE_VERSION || '1',

  /** Per token (`jti`) request budget. Must accommodate a viewport pan, which is many tiles. */
  rateLimitPerJtiPerMinute: readNumber('RATE_LIMIT_JTI_PER_MIN', 600),

  /**
   * Coarse per IP budget, a secondary backstop only. BC government networks NAT heavily, so many
   * unrelated users can share one address and this must never be the primary control.
   */
  rateLimitPerIpPerMinute: readNumber('RATE_LIMIT_IP_PER_MIN', 3000),

  /** Origin allowed to request tiles. Same origin in OpenShift; cross origin in local development. */
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',

  /** Seconds between metrics log lines. */
  metricsIntervalSeconds: readNumber('METRICS_INTERVAL_SECONDS', 300),

  logLevel: process.env.LOG_LEVEL || 'info'
};

export type Config = typeof config;
