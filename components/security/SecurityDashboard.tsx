"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/Panel";
import { BarList } from "@/components/charts/BarList";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { formatUsdCompact } from "@/lib/format";
import { useSource } from "@/lib/useSource";
import {
  buildTimeline,
  bucketBy,
  isoDaysAgo,
  longestStreak,
  monthsAgo,
  sortBuckets,
  weeklyCadence,
  type Bucket,
} from "@/lib/hackStats";
import type { HackEvent, HacksDataset } from "@/lib/sources/hacks";
import { HackTimelineChart } from "./HackTimelineChart";
import { HackLedger } from "./HackLedger";
import { CadenceLegend, WeeklyCadence } from "./WeeklyCadence";

const SOURCE_LABEL = "DeFiLlama Hacks";
const SOURCE_URL = "https://defillama.com/hacks";
const CADENCE_WEEKS = 52;
const ALL = "__all__";

type Range = "12m" | "24m" | "all";
type Metric = "amount" | "count";

const RANGE_LABEL: Record<Range, string> = {
  "12m": "12 meses",
  "24m": "24 meses",
  all: "Histórico",
};

const number = new Intl.NumberFormat("es-BO");

function plural(n: number, one: string, many: string) {
  return `${number.format(n)} ${n === 1 ? one : many}`;
}

// --- controles ---------------------------------------------------------

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      <div className="flex overflow-hidden rounded border border-line">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`px-2 py-1 text-[11px] transition-colors ${
              value === option.value
                ? "bg-electric/15 font-medium text-ink"
                : "text-ink-secondary hover:bg-ice/50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  label,
  allLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  label: string;
  allLabel: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[11rem] truncate rounded border border-line bg-card px-2 py-1 text-[11px] text-ink"
      >
        <option value={ALL}>{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Kpi({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warn" | "up";
}) {
  const toneClass = tone === "warn" ? "text-warn" : tone === "up" ? "text-up" : "text-ink";
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${toneClass}`} title={value}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-ink-secondary" title={detail}>
        {detail}
      </p>
    </div>
  );
}

// --- rankings ----------------------------------------------------------

function Ranking({
  title,
  subtitle,
  buckets,
  metric,
  total,
  limit,
  index,
}: {
  title: string;
  subtitle: string;
  buckets: Bucket[];
  metric: Metric;
  total: number;
  limit: number;
  index: number;
}) {
  const items = sortBuckets(buckets, metric)
    .slice(0, limit)
    .map((bucket) => ({
      label: bucket.key,
      value: metric === "amount" ? bucket.amountUsd : bucket.count,
      note:
        metric === "amount"
          ? plural(bucket.count, "caso", "casos")
          : formatUsdCompact(bucket.amountUsd),
    }))
    .filter((item) => item.value > 0);

  return (
    <Panel title={title} subtitle={subtitle} index={index}>
      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-ink-muted">Sin datos con estos filtros</p>
      ) : (
        <BarList
          items={items}
          total={total}
          formatValue={(v) => (metric === "amount" ? formatUsdCompact(v) : number.format(v))}
        />
      )}
    </Panel>
  );
}

// --- dashboard ---------------------------------------------------------

