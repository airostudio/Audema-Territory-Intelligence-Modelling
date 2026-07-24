import { sectorTaxonomy } from "@/data/sectorTaxonomy.js";
import { DEMO_SECTOR_ID, DEMO_TERRITORY } from "@/demoData/geelongElectrical.js";
import { WizardForm } from "./WizardForm";

export default function Page() {
  const sectorOptions = [...sectorTaxonomy.nodes.values()]
    .filter((n) => n.googlePlaceTypes.length > 0 || n.osmTags.length > 0)
    .map((n) => ({ id: n.id, label: n.path.join(" > ") }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <main className="page">
      <div className="hero">
        <h1>Audema Territory Intelligence Modelling</h1>
        <p>
          Select a sector, draw a territory, and Audema finds the businesses with a measurable marketing problem — then
          tells you which offer to lead with. This demo runs the full Territory → Discovery → Audit → Opportunity →
          Campaign pipeline against a fixed sample dataset ({DEMO_TERRITORY.name}, Commercial Electrical Contractors)
          so it works without live Google Places / PageSpeed API keys.
        </p>
      </div>
      <WizardForm sectorOptions={sectorOptions} defaultSectorId={DEMO_SECTOR_ID} />
    </main>
  );
}
