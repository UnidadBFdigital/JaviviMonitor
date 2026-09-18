import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://community-api.coinmetrics.io/v4";
export const SOURCE = "Coin Metrics Community";

type RawPoint = {
  asset: string;
  time: string;
  AdrActCnt?: string | null;
  AdrBalCnt?: string | null;
  CapMVRVCur?: string | null;
  CapMrktCurUSD?: string | null;
  FeeTotNtv?: string | null;
  FlowInExUSD?: string | null;
  FlowOutExUSD?: string | null;
  HashRate?: string | null;
  PriceUSD?: string | null;
  ROI30d?: string | null;
  SplyCur?: string | null;
  SplyExNtv?: string | null;
  TxCnt?: string | null;
  /** Coin Metrics adjunta `<metrica>-status`: "flash" marca un valor
   *  preliminar que la fuente puede revisar en las horas siguientes. */
  [statusKey: string]: string | null | undefined;
};

/** Métricas que llegan como estimación preliminar en el último cierre. */
const REVISABLE = ["FlowInExUSD", "FlowOutExUSD", "SplyExNtv"] as const;

export type NetworkActivityPoint = {
  date: string;
  asset: "BTC" | "ETH";
  activeAddresses: number | null;
  transactions: number | null;
};

export type BitcoinOnchainPoint = {
  date: string;
  priceUsd: number | null;
  mvrv: number | null;
  marketCapUsd: number | null;
  realizedCapUsd: number | null;
  realizedPriceUsd: number | null;
  unrealizedGainUsd: number | null;
  supplyBtc: number | null;
  exchangeSupplyBtc: number | null;
  exchangeSupplyPct: number | null;
  exchangeInflowUsd: number | null;
  exchangeOutflowUsd: number | null;
  netExchangeFlowUsd: number | null;
  addressesWithBalance: number | null;
  activeAddresses: number | null;
  transactions: number | null;
  hashRateEh: number | null;
  feesBtc: number | null;
  roi30dPct: number | null;
};

export type BitcoinOnchainData = {
  asOf: string;
  snapshot: BitcoinOnchainPoint;
  history: BitcoinOnchainPoint[];
  signals: {
    profitableDaysPct: number | null;
    mvrv30dChange: number | null;
    addressBalance30dChangePct: number | null;
    exchangeSupply7dChangeBtc: number | null;
    exchangeSupply30dChangeBtc: number | null;
    netExchangeFlow7dUsd: number | null;
  };
  /** Métricas del cierre marcadas "flash" por Coin Metrics: preliminares. */
  preliminary: string[];
};

function numberOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBitcoinPoint(point: RawPoint): BitcoinOnchainPoint {
  const priceUsd = numberOrNull(point.PriceUSD);
  const mvrv = numberOrNull(point.CapMVRVCur);
  const marketCapUsd = numberOrNull(point.CapMrktCurUSD);
  const supplyBtc = numberOrNull(point.SplyCur);
  const exchangeSupplyBtc = numberOrNull(point.SplyExNtv);
  const exchangeInflowUsd = numberOrNull(point.FlowInExUSD);
  const exchangeOutflowUsd = numberOrNull(point.FlowOutExUSD);
  const realizedCapUsd = marketCapUsd !== null && mvrv !== null && mvrv > 0
    ? marketCapUsd / mvrv
    : null;
  const realizedPriceUsd = realizedCapUsd !== null && supplyBtc !== null && supplyBtc > 0
    ? realizedCapUsd / supplyBtc
    : null;

  return {
    date: point.time.slice(0, 10),
    priceUsd,
    mvrv,
    marketCapUsd,
    realizedCapUsd,
    realizedPriceUsd,
    unrealizedGainUsd: marketCapUsd !== null && realizedCapUsd !== null
      ? marketCapUsd - realizedCapUsd
      : null,
    supplyBtc,
    exchangeSupplyBtc,
    exchangeSupplyPct: exchangeSupplyBtc !== null && supplyBtc !== null && supplyBtc > 0
      ? (exchangeSupplyBtc / supplyBtc) * 100
      : null,
    exchangeInflowUsd,
    exchangeOutflowUsd,
    netExchangeFlowUsd: exchangeInflowUsd !== null && exchangeOutflowUsd !== null
      ? exchangeInflowUsd - exchangeOutflowUsd
      : null,
    addressesWithBalance: numberOrNull(point.AdrBalCnt),
    activeAddresses: numberOrNull(point.AdrActCnt),
    transactions: numberOrNull(point.TxCnt),
    hashRateEh: point.HashRate === null || point.HashRate === undefined
      ? null
      : numberOrNull(point.HashRate) === null
        ? null
        : (numberOrNull(point.HashRate) as number) / 1_000_000,
    feesBtc: numberOrNull(point.FeeTotNtv),
    roi30dPct: numberOrNull(point.ROI30d),
  };
}

function delta(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null ? current - previous : null;
}

function changePct(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null && previous !== 0
    ? ((current / previous) - 1) * 100
    : null;
}

