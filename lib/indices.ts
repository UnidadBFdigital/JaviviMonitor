import type { Stablecoin, SupplyPoint } from "@/lib/sources/stablecoins";
import type { TvlPoint, ChainTvl, DexOverview } from "@/lib/sources/defillama";
import type { FearGreed } from "@/lib/sources/feargreed";
import type { GlobalMarket } from "@/lib/sources/coingecko";
import type { Quote } from "@/lib/sources/yahoo";
import type { ScoredNetwork } from "@/lib/bbi";

// Índices propietarios de Blockfinity.
//
// Arquitectura de registro: cada índice se declara en REGISTRY con su propia
// función de cálculo. Agregar uno nuevo es empujar un objeto al array — no
// toca ninguno de los existentes, que es exactamente el requisito.
//
// Regla firme: el sparkline solo se muestra cuando existe serie histórica
// real. Un índice compuesto sin historia declara `noHistory` en vez de
// dibujar una línea inventada.

export type IndexFamily = "Tokenización" | "Stablecoins" | "Institucional" | "Riesgo";

export type IndexContext = {
  stableHistory: SupplyPoint[] | null;
  stables: Stablecoin[] | null;
  /** total canónico del mercado de stablecoins (no la suma de los top N) */
  stablecoinTotalUsd: number | null;
  tvlHistory: TvlPoint[] | null;
  rwaTotalUsd: number | null;
  rwaProtocolCount: number | null;
  rwaTreasuriesUsd: number | null;
  fearGreed: FearGreed | null;
  global: GlobalMarket | null;
  chains: ChainTvl[] | null;
  networks: ScoredNetwork[] | null;
  etfs: Quote[] | null;
  dex: DexOverview | null;
};

export type IndexResult = {
  code: string;
  name: string;
  family: IndexFamily;
  /** cómo leer el número: base 100, escala 0-100 o dólares */
  unit: "base100" | "score" | "usd";
  value: number | null;
  changePct: number | null;
  changeLabel: string | null;
  spark: number[] | null;
  /** motivo por el que no hay serie histórica, cuando corresponde */
  noHistory: string | null;
  methodology: string;
  inputs: string[];
  /** true = el valor sube cuando la situación mejora */
  higherIsBetter: boolean;
  /** variaciones a 1, 7 y 30 pasos de la serie; null donde no hay serie */
  changes: { d1: number | null; d7: number | null; d30: number | null };
  /** lectura derivada por regla, no por opinión — ver `signalOf` */
  signal: { label: string; tone: "good" | "bad" | "flat" | "none" };
};

type IndexDef = Omit<
  IndexResult,
  "value" | "changePct" | "spark" | "changeLabel" | "noHistory" | "changes" | "signal"
> & {
  compute: (ctx: IndexContext) => {
    value: number | null;
    changePct: number | null;
    changeLabel: string | null;
    spark: number[] | null;
    noHistory: string | null;
  };
};

/** Serie indexada a base 100 sobre el primer punto disponible. */
function toBase100(series: number[]): number[] {
  const base = series.find((v) => v > 0);
  if (!base) return [];
  return series.map((v) => (v / base) * 100);
}

function pctChange(now: number, prev: number): number | null {
  return prev > 0 ? ((now - prev) / prev) * 100 : null;
}

/** Recorta a 0-100 y redondea a un decimal. */
function clamp100(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}

