import type { InterestId } from "./interests";

// Registro de navegación del terminal. Vive fuera del componente para que sea
// dato probable: la prueba verifica que no haya rutas repetidas, que cada
// código de tres letras sea único y que ningún módulo quede sin perfil.
//
// La navegación se organiza por vertical de decisión (qué necesita saber el
// cliente), no por tipo de dato. Las URLs se mantienen como estaban.
//
// `code` es la etiqueta del modo contraído: tres caracteres en mono, que es
// lo único que entra en el riel de 56 px. No es decorativo — sin él, el
// sidebar contraído no diría en qué sección está parado el usuario.
//
// `interests` responde a "¿a quién le sirve este módulo?". El orden importa:
// el primero es el perfil principal, el que justifica que el módulo exista.

export type Item = {
  label: string;
  href: string;
  code: string;
  interests: [InterestId, ...InterestId[]];
};

export type Group = { title: string; items: Item[] };

export const NAV: Group[] = [
  {
    title: "Executive Brief",
    items: [
      { href: "/", label: "Portada del día", code: "HOY", interests: ["formacion", "inversion"] },
      { href: "/informe", label: "Informe descargable", code: "PDF", interests: ["formacion", "inversion", "institucional"] },
    ],
  },
  {
    title: "Institutional Intelligence",
    items: [
      { href: "/tokenizacion", label: "Tokenization Hub", code: "TKN", interests: ["institucional", "inversion"] },
      { href: "/tokenizacion/clases", label: "· Asset Classes", code: "CLS", interests: ["institucional", "formacion"] },
      { href: "/tokenizacion/casos", label: "· Global Case Studies", code: "CAS", interests: ["formacion", "institucional"] },
      { href: "/tokenizacion/bolivia", label: "· Bolivia Opportunities", code: "OPB", interests: ["institucional", "formacion"] },
      { href: "/stablecoins", label: "Stablecoin Intelligence", code: "STB", interests: ["institucional", "cumplimiento", "inversion"] },
      { href: "/capital-markets", label: "Capital Markets", code: "CAP", interests: ["institucional", "inversion"] },
      { href: "/cbdc", label: "CBDC & Regulation", code: "CBD", interests: ["cumplimiento", "institucional"] },
    ],
  },
  {
    title: "Blockfinity Indices",
    items: [{ href: "/indices", label: "Índices propietarios", code: "IDX", interests: ["inversion", "tecnologia"] }],
  },
  {
    title: "Blockchain Intelligence",
    items: [
      { href: "/blockchains", label: "Landscape", code: "LND", interests: ["tecnologia", "inversion"] },
      { href: "/blockchains/scorecard", label: "Scorecard & BBI", code: "BBI", interests: ["tecnologia", "riesgo"] },
      { href: "/blockchains/riesgo", label: "Risk Profiles", code: "RSK", interests: ["riesgo", "cumplimiento"] },
      { href: "/blockchains/infraestructura", label: "Builder Radar", code: "BLD", interests: ["tecnologia"] },
    ],
  },
  {
    title: "Bolivia Intelligence",
    items: [
      { href: "/bolivia/noticias", label: "Bolivia News", code: "BNW", interests: ["cumplimiento", "formacion"] },
      { href: "/bolivia/timeline", label: "Timeline regulatorio", code: "TML", interests: ["cumplimiento"] },
    ],
  },
  {
    title: "Market Intelligence",
    items: [
      { href: "/mercado", label: "Crypto Markets", code: "MKT", interests: ["inversion"] },
      { href: "/onchain", label: "Bitcoin & On-chain", code: "BTC", interests: ["inversion", "riesgo"] },
      { href: "/defi", label: "Protocol Analytics", code: "DFI", interests: ["inversion", "tecnologia"] },
      { href: "/defi/yields", label: "· DeFi Yields", code: "YLD", interests: ["inversion", "riesgo"] },
      { href: "/seguridad", label: "Exploits & Seguridad", code: "SEC", interests: ["riesgo", "cumplimiento", "tecnologia"] },
      { href: "/correlaciones", label: "Correlation Lab", code: "COR", interests: ["inversion", "riesgo"] },
    ],
  },
  {
    title: "Research Lab",
    items: [
      { href: "/noticias", label: "News B2B", code: "NWS", interests: ["formacion", "inversion"] },
      { href: "/partnerships", label: "Partnerships", code: "PTN", interests: ["formacion", "institucional"] },
      { href: "/fan-tokens", label: "Fan Token Analytics", code: "FAN", interests: ["inversion", "formacion"] },
      { href: "/ia", label: "AI Workspace", code: "IA", interests: ["formacion", "tecnologia"] },
    ],
  },
  {
    title: "NEXUM Intelligence Layer",
    items: [{ href: "/nexum", label: "Aula del terminal", code: "NXM", interests: ["formacion"] }],
  },
];

/** Todos los módulos, sin el agrupamiento de la navegación. */
export const MODULES: Item[] = NAV.flatMap((group) => group.items);

/**
 * Navegación filtrada por perfil. Sin perfiles seleccionados devuelve todo;
 * con varios, un módulo entra si sirve a cualquiera de ellos —lo contrario
 * dejaría la pantalla vacía en cuanto alguien marque dos.
 */
export function filterNav(selected: InterestId[]): Group[] {
  if (selected.length === 0) return NAV;
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.interests.some((id) => selected.includes(id))),
  })).filter((group) => group.items.length > 0);
}

/** Cuántos módulos sirven a cada perfil, para mostrarlo junto al filtro. */
export function countByInterest(id: InterestId): number {
  return MODULES.filter((item) => item.interests.includes(id)).length;
}
