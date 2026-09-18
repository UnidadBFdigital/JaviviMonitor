"use client";

import Link from "next/link";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { UNCLASSIFIED } from "@/lib/rwaSectors";
import { useRwa } from "./useRwa";
import { useHistory } from "@/components/history/HistoryProvider";

// Momentum semanal por sector RWA en barras divergentes desde un eje central.
// El tamaño del sector va como texto y no como largo de barra: acá lo que se
// compara es la velocidad, no el tamaño — para eso está el donut.
export function RwaMomentumCard() {
  const { data, error } = useRwa();
  const history = useHistory();

  if (error)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Momentum del TVL por sector RWA</h3>
        <p className="py-6 text-sm text-ink-muted">No disponible.</p>
      </section>
    );

  if (!data)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Momentum del TVL por sector RWA</h3>
        <div className="mt-3 h-64 animate-pulse rounded bg-ice/50" />
      </section>
    );

  if (!data.source.ok || data.sectors.length === 0)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Momentum del TVL por sector RWA</h3>
        <p className="py-6 text-sm text-ink-muted">Dato no disponible.</p>
      </section>
    );

  const sectores = data.sectors.filter(
    (s) => s.name !== UNCLASSIFIED && s.change7dPct !== null
  );
  // la escala se fija con el mayor movimiento absoluto, con piso de 2% para
  // que una semana tranquila no exagere variaciones mínimas
  const escala = Math.max(2, ...sectores.map((s) => Math.abs(s.change7dPct ?? 0)));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Momentum del TVL por sector RWA</h3>
        <Link
          href="/tokenizacion"
          className="text-[11px] text-core underline hover:text-electric"
        >
          Tokenization Hub →
        </Link>
      </div>
      <p className="mb-4 text-xs text-ink-secondary">
        Variación de 7 días por sector. Qué parte de la tokenización se está moviendo esta semana. Tocá un sector para ver cómo evolucionó.
      </p>

      <div className="space-y-0.5">
        {sectores.map((s) => {
          const ch = s.change7dPct ?? 0;
          // tope de 40% por lado: el 10% restante es para la etiqueta de la barra
          // más larga, que antes se salía del borde de la tarjeta
          const ancho = (Math.abs(ch) / escala) * 40;
          const positivo = ch >= 0;
          return (
            <button
              type="button"
              key={s.name}
              onClick={() => history.open({ kind: "rwa-sector", id: s.name, label: s.name })}
              aria-label={`Ver histórico del sector ${s.name}`}
              className="group block w-full rounded px-1.5 py-1 text-left transition-colors hover:bg-ice/30"
            >
              <span className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate text-ink-secondary transition-colors group-hover:text-ink">
                  {s.name}
                  <span className="ml-1.5 text-[10px] text-core opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    ver histórico ↗
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {formatUsdCompact(s.tvlUsd)}
                </span>
              </span>
              <span className="relative mt-1 block h-4">
                {/* eje cero */}
                <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
                <span
                  className={`absolute top-1 h-2 rounded ${positivo ? "bg-up" : "bg-down"}`}
                  style={{
                    left: positivo ? "50%" : `${50 - ancho}%`,
                    width: `${Math.max(ancho, 0.6)}%`,
                  }}
                />
                <span
                  className={`absolute top-0 text-[11px] tabular-nums ${
                    positivo ? "text-up" : "text-down"
                  }`}
                  style={
                    positivo
                      ? { left: `calc(50% + ${ancho}% + 6px)` }
                      : { right: `calc(50% + ${ancho}% + 6px)` }
                  }
                >
                  {formatPct(ch)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-ink-muted">
        DeFiLlama en vivo · sectores clasificados por Blockfinity · escala ±{escala.toFixed(1)}%
      </p>
    </section>
  );
}
