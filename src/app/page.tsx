import { sectorTaxonomy } from "@/data/sectorTaxonomy.js";
import { DEMO_SECTOR_ID, DEMO_TERRITORY } from "@/demoData/geelongElectrical.js";
import { WizardForm } from "./WizardForm";

export default function Page() {
  const sectorOptions = [...sectorTaxonomy.nodes.values()]
    .filter((n) => n.googlePlaceTypes.length > 0 || n.osmTags.length > 0)
    .map((n) => ({ id: n.id, label: n.path.join(" > ") }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const liveModeEnabled = !!process.env.GOOGLE_MAPS_API_KEY;

  return (
    <main className="page">
      <div className="hero">
        <h1>Audema Territory Intelligence Modelling</h1>
        {liveModeEnabled ? (
          <p>
            Select a sector, type any territory, and Audema runs live Google Places + OpenStreetMap discovery and
            PageSpeed Insights audits to find businesses with a measurable marketing problem — then tells you which
            offer to lead with. Live searches are capped to a handful of businesses per run to stay within API/time
            limits.
          </p>
        ) : (
          <p>
            Select a sector, draw a territory, and Audema finds the businesses with a measurable marketing problem —
            then tells you which offer to lead with. Live discovery isn&rsquo;t configured on this deployment (no
            GOOGLE_MAPS_API_KEY), so this runs the full Territory → Discovery → Audit → Opportunity → Campaign
            pipeline against a fixed sample dataset ({DEMO_TERRITORY.name}, Commercial Electrical Contractors)
            instead.
          </p>
        )}
      </div>
      <WizardForm sectorOptions={sectorOptions} defaultSectorId={DEMO_SECTOR_ID} liveModeEnabled={liveModeEnabled} />
    </main>
  );
}
