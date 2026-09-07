"use client";

import { useEffect, useRef, useState } from "react";

interface PlaceSuggestion {
  placeId: string;
  description: string;
}

const AUTOCOMPLETE_DEBOUNCE_MS = 250;
const AUTOCOMPLETE_MIN_CHARS = 2;

/** Territory text field with a live "type and click a suggestion" location picker, backed by /api/territory-suggestions. */
function TerritoryAutocomplete({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (value.trim().length < AUTOCOMPLETE_MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/territory-suggestions?q=${encodeURIComponent(value)}`);
        const data = (await res.json()) as { suggestions?: PlaceSuggestion[] };
        // Ignore stale responses from an earlier keystroke that resolved out of order.
        if (thisRequestId === requestIdRef.current) {
          setSuggestions(data.suggestions ?? []);
          setIsOpen(true);
        }
      } catch {
        if (thisRequestId === requestIdRef.current) setSuggestions([]);
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  function selectSuggestion(suggestion: PlaceSuggestion) {
    onChange(suggestion.description);
    setSuggestions([]);
    setIsOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        id="territory"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Start typing a suburb, city, or region…"
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((s) => (
            // onMouseDown (not onClick) fires before the input's onBlur, so the selection
            // registers instead of the dropdown closing first and swallowing the click.
            <li key={s.placeId} onMouseDown={() => selectSuggestion(s)}>
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SectorOption {
  id: string;
  label: string;
}

interface CategoryScoreView {
  category: string;
  rawScore: number;
  weightedContribution: number;
  evidenceSummary: string[];
}

interface OpportunityView {
  businessId: string;
  name: string;
  suburb?: string;
  hasWebsite: boolean;
  reviewCount?: number;
  rating?: number;
  score: number;
  tier: "urgent" | "strong" | "nurture" | "low_fit" | "existing_client";
  recommendedOffers: string[];
  explanation: string[];
  categories: CategoryScoreView[];
}

interface MarketIntelligenceView {
  totalMatchingBusinesses: number;
  withNoWebsite: number;
  withWeakWebsite: number;
  averageReviewCount: number;
  underservedSuburbs: string[];
  mostFrequentOffers: { offer: string; count: number }[];
  saturationVerdict: string;
}

interface BenchmarkReportView {
  title: string;
  sampleSize: number;
  averageWebsiteScore: number;
  pctWithOnlineQuoting: number;
  reviewBenchmark: { averageReviewCount: number; averageRating: number };
  pctGoodMobileExperience: number;
}

interface CampaignView {
  tier: string;
}

interface WizardResult {
  dataSource: "live" | "demo";
  sectorPath: string[];
  territory: { name: string; areaSqKm: number; cellCount: number };
  matchingBusinessCount: number;
  opportunities: OpportunityView[];
  campaigns: CampaignView[];
  marketIntelligence: MarketIntelligenceView;
  benchmarkReport: BenchmarkReportView;
  sourceErrors: { source: string; message: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  idealCustomerFit: "Ideal customer fit",
  marketingNeed: "Marketing need",
  growthPotential: "Growth potential",
  timingSignals: "Timing signals",
  reachability: "Reachability",
  dataConfidence: "Data confidence",
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  idealCustomerFit: 25,
  marketingNeed: 30,
  growthPotential: 15,
  timingSignals: 15,
  reachability: 10,
  dataConfidence: 5,
};

const TIER_LABELS: Record<OpportunityView["tier"], string> = {
  urgent: "Urgent opportunity",
  strong: "Strong opportunity",
  nurture: "Nurture",
  low_fit: "Low fit / excluded",
  existing_client: "Existing client",
};

export function WizardForm({
  sectorOptions,
  defaultSectorId,
  liveModeEnabled,
}: {
  sectorOptions: SectorOption[];
  defaultSectorId: string;
  liveModeEnabled: boolean;
}) {
  const [sectorId, setSectorId] = useState(defaultSectorId);
  const [territoryQuery, setTerritoryQuery] = useState("Geelong, VIC, Australia");
  const [radiusKm, setRadiusKm] = useState(25);
  const [independentOnly, setIndependentOnly] = useState(true);
  const [minReviewCount, setMinReviewCount] = useState(15);
  const [minRating, setMinRating] = useState(3.5);
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WizardResult | null>(null);

  async function runWizard() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/run-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorId,
          independentOnly,
          minReviewCount,
          minRating,
          weights,
          ...(liveModeEnabled ? { territoryQuery, radiusKm } : {}),
        }),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setError(
          res.status === 504 || res.status === 502
            ? "The live search took too long and timed out (this happens when several businesses' websites are slow to audit). Try a smaller radius, fewer minimum reviews, or a less busy sector."
            : `The wizard API returned an unexpected response (HTTP ${res.status}).`,
        );
        return;
      }
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Something went wrong running the wizard.");
        return;
      }
      setResult(data as WizardResult);
    } catch {
      setError("Could not reach the Audema wizard API — check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Step 1–2 · Territory &amp; sector</h2>
        <div className="field-row">
          <div>
            <label htmlFor="territory">{liveModeEnabled ? "Territory" : "Territory (fixed in this demo)"}</label>
            {liveModeEnabled ? (
              <TerritoryAutocomplete value={territoryQuery} onChange={setTerritoryQuery} />
            ) : (
              <input id="territory" value="Geelong, VIC — 30km radius" disabled />
            )}
          </div>
          {liveModeEnabled && (
            <div>
              <label htmlFor="radiusKm">Radius (km)</label>
              <input id="radiusKm" type="number" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
            </div>
          )}
          <div>
            <label htmlFor="sector">Sector</label>
            <select id="sector" value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
              {sectorOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Step 3 · Ideal Local Business Profile</h2>
        <div className="field-row">
          <div>
            <label htmlFor="minReviews">Minimum Google reviews</label>
            <input id="minReviews" type="number" min={0} value={minReviewCount} onChange={(e) => setMinReviewCount(Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="minRating">Minimum rating</label>
            <input id="minRating" type="number" min={0} max={5} step={0.1} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} />
          </div>
        </div>
        <div className="checkbox-row">
          <input id="independentOnly" type="checkbox" checked={independentOnly} onChange={(e) => setIndependentOnly(e.target.checked)} />
          <label htmlFor="independentOnly" style={{ marginBottom: 0 }}>
            Independent businesses only (exclude franchises/chains)
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Step 5 (tuning) · Opportunity Score weights</h2>
        <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.85rem" }}>
          Adjust how much each category contributes to the 0–100 Opportunity Score — e.g. a website agency might weight
          &ldquo;Marketing need&rdquo; heavily, while a review-management campaign weights reachability and data
          confidence more.
        </p>
        <div className="weight-grid">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <label key={key} htmlFor={`weight-${key}`}>
              {label}
              <span>
                <input
                  id={`weight-${key}`}
                  type="range"
                  min={0}
                  max={50}
                  value={weights[key]}
                  onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                />{" "}
                {weights[key]}
              </span>
            </label>
          ))}
        </div>
      </section>

      <button className="primary" onClick={runWizard} disabled={loading}>
        {loading ? "Running Audema wizard…" : "Run Audema wizard"}
      </button>

      {error && <div className="error-banner" style={{ marginTop: "1.5rem" }}>{error}</div>}

      {result && <Results result={result} />}
    </>
  );
}

function Results({ result }: { result: WizardResult }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      {result.sourceErrors.length > 0 && (
        <div className="error-banner">
          {result.sourceErrors.map((e) => `${e.source} discovery unavailable (${e.message})`).join("; ")} — results below are from the sources that did respond, not a complete picture of the territory.
        </div>
      )}
      <section className="panel">
        <h2>
          Market intelligence — {result.sectorPath.join(" > ")}{" "}
          <span style={{ fontSize: "0.7rem", fontWeight: 400, color: "var(--muted)" }}>
            ({result.dataSource === "live" ? "live Google Places / PageSpeed data" : "demo fixture data"})
          </span>
        </h2>
        <div className="stat-row">
          <Stat label="Matching businesses" value={result.matchingBusinessCount} />
          <Stat label="No website" value={result.marketIntelligence.withNoWebsite} />
          <Stat label="Weak website" value={result.marketIntelligence.withWeakWebsite} />
          <Stat label="Avg. reviews" value={result.marketIntelligence.averageReviewCount.toFixed(1)} />
          <Stat label="Territory area" value={`${Math.round(result.territory.areaSqKm)} km²`} />
          <Stat label="Saturation" value={result.marketIntelligence.saturationVerdict.replace(/_/g, " ")} />
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Largest addressable offer:{" "}
          <strong>{result.marketIntelligence.mostFrequentOffers[0]?.offer.replace(/_/g, " ") ?? "n/a"}</strong> (
          {result.marketIntelligence.mostFrequentOffers[0]?.count ?? 0} businesses) · {result.campaigns.length} campaign
          {result.campaigns.length === 1 ? "" : "s"} generated ({result.campaigns.map((c) => c.tier.replace("tier", "Tier ").replace(/_/g, " ")).join(", ") || "none"})
        </p>
      </section>

      <section className="panel">
        <h2>{result.benchmarkReport.title}</h2>
        <div className="stat-row">
          <Stat label="Sample size" value={result.benchmarkReport.sampleSize} />
          <Stat label="Avg. mobile website score" value={Math.round(result.benchmarkReport.averageWebsiteScore)} />
          <Stat label="Online quoting" value={`${Math.round(result.benchmarkReport.pctWithOnlineQuoting * 100)}%`} />
          <Stat label="Good mobile experience" value={`${Math.round(result.benchmarkReport.pctGoodMobileExperience * 100)}%`} />
        </div>
      </section>

      <section className="panel">
        <h2>Opportunity map (list view)</h2>
        <div className="legend">
          {(["urgent", "strong", "nurture", "low_fit", "existing_client"] as const).map((tier) => (
            <span key={tier}>
              <span className="dot" style={{ background: `var(--tier-${tier})` }} />
              {TIER_LABELS[tier]}
            </span>
          ))}
        </div>
        {result.opportunities.map((o) => (
          <div className="opportunity-card" key={o.businessId}>
            <span className="tier-pin" style={{ background: `var(--tier-${o.tier})` }} title={TIER_LABELS[o.tier]} />
            <div>
              <h3>{o.name}</h3>
              <div className="meta">
                {o.suburb ?? "Unknown suburb"} · {o.hasWebsite ? "Has website" : "No website"} · {o.reviewCount ?? "?"} reviews · {o.rating ?? "?"}★
              </div>
              <ul>
                {o.explanation.slice(0, 4).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {o.recommendedOffers.length > 0 && (
                <div className="offer-tags">
                  {o.recommendedOffers.slice(0, 4).map((offer) => (
                    <span className="offer-tag" key={offer}>
                      {offer.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="score-badge">
              {o.score}
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 400 }}>{TIER_LABELS[o.tier]}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