export async function getBitcoinOnchainData(days = 365): Promise<SourceResult<BitcoinOnchainData>> {
  const safeDays = Math.min(730, Math.max(90, Math.round(days)));
  try {
    const { data, fetchedAt, stale } = await cached(
      `coinmetrics:bitcoin-intelligence:${safeDays}`,
      async () => {
        const url = new URL(`${BASE}/timeseries/asset-metrics`);
        url.searchParams.set("assets", "btc");
        url.searchParams.set(
          "metrics",
          [
            "PriceUSD",
            "CapMVRVCur",
            "CapMrktCurUSD",
            "SplyCur",
            "AdrBalCnt",
            "AdrActCnt",
            "TxCnt",
            "FlowInExUSD",
            "FlowOutExUSD",
            "SplyExNtv",
            "HashRate",
            "FeeTotNtv",
            "ROI30d",
          ].join(",")
        );
        url.searchParams.set("frequency", "1d");
        url.searchParams.set("limit_per_asset", String(safeDays + 3));
        url.searchParams.set("paging_from", "end");
        url.searchParams.set("page_size", String(safeDays + 3));
        const response = await fetch(url, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`${SOURCE} asset-metrics -> HTTP ${response.status}`);
        const json = (await response.json()) as { data?: RawPoint[] };
        return json.data ?? [];
      },
      60 * 60 * 1000
    );

    const history = data
      .filter((point) => point.asset === "btc")
      .map(toBitcoinPoint)
      .filter((point) => point.priceUsd !== null || point.mvrv !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const snapshotIndex = history.findLastIndex((point) => point.mvrv !== null && point.marketCapUsd !== null);
    if (snapshotIndex < 0) throw new Error(`${SOURCE}: no complete BTC snapshot`);
    const snapshot = history[snapshotIndex];
    const previous7 = history[Math.max(0, snapshotIndex - 7)] ?? null;
    const previous30 = history[Math.max(0, snapshotIndex - 30)] ?? null;
    const last7 = history.slice(Math.max(0, snapshotIndex - 6), snapshotIndex + 1);
    // El punto crudo del cierre trae `<metrica>-status`; "flash" avisa que el
    // valor es preliminar. Se propaga para poder decirlo en pantalla en vez de
    // presentar una estimación revisable como dato cerrado.
    const rawSnapshot = data.find((point) => point.asset === "btc" && point.time.slice(0, 10) === snapshot.date);
    const preliminary = REVISABLE.filter((metric) => rawSnapshot?.[`${metric}-status`] === "flash");
    const comparablePrices = history
      .slice(Math.max(0, snapshotIndex - 364), snapshotIndex + 1)
      .map((point) => point.priceUsd)
      .filter((price): price is number => price !== null);

    return {
      ok: true,
      data: {
        asOf: snapshot.date,
        snapshot,
        history: history.slice(Math.max(0, snapshotIndex - safeDays + 1), snapshotIndex + 1),
        signals: {
          profitableDaysPct: snapshot.priceUsd !== null && comparablePrices.length > 0
            ? (comparablePrices.filter((price) => price < snapshot.priceUsd!).length / comparablePrices.length) * 100
            : null,
          mvrv30dChange: delta(snapshot.mvrv, previous30?.mvrv ?? null),
          addressBalance30dChangePct: changePct(
            snapshot.addressesWithBalance,
            previous30?.addressesWithBalance ?? null
          ),
          exchangeSupply7dChangeBtc: delta(
            snapshot.exchangeSupplyBtc,
            previous7?.exchangeSupplyBtc ?? null
          ),
          exchangeSupply30dChangeBtc: delta(
            snapshot.exchangeSupplyBtc,
            previous30?.exchangeSupplyBtc ?? null
          ),
          netExchangeFlow7dUsd: last7.every((point) => point.netExchangeFlowUsd !== null)
            ? last7.reduce((sum, point) => sum + (point.netExchangeFlowUsd ?? 0), 0)
            : null,
        },
        preliminary,
      },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}

export async function getNetworkActivity(days = 30): Promise<SourceResult<NetworkActivityPoint[]>> {
  const safeDays = Math.min(90, Math.max(7, Math.round(days)));
  try {
    const { data, fetchedAt, stale } = await cached(
      `coinmetrics:network-activity:${safeDays}`,
      async () => {
        const url = new URL(`${BASE}/timeseries/asset-metrics`);
        url.searchParams.set("assets", "btc,eth");
        url.searchParams.set("metrics", "AdrActCnt,TxCnt");
        url.searchParams.set("frequency", "1d");
        url.searchParams.set("limit_per_asset", String(safeDays));
        url.searchParams.set("paging_from", "end");
        url.searchParams.set("page_size", String(safeDays * 2));
        const response = await fetch(url, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`${SOURCE} asset-metrics → HTTP ${response.status}`);
        const json = (await response.json()) as { data?: RawPoint[] };
        return json.data ?? [];
      },
      60 * 60 * 1000
    );

    const points = data.flatMap((point): NetworkActivityPoint[] => {
      if (point.asset !== "btc" && point.asset !== "eth") return [];
      return [{
        date: point.time.slice(0, 10),
        asset: point.asset.toUpperCase() as "BTC" | "ETH",
        activeAddresses: point.AdrActCnt === null || point.AdrActCnt === undefined
          ? null
          : Number(point.AdrActCnt),
        transactions: point.TxCnt === null || point.TxCnt === undefined
          ? null
          : Number(point.TxCnt),
      }];
    });
    return { ok: true, data: points, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}
