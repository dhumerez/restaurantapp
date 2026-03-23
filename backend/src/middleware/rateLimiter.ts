import type { Request, Response, NextFunction } from "express";

interface RateRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateRecord>();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

export function rateLimiter(maxAttempts: number, windowMs: number, message = "Demasiados intentos. Intenta más tarde.") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.ip ?? req.socket.remoteAddress ?? "unknown") + req.path;
    const now = Date.now();
    const record = store.get(key);

    if (record && now < record.resetAt) {
      if (record.count >= maxAttempts) {
        const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
        res.setHeader("Retry-After", retryAfterSec);
        res.status(429).json({ error: message });
        return;
      }
      record.count++;
    } else {
      store.set(key, { count: 1, resetAt: now + windowMs });
    }

    next();
  };
}