export function SecurityDashboard() {
  const result = useSource<HacksDataset>("/api/security/hacks", SOURCE_LABEL);
  const [range, setRange] = useState<Range>("12m");
  const [metric, setMetric] = useState<Metric>("amount");
  const [chain, setChain] = useState<string>(ALL);
  const [vector, setVector] = useState<string>(ALL);
  const [target, setTarget] = useState<string>(ALL);

  const events = useMemo(() => (result?.ok ? result.data.events : []), [result]);

  // Las opciones salen del registro completo, no de la ventana: si dependieran
  // del filtro activo, cambiar de ventana haría desaparecer la opción elegida.
  const options = useMemo(() => {
    const chains = sortBuckets(bucketBy(events, (e) => e.chains), "count").map((b) => b.key);
    const vectors = sortBuckets(bucketBy(events, (e) => [e.classification]), "count").map((b) => b.key);
    const targets = sortBuckets(bucketBy(events, (e) => [e.targetType]), "count").map((b) => b.key);
    return { chains: chains.slice(0, 40), vectors, targets };
  }, [events]);

  const filtered = useMemo(() => {
    const from = range === "all" ? "" : monthsAgo(range === "12m" ? 12 : 24);
    return events.filter(
      (e) =>
        e.date >= from &&
        (chain === ALL || e.chains.includes(chain)) &&
        (vector === ALL || e.classification === vector) &&
        (target === ALL || e.targetType === target)
    );
  }, [events, range, chain, vector, target]);

  const stats = useMemo(() => {
    const priced = filtered.filter((e) => e.amountUsd !== null);
    const amountUsd = priced.reduce((sum, e) => sum + (e.amountUsd ?? 0), 0);
    const returnedUsd = filtered.reduce((sum, e) => sum + (e.returnedUsd ?? 0), 0);
    const biggest = priced.reduce<HackEvent | null>(
      (best, e) => (best === null || (e.amountUsd ?? 0) > (best.amountUsd ?? 0) ? e : best),
      null
    );
    const cadence = weeklyCadence(filtered, CADENCE_WEEKS, new Date().toISOString().slice(0, 10));
    const activeWeeks = cadence.filter((w) => w.count > 0).length;
    const cadenceCount = cadence.reduce((sum, w) => sum + w.count, 0);
    const byChain = bucketBy(filtered, (e) => e.chains);
    const byVector = bucketBy(filtered, (e) => [e.classification]);
    const byTechnique = bucketBy(filtered, (e) => [e.technique]);
    const byTarget = bucketBy(filtered, (e) => [e.targetType]);
    const topVector = sortBuckets(byVector, "count")[0] ?? null;
    return {
      amountUsd,
      returnedUsd,
      unpriced: filtered.length - priced.length,
      biggest,
      latest: filtered[0] ?? null,
      cadence,
      activeWeeks,
      cadenceCount,
      streak: longestStreak(cadence),
      byChain,
      byVector,
      byTechnique,
      byTarget,
      topVector,
      bridgeCount: filtered.filter((e) => e.bridgeHack).length,
    };
  }, [filtered]);

  const timeline = useMemo(
    () => buildTimeline(filtered, range === "all" ? "year" : "month"),
    [filtered, range]
  );

  const biggestList = useMemo(
    () =>
      [...filtered]
        .filter((e) => e.amountUsd !== null)
        .sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))
        .slice(0, 10),
    [filtered]
  );

  if (result === null) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-ice/50" />
        <div className="h-72 animate-pulse rounded-lg bg-ice/50" />
        <div className="h-64 animate-pulse rounded-lg bg-ice/50" />
      </div>
    );
  }

  if (!result.ok) {
    return (
      <Panel title="Incidentes de seguridad">
        <Unavailable source={result.source} />
      </Panel>
    );
  }

  const dataset = result.data;
  // La etiqueta del histórico sale del set FILTRADO, no del registro completo:
  // con un filtro de red puesto, "desde 2011" sería una fecha que esa red no
  // llegó a ver.
  const rangeNote =
    range === "all"
      ? filtered.length > 0
        ? `desde ${filtered[filtered.length - 1].date}`
        : "histórico completo"
      : `últimos ${RANGE_LABEL[range]}`;
  const rankingTotal = metric === "amount" ? stats.amountUsd : filtered.length;

  return (
    <div className="space-y-4">
      {/* Barra de filtros — gobierna KPI, gráficos, rankings y tabla */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-card px-4 py-3">
        <Segmented
          label="Ventana"
          value={range}
          onChange={setRange}
          options={[
            { value: "12m" as Range, label: "12m" },
            { value: "24m" as Range, label: "24m" },
            { value: "all" as Range, label: "Histórico" },
          ]}
        />
        <Select
          label="Red"
          value={chain}
          onChange={setChain}
          options={options.chains}
          allLabel="Todas"
        />
        <Select
          label="Vector"
          value={vector}
          onChange={setVector}
          options={options.vectors}
          allLabel="Todos"
        />
        <Select
          label="Objetivo"
          value={target}
          onChange={setTarget}
          options={options.targets}
          allLabel="Todos"
        />
        <Segmented
          label="Ordenar por"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "amount" as Metric, label: "Monto" },
            { value: "count" as Metric, label: "Casos" },
          ]}
        />
        <span className="ml-auto text-[11px] text-ink-secondary">
          {plural(filtered.length, "incidente", "incidentes")} · {rangeNote}
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 divide-y divide-line overflow-hidden rounded-lg border border-line bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        <Kpi
          label="Robado"
          value={formatUsdCompact(stats.amountUsd)}
          detail={
            stats.unpriced > 0
              ? `${stats.unpriced} sin monto confirmado · fuera de la suma`
              : "todos con monto confirmado"
          }
          tone="warn"
        />
        <Kpi
          label="Cadencia"
          value={`${stats.activeWeeks} de ${CADENCE_WEEKS} semanas`}
          detail={`con al menos un incidente · racha máxima ${plural(stats.streak, "semana", "semanas")}`}
        />
        <Kpi
          label="Último incidente"
          value={stats.latest ? stats.latest.name : "—"}
          detail={
            stats.latest
              ? `${stats.latest.date} · hace ${plural(isoDaysAgo(stats.latest.date), "día", "días")} · ${
                  stats.latest.amountUsd === null
                    ? "monto n/d"
                    : formatUsdCompact(stats.latest.amountUsd)
                }`
              : "sin incidentes con estos filtros"
          }
        />
        <Kpi
          label="Mayor pérdida"
          value={stats.biggest ? formatUsdCompact(stats.biggest.amountUsd ?? 0) : "—"}
          detail={stats.biggest ? `${stats.biggest.name} · ${stats.biggest.date}` : "sin monto confirmado"}
        />
        <Kpi
          label="Vector dominante"
          value={stats.topVector ? stats.topVector.key : "—"}
          detail={
            stats.topVector && filtered.length > 0
              ? `${plural(stats.topVector.count, "caso", "casos")} · ${((stats.topVector.count / filtered.length) * 100).toFixed(0)}% del período`
              : "sin datos"
          }
        />
      </div>

      {/* Cronología */}
      <Panel
        variant="cut"
        title="Cuánto se roba y cada cuánto"
        subtitle={`Monto robado (barras, eje izquierdo) y número de incidentes (línea, eje derecho) por ${
          range === "all" ? "año" : "mes"
        } · ${rangeNote}`}
        index={0}
      >
        <div className="h-72">
          <HackTimelineChart points={timeline} />
        </div>
      </Panel>

      {/* Cadencia semanal */}
      <Panel
        variant="flush"
        title="Semana a semana"
        subtitle={`Últimas ${CADENCE_WEEKS} semanas, una celda por semana. Las semanas sin incidentes quedan vacías — no se omiten.`}
        index={1}
        footer={
          <span>
            {stats.activeWeeks} de {CADENCE_WEEKS} semanas registraron al menos un incidente (
            {((stats.activeWeeks / CADENCE_WEEKS) * 100).toFixed(0)}%), con{" "}
            {plural(stats.cadenceCount, "incidente", "incidentes")} en total y una racha máxima de{" "}
            {plural(stats.streak, "semana consecutiva", "semanas consecutivas")}.
          </span>
        }
      >
        <div className="space-y-2">
          <WeeklyCadence weeks={stats.cadence} />
          <CadenceLegend />
        </div>
      </Panel>

      {/* Rankings */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Ranking
          title="Redes afectadas"
          subtitle="Un incidente multi-red suma en cada red que tocó, así que los porcentajes pueden pasar de 100%."
          buckets={stats.byChain}
          metric={metric}
          total={rankingTotal}
          limit={12}
          index={2}
        />
        <Ranking
          title="Vector de ataque"
          subtitle="Clasificación de la causa raíz según DeFiLlama. Cada incidente cae en una sola categoría."
          buckets={stats.byVector}
          metric={metric}
          total={rankingTotal}
          limit={13}
          index={3}
        />
        <Ranking
          title="Técnica concreta"
          subtitle="El cómo dentro del vector — es el nivel al que se escribe un control."
          buckets={stats.byTechnique}
          metric={metric}
          total={rankingTotal}
          limit={12}
          index={4}
        />
        <Ranking
          title="Tipo de objetivo"
          subtitle="Qué clase de sistema se rompió: protocolo DeFi, exchange, puente, wallet, token."
          buckets={stats.byTarget}
          metric={metric}
          total={rankingTotal}
          limit={10}
          index={5}
        />
      </div>

      {/* Mayores pérdidas */}
      <Panel
        title="Mayores pérdidas del período"
        subtitle="Top 10 por monto robado. Solo incidentes con cifra confirmada."
        index={6}
      >
        {biggestList.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-muted">Sin montos confirmados</p>
        ) : (
          <BarList
            items={biggestList.map((e) => ({
              label: e.name,
              value: e.amountUsd ?? 0,
              note: `${e.date} · ${e.chains.join(", ")} · ${e.classification}`,
            }))}
            total={stats.amountUsd}
            formatValue={formatUsdCompact}
          />
        )}
      </Panel>

      {/* Registro completo */}
      <Panel
        title="Registro de incidentes"
        subtitle={`Una fila por incidente, con vector, técnica, redes y fondos devueltos. Buscable, ordenable y exportable a CSV · ${rangeNote}`}
        index={7}
        aside={
          <span className="text-[11px] text-ink-secondary">
{plural(stats.bridgeCount, "caso en puentes", "casos en puentes")} ·{" "}
            {stats.returnedUsd > 0 ? formatUsdCompact(stats.returnedUsd) : "$0"} devueltos
          </span>
        }
      >
        <HackLedger events={filtered} />
      </Panel>

      <SourceBadge
        source={result.source}
        url={SOURCE_URL}
        fetchedAt={result.fetchedAt}
        stale={result.stale}
      />

      <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-ink-muted">
        <strong className="text-ink-secondary">Cómo leer esto.</strong> El registro cubre{" "}
        {plural(dataset.totals.count, "incidente", "incidentes")} entre {dataset.firstDate} y{" "}
        {dataset.lastDate}, por {formatUsdCompact(dataset.totals.amountUsd)} robados en total.{" "}
        {dataset.totals.unpricedCount} no tienen monto confirmado y quedan fuera de todas las sumas —
        aparecen como «n/d», nunca como cero. Los montos son la valuación en dólares al momento del
        incidente, no reexpresada a precio de hoy, así que no se pueden sumar como si fueran una
        cartera. «Devuelto» solo registra recuperaciones que la fuente confirmó; su ausencia no
        prueba que no hubo recuperación. La clasificación de vector y técnica es de DeFiLlama y se
        revisa cuando aparece un post-mortem, de modo que un incidente reciente puede cambiar de
        categoría. Un incidente cuenta en cada red que tocó: las barras por red miden exposición, no
        una partición del total.
      </p>
    </div>
  );
}
