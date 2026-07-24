/**
 * Sector taxonomy types.
 *
 * Audema maintains a master sector taxonomy mapping user-friendly sector
 * descriptions (Step 2 of the wizard) to the vocabularies each discovery
 * source actually understands: Google Places types, OpenStreetMap tags,
 * free-text search phrases, and country-specific industry classification
 * codes (e.g. ANZSIC, NAICS, SIC).
 */

export interface IndustryClassificationCode {
  system: "ANZSIC" | "NAICS" | "SIC" | "UKSIC" | "NACE";
  code: string;
}

export interface SectorNode {
  id: string;
  /** Human label shown in the wizard, e.g. "Emergency Plumbing" */
  label: string;
  /** Path from root, e.g. ["Home Services", "Plumbing", "Emergency Plumbing"] */
  path: string[];
  parentId?: string;
  /** Google Places API "type" or "includedType" values that best match this node. */
  googlePlaceTypes: string[];
  /** OpenStreetMap tag filters, e.g. { shop: "plumber" } or { craft: "plumber" } */
  osmTags: Record<string, string>[];
  /** Free-text phrases used for Places Text Search / OSM name matching when no clean type exists. */
  searchPhrases: string[];
  industryCodes?: IndustryClassificationCode[];
}

export interface SectorTaxonomy {
  nodes: Map<string, SectorNode>;
}

export function buildTaxonomy(nodes: SectorNode[]): SectorTaxonomy {
  return { nodes: new Map(nodes.map((n) => [n.id, n])) };
}

export function getSectorPath(taxonomy: SectorTaxonomy, id: string): SectorNode[] {
  const path: SectorNode[] = [];
  let current = taxonomy.nodes.get(id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? taxonomy.nodes.get(current.parentId) : undefined;
  }
  return path;
}

export function getSectorDescendants(taxonomy: SectorTaxonomy, id: string): SectorNode[] {
  const isDescendant = (node: SectorNode): boolean => {
    let current = node.parentId ? taxonomy.nodes.get(node.parentId) : undefined;
    while (current) {
      if (current.id === id) return true;
      current = current.parentId ? taxonomy.nodes.get(current.parentId) : undefined;
    }
    return false;
  };
  return [...taxonomy.nodes.values()].filter(isDescendant);
}
