/**
 * Best-effort, per-instance rate limiting for API routes that make real,
 * billed Google API calls with no auth in front of them. This is NOT a
 * reliable global limit: Vercel can run multiple instances of a function
 * concurrently, each with its own copy of a limiter's Map, and a cold start
 * resets it. It stops a single runaway browser tab or naive script, nothing
 * more — a real limit needs a shared store (Redis/KV), which is a
 * persistence decision, not something this module can provide.
 */

/**
 * x-forwarded-for's leftmost entry is whatever the caller put there — trivially spoofable by
 * sending a fresh random value on every request, which would defeat any limiter keyed on it.
 * x-real-ip and the rightmost x-forwarded-for entry are set by Vercel's own edge from the
 * actual observed connection, so those are what a client can't forge.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const hops = forwardedFor
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops?.[hops.length - 1] ?? "unknown";
}

export interface RateLimiter {
  isRateLimited(ip: string): boolean;
}

/** Creates an independent sliding-window limiter — give each route its own instance. */
export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  const log = new Map<string, number[]>();
  let sweepCounter = 0;

  return {
    isRateLimited(ip: string): boolean {
      const now = Date.now();
      // Periodically sweep the whole map rather than on every call — bounds its size against
      // the steady trickle of distinct IPs that only ever show up once, without adding per-request cost.
      if (++sweepCounter % 500 === 0) {
        for (const [key, timestamps] of log) {
          const stillRecent = timestamps.filter((t) => now - t < windowMs);
          if (stillRecent.length === 0) log.delete(key);
          else log.set(key, stillRecent);
        }
      }
      const recent = (log.get(ip) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      log.set(ip, recent);
      return recent.length > maxRequests;
    },
  };
}