const REGISTRY: IndexDef[] = [
  {
    code: "BSI",
    name: "Blockfinity Stablecoin Index",
    family: "Stablecoins",
    unit: "base100",
    higherIsBetter: true,
    methodology:
      "Market cap oficial de stablecoins indexado a base 100 sobre el primer día de la serie de 365 días. Excluye activos marcados como doublecounted y mide la expansión o contracción del dólar digital on-chain.",
    inputs: ["DeFiLlama Stablecoins Dashboard — market cap oficial 365d"],
    compute: (ctx) => {
      if (!ctx.stableHistory || ctx.stableHistory.length < 8) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      const serie = ctx.stableHistory.map((p) => p.totalUsd);
      const base = toBase100(serie);
      const value = base[base.length - 1] ?? null;
      const prev = serie[serie.length - 8];
      return {
        value,
        changePct: prev ? pctChange(serie[serie.length - 1], prev) : null,
        changeLabel: "7d",
        spark: base.slice(-90),
        noHistory: null,
      };
    },
  },
  {
    code: "RWAI",
    name: "RWA Protocol TVL Index",
    family: "Tokenización",
    unit: "usd",
    higherIsBetter: true,
    methodology:
      "TVL agregado de los protocolos clasificados como RWA y RWA Lending en /protocols de DeFiLlama. No representa la capitalización de los activos RWA del dashboard oficial.",
    inputs: ["DeFiLlama /protocols — TVL de RWA y RWA Lending"],
    compute: (ctx) => {
      if (ctx.rwaTotalUsd === null) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      return {
        value: ctx.rwaTotalUsd,
        changePct: null,
        changeLabel: null,
        spark: null,
        noHistory:
          "DeFiLlama no expone serie histórica por categoría. La serie propia empieza a construirse cuando se persistan snapshots diarios.",
      };
    },
  },
  {
    code: "TAI",
    name: "Tokenization Protocol Activity Index",
    family: "Tokenización",
    unit: "score",
    higherIsBetter: true,
    methodology:
      "Escala 0-100 de actividad en protocolos: peso del TVL de protocolos RWA sobre el TVL DeFi (50%), amplitud medida en protocolos activos (30%) y participación de treasuries dentro de ese TVL (20%). No mide el market cap total de activos tokenizados.",
    inputs: ["DeFiLlama /protocols — RWA", "DeFiLlama — TVL total"],
    compute: (ctx) => {
      const tvlTotal = ctx.tvlHistory?.[ctx.tvlHistory.length - 1]?.tvlUsd ?? null;
      if (ctx.rwaTotalUsd === null || tvlTotal === null || ctx.rwaProtocolCount === null) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      // Umbrales de saturación: el RWA ya pesa ~32% del TVL de DeFi y hay ~150
      // protocolos, así que topes bajos dejarían el índice clavado en 100 y sin
      // capacidad de discriminar. Se calibran contra escenarios de adopción
      // plena, no contra el estado actual.
      // peso del RWA sobre DeFi: la mitad del TVL sería adopción total
      const peso = Math.min((ctx.rwaTotalUsd / tvlTotal / 0.5) * 100, 100);
      // amplitud: 400 protocolos activos satura
      const amplitud = Math.min((ctx.rwaProtocolCount / 400) * 100, 100);
      // treasuries sobre RWA: 80% satura
      const treas =
        ctx.rwaTreasuriesUsd !== null && ctx.rwaTotalUsd > 0
          ? Math.min((ctx.rwaTreasuriesUsd / ctx.rwaTotalUsd / 0.8) * 100, 100)
          : 0;
      return {
        value: clamp100(peso * 0.5 + amplitud * 0.3 + treas * 0.2),
        changePct: null,
        changeLabel: null,
        spark: null,
        noHistory: "Índice compuesto sin serie histórica: sus insumos solo se publican en vivo.",
      };
    },
  },
  {
    code: "CBI",
    name: "Crypto Banking Index",
    family: "Institucional",
    unit: "score",
    higherIsBetter: true,
    methodology:
      "Media editorial de encaje institucional ponderada por TVL, expresada en 0-100. El TVL es capital depositado, no volumen transaccional. Este índice no determina autorización regulatoria ni qué parte de las transacciones puede usar una institución.",
    inputs: ["Blockfinity BBIM — score institucional por red", "DeFiLlama — TVL por red"],
    compute: (ctx) => {
      if (!ctx.networks) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      const conTvl = ctx.networks.filter((n) => n.tvlUsd !== null && n.tvlUsd > 0);
      const total = conTvl.reduce((s, n) => s + (n.tvlUsd ?? 0), 0);
      if (total <= 0) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      const ponderado = conTvl.reduce(
        (s, n) => s + n.scores.institucional * ((n.tvlUsd ?? 0) / total),
        0
      );
      return {
        value: clamp100(ponderado * 10),
        changePct: null,
        changeLabel: null,
        spark: null,
        noHistory: "Índice compuesto sin serie histórica: depende de scores editoriales con corte mensual.",
      };
    },
  },
  {
    code: "CPI",
    name: "Cross-border Payments Index",
    family: "Institucional",
    unit: "score",
    higherIsBetter: true,
    methodology:
      "Escala 0-100 sobre la capacidad instalada de pago transfronterizo con activos digitales: TVL agregado de las redes orientadas a pagos —Stellar, XRP Ledger y Tron— (40%), market cap de stablecoins como medio de liquidación (40%) y volumen DEX como proxy de conversión (20%).",
    inputs: ["DeFiLlama — TVL por red", "DeFiLlama Stablecoins", "DeFiLlama — volumen DEX"],
    compute: (ctx) => {
      if (!ctx.networks || ctx.stablecoinTotalUsd === null) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      const pagos = ctx.networks
        .filter((n) => n.group === "Infraestructura de pagos")
        .reduce((s, n) => s + (n.tvlUsd ?? 0), 0);
      // $10B de TVL en redes de pago satura el subíndice
      const redes = Math.min((pagos / 10e9) * 100, 100);
      const supply = ctx.stablecoinTotalUsd;
      // $300B de market cap satura
      const liquidacion = Math.min((supply / 300e9) * 100, 100);
      const dex = ctx.dex ? Math.min((ctx.dex.total24hUsd / 15e9) * 100, 100) : 0;
      return {
        value: clamp100(redes * 0.4 + liquidacion * 0.4 + dex * 0.2),
        changePct: null,
        changeLabel: null,
        spark: null,
        noHistory: "Índice compuesto sin serie histórica: sus insumos solo se publican en vivo.",
      };
    },
  },
  {
    code: "CMI",
    name: "Capital Markets Index",
    family: "Institucional",
    unit: "base100",
    higherIsBetter: true,
    methodology:
      "Canasta equiponderada de los ETF de bitcoin y ether al contado, indexada a base 100 sobre el primer día de la ventana de 3 meses. Mide el desempeño del canal por el que el capital institucional toma exposición sin custodiar cripto.",
    inputs: ["Yahoo Finance — IBIT, FBTC, ARKB, BITB, GBTC, ETHA"],
    compute: (ctx) => {
      if (!ctx.etfs || ctx.etfs.length === 0) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      const conSerie = ctx.etfs.filter((q) => q.spark.length >= 10);
      if (conSerie.length === 0) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      const largo = Math.min(...conSerie.map((q) => q.spark.length));
      // se normaliza cada ETF a base 100 y se promedia, para que no domine el de mayor precio
      const canasta: number[] = [];
      for (let i = 0; i < largo; i++) {
        let suma = 0;
        for (const q of conSerie) {
          const serie = q.spark.slice(-largo);
          suma += (serie[i] / serie[0]) * 100;
        }
        canasta.push(suma / conSerie.length);
      }
      const value = canasta[canasta.length - 1];
      const prev = canasta[Math.max(0, canasta.length - 6)];
      return {
        value,
        changePct: pctChange(value, prev),
        changeLabel: "5 sesiones",
        spark: canasta,
        noHistory: null,
      };
    },
  },
  {
    code: "MRI",
    name: "Market Risk Index",
    family: "Riesgo",
    unit: "score",
    higherIsBetter: false,
    methodology:
      "Escala 0-100 donde más alto es peor. Combina sentimiento extremo medido con Fear & Greed (50%) —tanto la codicia como el miedo extremos elevan el riesgo— y caída del TVL de DeFi desde su máximo de 90 días (50%). No predice: describe condiciones.",
    inputs: ["Alternative.me — Fear & Greed", "DeFiLlama — TVL total 90d"],
    compute: (ctx) => {
      if (!ctx.fearGreed) {
        return { value: null, changePct: null, changeLabel: null, spark: null, noHistory: null };
      }
      // distancia al centro: 50 es neutro, los extremos suman riesgo
      const extremo = (v: number) => (Math.abs(v - 50) / 50) * 100;
      const sentimiento = extremo(ctx.fearGreed.value);

      let drawdown = 0;
      if (ctx.tvlHistory && ctx.tvlHistory.length > 10) {
        const serie = ctx.tvlHistory.slice(-90).map((p) => p.tvlUsd);
        const pico = Math.max(...serie);
        const hoy = serie[serie.length - 1];
        // una caída del 30% desde el pico satura el subíndice
        drawdown = pico > 0 ? Math.min(((pico - hoy) / pico / 0.3) * 100, 100) : 0;
      }

      const value = clamp100(sentimiento * 0.5 + drawdown * 0.5);
      const histSpark = ctx.fearGreed.history?.length
        ? ctx.fearGreed.history.map((h) => clamp100(extremo(h.value) * 0.5 + drawdown * 0.5))
        : null;

      return {
        value,
        changePct: null,
        changeLabel: null,
        spark: histSpark,
        noHistory: histSpark
          ? null
          : "Sin serie de sentimiento disponible para reconstruir el índice.",
      };
    },
  },
];

