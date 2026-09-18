import tokenizationJson from "@/data/tokenization.json";
import { classifyProtocols, UNCLASSIFIED } from "@/lib/rwaSectors";
import {
  getChainToken,
  getChainTvlHistory,
  getProtocolTvlHistory,
  getRwaProtocols,
} from "@/lib/sources/defillama";
import {
  getChainStablecoinHistory,
  getStablecoinSupplyHistory,
  getSupplyHistory,
} from "@/lib/sources/stablecoins";
import { getAssetHistory } from "@/lib/sources/coingecko";
import { getPoolChart, getYieldUniverse, type PoolChartPoint } from "@/lib/sources/defillamaYields";
import { OPERATION_BY_ID, RISK_LABEL } from "@/lib/yields";
import { getDailyCandles } from "@/lib/sources/cryptocom";
import { getYahooSeries } from "@/lib/sources/yahoo";
import { alignSeries, sumSeries, unionDates } from "@/lib/historySeries";
import type {
  HistoryComposition,
  HistoryMember,
  HistoryMetric,
  HistoryPayload,
  HistoryPoint,
  HistoryTarget,
} from "@/lib/historyTypes";

// Resolvedor único del histórico a demanda. Traduce un HistoryTarget a la
// fuente que corresponde y normaliza la respuesta. Ninguna serie se inventa:
// si la fuente no responde, la ficha recibe ok:false con el motivo.

function failure(target: HistoryTarget, source: string, error: string): HistoryPayload {
  return { ok: false, target, source, error };
}

/** Promesas con concurrencia acotada: el detalle de protocolos es pesado. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Cuántos protocolos de un sector se consultan: cubren casi todo el TVL. */
const SECTOR_FETCH_LIMIT = 15;
/** Protocolos con serie propia en la composición; el resto se agrupa. */
const COMPOSITION_TOP = 5;

