export type CustomerProfile = {
  slug: string;
  name: string;
  sector: string;
  region: string;
  looksFor: string;
  activeProjects: number;
};

export type ContractorProfile = {
  slug: string;
  name: string;
  disciplines: string[];
  region: string;
  offers: string;
  completedProjects: number;
};

export const customers: CustomerProfile[] = [
  {
    slug: "northwind-energy",
    name: "Northwind Energy",
    sector: "Offshore wind",
    region: "North Sea",
    looksFor: "HV cabling and substation integrators willing to co-plan grid tie-ins.",
    activeProjects: 4,
  },
  {
    slug: "meridian-rail",
    name: "Meridian Rail Authority",
    sector: "Public infrastructure",
    region: "Central Europe",
    looksFor: "Signalling contractors with ETCS Level 2 migration experience.",
    activeProjects: 2,
  },
  {
    slug: "arcadia-pharma",
    name: "Arcadia Pharma",
    sector: "Life sciences facilities",
    region: "Ireland / Benelux",
    looksFor: "GMP fit-out partners for modular cleanroom expansion.",
    activeProjects: 3,
  },
];

export const contractors: ContractorProfile[] = [
  {
    slug: "keelson-marine",
    name: "Keelson Marine Works",
    disciplines: ["Subsea installation", "Cable pull-in", "Vessel ops"],
    region: "Northern Europe",
    offers: "Integrated offshore installation crews that co-schedule with owners.",
    completedProjects: 38,
  },
  {
    slug: "axiom-systems",
    name: "Axiom Control Systems",
    disciplines: ["ETCS signalling", "SCADA", "Cybersecurity"],
    region: "DACH + Nordics",
    offers: "Brownfield signalling migration without line shutdowns.",
    completedProjects: 22,
  },
  {
    slug: "cleancraft-fitout",
    name: "CleanCraft Fit-Out",
    disciplines: ["Cleanroom construction", "GMP validation", "HVAC"],
    region: "EU-wide",
    offers: "Modular GMP suites delivered with integrated qualification packs.",
    completedProjects: 47,
  },
];
