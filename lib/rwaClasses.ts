// Tamaño de mercado por clase de activo según el dashboard RWA de DeFiLlama.
//
// El dashboard publica cada activo con su market cap (activo y on-chain), su
// TVL DeFi y sus categorías. Esta es la regla con la que DeFiLlama arma sus KPI
// por defecto: reproducida acá, la suma coincide con la cabecera de
// defillama.com/rwa y cada clase con su página de categoría (verificado el
// 14-09-2026: Stocks & Equities $3.791B activo y $4.481B on-chain en ambos).
//
// No confundir con el TVL de protocolos por sector (lib/rwaSectors.ts): el TVL
// mide capital depositado en contratos rastreados; el market cap mide cuánto
// vale lo emitido. Para acciones tokenizadas la diferencia es de 4 a 1.

export type RwaInclusion = {
  includeStablecoins: boolean;
  includeGovernance: boolean;
  includeRwaPerps: boolean;
  includeWrappers: boolean;
};

/** Perímetro por defecto de defillama.com/rwa. */
export const DEFAULT_INCLUSION: RwaInclusion = {
  includeStablecoins: false,
  includeGovernance: false,
  includeRwaPerps: false,
  includeWrappers: false,
};

type Metric = { total?: unknown } | null | undefined;

export type RawRwaAsset = {
  type?: unknown;
  stablecoin?: unknown;
  governance?: unknown;
  category?: unknown;
  parentPlatform?: unknown;
  activeMcap?: Metric;
  onChainMcap?: Metric;
  defiActiveTvl?: Metric;
};

export type RwaClass = {
  /** nombre de la categoría en DeFiLlama */
  name: string;
  label: string;
  activeMcapUsd: number;
  onchainMcapUsd: number;
  defiActiveTvlUsd: number;
  assets: number;
};

export type RwaPlatform = { name: string; activeMcapUsd: number; assets: number };

export type RwaBreakdown = {
  classes: RwaClass[];
  platforms: RwaPlatform[];
  totals: { activeMcapUsd: number; onchainMcapUsd: number; defiActiveTvlUsd: number };
  assets: number;
};

const CLASS_LABELS: Record<string, string> = {
  "Bond & MMF Funds": "Bonos y fondos monetarios",
  "Gold & Commodities": "Oro y commodities",
  "Private Credit": "Crédito privado",
  "Stocks & Equities": "Acciones y participaciones",
  "Crypto Funds": "Fondos cripto",
  ETFs: "ETFs",
  "RWA Wrappers": "Wrappers RWA",
  "Real Estate": "Inmuebles",
  "Other RWAs": "Otros RWA",
  "Carbon & Environment": "Carbono y ambiente",
  "Fiat Stablecoins": "Stablecoins fiat",
  "RWA Stablecoins": "Stablecoins RWA",
  "Non-RWA Stablecoins": "Stablecoins no RWA",
  "Governance Tokens": "Tokens de gobernanza",
};

/**
 * Sectores de Blockfinity con una clase equivalente en DeFiLlama. El resto no
 * tiene par limpio: DeFiLlama pone el capital privado (PE / Venture) dentro de
 * Stocks & Equities, y Seguros no es una clase suya.
 */
export const SECTOR_CLASS: Record<string, string> = {
  "Treasuries y money market": "Bond & MMF Funds",
  "Commodities (metales)": "Gold & Commodities",
  "Crédito privado": "Private Credit",
  "Acciones tokenizadas": "Stocks & Equities",
  "Real estate": "Real Estate",
};

/** Un monto ausente, no numérico o negativo no suma: nunca se estima. */
function amount(metric: Metric): number {
  const value = metric && typeof metric === "object" ? metric.total : undefined;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function includedByDefault(asset: RawRwaAsset, inclusion: RwaInclusion = DEFAULT_INCLUSION): boolean {
  if (asset.type === "Perp") return inclusion.includeRwaPerps;
  if (asset.type === "Wrapper" && !inclusion.includeWrappers) return false;
  if (asset.stablecoin === true && !inclusion.includeStablecoins) return false;
  if (asset.governance === true && !inclusion.includeGovernance) return false;
  return true;
}

/**
 * Totales, clases y plataformas del perímetro elegido. Un activo con varias
 * categorías suma en cada una: las clases pueden superponerse y su suma no es
 * el total, igual que en DeFiLlama.
 */
export function aggregateRwaAssets(assets: RawRwaAsset[], inclusion: RwaInclusion = DEFAULT_INCLUSION): RwaBreakdown {
  const classes = new Map<string, RwaClass>();
  const platforms = new Map<string, RwaPlatform>();
  const totals = { activeMcapUsd: 0, onchainMcapUsd: 0, defiActiveTvlUsd: 0 };
  let count = 0;

  for (const asset of assets) {
    if (!includedByDefault(asset, inclusion)) continue;
    const active = amount(asset.activeMcap);
    const onchain = amount(asset.onChainMcap);
    const tvl = amount(asset.defiActiveTvl);
    count++;
    totals.activeMcapUsd += active;
    totals.onchainMcapUsd += onchain;
    totals.defiActiveTvlUsd += tvl;

    const categories = Array.isArray(asset.category)
      ? asset.category.filter((c): c is string => typeof c === "string" && c.trim() !== "")
      : [];
    for (const name of new Set(categories)) {
      const entry = classes.get(name) ?? {
        name,
        label: CLASS_LABELS[name] ?? name,
        activeMcapUsd: 0,
        onchainMcapUsd: 0,
        defiActiveTvlUsd: 0,
        assets: 0,
      };
      entry.activeMcapUsd += active;
      entry.onchainMcapUsd += onchain;
      entry.defiActiveTvlUsd += tvl;
      entry.assets++;
      classes.set(name, entry);
    }

    if (typeof asset.parentPlatform === "string" && asset.parentPlatform.trim() !== "") {
      const name = asset.parentPlatform.trim();
      const entry = platforms.get(name) ?? { name, activeMcapUsd: 0, assets: 0 };
      entry.activeMcapUsd += active;
      entry.assets++;
      platforms.set(name, entry);
    }
  }

  return {
    classes: [...classes.values()]
      .filter((c) => c.activeMcapUsd > 0 || c.onchainMcapUsd > 0)
      .sort((a, b) => b.activeMcapUsd - a.activeMcapUsd),
    platforms: [...platforms.values()]
      .filter((p) => p.activeMcapUsd > 0)
      .sort((a, b) => b.activeMcapUsd - a.activeMcapUsd)
      .slice(0, 50),
    totals,
    assets: count,
  };
}

/** Activos y perímetro por defecto embebidos en el HTML de defillama.com/rwa. */
export function extractRwaPageData(html: string): { assets: RawRwaAsset[]; inclusion: RwaInclusion } | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const props = JSON.parse(match[1])?.props?.pageProps;
    if (!Array.isArray(props?.assets)) return null;
    const d = props.defaultInclusion ?? {};
    return {
      assets: props.assets as RawRwaAsset[],
      inclusion: {
        includeStablecoins: d.includeStablecoins === true,
        includeGovernance: d.includeGovernance === true,
        includeRwaPerps: d.includeRwaPerps === true,
        includeWrappers: d.includeWrappers === true,
      },
    };
  } catch {
    return null;
  }
}
