"use client";

import Image from "next/image";
import { BuildCostReport } from "./BuildCostReport";
import { YieldsReport } from "./YieldsReport";
import { ReportFig as Fig, ReportSection as Section, ReportTable as Table } from "./ReportParts";
import type { YieldsReportPayload } from "@/lib/yieldsPayload";
import type { NetworksPayload } from "@/components/networks/useNetworkIntel";
import blockfinityLogo from "@/logoblockfinity.png";
import { usePayload } from "@/lib/useSource";
import { formatPct, formatUsdCompact } from "@/lib/format";
import type { ReportPayload, ReportSource } from "@/lib/report";
import type { IndexResult } from "@/lib/indices";
import { ACTIVITY_METRICS, BBI_VERSION } from "@/lib/bbiMethodology";
import {
  AreaSeries,
  BarRows,
  CadenceStrip,
  CATEGORICAL,
  Chart,
  Columns,
  CoverageBar,
  DivergingBars,
  Donut,
  DualSeries,
  Gauge,
  GOLD,
  LayerDiagram,
  Legend,
  MiniSpark,
  NEUTRAL,
  Pipeline,
  Quadrant,
  Radar,
  ScoreMatrix,
  StackedShare,
  STATUS,
  Treemap,
  W_FULL,
  W_HALF,
  W_THIRD,
} from "./ReportCharts";

// Blockchain Landscape Report — el entregable del BBIM (§3, Fase 4 del
// documento del proyecto). Imprime la foto del ecosistema en el momento en
// que se genera, con la trazabilidad adentro: cada bloque lleva su fuente y
// su hora de consulta, porque el PDF circula fuera del terminal.
//
// El documento se lee en gráficos. Las tablas quedaron solo donde la fila
// importa (mayores pérdidas, trazabilidad de fuentes): para todo lo demás
// una tabla de doce filas obliga al lector a construir en la cabeza la
// comparación que el gráfico ya le entrega hecha. Cada gráfico lleva el
// valor rotulado sobre la marca, porque en papel no hay tooltip.
//
// El PDF sale del diálogo de impresión del navegador. Es deliberado: no
// agrega dependencias, imprime exactamente lo que se ve y respeta el sistema
// visual del terminal en vez de reconstruirlo en un motor aparte.

type Insights = {
  hallazgos: string[];
  riesgos: string[];
  oportunidades: string[];
  pregunta: string;
  method: string;
};

type IndicesResponse = { indices: IndexResult[]; fetchedAt: string };

const num = new Intl.NumberFormat("es-BO");
const compactNum = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 });
const usdFull = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function usd(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : formatUsdCompact(value);
}

function count(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : num.format(value);
}

function compact(value: number): string {
  return compactNum.format(value);
}

function decimals(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? "—" : value.toFixed(digits);
}

function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-09-04" → "04/09". Los ejes del informe no llevan el año: la portada
 *  ya dice cuándo se generó y repetirlo en cada marca es ruido. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/** "2026-09" → "09/26" */
function shortMonth(label: string): string {
  const [year, month] = label.split("-");
  return `${month}/${year.slice(2)}`;
}

/** Variación con signo y color. El color nunca va solo: siempre lleva signo. */
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="bf-rp-muted">—</span>;
  const cls = value > 0 ? "bf-rp-up" : value < 0 ? "bf-rp-down" : "bf-rp-muted";
  return <span className={cls}>{formatPct(value)}</span>;
}