async function rwaSector(target: HistoryTarget): Promise<HistoryPayload> {
  const protocols = await getRwaProtocols();
  if (!protocols.ok) return failure(target, protocols.source, "DeFiLlama no devolvió los protocolos RWA");

  const buckets = classifyProtocols(protocols.data, tokenizationJson.sectorMap as Record<string, string[]>);
  const members = [...(buckets.get(target.id) ?? [])].sort((a, b) => b.tvlUsd - a.tvlUsd);
  if (members.length === 0) return failure(target, protocols.source, "El sector no tiene protocolos en el corte actual");

  const sectorTvl = members.reduce((sum, p) => sum + p.tvlUsd, 0);
  const selection = members.slice(0, SECTOR_FETCH_LIMIT);
  const histories = await mapLimit(selection, 4, (p) => getProtocolTvlHistory(p.slug));

  const fetched = selection
    .map((protocol, index) => ({ protocol, history: histories[index] }))
    .flatMap((entry) =>
      entry.history.ok && entry.history.data.points.length > 1
        ? [{
            protocol: entry.protocol,
            points: entry.history.data.points.map((p) => ({ date: p.date, value: p.tvlUsd })),
            fetchedAt: entry.history.fetchedAt,
            stale: entry.history.stale,
          }]
        : []
    );
  if (fetched.length === 0) return failure(target, "DeFiLlama", "Ningún protocolo del sector devolvió histórico");

  const total = sumSeries(fetched.map((f) => f.points));
  const dates = total.map((p) => p.date);

  // composición: los mayores con serie propia y el resto como una sola banda
  const top = fetched.slice(0, COMPOSITION_TOP);
  const topAligned = top.map((f) => alignSeries(dates, f.points));
  const composition: HistoryComposition[] = top.map((f, i) => ({
    key: f.protocol.slug,
    label: f.protocol.name,
    points: dates.map((date, j) => ({ date, value: topAligned[i][j] })),
  }));
  if (fetched.length > COMPOSITION_TOP) {
    composition.push({
      key: "resto",
      label: `Resto (${fetched.length - COMPOSITION_TOP})`,
      points: total.map((point, j) => ({
        date: point.date,
        value: Math.max(0, point.value - topAligned.reduce((sum, values) => sum + values[j], 0)),
      })),
    });
  }

  const coveredTvl = fetched.reduce((sum, f) => sum + f.protocol.tvlUsd, 0);
  const coveragePct = sectorTvl > 0 ? (coveredTvl / sectorTvl) * 100 : 0;

  const memberRows: HistoryMember[] = members.slice(0, 25).map((p) => ({
    label: p.name,
    valueUsd: p.tvlUsd,
    sharePct: sectorTvl > 0 ? (p.tvlUsd / sectorTvl) * 100 : 0,
    target: { kind: "protocol", id: p.slug, label: p.name },
  }));

  const notes = [
    fetched.length === members.length
      ? `La serie suma los ${members.length} protocolos del sector.`
      : `La serie suma los ${fetched.length} mayores protocolos del sector: ${coveragePct.toFixed(1)}% de su TVL actual. El resto es cola larga.`,
    "Un día sin dato de un protocolo arrastra su último valor; antes de su lanzamiento aporta cero.",
    target.id === UNCLASSIFIED
      ? "«Sin clasificar» es residuo del mapa de sectores, no un sector."
      : "Sectores: clasificación propia de Blockfinity sobre las categorías RWA y RWA Lending de DeFiLlama.",
  ];

  return {
    ok: true,
    target,
    title: target.id,
    subtitle: `TVL agregado del sector · ${members.length} protocolo${members.length === 1 ? "" : "s"}`,
    metrics: [{ key: "tvl", label: "TVL", unit: "usd", points: total }],
    compare: null,
    composition: composition.length > 1 ? composition : null,
    members: memberRows,
    source: "DeFiLlama",
    sourceUrl: "https://defillama.com/protocols/RWA",
    fetchedAt: fetched.map((f) => f.fetchedAt).sort().at(-1) ?? protocols.fetchedAt,
    stale: fetched.some((f) => f.stale) || protocols.stale,
    cadence: "Diario",
    notes,
  };
}

function simple(
  target: HistoryTarget,
  args: {
    title: string;
    subtitle: string;
    metricLabel: string;
    unit: "usd" | "price";
    points: HistoryPoint[];
    source: string;
    sourceUrl: string | null;
    fetchedAt: string;
    stale: boolean;
    cadence: "Diario" | "Cada hora";
    notes: string[];
  }
): HistoryPayload {
  if (args.points.length < 2) return failure(target, args.source, "La fuente devolvió una serie demasiado corta");
  return {
    ok: true,
    target,
    title: args.title,
    subtitle: args.subtitle,
    metrics: [{ key: "value", label: args.metricLabel, unit: args.unit, points: args.points }],
    compare: null,
    composition: null,
    members: null,
    source: args.source,
    sourceUrl: args.sourceUrl,
    fetchedAt: args.fetchedAt,
    stale: args.stale,
    cadence: args.cadence,
    notes: args.notes,
  };
}

/* ---------- TVL con el precio de su token ---------- */

type TokenRef = { geckoId: string | null; symbol: string | null };

/**
 * Serie de precio del token asociado a un protocolo o una red. Sin token, o
 * si CoinGecko no responde, no hay métrica: la ficha queda con el TVL solo y
 * una nota que dice por qué, nunca con una serie aproximada.
 */
async function tokenPrice(token: TokenRef, noToken: string): Promise<{ metric: HistoryMetric | null; note: string; stale: boolean }> {
  if (!token.geckoId) return { metric: null, note: noToken, stale: false };
  const label = token.symbol ? `Precio ${token.symbol}` : "Precio del token";
  const result = await getAssetHistory(token.geckoId, 365);
  if (!result.ok || result.data.prices.length < 2) {
    return { metric: null, note: `${label}: CoinGecko no devolvió la serie en esta consulta.`, stale: false };
  }
  return {
    metric: { key: "price", label, unit: "price", points: result.data.prices },
    note: `${label} según CoinGecko, hasta 365 días. Un TVL en USD también sube cuando sube el precio de lo depositado: «TVL vs precio» separa ambos efectos.`,
    stale: result.stale,
  };
}

