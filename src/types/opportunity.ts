/**
 * Audema Opportunity Score types.
 */

import type { AudemaOffer } from "./signals.js";

export type ScoreCategory =
  | "idealCustomerFit"
  | "marketingNeed"
  | "growthPotential"
  | "timingSignals"
  | "reachability"
  | "dataConfidence";

/** Default weights, summing to 100, matching the spec's scoring table. */
export const DEFAULT_SCORE_WEIGHTS: Record<ScoreCategory, number> = {
  idealCustomerFit: 25,
  marketingNeed: 30,
  growthPotential: 15,
  timingSignals: 15,
  reachability: 10,
  dataConfidence: 5,
};

export type ScoreWeights = Record<ScoreCategory, number>;

export interface CategoryScore {
  category: ScoreCategory;
  /** Raw 0-100 sub-score for this category before weighting. */
  rawScore: number;
  /** rawScore * (weight / 100), i.e. this category's contribution to the final 0-100 score. */
  weightedContribution: number;
  evidenceSummary: string[];
}

export type OpportunityTier = "urgent" | "strong" | "nurture" | "low_fit" | "existing_client";

export interface OpportunityScore {
  businessId: string;
  total: number;
  tier: OpportunityTier;
  categories: CategoryScore[];
  recommendedOffers: AudemaOffer[];
  explanation: string[];
  scoredAt: string;
  weightsUsed: ScoreWeights;
}

export function tierForScore(total: number, isExistingClient: boolean, isExcluded: boolean): OpportunityTier {
  if (isExistingClient) return "existing_client";
  if (isExcluded) return "low_fit";
  if (total >= 80) return "urgent";
  if (total >= 60) return "strong";
  if (total >= 35) return "nurture";
  return "low_fit";
}
