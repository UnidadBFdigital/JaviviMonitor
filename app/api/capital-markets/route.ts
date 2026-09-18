import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/sources/yahoo";
import { getNewsByCategory } from "@/lib/sources/news";
import { getRwaProtocols } from "@/lib/sources/defillama";
import { getRwaDashboardMetrics } from "@/lib/sources/defillamaRwa";
import { buildSectors } from "@/lib/rwaSectors";
import { SECTOR_CLASS } from "@/lib/rwaClasses";
import tokenizationJson from "@/data/tokenization.json";

// Capital Markets: vehículos cotizados que dan exposición institucional a
// cripto. Yahoo publica precio y volumen, NO flujos netos del fondo — la UI
// lo dice explícitamente para que nadie lea "turnover" como "inflows".
const ETFS = ["IBIT", "FBTC", "ARKB", "BITB", "GBTC", "ETHA"];
const EQUITIES = ["COIN", "MSTR", "CRCL", "HOOD"];

const TREASURIES_SECTOR = "Treasuries y money market";

// Gestoras tradicionales con producto tokenizado en vivo. El nombre es el que
// usa DeFiLlama en /protocols; la gestora, la que hay que nombrar en una
// propuesta. `platform` es su nombre en el dashboard RWA, para las que no
// tienen TVL en /protocols: se muestran con su market cap, no se omiten.
const GESTORAS: { llamaName: string; manager: string; platform?: string }[] = [
  { llamaName: "BlackRock BUIDL", manager: "BlackRock" },
  { llamaName: "WisdomTree", manager: "WisdomTree", platform: "WisdomTree" },
  { llamaName: "Invesco USTB", manager: "Invesco" },
  { llamaName: "VanEck Treasury Fund", manager: "VanEck" },
  { llamaName: "Circle USYC", manager: "Circle", platform: "Circle" },
  { llamaName: "Ondo Yield Assets", manager: "Ondo Finance" },
  { llamaName: "Spiko", manager: "Spiko", platform: "Spiko" },
  { llamaName: "Securitize Tokenized AAA CLO Fund", manager: "Securitize" },
  { llamaName: "Apollo Diversified Credit Securitize Fund", manager: "Apollo" },
  // DeFiLlama no lo lista en /protocols (verificado 14-09-2026); sí en el dashboard RWA
  { llamaName: "Franklin OnChain U.S. Government Money Fund", manager: "Franklin Templeton", platform: "Franklin Templeton" },
];

export async function GET() {
  const [etfs, equities, news, rwa, dashboard] = await Promise.all([
    getQuotes(ETFS),
    getQuotes(EQUITIES),
    getNewsByCategory("Capital Markets", 8),
    getRwaProtocols(),
    getRwaDashboardMetrics(),
  ]);

  const platforms = dashboard.ok && dashboard.data.platforms ? dashboard.data.platforms : [];
  const classes = dashboard.ok && dashboard.data.classes ? dashboard.data.classes : [];

  // gestoras con AUM tokenizado en vivo, y las que la fuente no cubre
  let managers: { manager: string; product: string; slug: string; aumUsd: number; change7dPct: number | null }[] =
    [];
  let uncoveredManagers: { manager: string; product: string; dashboardActiveMcapUsd: number | null }[] = [];
  let tokenizedTreasuries: { valueUsd: number; basis: "mcap" | "tvl" } | null = null;

  // el tamaño de la clase sale del market cap; el TVL por sector es el respaldo
  const bondClass = classes.find((c) => c.name === SECTOR_CLASS[TREASURIES_SECTOR]);
  if (bondClass) tokenizedTreasuries = { valueUsd: bondClass.activeMcapUsd, basis: "mcap" };

  if (rwa.ok) {
    const byName = new Map(rwa.data.map((p) => [p.name.toLowerCase(), p]));
    managers = GESTORAS.flatMap((g) => {
      const hit = byName.get(g.llamaName.toLowerCase());
      return hit
        ? [
            {
              manager: g.manager,
              product: hit.name,
              // habilita el histórico del AUM on-chain en la ficha lateral
              slug: hit.slug,
              aumUsd: hit.tvlUsd,
              change7dPct: hit.change7dPct,
            },
          ]
        : [];
    }).sort((a, b) => b.aumUsd - a.aumUsd);

    uncoveredManagers = GESTORAS.filter((g) => !byName.has(g.llamaName.toLowerCase())).map((g) => ({
      manager: g.manager,
      product: g.llamaName,
      dashboardActiveMcapUsd: g.platform ? (platforms.find((p) => p.name === g.platform)?.activeMcapUsd ?? null) : null,
    }));

    if (!tokenizedTreasuries) {
      const { sectors } = buildSectors(rwa.data, tokenizationJson.sectorMap as Record<string, string[]>);
      const tvl = sectors.find((x) => x.name === TREASURIES_SECTOR)?.tvlUsd;
      if (tvl !== undefined) tokenizedTreasuries = { valueUsd: tvl, basis: "tvl" };
    }
  }

  return NextResponse.json({
    etfs,
    equities,
    news,
    managers,
    uncoveredManagers,
    tokenizedTreasuries,
    rwaSource: rwa.ok
      ? { ok: true as const, source: rwa.source, fetchedAt: rwa.fetchedAt }
      : { ok: false as const },
  });
}
