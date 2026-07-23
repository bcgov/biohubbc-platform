import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/**
 * Coarse per IP limiter.
 *
 * A backstop only. BC government networks NAT heavily, so a single address can front a whole office;
 * the budget is therefore deliberately generous and the real control is the per token limiter below.
 * Applied before token verification so unauthenticated floods are also bounded.
 */
export const ipRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitPerIpPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { name: 'Too Many Requests', status: 429, message: 'Too many tile requests' }
});

/**
 * Per token limiter, keyed on the verified `jti`.
 *
 * The budget must accommodate a viewport pan or zoom, which requests many tiles in a burst; too low
 * a limit shows the user a broken map. Must run after token verification, which is what puts the
 * claims on `res.locals`.
 */
export const jtiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitPerJtiPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { name: 'Too Many Requests', status: 429, message: 'Too many tile requests for this session' },
  keyGenerator: (_req: Request, res: Response) => {
    // Verification has already run, so the claims are present and trustworthy.
    return res.locals.tokenClaims?.jti ?? 'anonymous';
  }
});
