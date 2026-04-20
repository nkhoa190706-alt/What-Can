import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store: token -> { count, resetAt }
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware.
 * @param maxRequests - max requests per window
 * @param windowMs   - window duration in milliseconds
 * @param keyFn      - function to derive the rate-limit key from the request
 */
export function rateLimit(
  maxRequests: number,
  windowMs: number,
  keyFn: (req: Request) => string | null
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    if (!key) return next(); // Can't derive key → skip rate limiting

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      // Fresh window
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
      return next();
    }

    entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        error: "Too many requests. Please slow down.",
        retryAfterSeconds: retryAfter,
      });
    }

    next();
  };
}

/** Extract Bearer token from Authorization header */
export function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}
