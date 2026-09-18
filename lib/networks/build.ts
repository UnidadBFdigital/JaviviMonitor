import registry from "@/data/networks.json";
import blockchains from "@/data/blockchains.json";
import { chainKey } from "@/lib/bbiMethodology";
import { institutionalScoreOf } from "@/lib/bbi";
import { calendarValues, defaultBranchStalled, windowChangePct } from "./series";
import { getAllChainsTvl, getChainTvlHistory, getRwaProtocols } from "@/lib/sources/defillama";
import { getChainActivityMetrics } from "@/lib/sources/defillamaDashboard";
import { getStablecoinSupplyByChain } from "@/lib/sources/stablecoins";
import { getGrowthepieFundamentals, getGrowthepieMaster, SOURCE_URL as GP_URL } from "@/lib/sources/growthepie";
import { getL2beatProjects, securityFromL2beat, SOURCE_URL as L2B_URL } from "@/lib/sources/l2beat";
import { getRepoActivity, SOURCE_URL as GH_URL } from "@/lib/sources/githubRepos";
import type {
  NetworkMetrics,
  NetworkRegistryEntry,
  Provenance,
  SeriesPoint,
} from "./types";

// Ensamblado de proveedores → esquema interno. Acá vive toda la fontanería:
// qué fuente alimenta qué campo, cómo se rellenan los huecos y qué motivo se
// publica cuando un dato no existe. Ningún componente de React repite esto.

export const NETWORKS = (registry.networks as NetworkRegistryEntry[]).slice();
export const REGISTRY_META = {
  techReviewedAt: registry.techReviewedAt as string,
  techNote: registry.techNote as string,
};

const COST_NO_COVERAGE =
  "growthepie no cubre esta red. Sin una serie de costo mediano con la misma metodología, publicar un número sería mezclar modelos de comisión distintos.";

const COST_NO_SERIES =
  "growthepie cubre la red pero no publicó costo mediano en la ventana vigente.";

const DEV_COUNT_SOURCE =
  "Electric Capital Developer Report — sin API pública (solo informes PDF anuales). Adapter preparado; la columna queda en N/A.";

/* ---------- utilidades de serie ---------- */

