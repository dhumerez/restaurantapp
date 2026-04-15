import { redis } from "../redis.js";
import { TRPCError } from "@trpc/server";

interface RateLimitOptions {
  windowMs: number;  // milliseconds
  max: number;       // max requests per window
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<void> {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, "-inf", windowStart);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);
  pipeline.pexpire(key, options.windowMs);
  const results = await pipeline.exec();

  const count = results![2][1] as number;
  if (count > options.max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please try again later.",
    });
  }
}

// Pre-defined limit configs
export const LIMITS = {
  global: { windowMs: 60_000, max: 100 },
  login: { windowMs: 15 * 60_000, max: 10 },
  register: { windowMs: 60 * 60_000, max: 5 },
} as const;
