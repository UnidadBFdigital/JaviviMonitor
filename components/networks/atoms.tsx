"use client";

import { formatUsdCompact } from "@/lib/format";
import type { Freshness, NetworkMetrics } from "@/lib/networks/types";
import type { TrendSignal } from "@/lib/networks/score";

// Piezas compartidas del módulo. Existen para que N/A, frescura y unidades se
// vean y se expliquen igual en toda la sección: un número sin unidad ni fuente
// no se publica, y un hueco se muestra como hueco.

/** Un guion largo marca el hueco: se lee como "sin dato" sin gritar N/A en cada celda. */
export const EMPTY = "—";

export function formatCost(value: number | null): string {
  if (value === null) return EMPTY;
  if (value === 0) return "$0";
  if (value < 0.0001) return "<$0.0001";
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatCount(value: number | null): string {
  if (value === null) return EMPTY;
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(value);
}

export function formatUsd(value: number | null): string {
  return value === null ? EMPTY : formatUsdCompact(value);
}

export function formatPctValue(value: number | null, digits = 1): string {
  if (value === null) return EMPTY;
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}%`;
}

/** Hueco explicado: el motivo viaja en el tooltip, nunca se rellena con cero. */
export function Na({ reason }: { reason?: string | null }) {
  return (
    <span
      className="cursor-help text-ink-muted"
      title={reason ?? "La fuente no publica este dato para esta red."}
      aria-label={`Sin dato. ${reason ?? "La fuente no publica este dato para esta red."}`}
    >
      {EMPTY}
    </span>
  );
}

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <Na />;
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.05;
  return (
    <span
      className={`tabular-nums ${flat ? "text-ink-muted" : good ? "text-up" : "text-down"}`}
    >
      {flat ? "→" : value > 0 ? "↑" : "↓"} {formatPctValue(value)}
    </span>
  );
}

const SIGNAL_STYLE: Record<TrendSignal, string> = {
  Acelerando: "bg-up/15 text-up",
  Creciendo: "bg-up/10 text-up",
  Estable: "bg-ice text-ink-secondary",
  "Enfriándose": "bg-warn/15 text-warn",
  Retrocediendo: "bg-down/15 text-down",
};

export function TrendChip({ signal }: { signal: TrendSignal | null }) {
  if (!signal) return <Na reason="Sin serie diaria suficiente para clasificar la tendencia." />;
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] ${SIGNAL_STYLE[signal]}`}>
      {signal}
    </span>
  );
}

/** Barra 0-100. El dorado marca lo propietario: el índice de Blockfinity. */
export function ScoreBar({
  value,
  gold = false,
  reason,
}: {
  value: number | null;
  gold?: boolean;
  /** por qué no hay nota: se lee al pasar el cursor */
  reason?: string;
}) {
  if (value === null) {
    return (
      <span
        className="cursor-help text-[11px] text-ink-muted"
        title={reason ?? "El índice exige tres pilares con dato y 60% de cobertura observada."}
      >
        sin cobertura
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-sm bg-ice">
        <span
          className="block h-full rounded-sm transition-all duration-500"
          style={{ width: `${Math.max(2, value)}%`, background: gold ? "var(--color-gold)" : "var(--color-electric)" }}
        />
      </span>
      <span className={`w-7 text-right text-[11px] tabular-nums ${gold ? "text-gold-bright" : "text-ink"}`}>
        {value.toFixed(0)}
      </span>
    </span>
  );
}

const FRESHNESS_LABEL: Record<Freshness, string> = {
  LIVE: "En vivo",
  HOURLY: "Cada hora",
  DAILY: "Diario",
  MONTHLY: "Mensual",
  STATIC: "Curado",
};

const FRESHNESS_TONE: Record<Freshness, string> = {
  LIVE: "text-up",
  HOURLY: "text-electric",
  DAILY: "text-ink-secondary",
  MONTHLY: "text-warn",
  STATIC: "text-gold",
};

export function relativeTime(iso: string | null): string {
  if (!iso) return "sin consulta";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/** Cadencia real del bloque: nunca dice "en vivo" a un dato diario. */
export function FreshnessTag({
  freshness,
  fetchedAt,
  compact = false,
}: {
  freshness: Freshness;
  fetchedAt: string | null;
  compact?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${FRESHNESS_TONE[freshness]}`}>
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
      {FRESHNESS_LABEL[freshness]}
      {!compact && <span className="text-ink-muted">· {relativeTime(fetchedAt)}</span>}
    </span>
  );
}

/** Definición corta al alcance del cursor: el tablero tiene que leerse sin manual. */
export function Info({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="ml-1 cursor-help select-none text-[9px] text-ink-muted hover:text-electric"
      aria-label={text}
    >
      ⓘ
    </span>
  );
}

export function LayerChip({ network }: { network: NetworkMetrics }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`rounded px-1 py-0.5 text-[9px] ${
          network.layer === "L2" ? "bg-electric/15 text-electric" : "bg-ice text-ink-secondary"
        }`}
      >
        {network.layer}
      </span>
      <span className="rounded bg-ice px-1 py-0.5 text-[9px] text-ink-muted">{network.vm}</span>
    </span>
  );
}

/** Sparkline mínima para las fichas del encabezado. */
export function MiniSpark({
  values,
  positive = true,
  width = 64,
  height = 20,
}: {
  values: number[];
  positive?: boolean;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--color-up)" : "var(--color-down)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
