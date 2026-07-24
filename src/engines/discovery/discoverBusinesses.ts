import type { BusinessRecord, IdealLocalBusinessProfile } from "../../types/index.js";
import { matchesProfile } from "../../types/business.js";
import { dedupeBusinessRecords } from "./dedupe.js";
import type { DiscoveryQuery, DiscoverySource } from "./sources.js";

export interface DiscoveryResult {
  all: BusinessRecord[];
  matchingProfile: BusinessRecord[];
}

/** Runs every configured source, deduplicates the union, and applies the Ideal Local Business Profile filter. */
export async function discoverBusinesses(
  query: DiscoveryQuery,
  sources: DiscoverySource[],
  profile?: IdealLocalBusinessProfile,
): Promise<DiscoveryResult> {
  const results = await Promise.all(sources.map((s) => s.discover(query)));
  const all = dedupeBusinessRecords(results.flat());
  const matchingProfile = profile ? all.filter((b) => matchesProfile(b, profile)) : all;
  return { all, matchingProfile };
}
