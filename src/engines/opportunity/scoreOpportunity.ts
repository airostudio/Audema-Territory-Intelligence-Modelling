import type {
  AudemaOffer,
  BusinessRecord,
  CategoryScore,
  IdealLocalBusinessProfile,
  OpportunityScore,
  OpportunitySignalSet,
  ScoreCategory,
  ScoreWeights,
  SignalFinding,
} from "../../types/index.js";
import { DEFAULT_SCORE_WEIGHTS, SIGNAL_TO_OFFER, matchesProfile, tierForScore } from "../../types/index.js";
import { GROWTH_POTENTIAL_SIGNALS, MARKETING_NEED_SIGNALS, TIMING_SIGNALS } from "./signalGroups.js";

function presentFindings(signals: OpportunitySignalSet, keys: string[]): SignalFinding[] {
  const keySet = new Set(keys);
  return signals.findings.filter((f) => keySet.has(f.key) && f.present.value);
}

function scoreIdealCustomerFit(business: BusinessRecord, profile?: IdealLocalBusinessProfile): CategoryScore {
  if (!profile) {
    return { category: "idealCustomerFit", rawScore: 50, weightedContribution: 0, evidenceSummary: ["No Ideal Local Business Profile supplied — neutral score applied."] };
  }
  const checks: { label: string; pass: boolean; applicable: boolean }[] = [
    { label: "sector match", pass: business.sectorId === profile.sectorId, applicable: true },
    {
      label: "business model match",
      pass: !profile.businessModel || (!!business.businessModel && profile.businessModel.includes(business.businessModel)),
      applicable: !!profile.businessModel,
    },
    {
      label: "customer base match",
      pass: !profile.customerBase || (!!business.customerBase && profile.customerBase.includes(business.customerBase)),
      applicable: !!profile.customerBase,
    },
    {
      label: "review count in range",
      pass:
        !profile.reviewCountRange ||
        business.reviewCount === undefined ||
        ((profile.reviewCountRange.min ?? -Infinity) <= business.reviewCount && business.reviewCount <= (profile.reviewCountRange.max ?? Infinity)),
      applicable: !!profile.reviewCountRange,
    },
    {
      label: "rating in range",
      pass:
        !profile.ratingRange ||
        business.rating === undefined ||
        ((profile.ratingRange.min ?? -Infinity) <= business.rating && business.rating <= (profile.ratingRange.max ?? Infinity)),
      applicable: !!profile.ratingRange,
    },
  ];
  const applicable = checks.filter((c) => c.applicable);
  const passed = applicable.filter((c) => c.pass);
  const rawScore = applicable.length ? (passed.length / applicable.length) * 100 : 100;
  const overallFit = matchesProfile(business, profile);

  return {
    category: "idealCustomerFit",
    rawScore: overallFit ? rawScore : Math.min(rawScore, 40),
    weightedContribution: 0,
    evidenceSummary: applicable.map((c) => `${c.pass ? "matches" : "does not match"} ${c.label}`),
  };
}

function scoreFromSignalGroup(category: ScoreCategory, signals: OpportunitySignalSet, keys: string[]): CategoryScore {
  const present = presentFindings(signals, keys);
  const rawScore = keys.length ? (present.length / keys.length) * 100 : 0;
  return {
    category,
    rawScore,
    weightedContribution: 0,
    evidenceSummary: present.map((f) => f.present.reason),
  };
}

function scoreReachability(business: BusinessRecord): CategoryScore {
  const channels = [business.contact.phone, business.contact.email, business.contact.website].filter(Boolean);
  const rawScore = (channels.length / 3) * 100;
  return {
    category: "reachability",
    rawScore,
    weightedContribution: 0,
    evidenceSummary: [
      business.contact.phone ? "Phone on file" : "No phone on file",
      business.contact.email ? "Email on file" : "No email on file",
      business.contact.website ? "Website on file" : "No website on file",
    ],
  };
}

function scoreDataConfidence(signals: OpportunitySignalSet): CategoryScore {
  if (!signals.findings.length) {
    return { category: "dataConfidence", rawScore: 0, weightedContribution: 0, evidenceSummary: ["No signal data collected yet."] };
  }
  const confirmed = signals.findings.filter((f) => f.present.confidence === "confirmed").length;
  const rawScore = (confirmed / signals.findings.length) * 100;
  return {
    category: "dataConfidence",
    rawScore,
    weightedContribution: 0,
    evidenceSummary: [`${confirmed}/${signals.findings.length} signals backed by confirmed evidence`],
  };
}

function recommendOffers(signals: OpportunitySignalSet): AudemaOffer[] {
  const counts = new Map<AudemaOffer, number>();
  for (const f of signals.findings) {
    if (!f.present.value) continue;
    for (const offer of SIGNAL_TO_OFFER[f.key] ?? []) {
      counts.set(offer, (counts.get(offer) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([offer]) => offer);
}

export interface ScoreOpportunityInput {
  business: BusinessRecord;
  signals: OpportunitySignalSet;
  profile?: IdealLocalBusinessProfile;
  weights?: Partial<ScoreWeights>;
  scoredAt: string;
}

export function scoreOpportunity(input: ScoreOpportunityInput): OpportunityScore {
  const weights: ScoreWeights = { ...DEFAULT_SCORE_WEIGHTS, ...input.weights };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const categories: CategoryScore[] = [
    scoreIdealCustomerFit(input.business, input.profile),
    scoreFromSignalGroup("marketingNeed", input.signals, MARKETING_NEED_SIGNALS),
    scoreFromSignalGroup("growthPotential", input.signals, GROWTH_POTENTIAL_SIGNALS),
    scoreFromSignalGroup("timingSignals", input.signals, TIMING_SIGNALS),
    scoreReachability(input.business),
    scoreDataConfidence(input.signals),
  ].map((c) => ({ ...c, weightedContribution: (c.rawScore * weights[c.category]) / (totalWeight || 100) }));

  const total = Math.round(categories.reduce((sum, c) => sum + c.weightedContribution, 0));
  const isExcluded = input.profile ? !matchesProfile(input.business, input.profile) : false;
  const tier = tierForScore(total, !!input.business.isExistingCustomer, isExcluded);

  const explanation = categories
    .flatMap((c) => c.evidenceSummary.slice(0, 2))
    .slice(0, 6);

  return {
    businessId: input.business.id,
    total,
    tier,
    categories,
    recommendedOffers: recommendOffers(input.signals),
    explanation,
    scoredAt: input.scoredAt,
    weightsUsed: weights,
  };
}
