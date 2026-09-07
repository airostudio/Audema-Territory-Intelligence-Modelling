import type { BusinessRecord, IdealLocalBusinessProfile } from "../../types/index.js";
import { matchesProfile } from "../../types/business.js";
import { dedupeBusinessRecords } from "./dedupe.js";
import type { DiscoveryQuery, DiscoverySource } from "./sources.js";

export interface DiscoveryResult {
  all: BusinessRecord[];
  matchingProfile: BusinessRecord[];
  /** Sources that failed (e.g. Overpass under load, a Places API hiccup) — discovery still returns whatever the other sources found rather than failing the whole search. */
  sourceErrors: { source: string; message: string }[];
}

/** Runs every configured source, deduplicates the union, and applies the Ideal Local Business Profile filter. */
export async function discoverBusinesses(
  query: DiscoveryQuery,
  sources: DiscoverySource[],
  profile?: IdealLocalBusinessProfile,
): Promise<DiscoveryResult> {
  const settled = await Promise.allSettled(sources.map((s) => s.discover(query)));
  const results: BusinessRecord[][] = [];
  const sourceErrors: { source: string; message: string }[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      sourceErrors.push({ source: sources[i]?.name ?? "unknown", message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) });
    }
  });
  const all = dedupeBusinessRecords(results.flat());
  const matchingProfile = profile ? all.filter((b) => matchesProfile(b, profile)) : all;
  return { all, matchingProfile, sourceErrors };
}