function tail(series: SeriesPoint[] | undefined, days: number): number[] {
  return calendarValues(series, days);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Coeficiente de variación: desviación relativa a la media. */
function coefficientOfVariation(values: number[]): number | null {
  const avg = mean(values);
  if (avg === null || avg === 0) return null;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(avg);
}

function last(series: SeriesPoint[] | undefined): number | null {
  if (!series || series.length === 0) return null;
  const value = series[series.length - 1].value;
  return Number.isFinite(value) ? value : null;
}

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** El parser conserva la diferencia entre cero observado y dato ausente. */
function dashboardNumber(value: number | null | undefined): number | null {
  return positive(value);
}

/**
 * GitHub entrega 52 conteos semanales sin fecha: el último es la semana en
 * curso. Se fechan hacia atrás para poder dibujarlos junto a las demás series.
 */
function weeklyToSeries(weekly: number[]): SeriesPoint[] {
  const now = Date.now();
  return weekly.map((value, index) => ({
    date: new Date(now - (weekly.length - 1 - index) * 7 * 86_400_000).toISOString().slice(0, 10),
    value,
  }));
}

/* ---------- ensamblado ---------- */

export type NetworkBuild = {
  networks: NetworkMetrics[];
  sources: Provenance[];
  failed: string[];
  generatedAt: string;
};

export async function buildNetworks(): Promise<NetworkBuild> {
  const histories = NETWORKS.map((n) => n.keys.llama);

  const [fundamentals, master, activity, chainsTvl, stables, rwa, l2beat, repos, ...tvlSeries] =
    await Promise.all([
      getGrowthepieFundamentals(),
      getGrowthepieMaster(),
      getChainActivityMetrics(),
      getAllChainsTvl(),
      getStablecoinSupplyByChain(),
      getRwaProtocols(),
      getL2beatProjects(),
      getRepoActivity(NETWORKS.map((n) => n.repo)),
      ...histories.map((chain) =>
        // 400 días: la ventana de 90 exige comparar contra los 90 previos
        chain ? getChainTvlHistory(chain, 400) : Promise.resolve(null)
      ),
    ]);

  const failed: string[] = [];
  if (!fundamentals.ok) failed.push("growthepie");
  if (!activity.ok) failed.push("DeFiLlama Chains");
  if (!stables.ok) failed.push("DeFiLlama Stablecoins");
  if (!chainsTvl.ok) failed.push("DeFiLlama TVL");
  if (!rwa.ok) failed.push("DeFiLlama RWA");
  if (!master.ok) failed.push("growthepie metadata");
  if (!l2beat.ok) failed.push("L2BEAT");
  if (!repos.ok) failed.push("GitHub");

  const activityByChain = new Map(
    (activity.ok ? activity.data : []).map((row) => [chainKey(row.name), row])
  );
  const tvlByChain = new Map(
    (chainsTvl.ok ? chainsTvl.data : []).map((row) => [chainKey(row.name), row.tvlUsd])
  );
  const stablesByChain = new Map(
    (stables.ok ? stables.data : []).map((row) => [chainKey(row.chain), row.circulatingUsd])
  );

  // RWA por cadena: DeFiLlama atribuye cada protocolo a UNA cadena principal,
  // así que esto mide presencia, no el reparto real de un protocolo multichain.
  const rwaByChain = new Map<string, { count: number; tvlUsd: number }>();
  for (const protocol of rwa.ok ? rwa.data : []) {
    const key = chainKey(protocol.chain);
    const entry = rwaByChain.get(key) ?? { count: 0, tvlUsd: 0 };
    entry.count += 1;
    entry.tvlUsd += protocol.tvlUsd;
    rwaByChain.set(key, entry);
  }

  // Las notas editoriales del BBI se reutilizan tal cual: este módulo mira la
  // infraestructura desde el ángulo de quien construye, no reabre el juicio
  // editorial que ya publica el scorecard.
  const editorial = new Map(
    (blockchains.networks as { name: string; scores: Parameters<typeof institutionalScoreOf>[0] }[]).map(
      (n) => [n.name, n.scores]
    )
  );

  const sources: Provenance[] = [
    {
      block: "Costos, throughput y actividad diaria",
      source: "growthepie",
      url: GP_URL,
      fetchedAt: fundamentals.ok ? fundamentals.fetchedAt : null,
      freshness: "DAILY",
      period: "serie diaria, 90 días",
      ok: fundamentals.ok,
      stale: fundamentals.ok ? fundamentals.stale : false,
      note: "Solo Ethereum y su ecosistema. El resto de las redes queda en N/A por metodología.",
    },
    {
      block: "Panel de actividad, DEX, comisiones y protocolos",
      source: "DeFiLlama",
      url: "https://defillama.com/chains",
      fetchedAt: activity.ok ? activity.fetchedAt : null,
      freshness: "HOURLY",
      period: "corte 24h y 7d",
      ok: activity.ok,
      stale: activity.ok ? activity.stale : false,
    },
    {
      block: "Arquitectura y riesgos de rollups",
      source: "L2BEAT",
      url: L2B_URL,
      fetchedAt: l2beat.ok ? l2beat.fetchedAt : null,
      freshness: "DAILY",
      period: "estado vigente",
      ok: l2beat.ok,
      stale: l2beat.ok ? l2beat.stale : false,
      note: "Solo aplica a L2. En L1 la seguridad usa la nota editorial del BBI.",
    },
    {
      block: "Actividad del repositorio núcleo",
      source: "GitHub API",
      url: GH_URL,
      fetchedAt: repos.ok ? repos.fetchedAt : null,
      freshness: "DAILY",
      period: "commits por semana, 52 semanas",
      ok: repos.ok,
      stale: repos.ok ? repos.stale : false,
      note: "Mide el repositorio del cliente, no los desarrolladores del ecosistema.",
    },
    {
      block: "Ficha técnica y tooling",
      source: "Registro curado de Blockfinity",
      url: "/blockchains/infraestructura#metodologia",
      fetchedAt: null,
      freshness: "STATIC",
      period: `revisado ${REGISTRY_META.techReviewedAt}`,
      ok: true,
      stale: false,
      note: REGISTRY_META.techNote,
    },
  ];

  for (const [block, result, url] of [
    ["TVL por red", chainsTvl, "https://defillama.com/chains"],
    ["Oferta de stablecoins por red", stables, "https://defillama.com/stablecoins/chains"],
    ["Protocolos RWA", rwa, "https://defillama.com/protocols/RWA"],
    ["Metadatos y accesos de redes", master, GP_URL],
  ] as const) {
    sources.push({ block, source: result.source, url, fetchedAt: result.ok ? result.fetchedAt : null, freshness: "DAILY", period: "último corte disponible", ok: result.ok, stale: result.ok ? result.stale : false });
  }

  const networks: NetworkMetrics[] = NETWORKS.map((entry, index) => {
    const key = entry.keys.llama ? chainKey(entry.keys.llama) : null;
    const dash = key ? activityByChain.get(key) : undefined;
    const gp = entry.keys.growthepie ? (fundamentals.ok ? fundamentals.data[entry.keys.growthepie] : undefined) : undefined;
    const meta = entry.keys.growthepie && master.ok ? master.data[entry.keys.growthepie] : undefined;
    const l2 = entry.keys.l2beat && l2beat.ok ? l2beat.data[entry.keys.l2beat] : undefined;
    const repo = repos.ok ? repos.data[entry.repo] : undefined;
    const tvlHistory = tvlSeries[index];

    /* --- costo --- */
    const costSeries = gp?.txcosts_median_usd;
    const cost30 = tail(costSeries, 30);
    const medianUsd = last(costSeries);
    const cost = {
      medianUsd,
      avg7dUsd: mean(tail(costSeries, 7)),
      avg30dUsd: mean(cost30),
      min30dUsd: cost30.length > 0 ? Math.min(...cost30) : null,
      max30dUsd: cost30.length > 0 ? Math.max(...cost30) : null,
      volatility30d: cost30.length >= 10 ? coefficientOfVariation(cost30) : null,
      change7dPct: windowChangePct(costSeries, 7),
      change30dPct: windowChangePct(costSeries, 30),
      change90dPct: windowChangePct(costSeries, 90),
      unavailable:
        medianUsd !== null
          ? null
          : entry.keys.growthepie
            ? COST_NO_SERIES
            : COST_NO_COVERAGE,
    };

    /* --- actividad --- */
    const txCount24h = last(gp?.txcount);
    const activityBlock = {
      activeAddresses24h: dashboardNumber(dash?.activeAddresses24h),
      dailyActiveAddresses: last(gp?.daa),
      txCount24h,
      observedTps: txCount24h !== null ? txCount24h / 86_400 : null,
      throughputGasPerSec: last(gp?.gas_per_second),
      daaChange7dPct: windowChangePct(gp?.daa, 7),
      daaChange30dPct: windowChangePct(gp?.daa, 30),
      daaChange90dPct: windowChangePct(gp?.daa, 90),
      txChange7dPct: windowChangePct(gp?.txcount, 7),
      txChange30dPct: windowChangePct(gp?.txcount, 30),
      txChange90dPct: windowChangePct(gp?.txcount, 90),
      unavailable:
        gp === undefined
          ? "Sin serie diaria comparable: solo hay corte de 24h de DeFiLlama."
          : null,
    };

    /* --- liquidez --- */
    const tvlUsd = dashboardNumber(dash?.tvlUsd) ?? (key ? positive(tvlByChain.get(key) ?? null) : null);
    const tvlPoints = tvlHistory?.ok ? tvlHistory.data : [];
    const tvlSeriesPoints: SeriesPoint[] = tvlPoints.map((p) => ({ date: p.date, value: p.tvlUsd }));
    const liquidity = {
      tvlUsd,
      tvlChange7dPct: windowChangePct(tvlSeriesPoints, 7),
      tvlChange30dPct: windowChangePct(tvlSeriesPoints, 30),
      tvlChange90dPct: windowChangePct(tvlSeriesPoints, 90),
      stablecoinUsd:
        dashboardNumber(dash?.stablecoinMcapUsd) ?? (key ? positive(stablesByChain.get(key) ?? null) : null),
      dexVolume24hUsd: dashboardNumber(dash?.dexVolume24hUsd),
      dexVolume7dUsd: dashboardNumber(dash?.dexVolume7dUsd),
      chainFees24hUsd: dashboardNumber(dash?.chainFees24hUsd),
      protocols: dashboardNumber(dash?.protocolCount),
    };

    /* --- RWA --- */
    const rwaEntry = key ? rwaByChain.get(key) : undefined;
    const rwaBlock = {
      protocolCount: rwaEntry?.count ?? (rwa.ok ? 0 : null),
      tvlUsd: rwaEntry?.tvlUsd ?? (rwa.ok ? 0 : null),
      note: "DeFiLlama asigna cada protocolo a una cadena principal: mide presencia, no el reparto de un protocolo multichain.",
    };

    /* --- desarrollo --- */
    // rama principal quieta con pushes recientes: el cero no mide la red
    const stalled = repo ? defaultBranchStalled(repo, Date.now()) : null;
    const commits12w = stalled ? null : (repo?.commits12w ?? null);
    const commitsChangePct =
      commits12w !== null && repo?.commitsPrev12w
        ? ((commits12w - repo.commitsPrev12w) / repo.commitsPrev12w) * 100
        : null;
    const dev = {
      repo: entry.repo,
      repoNote: entry.repoNote ?? null,
      commits4w: stalled ? null : (repo?.commits4w ?? null),
      commits12w,
      commits52w: repo?.commits52w ?? null,
      commitsPrev12w: repo?.commitsPrev12w ?? null,
      commitsChangePct,
      stars: repo?.stars ?? null,
      contributors: repo?.contributors ?? null,
      pushedAt: repo?.pushedAt ?? null,
      ecosystemDevelopers: null,
      ecosystemDevelopersSource: DEV_COUNT_SOURCE,
      unavailable: stalled ?? repo?.unavailable ?? (repos.ok ? null : repos.error),
    };

    /* --- arquitectura y seguridad --- */
    const fromL2beat = l2 ? securityFromL2beat(l2) : null;
    const curated = entry.keys.bbi ? editorial.get(entry.keys.bbi) ?? null : null;
    const arch = {
      stage: l2?.stage ?? null,
      // L2BEAT devuelve "Other" para las sidechains: ahí manda el registro
      category: l2?.category && l2.category !== "Other" ? l2.category : entry.kind,
      dataAvailability: l2?.dataAvailability ?? null,
      providers: l2?.providers ?? [],
      risks: l2?.risks ?? [],
      blockTimeSec: entry.blockTimeSec,
      finalitySec: entry.finalitySec,
      securityScore: fromL2beat ? Math.round(fromL2beat.score * 10) / 10 : curated?.seguridad ?? null,
      securityBasis: fromL2beat
        ? `Proxy editorial Blockfinity basado en L2BEAT · ${fromL2beat.basis}. Stage mide madurez de descentralización, no garantiza seguridad.`
        : curated
          ? "Nota editorial BBI de Blockfinity"
          : null,
      institutionalScore: curated ? Math.round(institutionalScoreOf(curated) * 10) / 10 : null,
    };

    return {
      ...entry,
      cost,
      activity: activityBlock,
      liquidity,
      rwa: rwaBlock,
      dev,
      arch,
      history: {
        cost: costSeries?.slice(-90) ?? [],
        daa: gp?.daa?.slice(-90) ?? [],
        tvl: tvlSeriesPoints.slice(-90),
        commits: repo?.weekly?.length ? weeklyToSeries(repo.weekly) : [],
      },
      explorers: meta?.explorers ?? [],
      rpcs: meta?.rpcs ?? [],
      sources: sources.filter((source) => source.source !== "growthepie" || entry.keys.growthepie !== null),
    };
  });

  return { networks, sources, failed, generatedAt: new Date().toISOString() };
}
