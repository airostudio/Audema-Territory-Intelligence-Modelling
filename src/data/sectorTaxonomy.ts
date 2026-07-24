import type { SectorNode } from "../types/index.js";
import { buildTaxonomy } from "../types/index.js";

/**
 * Seed sector taxonomy covering the examples given in the product spec.
 * This is illustrative, not exhaustive — production taxonomy management
 * (adding sectors, mapping new Google Place types / OSM tags / industry
 * codes) should live in a data pipeline, not hardcoded source.
 */
const nodes: SectorNode[] = [
  { id: "home_services", label: "Home Services", path: ["Home Services"], googlePlaceTypes: [], osmTags: [], searchPhrases: [] },
  {
    id: "plumbing",
    label: "Plumbing",
    path: ["Home Services", "Plumbing"],
    parentId: "home_services",
    googlePlaceTypes: ["plumber"],
    osmTags: [{ craft: "plumber" }, { shop: "plumber" }],
    searchPhrases: ["plumber", "plumbing company"],
  },
  {
    id: "emergency_plumbing",
    label: "Emergency Plumbing",
    path: ["Home Services", "Plumbing", "Emergency Plumbing"],
    parentId: "plumbing",
    googlePlaceTypes: ["plumber"],
    osmTags: [{ craft: "plumber", emergency: "yes" }],
    searchPhrases: ["24 hour plumber", "emergency plumber"],
  },

  { id: "healthcare", label: "Healthcare", path: ["Healthcare"], googlePlaceTypes: [], osmTags: [], searchPhrases: [] },
  {
    id: "physiotherapy",
    label: "Physiotherapy",
    path: ["Healthcare", "Physiotherapy"],
    parentId: "healthcare",
    googlePlaceTypes: ["physiotherapist"],
    osmTags: [{ healthcare: "physiotherapist" }],
    searchPhrases: ["physiotherapy clinic"],
  },
  {
    id: "sports_rehabilitation",
    label: "Sports Rehabilitation",
    path: ["Healthcare", "Physiotherapy", "Sports Rehabilitation"],
    parentId: "physiotherapy",
    googlePlaceTypes: ["physiotherapist"],
    osmTags: [{ healthcare: "physiotherapist", specialty: "sports" }],
    searchPhrases: ["sports physiotherapy", "sports injury clinic"],
  },

  { id: "construction", label: "Construction", path: ["Construction"], googlePlaceTypes: [], osmTags: [], searchPhrases: [] },
  {
    id: "fire_protection",
    label: "Fire Protection",
    path: ["Construction", "Fire Protection"],
    parentId: "construction",
    googlePlaceTypes: ["general_contractor"],
    osmTags: [{ craft: "fire_protection" }],
    searchPhrases: ["fire protection contractor"],
  },
  {
    id: "commercial_fire_compliance",
    label: "Commercial Compliance",
    path: ["Construction", "Fire Protection", "Commercial Compliance"],
    parentId: "fire_protection",
    googlePlaceTypes: ["general_contractor"],
    osmTags: [{ craft: "fire_protection", scope: "commercial" }],
    searchPhrases: ["commercial fire compliance", "fire safety compliance contractor"],
  },

  { id: "hospitality", label: "Hospitality", path: ["Hospitality"], googlePlaceTypes: [], osmTags: [], searchPhrases: [] },
  {
    id: "restaurants",
    label: "Restaurants",
    path: ["Hospitality", "Restaurants"],
    parentId: "hospitality",
    googlePlaceTypes: ["restaurant"],
    osmTags: [{ amenity: "restaurant" }],
    searchPhrases: ["restaurant"],
  },
  {
    id: "independent_italian_restaurants",
    label: "Independent Italian Restaurants",
    path: ["Hospitality", "Restaurants", "Independent Italian Restaurants"],
    parentId: "restaurants",
    googlePlaceTypes: ["restaurant"],
    osmTags: [{ amenity: "restaurant", cuisine: "italian" }],
    searchPhrases: ["independent Italian restaurant"],
  },

  { id: "professional_services", label: "Professional Services", path: ["Professional Services"], googlePlaceTypes: [], osmTags: [], searchPhrases: [] },
  {
    id: "accounting",
    label: "Accounting",
    path: ["Professional Services", "Accounting"],
    parentId: "professional_services",
    googlePlaceTypes: ["accounting"],
    osmTags: [{ office: "accountant" }],
    searchPhrases: ["accounting firm"],
  },
  {
    id: "small_business_accountants",
    label: "Small-Business Accountants",
    path: ["Professional Services", "Accounting", "Small-Business Accountants"],
    parentId: "accounting",
    googlePlaceTypes: ["accounting"],
    osmTags: [{ office: "accountant", clientele: "small_business" }],
    searchPhrases: ["small business accountant"],
    industryCodes: [{ system: "ANZSIC", code: "6932" }],
  },

  { id: "retail", label: "Retail", path: ["Retail"], googlePlaceTypes: [], osmTags: [], searchPhrases: [] },
  {
    id: "fashion",
    label: "Fashion",
    path: ["Retail", "Fashion"],
    parentId: "retail",
    googlePlaceTypes: ["clothing_store"],
    osmTags: [{ shop: "clothes" }],
    searchPhrases: ["clothing store"],
  },
  {
    id: "independent_boutiques",
    label: "Independent Boutiques",
    path: ["Retail", "Fashion", "Independent Boutiques"],
    parentId: "fashion",
    googlePlaceTypes: ["clothing_store"],
    osmTags: [{ shop: "boutique" }],
    searchPhrases: ["independent boutique", "fashion boutique"],
  },

  { id: "automotive", label: "Automotive", path: ["Automotive"], googlePlaceTypes: [], osmTags: [], searchPhrases: [] },
  {
    id: "mechanics",
    label: "Mechanics",
    path: ["Automotive", "Mechanics"],
    parentId: "automotive",
    googlePlaceTypes: ["car_repair"],
    osmTags: [{ shop: "car_repair" }],
    searchPhrases: ["mechanic", "auto repair shop"],
  },
  {
    id: "european_vehicle_specialists",
    label: "European Vehicle Specialists",
    path: ["Automotive", "Mechanics", "European Vehicle Specialists"],
    parentId: "mechanics",
    googlePlaceTypes: ["car_repair"],
    osmTags: [{ shop: "car_repair", brand: "european" }],
    searchPhrases: ["European car specialist", "German car mechanic"],
  },

  {
    id: "commercial_electrical_contractors",
    label: "Commercial Electrical Contractors",
    path: ["Construction", "Electrical", "Commercial Electrical Contractors"],
    parentId: "construction",
    googlePlaceTypes: ["electrician"],
    osmTags: [{ craft: "electrician", scope: "commercial" }],
    searchPhrases: ["commercial electrician", "commercial electrical contractor"],
    industryCodes: [{ system: "ANZSIC", code: "3221" }],
  },
];

export const sectorTaxonomy = buildTaxonomy(nodes);