/** Variación entre el último punto de la serie y el de `back` pasos atrás. */
function changeOverSeries(spark: number[] | null, back: number): number | null {
  if (!spark || spark.length <= back) return null;
  const now = spark[spark.length - 1];
  const prev = spark[spark.length - 1 - back];
  if (!prev) return null;
  return ((now - prev) / prev) * 100;
}

/**
 * Señal del índice, derivada por regla explícita — nunca por criterio suelto.
 * Con serie: manda el signo de la variación a 30 pasos, leído contra la
 * dirección deseada del índice. Sin serie: se describe el nivel, que es lo
 * único observable, y se dice que es nivel y no tendencia.
 */
function signalOf(
  d30: number | null,
  value: number | null,
  unit: IndexResult["unit"],
  higherIsBetter: boolean
): IndexResult["signal"] {
  if (d30 !== null) {
    if (Math.abs(d30) < 1) return { label: "Estable", tone: "flat" };
    const favorable = d30 >= 0 === higherIsBetter;
    return favorable
      ? { label: "Favorable", tone: "good" }
      : { label: "Adverso", tone: "bad" };
  }
  if (value === null) return { label: "Sin dato", tone: "none" };
  if (unit !== "score") return { label: "Nivel", tone: "none" };
  const alto = value >= 66;
  const bajo = value < 33;
  const buenoAlto = higherIsBetter;
  if (alto) return { label: "Nivel alto", tone: buenoAlto ? "good" : "bad" };
  if (bajo) return { label: "Nivel bajo", tone: buenoAlto ? "bad" : "good" };
  return { label: "Nivel medio", tone: "flat" };
}

export function computeIndices(ctx: IndexContext): IndexResult[] {
  return REGISTRY.map((def) => {
    const { compute, ...meta } = def;
    const r = compute(ctx);
    const changes = {
      d1: changeOverSeries(r.spark, 1),
      d7: changeOverSeries(r.spark, 7),
      d30: changeOverSeries(r.spark, 30),
    };
    return {
      ...meta,
      ...r,
      changes,
      signal: signalOf(changes.d30, r.value, meta.unit, meta.higherIsBetter),
    };
  });
}

export const INDEX_FAMILIES: IndexFamily[] = [
  "Tokenización",
  "Stablecoins",
  "Institucional",
  "Riesgo",
];