function Signals({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <ol className="bf-rp-list">
        {items.map((item) => (
          <li key={item}>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

// Capas y frecuencias son del documento del proyecto (§4), no invención del
// informe: se imprimen para que el lector externo sepa bajo qué método se
// levantó cada cifra. Van de la 4 a la 1 porque el esquema es una pirámide:
// la arquitectura es la base que sostiene todo lo demás.
const LAYERS = [
  {
    code: "04",
    name: "Adopción institucional",
    indicators: "Tokenización, stablecoins, uso por bancos y gobiernos, CBDC",
    cadence: "Mensual",
  },
  {
    code: "03",
    name: "Ecosistema",
    indicators: "Protocolos activos, categorías, concentración de TVL",
    cadence: "Trimestral",
  },
  {
    code: "02",
    name: "Actividad económica",
    indicators: "Volumen transaccional, TVL, direcciones activas, fees",
    cadence: "Semanal",
  },
  {
    code: "01",
    name: "Arquitectura tecnológica",
    indicators: "Consenso, validadores, descentralización, historial de ataques",
    cadence: "Anual",
  },
];

const TOC: [string, string][] = [
  ["00", "Resumen ejecutivo"],
  ["01", "Landscape del capital"],
  ["02", "Ranking comparativo BBI"],
  ["03", "Actividad de red"],
  ["04", "Adopción institucional"],
  ["05", "Superficie de riesgo"],
  ["06", "Índices propietarios"],
  ["07", "Builder Radar: dónde construir"],
  ["08", "Builder Radar: desarrollo y arquitectura"],
  ["09", "Builder Radar: qué red para qué proyecto"],
  ["10", "DeFi Yields: dónde rinde el capital"],
  ["11", "Metodología y fuentes"],
];

const WEIGHT_LABELS: Record<string, string> = {
  seguridad: "Seguridad",
  adopcion: "Adopción",
  actividadEconomica: "Actividad económica",
  escalabilidad: "Escalabilidad",
  ecosistema: "Ecosistema",
  institucional: "Institucional",
  compliance: "Cumplimiento y monitoreo",
};

const SCORE_COLS = ["Seg.", "Adop.", "Escal.", "Ecos.", "Inst.", "Compl.", "Act. ec."];
const RADAR_AXES = ["Seg", "Adop", "Escal", "Ecos", "Inst", "Compl", "Act"];

// Zonas del Fear & Greed: divergente rojo → gris → verde. Es polaridad, no
// identidad, así que van los tokens de estado y no la paleta categórica.
const FNG_ZONES = [
  { to: 25, color: STATUS.down, name: "Miedo extremo" },
  { to: 45, color: STATUS.warn, name: "Miedo" },
  { to: 55, color: NEUTRAL, name: "Neutral" },
  { to: 75, color: "#4fb286", name: "Codicia" },
  { to: 100, color: STATUS.up, name: "Codicia extrema" },
];

// Orden de progreso de un proyecto CBDC. El tracker los devuelve por conteo;
// acá se reordenan porque la lectura útil es el avance, no el ranking.
const CBDC_ORDER = ["Investigación", "Desarrollo", "Piloto", "Lanzado", "Descartado"];

export function ReportDocument() {
  const report = usePayload<ReportPayload>("/api/report");
  const insights = usePayload<Insights>("/api/insights");
  const indices = usePayload<IndicesResponse>("/api/indices");
  const build = usePayload<NetworksPayload>("/api/networks");
  const yields = usePayload<YieldsReportPayload>("/api/yields/report");
  const pending = (!build.data && !build.error) || (!indices.data && !indices.error) || (!insights.data && !insights.error) || (!yields.data && !yields.error);

  if (report.error) {
    return (
      <p className="rounded-lg border border-line bg-card p-6 text-sm text-ink-muted">
        No se pudo armar el informe: el endpoint de datos no respondió.
      </p>
    );
  }

  if (!report.data) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-lg bg-ice/50" />
        <div className="h-[70vh] animate-pulse rounded-lg bg-ice/50" />
      </div>
    );
  }

  const d = report.data;
  // /api/report y /api/networks comparten bloques (TVL por red, protocolos RWA):
  // se listan una sola vez, identificados por bloque y fuente
  const yieldsBlock = "Rendimientos DeFi (pools, APY y tasas de préstamo)";
  const yieldsSources: ReportSource[] = yields.data?.ok
    ? [{ block: yieldsBlock, source: yields.data.source, fetchedAt: yields.data.fetchedAt, ok: true, stale: yields.data.stale }]
    : yields.data || yields.error
      ? [{ block: yieldsBlock, source: "DeFiLlama Yields", fetchedAt: null, ok: false, stale: false }]
      : [];
  const reportSources: ReportSource[] = [...d.sources, ...(build.data?.sources ?? []), ...yieldsSources].filter(
    (source, index, all) => all.findIndex((o) => o.block === source.block && o.source === source.source) === index
  );
  const okSources = reportSources.filter((s) => s.ok).length;
  const staleSources = reportSources.filter((s) => s.ok && s.stale).length;
  const liveSources = okSources - staleSources;
  const failedSources = reportSources.length - okSources;
  const scoredWithTvl = d.networks.filter((n) => n.tvlUsd !== null).length;
  const weights = Object.entries(d.weights) as [keyof typeof d.weights, number][];

  // --- derivados de presentación (ningún cálculo de negocio vive acá) ---
  const tvlSpark = d.defi.tvlSeries.map((p) => p.tvlUsd);
  const stableSpark = d.stablecoins.supplySeries.map((p) => p.totalUsd);

  const chainBars = d.chains.slice(0, 10).map((c) => ({
    label: c.name,
    value: c.tvlUsd,
    sub: `${c.sharePct.toFixed(1)}%`,
  }));

  const concentration = d.chainConcentration;
  const restPct = concentration ? Math.max(0, 100 - concentration.top5Pct) : 0;
  const concentrationSlices = concentration
    ? [
        { label: d.chains[0]?.name ?? "Red líder", value: concentration.top1Pct, color: CATEGORICAL[0] },
        {
          label: "Redes 2 a 5",
          value: Math.max(0, concentration.top5Pct - concentration.top1Pct),
          color: CATEGORICAL[1],
        },
        { label: `Otras ${Math.max(0, concentration.total - 5)}`, value: restPct, color: NEUTRAL },
      ]
    : [];

  const categoryNodes = d.defi.categoryMix.map((c, i) => ({
    label: c.category,
    value: c.tvlUsd,
    color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
  }));
  const categoryTotal = d.defi.categoryMix.reduce((s, c) => s + c.tvlUsd, 0);

  const weightSlices = weights.map(([key, value], i) => ({
    label: WEIGHT_LABELS[key] ?? key,
    value,
    color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
  }));

  const radarNetworks = d.networks.filter((n) => !n.bbiPartial).slice(0, 3);
  const footprint = d.networks
    .filter((n) => n.stablecoinSupplyUsd !== null)
    .sort((a, b) => (b.stablecoinSupplyUsd ?? 0) - (a.stablecoinSupplyUsd ?? 0))
    .slice(0, 8);

  const btcPoints = d.activity.btcSeries;
  const ethSeries = d.activity.ethSeries;
  // Coin Metrics deja huecos en el cierre más reciente. Un null no es un cero:
  // mapearlo a cero dibujaría un desplome que no ocurrió.
  const ethTx = ethSeries.filter((p) => p.transactions !== null);
  const ethAddr = ethSeries.filter((p) => p.activeAddresses !== null);

  const sectorNodes = d.tokenization.topSectors.map((s, i) => ({
    label: s.name,
    value: s.tvlUsd,
    color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
  }));

  const issuerSlices = d.stablecoins.topIssuers.slice(0, 5).map((s, i) => ({
    label: s.symbol,
    value: s.circulatingUsd,
    color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
  }));

  const stableChainSlices = d.stablecoins.topChains.map((c, i) => ({
    label: c.chain,
    value: c.circulatingUsd,
    color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
  }));

  const cbdcStages = [...d.cbdc.byStatus]
    .filter((s) => s.status !== "Descartado")
    .sort((a, b) => CBDC_ORDER.indexOf(a.status) - CBDC_ORDER.indexOf(b.status))
    .map((s) => ({
      name: s.status,
      count: s.count,
      detail: `${((s.count / d.cbdc.total) * 100).toFixed(0)}% del tracker`,
    }));
  const discarded = d.cbdc.byStatus.find((s) => s.status === "Descartado");

  return (
    <>
      <div className="bf-rp-bar bf-noprint">
        <button
          onClick={() => window.print()}
          disabled={pending}
          aria-busy={pending}
          className="rounded border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold-bright transition-colors hover:bg-gold/20"
        >
          {pending ? "Preparando informe completo…" : "Descargar PDF"}
        </button>
        <span className="text-[11px] text-ink-secondary">A4 · Fondo blanco</span>
        <p className="max-w-xl text-[11px] leading-relaxed text-ink-muted">
          Elegí <strong className="text-ink-secondary">Guardar como PDF</strong>, tamaño A4 y escala 100%.
          Desactivá los encabezados y pies del navegador para conservar el formato del informe.
        </p>
      </div>

      <article className="bf-rp" aria-label="Blockchain Landscape Report">
        {/* ── Portada ───────────────────────────────────────────── */}
        <header className="bf-rp-mast">
          <div className="bf-rp-brand">
            <Image src={blockfinityLogo} alt="Blockfinity" className="bf-rp-logo" priority unoptimized />
            <span>Research & Intelligence<br />Blockfinity Advisors</span>
          </div>
          <p className="bf-rp-eyebrow">Blockchain Intelligence Monitor · Informe de investigación</p>
          <h1>
            Blockchain <em>Landscape Report</em>
          </h1>
          <p className="bf-rp-thesis">
            Estado del ecosistema en el instante en que se generó este documento: concentración de
            infraestructura, actividad económica observable, adopción institucional y superficie de
            riesgo. Combina métricas públicas, evaluaciones editoriales y escenarios operativos con sus métodos y fechas de consulta.
          </p>
          <dl className="bf-rp-meta">
            <div>
              <dt>Generado</dt>
              <dd>{stamp(d.generatedAt)}</dd>
            </div>
            <div>
              <dt>Redes evaluadas</dt>
              <dd>
                {d.networks.length} · {scoredWithTvl} con TVL
              </dd>
            </div>
            <div>
              <dt>Cadenas con TVL</dt>
              <dd>{count(d.chainConcentration?.total)}</dd>
            </div>
            <div>
              <dt>Fuentes</dt>
              <dd>
                {okSources}/{reportSources.length}
              </dd>
            </div>
          </dl>
          <p className="bf-rp-contents-label">Contenido del informe</p>
          <nav className="bf-rp-toc" aria-label="Contenido del informe">
            {TOC.map(([code, title]) => (
              <a key={code} href={`#informe-${code}`}>
                <b>{code}</b>
                <span>{title}</span>
              </a>
            ))}
          </nav>
          <p className="bf-rp-cover-note">Panorama del ecosistema blockchain · Datos, análisis y trazabilidad de fuentes</p>
        </header>

        {/* ── 00 Resumen ejecutivo ──────────────────────────────── */}
        <Section
          code="00"
          layer="Síntesis"
          title="Resumen ejecutivo"
          lead="Las ocho cifras que definen la sesión, el pulso del capital en los últimos 30 días y las señales derivadas por reglas deterministas sobre los mismos datos."
        >
          <div className="bf-rp-figs">
            <Fig
              value={usd(d.market?.totalMarketCapUsd)}
              label="Market cap cripto"
              note={d.market ? `${formatPct(d.market.marketCapChange24hPct)} en 24h` : undefined}
            />
            <Fig
              value={d.market ? `${d.market.btcDominancePct.toFixed(1)}%` : "—"}
              label="Dominancia BTC"
              note="Cuota de Bitcoin en el market cap"
            />
            <Fig
              value={usd(d.defi.tvlUsd)}
              label="TVL total en DeFi"
              note={d.defi.tvlChange7dPct !== null ? `${formatPct(d.defi.tvlChange7dPct)} en 7d` : undefined}
              spark={tvlSpark}
              positive={d.defi.tvlChange7dPct === null ? null : d.defi.tvlChange7dPct >= 0}
            />
            <Fig
              value={usd(d.defi.dexVolume24hUsd)}
              label="Volumen DEX 24h"
              note={d.defi.dexChange7dPct !== null ? `${formatPct(d.defi.dexChange7dPct)} 7d/7d` : undefined}
            />
            <Fig
              value={usd(d.stablecoins.totalUsd)}
              label="Market cap stablecoins"
              note={
                d.stablecoins.dominantSymbol && d.stablecoins.dominancePct !== null
                  ? `${d.stablecoins.dominantSymbol} ${d.stablecoins.dominancePct.toFixed(1)}%`
                  : undefined
              }
              spark={stableSpark}
              positive={d.stablecoins.change30dPct === null ? null : d.stablecoins.change30dPct >= 0}
            />
            <Fig
              value={usd(d.tokenization.onchainMcapUsd)}
              label="Mercado RWA on-chain"
              note={
                d.tokenization.issuerCount !== null
                  ? `${d.tokenization.issuerCount} emisores`
                  : undefined
              }
            />
            <Fig
              value={d.market?.fearGreed ? `${d.market.fearGreed.value}/100` : "—"}
              label="Fear & Greed"
              note={d.market?.fearGreed?.classification}
            />
            <Fig
              value={d.security ? count(d.security.count) : "—"}
              label="Incidentes · 90 días"
              note={d.security ? `${usd(d.security.amountUsd)} robados` : undefined}
              spark={d.security?.cadence.map((w) => w.count)}
              positive={false}
            />
          </div>

          <div className="bf-rp-duo bf-rp-duo--aside">
            {d.defi.tvlSeries.length > 1 && (
              <Chart
                title="Capital bloqueado en DeFi · 30 días"
                note="Serie diaria del TVL agregado de todas las cadenas. El eje arranca por debajo del mínimo del período, no en cero: con cero de piso el movimiento real se aplasta contra el techo."
              >
                <AreaSeries
                  width={380}
                  height={158}
                  points={d.defi.tvlSeries.map((p) => ({ label: shortDate(p.date), value: p.tvlUsd }))}
                  format={usd}
                  endLabel="hoy"
                />
              </Chart>
            )}

            {d.market?.fearGreed && (
              <Chart
                title="Sentimiento de mercado"
                note="Índice Fear & Greed, 0-100. Es una lectura de ánimo, no un pronóstico."
                legend={
                  <Legend
                    items={FNG_ZONES.map((z) => ({ label: z.name, color: z.color }))}
                    columns
                  />
                }
              >
                <div className="bf-rp-center-x">
                  <Gauge
                    value={d.market.fearGreed.value}
                    label={d.market.fearGreed.classification}
                    zones={FNG_ZONES}
                  />
                </div>
              </Chart>
            )}
          </div>

          {insights.data ? (
            <>
              <Signals title="Hallazgos" items={insights.data.hallazgos} />
              <Signals title="Riesgos" items={insights.data.riesgos} />
              <Signals title="Oportunidades" items={insights.data.oportunidades} />
              <div className="bf-rp-note bf-rp-note--gold">
                <h4>Pregunta abierta de research</h4>
                <p>{insights.data.pregunta}</p>
                <p>{insights.data.method}</p>
              </div>
            </>
          ) : (
            <p>Las señales derivadas no estaban disponibles al generar este informe.</p>
          )}
        </Section>

        {/* ── 01 Landscape ──────────────────────────────────────── */}
        <Section
          code="01"
          layer="Capa 2 · Actividad económica"
          title="Landscape: dónde está el capital"
          lead="Distribución del valor bloqueado entre redes, categorías y protocolos. La concentración es el dato relevante para una decisión de infraestructura: define a qué red queda expuesto un despliegue."
          pageBreak
        >
          <div className="bf-rp-figs">
            <Fig value={usd(d.defi.tvlUsd)} label="TVL total" />
            <Fig value={formatPct(d.defi.tvlChange7dPct)} label="Variación 7 días" />
            <Fig value={formatPct(d.defi.tvlChange30dPct)} label="Variación 30 días" />
            <Fig value={usd(d.defi.dexVolume24hUsd)} label="Volumen DEX 24h" />
          </div>

          <div className="bf-rp-duo bf-rp-duo--aside">
            <Chart
              title="TVL por red · top 10"
              note="Cuota calculada sobre el total de las cadenas con TVL reportado."
            >
              <BarRows
                items={chainBars}
                format={usd}
                width={380}
                gutter={86}
                valueWidth={62}
                subWidth={34}
                rowH={21}
              />
            </Chart>

            {concentration && (
              <Chart
                title="Concentración"
                note={`Sobre ${count(concentration.total)} cadenas con TVL.`}
                legend={
                  <Legend
                    columns
                    items={concentrationSlices.map((s) => ({
                      label: s.label,
                      color: s.color,
                      value: `${s.value.toFixed(1)}%`,
                    }))}
                  />
                }
              >
                <div className="bf-rp-center-x">
                  <Donut
                    items={concentrationSlices}
                    centerValue={`${concentration.top5Pct.toFixed(0)}%`}
                    centerLabel="en el top 5"
                    size={186}
                  />
                </div>
              </Chart>
            )}
          </div>

          {categoryNodes.length > 0 && (
            <Chart
              title="En qué está el capital · categorías de protocolo"
              note={`Reparto del TVL de los ${d.defi.universeSize} protocolos más grandes de DeFiLlama. El área de cada bloque es proporcional al capital depositado; no es el universo DeFi completo.`}
              legend={
                <Legend
                  items={categoryNodes.map((c) => ({
                    label: c.label,
                    color: c.color,
                    value: categoryTotal > 0 ? `${((c.value / categoryTotal) * 100).toFixed(0)}%` : "—",
                  }))}
                />
              }
            >
              <Treemap items={categoryNodes} format={usd} width={W_FULL} height={186} />
            </Chart>
          )}

          {d.defi.topProtocols.length > 0 && (
            <div className="bf-rp-duo">
              <Chart title="Protocolos por TVL" note="Categoría y red de despliegue principal.">
                <BarRows
                  items={d.defi.topProtocols.map((p) => ({
                    label: p.name,
                    value: p.tvlUsd,
                    sub: p.chain,
                  }))}
                  format={usd}
                  width={W_HALF}
                  gutter={86}
                  valueWidth={54}
                  subWidth={56}
                  rowH={21}
                />
              </Chart>
              <Chart
                title="Movimiento a 7 días"
                note="Mismos protocolos, variación porcentual del TVL. El signo va escrito: el color acompaña, no sustituye."
              >
                <DivergingBars
                  items={d.defi.topProtocols.map((p) => ({ label: p.name, value: p.change7dPct }))}
                  format={formatPct}
                  width={W_HALF}
                  gutter={86}
                  rowH={21}
                />
              </Chart>
            </div>
          )}

          {d.defi.topRevenue.length > 0 && (
            <Chart
              title="Ingresos capturados · 24h"
              note="Comisiones que el protocolo retiene, no volumen procesado."
            >
              <BarRows
                items={d.defi.topRevenue.map((p) => ({ label: p.name, value: p.revenue24hUsd }))}
                format={usd}
                width={W_FULL}
                gutter={132}
                rowH={22}
              />
            </Chart>
          )}
        </Section>

        {/* ── 02 Ranking comparativo ────────────────────────────── */}
        <Section
          code="02"
          layer="Análisis multicapa"
          title="Ranking comparativo — Blockfinity Blockchain Index"
          lead="BBI v2: 40% actividad observable y 60% evaluación editorial. Direcciones activas, stablecoins, TVL, volumen DEX y comisiones se normalizan por separado. Las redes con datos incompletos se presentan después de las comparables."
          pageBreak
        >
          <Chart
            title="Ponderadores del índice"
            note="Los siete pesos suman 100. El ancho de cada tramo es su peso."
            legend={
              <Legend
                items={weightSlices.map((w) => ({ label: w.label, color: w.color, value: `${w.value}%` }))}
              />
            }
          >
            <StackedShare items={weightSlices} width={W_FULL} height={28} />
          </Chart>

          <div className="bf-rp-note">
            <h4>Metodología {BBI_VERSION}</h4>
            <p>Actividad: direcciones activas 30%, stablecoins 25%, TVL 20%, DEX 15% y comisiones 10%. Cada indicador positivo usa 1 + 9 × log(valor / ancla inferior) / log(ancla superior / ancla inferior), limitado a [1, 10]; un cero observado puntúa 0.</p>
            <p>{ACTIVITY_METRICS.map(m => `${m.label}: ${m.unit === "usd" ? usd(m.floor) : compact(m.floor)} → ${m.unit === "usd" ? usd(m.ceiling) : compact(m.ceiling)}`).join(" · ")}. Las anclas son decisiones editoriales fijas.</p>
          </div>

          <h3>Scorecard · siete categorías por red</h3>
          <p>
            Cada celda es el score 0-10 de la red en esa categoría; la intensidad del color acompaña
            al número, nunca lo reemplaza. La columna BBI es el índice ponderado resultante; * indica
            cobertura parcial y exclusión del podio comparable.
          </p>
          <ScoreMatrix
            cols={SCORE_COLS}
            rows={d.networks.map((n) => ({
              label: n.name,
              badge: decimals(n.bbi, 1),
              flag: n.bbiPartial,
              cells: [
                n.scores.seguridad,
                n.scores.adopcion,
                n.scores.escalabilidad,
                n.scores.ecosistema,
                n.scores.institucional,
                n.scores.compliance,
                n.actividadEconomica,
              ],
            }))}
          />

          <h3>Actividad y capital · orden por direcciones activas</h3>
          <Table head={<><th>Red</th><th className="n">Dir. 24h</th><th className="n">Stablecoins</th><th className="n">DEX 24h</th><th className="n">Fees 24h</th><th className="n">Cobertura</th></>}>
            {[...d.networks].filter(n => n.activeAddresses24h !== null).sort((a, b) => (b.activeAddresses24h ?? 0) - (a.activeAddresses24h ?? 0)).map(n => <tr key={n.name}><td className="k">{n.name}</td><td className="n">{n.activeAddresses24h !== null ? compact(n.activeAddresses24h) : "—"}</td><td className="n">{usd(n.stablecoinSupplyUsd)}</td><td className="n">{usd(n.dexVolume24hUsd)}</td><td className="n">{usd(n.chainFees24hUsd)}</td><td className="n">{n.activityCoverage}%</td></tr>)}
          </Table>
          <p>Direcciones no son personas únicas. DEX mide intercambios, no volumen de pagos. La oferta de stablecoins es un stock. Los cortes de las fuentes pueden diferir.</p>

          {radarNetworks.length > 0 && (
            <>
              <h3>Perfiles comparados · las tres primeras del índice</h3>
              <div className="bf-rp-trio">
                {radarNetworks.map((n, i) => (
                  <Chart key={n.name} title={n.name} note={`BBI ${decimals(n.bbi, 1)} · ${n.type}`}>
                    <Radar
                      axes={RADAR_AXES}
                      values={[
                        n.scores.seguridad,
                        n.scores.adopcion,
                        n.scores.escalabilidad,
                        n.scores.ecosistema,
                        n.scores.institucional,
                        n.scores.compliance,
                        n.actividadEconomica ?? 0,
                      ]}
                      color={CATEGORICAL[i]}
                      size={W_THIRD}
                    />
                  </Chart>
                ))}
              </div>
            </>
          )}

          <Chart
            title="Actividad observable y encaje institucional editorial"
            note="Tamaño = oferta de stablecoins. Se incluyen redes con actividad y oferta observables; la posición no determina autorización regulatoria."
          >
            <Quadrant
              width={W_FULL}
              height={330}
                points={d.networks.filter(n => n.actividadEconomica !== null && n.stablecoinSupplyUsd !== null && n.stablecoinSupplyUsd > 0).map((n) => ({
                  x: n.actividadEconomica!,
                  y: n.scores.institucional,
                  label: n.name,
                  size: n.stablecoinSupplyUsd!,
                  muted: n.bbiPartial,
                }))}
              xLabel="Actividad observable"
              yLabel="Encaje institucional"
              quadrants={["Mayor encaje", "Actividad y encaje", "Menor actividad y encaje", "Mayor actividad"]}
            />
          </Chart>

          {footprint.length > 0 && (
            <Chart
              title="Oferta de stablecoins por red"
              note="Orden por stock monetario observado. No mide pagos ni se suma al TVL para calcular el BBI."
            >
              <BarRows
                items={footprint.map((n) => ({
                  label: n.name,
                  value: n.stablecoinSupplyUsd ?? 0,
                }))}
                format={usd}
                width={W_FULL}
                gutter={132}
                valueWidth={74}
                rowH={22}
                color={GOLD}
              />
            </Chart>
          )}

          {d.networks.filter((n) => n.review).map((n) => <div className="bf-rp-note" key={n.name}>
            <h4>{n.name}: revisión documentada · {n.review!.reviewedAt}</h4>
            <p>{n.review!.rationale}</p>
            <p>{n.institutionalAdoption} {n.regulatoryRisk}</p>
            {n.referenceMetrics?.map((m) => <p key={m.label}><strong>{m.label}: {usd(m.valueUsd)}</strong> · {m.period}. {m.note} <a href={m.url}>{m.source}</a> · publicado {m.publishedAt}.</p>)}
            <p>Fuentes: {n.review!.sources.map((source, i) => <span key={source.url}>{i > 0 ? " · " : ""}<a href={source.url}>{source.label}</a></span>)}</p>
          </div>)}
          <div className="bf-rp-note">
            <h4>Cómo leer el scorecard</h4>
            <p>
              Las redes marcadas con <strong>*</strong> tienen datos incompletos o no comparables.
              Actividad requiere al menos tres indicadores y 60% de cobertura; se renormalizan los pesos disponibles.
              Si no alcanza, el BBI se calcula solo con las categorías editoriales. Solo una cobertura del 100%
              habilita el podio. La falta de datos no prueba baja actividad. TVL y stablecoins pueden solaparse.
            </p>
          </div>
        </Section>

        {/* ── 03 Actividad de red ───────────────────────────────── */}
        <Section
          code="03"
          layer="Capa 2 · Actividad económica"
          title="Actividad de red observable"
          lead="Uso real de las dos redes de referencia. Las direcciones activas son direcciones, no personas: una billetera puede usar varias y un exchange concentra millones de usuarios en pocas."
          pageBreak
        >
          {d.activity.btc ? (
            <>
              <h3>Bitcoin · cierre {d.activity.btc.asOf}</h3>
              <div className="bf-rp-figs">
                <Fig
                  value={d.activity.btc.priceUsd === null ? "—" : usdFull.format(d.activity.btc.priceUsd)}
                  label="Precio"
                  spark={btcPoints.map((p) => p.priceUsd ?? 0).filter((v) => v > 0)}
                  positive={null}
                />
                <Fig
                  value={
                    d.activity.btc.realizedPriceUsd === null
                      ? "—"
                      : usdFull.format(d.activity.btc.realizedPriceUsd)
                  }
                  label="Costo medio realizado"
                  note="Derivado de market cap ÷ MVRV"
                />
                <Fig value={decimals(d.activity.btc.mvrv)} label="MVRV" note="Precio sobre costo base" />
                <Fig value={count(d.activity.btc.transactions)} label="Transacciones · día" />
                <Fig value={count(d.activity.btc.activeAddresses)} label="Direcciones activas" />
                <Fig value={decimals(d.activity.btc.feesBtc, 2)} label="Fees · BTC/día" />
                <Fig value={decimals(d.activity.btc.hashRateEh, 0)} label="Hash rate · EH/s" note="Media 24h" />
                <Fig
                  value={count(d.activity.btc.exchangeSupplyBtc)}
                  label="Saldo en exchanges · BTC"
                  note={
                    d.activity.btc.exchangeSupply30dChangeBtc === null
                      ? undefined
                      : `${d.activity.btc.exchangeSupply30dChangeBtc > 0 ? "+" : "−"}${num.format(
                          Math.round(Math.abs(d.activity.btc.exchangeSupply30dChangeBtc))
                        )} BTC en 30d`
                  }
                />
              </div>

              {btcPoints.length > 1 && (
                <>
                  <Chart
                    title="Precio frente a costo medio realizado"
                    note="Las dos series están en dólares por BTC y comparten un solo eje. La distancia entre ellas es la ganancia latente del conjunto de tenedores: cuando el precio cae por debajo del costo base, el mercado agregado está en pérdida."
                    legend={
                      <Legend
                        items={[
                          { label: "Precio de mercado", color: CATEGORICAL[0], shape: "line" },
                          { label: "Costo medio realizado", color: CATEGORICAL[1], shape: "line" },
                        ]}
                      />
                    }
                  >
                    <DualSeries
                      width={W_FULL}
                      height={186}
                      points={btcPoints.map((p) => shortDate(p.date))}
                      series={[
                        {
                          name: "Precio",
                          color: CATEGORICAL[0],
                          values: btcPoints.map((p) => p.priceUsd),
                        },
                        {
                          name: "Costo realizado",
                          color: CATEGORICAL[1],
                          values: btcPoints.map((p) => p.realizedPriceUsd),
                        },
                      ]}
                      format={usd}
                    />
                  </Chart>

                  <Chart
                    title="MVRV"
                    note="Precio dividido por costo base, en su propia escala y en su propio gráfico. Superponerlo al de arriba obligaría a un segundo eje, y dos escalas en un mismo plano inventan una correlación que no está en los datos."
                  >
                    <AreaSeries
                      width={W_FULL}
                      height={132}
                      points={btcPoints
                        .filter((p) => p.mvrv !== null)
                        .map((p) => ({ label: shortDate(p.date), value: p.mvrv as number }))}
                      format={(v) => v.toFixed(2)}
                      color={CATEGORICAL[2]}
                    />
                  </Chart>
                </>
              )}

              {d.activity.btc.preliminary.length > 0 && (
                <div className="bf-rp-note bf-rp-note--warn">
                  <h4>Valores preliminares</h4>
                  <p>
                    La fuente marcó como preliminares las métricas{" "}
                    {d.activity.btc.preliminary.join(", ")} en el último cierre: puede revisarlas en las
                    horas siguientes.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p>Los datos on-chain de Bitcoin no estaban disponibles al generar este informe.</p>
          )}

          {d.activity.eth && (
            <>
              <h3>Ethereum · cierre {d.activity.eth.date}</h3>
              <div className="bf-rp-figs">
                <Fig
                  value={count(d.activity.eth.transactions)}
                  label="Transacciones · día"
                  spark={ethTx.map((p) => p.transactions as number)}
                  positive={null}
                />
                <Fig
                  value={count(d.activity.eth.activeAddresses)}
                  label="Direcciones activas"
                  spark={ethAddr.map((p) => p.activeAddresses as number)}
                  positive={null}
                />
              </div>

              {(ethTx.length > 1 || ethAddr.length > 1) && (
                <div className="bf-rp-duo">
                  {ethTx.length > 1 && (
                    <Chart title="Transacciones diarias · 30 días" note="Cierre diario de Coin Metrics.">
                      <Columns
                        width={W_HALF}
                        height={140}
                        labelEvery={7}
                        points={ethTx.map((p) => ({
                          label: p.date,
                          tick: shortDate(p.date),
                          value: p.transactions as number,
                        }))}
                        format={compact}
                      />
                    </Chart>
                  )}
                  {ethAddr.length > 1 && (
                    <Chart
                      title="Direcciones activas · 30 días"
                      note="Direcciones distintas que firmaron al menos una operación; no equivalen a usuarios."
                    >
                      <Columns
                        width={W_HALF}
                        height={140}
                        labelEvery={7}
                        color={CATEGORICAL[2]}
                        points={ethAddr.map((p) => ({
                          label: p.date,
                          tick: shortDate(p.date),
                          value: p.activeAddresses as number,
                        }))}
                        format={compact}
                      />
                    </Chart>
                  )}
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── 04 Adopción institucional ─────────────────────────── */}
        <Section
          code="04"
          layer="Capa 4 · Adopción institucional"
          title="Tokenización, dólar digital y dinero de banca central"
          lead="La capa que más importa para el posicionamiento de la firma: qué activos reales ya están on-chain, sobre qué infraestructura circula el dólar digital y dónde va la política monetaria pública."
          pageBreak
        >
          <h3>Mercado RWA</h3>
          <div className="bf-rp-figs">
            {/* rótulos de DeFiLlama, que en 2026 pasó de "Mcap" a "AUM" sin cambiar la
                medida. El conteo de emisores salió de su página: sin dato, sin cifra */}
            <Fig value={usd(d.tokenization.onchainMcapUsd)} label="Onchain AUM" note="valor de los RWA emitidos on-chain" />
            <Fig value={usd(d.tokenization.activeMcapUsd)} label="Active AUM" note="la parte que DeFiLlama considera activa" />
            <Fig value={usd(d.tokenization.defiActiveTvlUsd)} label="DeFi Active TVL" />
            {d.tokenization.issuerCount !== null && <Fig value={count(d.tokenization.issuerCount)} label="Emisores" />}
            <Fig
              value={usd(d.tokenization.protocolTvlUsd)}
              label="TVL de protocolos RWA"
              note={`${count(d.tokenization.protocolCount)} protocolos`}
            />
          </div>

          {sectorNodes.length > 0 && (
            <>
              <Chart
                title="Activos reales tokenizados · por sector"
                note="Clasificación curada por el equipo sobre los protocolos RWA de DeFiLlama. El área es proporcional al TVL del sector."
                legend={
                  <Legend
                    items={d.tokenization.topSectors.map((s, i) => ({
                      label: s.name,
                      color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
                      value: `${s.sharePct.toFixed(1)}%`,
                    }))}
                  />
                }
              >
                <Treemap items={sectorNodes} format={usd} width={W_FULL} height={180} />
              </Chart>

              <Chart title="Sectores · variación a 7 días" note="Sobre el TVL del sector.">
                <DivergingBars
                  items={d.tokenization.topSectors.map((s) => ({ label: s.name, value: s.change7dPct }))}
                  format={formatPct}
                  width={W_FULL}
                  gutter={148}
                  rowH={21}
                />
              </Chart>
            </>
          )}

          {d.tokenization.topProtocols.length > 0 && (
            <Chart title="Protocolos RWA por TVL" note="La red indicada es la de despliegue principal.">
              <BarRows
                items={d.tokenization.topProtocols.map((p) => ({
                  label: p.name,
                  value: p.tvlUsd,
                  sub: p.chain,
                }))}
                format={usd}
                width={W_FULL}
                gutter={132}
                valueWidth={70}
                subWidth={78}
                rowH={22}
                color={GOLD}
              />
            </Chart>
          )}

          <h3>Stablecoins</h3>
          <div className="bf-rp-figs">
            <Fig
              value={usd(d.stablecoins.totalUsd)}
              label="Market cap total"
              spark={stableSpark}
              positive={d.stablecoins.change30dPct === null ? null : d.stablecoins.change30dPct >= 0}
            />
            <Fig value={formatPct(d.stablecoins.change7dPct)} label="Variación 7 días" />
            <Fig value={formatPct(d.stablecoins.change30dPct)} label="Variación 30 días" />
            <Fig
              value={
                d.stablecoins.dominancePct === null ? "—" : `${d.stablecoins.dominancePct.toFixed(1)}%`
              }
              label="Concentración del emisor líder"
              note={d.stablecoins.dominantSymbol ?? undefined}
            />
          </div>

          <div className="bf-rp-duo bf-rp-duo--aside">
            {d.stablecoins.supplySeries.length > 1 && (
              <Chart
                title="Oferta total · 90 días"
                note="Market cap agregado de stablecoins. Es el mejor proxy público de dólares dispuestos a operar on-chain."
              >
                <AreaSeries
                  width={380}
                  height={158}
                  points={d.stablecoins.supplySeries.map((p) => ({
                    label: shortDate(p.date),
                    value: p.totalUsd,
                  }))}
                  format={usd}
                  color={CATEGORICAL[2]}
                  endLabel="hoy"
                />
              </Chart>
            )}

            {issuerSlices.length > 0 && (
              <Chart
                title="Reparto por emisor"
                note="Top 5 por circulante."
                legend={
                  <Legend
                    columns
                    items={d.stablecoins.topIssuers.slice(0, 5).map((s, i) => ({
                      label: s.symbol,
                      color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
                      value: usd(s.circulatingUsd),
                    }))}
                  />
                }
              >
                <div className="bf-rp-center-x">
                  <Donut
                    items={issuerSlices}
                    centerValue={
                      d.stablecoins.dominancePct === null
                        ? "—"
                        : `${d.stablecoins.dominancePct.toFixed(0)}%`
                    }
                    centerLabel={d.stablecoins.dominantSymbol ?? "líder"}
                    size={186}
                  />
                </div>
              </Chart>
            )}
          </div>

          {stableChainSlices.length > 0 && (
            <Chart
              title="Redes donde circula el dólar digital"
              note="Cuota sobre el circulante con red atribuida. Un emisor multi-red aparece en cada una."
              legend={
                <Legend
                  items={d.stablecoins.topChains.map((c, i) => ({
                    label: c.chain,
                    color: i < CATEGORICAL.length ? CATEGORICAL[i] : NEUTRAL,
                    value: usd(c.circulatingUsd),
                  }))}
                />
              }
            >
              <StackedShare items={stableChainSlices} width={W_FULL} height={30} />
            </Chart>
          )}

          {d.stablecoins.topIssuers.length > 0 && (
            <Chart
              title="Emisores · variación a 7 días"
              note="El mecanismo de respaldo va en la leyenda porque cambia por completo el perfil de riesgo del instrumento."
              legend={
                <Legend
                  items={d.stablecoins.topIssuers.map((s) => ({
                    label: `${s.symbol} · ${s.pegMechanism}`,
                    color: s.change7dPct === null ? NEUTRAL : s.change7dPct >= 0 ? STATUS.up : STATUS.down,
                    shape: "dot",
                  }))}
                />
              }
            >
              <DivergingBars
                items={d.stablecoins.topIssuers.map((s) => ({ label: s.symbol, value: s.change7dPct }))}
                format={formatPct}
                width={W_FULL}
                gutter={92}
                rowH={21}
              />
            </Chart>
          )}

          <h3>CBDC · {d.cbdc.total} jurisdicciones seguidas</h3>
          {cbdcStages.length > 0 && (
            <Chart
              title="Avance de los proyectos de dinero de banca central"
              note="Las etapas van en orden de progreso, no por tamaño. El tono se satura conforme avanza la etapa; el número está impreso sobre cada columna."
            >
              <Pipeline stages={cbdcStages} width={W_FULL} height={138} />
            </Chart>
          )}
          <div className="bf-rp-chips">
            {[...d.cbdc.byStatus]
              .sort((a, b) => CBDC_ORDER.indexOf(a.status) - CBDC_ORDER.indexOf(b.status))
              .map((s) => (
                <span key={s.status}>
                  <i>{s.status}:</i> {s.jurisdictions.join(", ")}
                </span>
              ))}
          </div>
          <div className="bf-rp-note">
            <h4>Alcance del tracker CBDC</h4>
            <p>
              Selección curada por el equipo sobre el CBDC Tracker del Atlantic Council, verificada a{" "}
              {d.cbdc.asOf}. No es el universo completo de proyectos: recoge las jurisdicciones
              relevantes para la práctica de la firma.
              {discarded
                ? ` ${discarded.count} proyecto(s) figuran como descartados y quedan fuera del embudo de avance: ${discarded.jurisdictions.join(", ")}.`
                : ""}
            </p>
          </div>
        </Section>

        {/* ── 05 Riesgo y seguridad ─────────────────────────────── */}
        <Section
          code="05"
          layer="Capa 1 · Historial de ataques"
          title="Superficie de riesgo"
          lead="Ataques confirmados a protocolos, puentes, exchanges y wallets en los últimos 90 días. Es el insumo directo de un Blockchain Risk Assessment: no mide opinión sobre seguridad, mide lo que efectivamente se rompió."
          pageBreak
        >
          {d.security ? (
            <>
              <div className="bf-rp-figs">
                <Fig
                  value={count(d.security.count)}
                  label="Incidentes · 90 días"
                  note={`desde ${d.security.from}`}
                  spark={d.security.cadence.map((w) => w.count)}
                  positive={false}
                />
                <Fig
                  value={usd(d.security.amountUsd)}
                  label="Robado en el período"
                  note={
                    d.security.unpricedCount > 0
                      ? `${d.security.unpricedCount} sin monto confirmado`
                      : undefined
                  }
                />
                <Fig
                  value={`${d.security.weeksWithIncident}/${d.security.weeksObserved}`}
                  label="Semanas con incidente"
                  note={`racha más larga: ${d.security.longestStreak} semanas seguidas`}
                />
                <Fig
                  value={count(d.security.historyCount)}
                  label="Incidentes en el registro"
                  note={`${usd(d.security.historyAmountUsd)} acumulados`}
                />
                <Fig
                  value={d.market?.fearGreed ? `${d.market.fearGreed.value}/100` : "—"}
                  label="Fear & Greed"
                  note={d.market?.fearGreed?.classification}
                />
              </div>

              {d.security.monthly.length > 1 && (
                <Chart
                  title="Pérdidas por mes · 24 meses"
                  note="Monto robado en cada mes del registro. Da la escala contra la que se lee la ventana de 90 días de esta sección."
                >
                  <Columns
                    width={W_FULL}
                    height={150}
                    labelEvery={3}
                    color={STATUS.down}
                    points={d.security.monthly.map((m) => ({
                      label: m.label,
                      tick: shortMonth(m.label),
                      value: m.amountUsd,
                    }))}
                    format={usd}
                  />
                </Chart>
              )}

              <Chart
                title="Cadencia semanal · últimas 13 semanas"
                note="Una celda por semana, incluidas las vacías. El dato no es cuántos ataques hubo sino que casi no hay semana en blanco: el riesgo es continuo, no episódico."
              >
                <CadenceStrip weeks={d.security.cadence} width={W_FULL} height={56} />
              </Chart>

              <div className="bf-rp-duo">
                <Chart title="Vectores de ataque" note="Casos en la ventana; el monto va a la derecha.">
                  <BarRows
                    items={d.security.topVectors.map((v) => ({
                      label: v.key,
                      value: v.count,
                      sub: usd(v.amountUsd),
                    }))}
                    format={(v) => String(v)}
                    width={W_HALF}
                    gutter={108}
                    valueWidth={24}
                    subWidth={52}
                    rowH={22}
                    color={STATUS.down}
                  />
                </Chart>
                <Chart title="Redes más golpeadas" note="Un ataque multi-red suma en cada una.">
                  <BarRows
                    items={d.security.topChains.map((c) => ({
                      label: c.key,
                      value: c.count,
                      sub: usd(c.amountUsd),
                    }))}
                    format={(v) => String(v)}
                    width={W_HALF}
                    gutter={86}
                    valueWidth={24}
                    subWidth={52}
                    rowH={22}
                    color={STATUS.warn}
                  />
                </Chart>
              </div>

              <h3>Mayores pérdidas del período</h3>
              <Table
                head={
                  <>
                    <th>Fecha</th>
                    <th>Objetivo</th>
                    <th>Redes</th>
                    <th>Vector</th>
                    <th className="n">Robado</th>
                  </>
                }
              >
                {d.security.biggest.map((e) => (
                  <tr key={`${e.date}-${e.name}`}>
                    <td className="n">{e.date}</td>
                    <td className="k">{e.name}</td>
                    <td>{e.chains.join(", ")}</td>
                    <td>{e.classification}</td>
                    <td className="n">{usd(e.amountUsd)}</td>
                  </tr>
                ))}
              </Table>
              <div className="bf-rp-note">
                <h4>Cómo contar un incidente multi-red</h4>
                <p>
                  Un ataque que tocó varias redes suma en cada una: el gráfico mide exposición por red,
                  no una partición del total. Los montos son la valuación en dólares al momento del
                  incidente, sin reexpresar a precio de hoy.
                </p>
              </div>
            </>
          ) : (
            <p>El registro de incidentes no estaba disponible al generar este informe.</p>
          )}
        </Section>

        {/* ── 06 Índices propietarios ───────────────────────────── */}
        <Section
          code="06"
          layer="Capa 3 · Ecosistema"
          title="Índices propietarios Blockfinity"
          lead="Ocho índices construidos sobre los mismos datos públicos de este informe. Son agregaciones con fórmula fija y auditable, no señales de mercado ni recomendaciones."
        >
          {indices.data ? (
            <div className="bf-rp-ix">
              {indices.data.indices.map((index) => (
                <article key={index.code}>
                  <div className="bf-rp-ix-h">
                    <span>{index.code}</span>
                    <span>· {index.family}</span>
                  </div>
                  <span className="bf-rp-ix-n">{index.name}</span>
                  <div className="bf-rp-ix-v">
                    <b>
                      {index.value === null
                        ? "—"
                        : index.unit === "usd"
                          ? usd(index.value)
                          : index.value.toFixed(1)}
                    </b>
                    {index.spark && index.spark.length > 1 && (
                      <MiniSpark
                        values={index.spark}
                        positive={
                          index.changes.d30 === null
                            ? null
                            : index.higherIsBetter
                              ? index.changes.d30 >= 0
                              : index.changes.d30 < 0
                        }
                      />
                    )}
                  </div>
                  <div className="bf-rp-ix-f">
                    <span>
                      7d <Delta value={index.changes.d7} />
                    </span>
                    <span>
                      30d <Delta value={index.changes.d30} />
                    </span>
                    <b style={{ marginLeft: "auto" }}>{index.signal.label}</b>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Los índices propietarios no estaban disponibles al generar este informe.</p>
          )}
        </Section>

        <BuildCostReport data={build.data} failed={build.error} />

        <YieldsReport data={yields.data} failed={yields.error} />

        {/* ── 11 Metodología ────────────────────────────────────── */}
        <Section
          code="11"
          layer="Método y trazabilidad"
          title="Metodología y fuentes"
          lead="El informe sigue el modelo de análisis en cuatro capas definido en el proyecto BBIM. Cada bloque se levanta de una fuente pública y viaja con la hora exacta de consulta."
          pageBreak
        >
          <Chart
            title="Modelo de análisis en cuatro capas"
            note="La arquitectura es la base: sostiene todo lo que está encima. A la derecha de cada banda, la frecuencia de actualización prevista para esa capa."
          >
            <LayerDiagram layers={LAYERS} width={W_FULL} />
          </Chart>

          <h3>Trazabilidad de este documento</h3>
          <Chart
            title="Estado de las fuentes al generar"
            note={`${okSources} de ${reportSources.length} bloques respondieron. Un bloque en caché muestra el último valor válido porque la fuente no contestó en el momento de generar.`}
            legend={
              <Legend
                items={[
                  { label: "En vivo", color: STATUS.up, value: String(liveSources) },
                  { label: "Caché", color: STATUS.warn, value: String(staleSources) },
                  { label: "Sin respuesta", color: STATUS.down, value: String(failedSources) },
                ]}
              />
            }
          >
            <CoverageBar
              width={W_FULL}
              segments={[
                { label: "En vivo", count: liveSources, color: STATUS.up },
                { label: "Caché", count: staleSources, color: STATUS.warn },
                { label: "Sin respuesta", count: failedSources, color: STATUS.down },
              ]}
            />
          </Chart>

          <Table
            head={
              <>
                <th>Bloque</th>
                <th>Fuente</th>
                <th>Consultado</th>
                <th>Estado</th>
              </>
            }
          >
            {reportSources.map((s) => (
              <tr key={`${s.block}|${s.source}`}>
                <td className="k">{s.block}</td>
                <td>{s.source}</td>
                <td className="n">{stamp(s.fetchedAt)}</td>
                <td>
                  {!s.ok ? (
                    <span className="bf-rp-down">sin respuesta</span>
                  ) : s.stale ? (
                    <span className="bf-rp-muted">caché</span>
                  ) : (
                    <span className="bf-rp-up">en vivo</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>

          <div className="bf-rp-note bf-rp-note--warn">
            <h4>Límites de lectura</h4>
            <p>
              El TVL mide capital depositado en contratos, no valor de una red ni ingresos. Las
              direcciones activas no son usuarios. Los scores editoriales del BBI son evaluación del
              equipo sobre criterios publicados, no una medición externa. En los gráficos de área el eje
              vertical no arranca en cero —arranca por debajo del mínimo del período— para que se vea el
              movimiento; las magnitudes absolutas están rotuladas sobre las marcas.
            </p>
            <p>
              Ninguna cifra de este documento constituye asesoramiento de inversión ni recomendación
              de compra o venta.
            </p>
          </div>
        </Section>

        <footer className="bf-rp-foot">
          <div className="bf-rp-foot-brand">
            <Image src={blockfinityLogo} alt="Blockfinity" className="bf-rp-logo" loading="eager" unoptimized />
            <span>Research & Intelligence</span>
          </div>
          <p>
          Blockfinity Blockchain Intelligence Monitor · Blockchain Landscape Report generado el{" "}
          {stamp(d.generatedAt)} desde el Research Terminal. Documento de uso interno y comercial de
          Blockfinity Advisors. Las fuentes son públicas y están listadas en el capítulo 11 con su hora
          de consulta.
          </p>
        </footer>
      </article>
    </>
  );
}
