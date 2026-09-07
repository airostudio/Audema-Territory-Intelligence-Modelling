/**
 * Every external call this app makes (Geocoding, Places, Overpass, PageSpeed,
 * the site crawler) needs a hard client-side deadline — a hung upstream
 * request must not be able to consume the whole wizard request's time
 * budget. One shared helper instead of five copies of the same
 * AbortController/setTimeout/try-finally boilerplate.
 */
export async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
