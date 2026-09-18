"use client";

import { useState } from "react";
import { CATEGORICAL, NEUTRAL, STATUS } from "@/lib/palette";
import { formatUsdCompact } from "@/lib/format";
import { OPERATIONS, RISK_LABEL, type OperationId, type RiskLevel, type YieldPool } from "@/lib/yields";

// Piezas visuales del explorador de rendimientos. El color identifica al tipo
// de operación en orden fijo; el estado de riesgo usa los colores reservados
// de estado y siempre va con su palabra al lado, nunca solo con color.

export const OPERATION_COLOR = Object.fromEntries(
  OPERATIONS.map((operation, index) => [operation.id, operation.id === "other" ? NEUTRAL : CATEGORICAL[index]])
) as Record<OperationId, string>;

export function formatApy(value: number | null): string {
  if (value === null) return "—";
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${value.toFixed(digits)}%`;
}

export function formatPp(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} pp`;
}

export { formatUsdCompact };

/* ---------- íconos por operación ---------- */

const ICON_PATHS: Record<OperationId, React.ReactNode> = {
  lend: (
    <>
      <ellipse cx="12" cy="6.5" rx="6" ry="2.5" />
      <path d="M6 6.5v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5" />
      <path d="M6 11.5v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5" />
    </>
  ),
  stake: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  restake: (
    <>
      <path d="M10 5l6 2.5v4c0 3.6-2.4 6.4-6 8-3.6-1.6-6-4.4-6-8v-4L10 5z" />
      <path d="M16 4.5l4 1.7v3.3c0 2.4-1 4.6-2.8 6.1" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 8.8c-.5-.9-1.6-1.5-2.8-1.5-1.7 0-3 1-3 2.3 0 3 6 1.6 6 4.6 0 1.3-1.3 2.3-3 2.3-1.3 0-2.4-.6-2.9-1.6M12 5.8v1.5M12 16.5V18" />
    </>
  ),
  rwa: (
    <>
      <path d="M4 9.5L12 5l8 4.5" />
      <path d="M6 10v7M10 10v7M14 10v7M18 10v7M4 19.5h16" />
    </>
  ),
  liquidity: (
    <>
      <path d="M12 3.5c3 3.6 5.5 6.8 5.5 10a5.5 5.5 0 11-11 0c0-3.2 2.5-6.4 5.5-10z" />
      <path d="M9.5 14.5a2.5 2.5 0 002.5 2.5" />
    </>
  ),
  fixed: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16M9 14.5l2 2 4-4" />
    </>
  ),
  vault: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5v1.2M12 14.3v1.2M8.5 12h1.2M14.3 12h1.2" />
    </>
  ),
  other: (
    <>
      <circle cx="6.5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="17.5" cy="12" r="1.5" />
    </>
  ),
};

export function OperationIcon({ id, size = 20 }: { id: OperationId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[id]}
    </svg>
  );
}

/* ---------- logo del protocolo ---------- */

export function ProtocolLogo({ project, name, size = 22 }: { project: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-ice text-[9px] font-semibold text-ink-secondary"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // logos de 48px del CDN de DeFiLlama: el optimizador de imágenes solo sumaría carga al servidor
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://icons.llamao.fi/icons/protocols/${encodeURIComponent(project)}?w=48&h=48`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-ice"
      style={{ width: size, height: size }}
    />
  );
}

/* ---------- barra de APY: base y recompensas ---------- */

/**
 * Largo proporcional al APY dentro de la escala de la vista. El tramo sólido
 * es el rendimiento base; el tramo claro, lo que se paga en tokens de incentivo.
 */
export function ApyBar({ pool, scale }: { pool: YieldPool; scale: number }) {
  const color = OPERATION_COLOR[pool.operation];
  const total = Math.max(pool.apy, 0);
  const reward = Math.min(Math.max(pool.apyReward ?? 0, 0), total);
  const base = total - reward;
  const width = (value: number) => `${Math.min((value / Math.max(scale, 0.01)) * 100, 100)}%`;
  return (
    <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-ice" aria-hidden>
      <span className="h-full" style={{ width: width(base), background: color }} />
      {reward > 0 && (
        <span
          className="h-full border-l-2 border-card"
          style={{ width: width(reward), background: color, opacity: 0.45, borderRadius: "0 4px 4px 0" }}
        />
      )}
    </span>
  );
}

/* ---------- semáforo de riesgo ---------- */

const RISK_COLOR: Record<RiskLevel, string> = { low: STATUS.up, medium: STATUS.warn, high: STATUS.down };
const RISK_ORDER: RiskLevel[] = ["low", "medium", "high"];

export function RiskLight({ pool, compact = false }: { pool: YieldPool; compact?: boolean }) {
  const { level, signals } = pool.risk;
  const reached = RISK_ORDER.indexOf(level);
  const reasons =
    signals.length > 0
      ? signals.map((s) => `• ${s.label}`).join("\n")
      : "Ninguna regla de riesgo se activa. No reemplaza una auditoría del contrato.";
  return (
    <span className="inline-flex cursor-help items-center gap-1.5" title={`${RISK_LABEL[level]}\n${reasons}`}>
      <span className="flex gap-0.5" aria-hidden>
        {RISK_ORDER.map((step, index) => (
          <span
            key={step}
            className="h-2 w-2 rounded-full"
            style={{ background: index <= reached ? RISK_COLOR[level] : "var(--color-ice)" }}
          />
        ))}
      </span>
      {!compact && <span className="text-[11px] text-ink-secondary">{RISK_LABEL[level]}</span>}
      <span className="sr-only">{`${RISK_LABEL[level]}. ${reasons}`}</span>
    </span>
  );
}

/* ---------- chips de características ---------- */

type Chip = { label: string; tone: "neutral" | "info" | "warn" };

export function poolChips(pool: YieldPool): Chip[] {
  const chips: Chip[] = pool.terms.map((term) => ({
    label: term.label,
    tone: term.kind === "maturity" || term.kind === "fixedBorrow" ? "info" : term.kind === "fee" ? "neutral" : "warn",
  }));
  if (pool.stablecoin) chips.push({ label: "Precio estable", tone: "info" });
  if (pool.ilRisk) chips.push({ label: "Pérdida impermanente", tone: "warn" });
  if ((pool.apyReward ?? 0) > 0) chips.push({ label: "Parte en tokens de incentivo", tone: "neutral" });
  if (pool.borrow?.apyBorrow != null) chips.push({ label: `Pedir prestado: ${formatApy(pool.borrow.apyBorrow)}`, tone: "neutral" });
  return chips;
}

const CHIP_TONE: Record<Chip["tone"], string> = {
  neutral: "border-line text-ink-secondary",
  info: "border-electric/40 text-electric",
  warn: "border-warn/40 text-warn",
};

export function Chips({ pool, limit = 4 }: { pool: YieldPool; limit?: number }) {
  const chips = poolChips(pool);
  if (chips.length === 0) return <span className="text-[10px] text-ink-muted">Sin plazo publicado</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {chips.slice(0, limit).map((chip) => (
        <span key={chip.label} className={`whitespace-nowrap rounded border px-1.5 py-px text-[10px] ${CHIP_TONE[chip.tone]}`}>
          {chip.label}
        </span>
      ))}
      {chips.length > limit && <span className="text-[10px] text-ink-muted">+{chips.length - limit}</span>}
    </span>
  );
}
