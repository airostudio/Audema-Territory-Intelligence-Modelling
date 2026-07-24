/**
 * End-to-end walkthrough of the "Example wizard search" from the spec:
 * commercial electrical contractors within 30km of Geelong, VIC.
 *
 * Every external call (geocoding, Places/Overpass discovery, PageSpeed,
 * HTML crawl) is backed by a static in-memory fixture so this runs offline
 * with `npm run example`. Swap the Static* implementations for real
 * API-backed ones to go live. The same fixtures power the deployed wizard
 * demo at src/app/api/run-wizard.
 */

import { sectorTaxonomy } from "../data/sectorTaxonomy.js";
import { runWizardPipeline } from "../runWizardPipeline.js";
import {
  DEMO_BENCHMARK,
  DEMO_NOW,
  DEMO_PROFILE,
  DEMO_SECTOR_ID,
  DEMO_TERRITORY,
  buildDemoBusinesses,
  buildDemoCrawlFixtures,
  buildDemoPageSpeedFixtures,
} from "../demoData/geelongElectrical.js";

async function main() {
  const result = await runWizardPipeline({
    taxonomy: sectorTaxonomy,
    sectorId: DEMO_SECTOR_ID,
    territory: DEMO_TERRITORY,
    profile: DEMO_PROFILE,
    businesses: buildDemoBusinesses(),
    pageSpeedFixtures: buildDemoPageSpeedFixtures(),
    crawlFixtures: buildDemoCrawlFixtures(),
    benchmark: DEMO_BENCHMARK,
    now: DEMO_NOW,
  });

  console.log("Sector path:", result.sectorPath.join(" > "));
  console.log(`Resolved territory: ${result.territoryCellCount} H3 cells, ~${result.territoryAreaSqKm.toFixed(0)} km^2`);
  console.log(`\n${result.matchingBusinessCount} businesses match the Ideal Local Business Profile.`);

  console.log("\nRanked opportunities:");
  for (const { business, score } of result.scoredBusinesses) {
    console.log(`  ${score.total.toString().padStart(3)} [${score.tier.padEnd(8)}] ${business.name} — offers: ${score.recommendedOffers.join(", ") || "none"}`);
  }

  console.log(`\nGenerated ${result.campaigns.length} campaign(s):`);
  for (const c of result.campaigns) console.log(`  - ${c.tier}`);

  console.log("\nMarket intelligence summary:", result.marketIntelligence);
  console.log("\nBenchmark report title:", result.benchmarkReport.title);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