function tvlWithPrice(
  target: HistoryTarget,
  args: {
    title: string;
    subtitle: string;
    tvl: HistoryPoint[];
    price: { metric: HistoryMetric | null; note: string; stale: boolean };
    sourceUrl: string;
    fetchedAt: string;
    stale: boolean;
    notes: string[];
  }
): HistoryPayload {
  if (args.tvl.length < 2) return failure(target, "DeFiLlama", "La fuente devolvió una serie demasiado corta");
  const price = args.price.metric;
  return {
    ok: true,
    target,
    title: args.title,
    subtitle: args.subtitle,
    metrics: [{ key: "tvl", label: "TVL", unit: "usd", points: args.tvl }, ...(price ? [price] : [])],
    compare: price ? { left: "tvl", right: price.key, label: "TVL vs precio" } : null,
    composition: null,
    members: null,
    source: price ? "DeFiLlama · CoinGecko" : "DeFiLlama",
    sourceUrl: args.sourceUrl,
    fetchedAt: args.fetchedAt,
    stale: args.stale || args.price.stale,
    cadence: "Diario",
    notes: [...args.notes, args.price.note],
  };
}

export async function resolveHistory(target: HistoryTarget): Promise<HistoryPayload> {
  switch (target.kind) {
    case "rwa-sector":
      return rwaSector(target);

    case "protocol": {
      const result = await getProtocolTvlHistory(target.id);
      if (!result.ok) return failure(target, result.source, "DeFiLlama no devolvió el histórico del protocolo");
      const price = await tokenPrice(
        { geckoId: result.data.geckoId, symbol: result.data.symbol },
        "DeFiLlama no asocia un token cotizado a este protocolo: solo hay serie de TVL."
      );
      return tvlWithPrice(target, {
        title: result.data.name,
        subtitle: price.metric ? `TVL del protocolo y precio de ${price.metric.label.replace("Precio ", "")}` : "TVL del protocolo",
        tvl: result.data.points.map((p) => ({ date: p.date, value: p.tvlUsd })),
        price,
        sourceUrl: `https://defillama.com/protocol/${target.id}`,
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        notes: ["TVL: capital depositado en el protocolo según DeFiLlama. No es la capitalización de mercado de su token."],
      });
    }

    case "stablecoin": {
      const result = await getStablecoinSupplyHistory(target.id);
      if (!result.ok) return failure(target, result.source, "DeFiLlama no devolvió el supply histórico");
      return simple(target, {
        title: target.label,
        subtitle: "Supply circulante en USD, desde su lanzamiento",
        metricLabel: "Supply circulante",
        unit: "usd",
        points: result.data.map((p) => ({ date: p.date, value: p.totalUsd })),
        source: result.source,
        sourceUrl: "https://defillama.com/stablecoins",
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        cadence: "Diario",
        notes: ["Supply circulante: tokens emitidos y no rescatados, valuados en USD."],
      });
    }

    case "stablecoin-total": {
      const result = await getSupplyHistory(3650);
      if (!result.ok) return failure(target, result.source, "DeFiLlama no devolvió el market cap histórico");
      return simple(target, {
        title: "Stablecoins · market cap oficial",
        subtitle: "Total del mercado de stablecoins",
        metricLabel: "Market cap",
        unit: "usd",
        points: result.data.map((p) => ({ date: p.date, value: p.totalUsd })),
        source: result.source,
        sourceUrl: "https://defillama.com/stablecoins",
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        cadence: "Diario",
        notes: ["Serie del dashboard oficial de DeFiLlama, sin activos doublecounted: la misma cifra de la cabecera del terminal."],
      });
    }

    case "stablecoin-chain": {
      const result = await getChainStablecoinHistory(target.id);
      if (!result.ok) return failure(target, result.source, "DeFiLlama no devolvió el supply histórico de la red");
      return simple(target, {
        title: `${target.label} · stablecoins`,
        subtitle: "Supply de stablecoins atadas al dólar en la red",
        metricLabel: "Supply en USD",
        unit: "usd",
        points: result.data.map((p) => ({ date: p.date, value: p.totalUsd })),
        source: result.source,
        sourceUrl: "https://defillama.com/stablecoins/chains",
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        cadence: "Diario",
        notes: ["Solo stablecoins atadas al dólar, igual que el desglose por red del terminal."],
      });
    }

    case "chain-tvl": {
      const [result, token] = await Promise.all([getChainTvlHistory(target.id, 5000), getChainToken(target.id)]);
      if (!result.ok) return failure(target, result.source, "DeFiLlama no devolvió el TVL histórico de la red");
      const price = await tokenPrice(
        token.ok ? token.data : { geckoId: null, symbol: null },
        token.ok
          ? "DeFiLlama no asocia un token propio cotizado a esta red: solo hay serie de TVL."
          : "No se pudo consultar el token de la red en DeFiLlama: solo hay serie de TVL."
      );
      return tvlWithPrice(target, {
        title: `${target.label} · TVL`,
        subtitle: price.metric
          ? `Capital depositado en la red y precio de ${price.metric.label.replace("Precio ", "")}`
          : "Capital depositado en los protocolos DeFi de la red",
        tvl: result.data.map((p) => ({ date: p.date, value: p.tvlUsd })),
        price,
        sourceUrl: `https://defillama.com/chain/${encodeURIComponent(target.id)}`,
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        notes: price.metric
          ? ["Token asociado a la red por DeFiLlama. En una L2 puede ser de gobernanza y no el que paga el gas."]
          : [],
      });
    }

    case "asset": {
      const result = await getAssetHistory(target.id, 365);
      if (!result.ok) return failure(target, result.source, "CoinGecko no devolvió el histórico del activo");
      if (result.data.prices.length < 2) return failure(target, result.source, "CoinGecko devolvió una serie vacía");
      return {
        ok: true,
        target,
        title: target.label,
        subtitle: "Precio, capitalización y volumen diarios · 365 días",
        metrics: [
          { key: "price", label: "Precio", unit: "price" as const, points: result.data.prices },
          { key: "mcap", label: "Market cap", unit: "usd" as const, points: result.data.marketCaps },
          { key: "volume", label: "Volumen 24h", unit: "usd" as const, points: result.data.volumes },
        ].filter((metric) => metric.points.length > 1),
        compare: null,
        composition: null,
        members: null,
        source: result.source,
        sourceUrl: `https://www.coingecko.com/en/coins/${target.id}`,
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        cadence: "Cada hora",
        notes: ["La API de CoinGecko disponible entrega hasta 365 días de histórico."],
      };
    }

    case "ticker": {
      const result = await getDailyCandles(target.id, 300);
      if (!result.ok) return failure(target, result.source, "Crypto.com no devolvió velas del par");
      return simple(target, {
        title: target.label,
        subtitle: "Cierre diario del par · hasta 300 días",
        metricLabel: "Cierre",
        unit: "price",
        points: result.data.map((c) => ({ date: c.date, value: c.close })),
        source: result.source,
        sourceUrl: "https://crypto.com/exchange",
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        cadence: "Cada hora",
        notes: ["Precio de cierre diario en Crypto.com Exchange, contra USDT."],
      });
    }

    case "yield-pool": {
      const [chart, universe] = await Promise.all([getPoolChart(target.id), getYieldUniverse()]);
      if (!chart.ok) return failure(target, chart.source, "DeFiLlama Yields no devolvió el histórico del pool");
      const pool = universe.ok ? (universe.data.pools.find((p) => p.id === target.id) ?? null) : null;
      const series = (pick: (point: PoolChartPoint) => number | null): HistoryPoint[] =>
        chart.data.flatMap((point) => {
          const value = pick(point);
          return value === null ? [] : [{ date: point.date, value }];
        });

      const apy = series((p) => p.apy);
      if (apy.length < 2) return failure(target, chart.source, "El pool tiene menos de dos días de historial");
      const base = series((p) => p.apyBase);
      const reward = series((p) => p.apyReward);
      const tvl = series((p) => p.tvlUsd);
      const paysRewards = reward.some((p) => p.value > 0);

      const metrics: HistoryMetric[] = [
        { key: "apy", label: "APY total", unit: "pct", points: apy },
        ...(paysRewards && base.length > 1
          ? [
              { key: "base", label: "APY base", unit: "pct" as const, points: base },
              { key: "reward", label: "Recompensas", unit: "pct" as const, points: reward },
            ]
          : []),
        ...(tvl.length > 1 ? [{ key: "tvl", label: "TVL", unit: "usd" as const, points: tvl }] : []),
      ];

      const operation = pool ? OPERATION_BY_ID.get(pool.operation) : undefined;
      const notes: string[] = [];
      if (pool && operation) {
        notes.push(`${operation.label}: ${operation.description}`);
        if (pool.terms.length > 0) notes.push(`Plazos que publica la fuente: ${pool.terms.map((t) => t.label).join(" · ")}.`);
        notes.push(
          pool.risk.signals.length > 0
            ? `${RISK_LABEL[pool.risk.level]}: ${pool.risk.signals.map((s) => s.label.toLowerCase()).join("; ")}.`
            : `${RISK_LABEL.low}: ninguna regla de riesgo se activa. No reemplaza una auditoría del contrato.`
        );
        if (pool.borrow?.apyBorrow != null) {
          notes.push(
            `Pedir prestado este activo cuesta hoy ${pool.borrow.apyBorrow.toFixed(2)}% anual${
              pool.borrow.utilizationPct !== null ? ` y el mercado está usado al ${pool.borrow.utilizationPct.toFixed(0)}%` : ""
            }. El histórico de esa tasa solo está en la API de pago de DeFiLlama.`
          );
        }
      }
      notes.push("APY base: lo que genera la actividad del pool. Recompensas: incentivos pagados en tokens, que pueden bajar o terminar.");

      return {
        ok: true,
        target,
        title: pool ? `${pool.projectName} · ${pool.symbol}` : target.label,
        subtitle: pool && operation ? `${operation.label} en ${pool.chain}` : "Rendimiento y capital del pool",
        metrics,
        compare: null,
        composition: null,
        members: null,
        source: chart.source,
        sourceUrl: `https://defillama.com/yields/pool/${target.id}`,
        fetchedAt: chart.fetchedAt,
        stale: chart.stale || (universe.ok && universe.stale),
        cadence: "Diario",
        notes,
      };
    }

    case "quote": {
      if (!/^[A-Za-z0-9.^=-]{1,15}$/.test(target.id)) return failure(target, "Yahoo Finance", "Símbolo inválido");
      const result = await getYahooSeries(target.id, "5y");
      if (!result.ok) return failure(target, result.source, "Yahoo Finance no devolvió la serie");
      return simple(target, {
        title: target.label,
        subtitle: "Cierre diario · 5 años",
        metricLabel: "Cierre",
        unit: "price",
        points: result.data.map((p) => ({ date: p.date, value: p.close })),
        source: result.source,
        sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(target.id)}`,
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        cadence: "Diario",
        notes: [],
      });
    }
  }
}

/** Solo para pruebas y diagnósticos: fechas comunes de varias series. */
export { unionDates };
