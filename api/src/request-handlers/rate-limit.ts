import { Request } from 'express';
import rateLimit from 'express-rate-limit';

/** Default budget: requests per IP per window. */
const DEFAULT_LIMIT = 60;
/** Default window, minutes. */
const DEFAULT_WINDOW_MINUTES = 5;

/**
 * Resolve the client address for rate limiting.
 *
 * The API does not set a global `trust proxy`, and changing that would alter `req.ip` for every
 * existing endpoint. Instead the client address is derived here, for this limiter only: exactly one
 * proxy (the OpenShift router) sits in front of the API, so the client is the LAST entry of
 * X-Forwarded-For. Taking the first entry instead would let a caller spoof the header and evade the
 * limit by rotating a fake address.
 *
 * @param {Request} req
 * @return {*}  {string}
 */
const getClientAddress = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.length) {
    const lastAddress = forwardedFor.split(',').at(-1);

    if (lastAddress) {
      return lastAddress.trim();
    }
  }

  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};

/**
 * Per IP rate limiter for the Martin session endpoint.
 *
 * The endpoint is reachable anonymously and performs database work, so it needs a budget. The limit
 * is coarse on purpose: BC government networks NAT heavily, so many unrelated users can share one
 * address and a tight per IP limit would lock out legitimate traffic.
 */
export const martinTokenRateLimiter = rateLimit({
  windowMs: (Number(process.env.MARTIN_MINT_RATE_LIMIT_WINDOW_MINUTES) || DEFAULT_WINDOW_MINUTES) * 60 * 1000,
  limit: Number(process.env.MARTIN_MINT_RATE_LIMIT) || DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientAddress,
  // The custom key generator handles the proxy hop, so the built in X-Forwarded-For check would
  // otherwise warn about the API not setting `trust proxy`.
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { name: 'Too Many Requests', status: 429, message: 'Too many Martin session requests' }
});
