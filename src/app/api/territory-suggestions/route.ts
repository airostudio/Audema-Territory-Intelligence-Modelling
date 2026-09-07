import { NextResponse } from "next/server";
import { autocompletePlaces } from "@/engines/territory/index.js";
import { createRateLimiter, getClientIp } from "@/lib/rateLimit.js";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
// Typeahead fires much more often than a full search (every debounced keystroke), so this
// needs a higher ceiling than the wizard's own limiter — still bounded, since each call is a
// real, billed Places Autocomplete request.
const suggestionsLimiter = createRateLimiter(40, 5 * 60 * 1000);

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, MAX_QUERY_LENGTH) ?? "";

  // Live mode isn't configured, or the query is too short to be useful — fail soft with an
  // empty list rather than an error, since this is a UX nicety, not a required step.
  if (!apiKey || query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  if (suggestionsLimiter.isRateLimited(getClientIp(request))) {
    return NextResponse.json({ suggestions: [] }, { status: 429 });
  }

  try {
    const suggestions = await autocompletePlaces(apiKey, query);
    return NextResponse.json({ suggestions });
  } catch {
    // Same reasoning: a flaky Autocomplete call shouldn't surface as a visible error while typing.
    return NextResponse.json({ suggestions: [] });
  }
}
