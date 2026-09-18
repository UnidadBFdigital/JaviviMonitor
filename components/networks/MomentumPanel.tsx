"use client";

import { Delta, Info, Na, TrendChip, formatPctValue } from "./atoms";
import { useIntel, type Row } from "./useNetworkIntel";

// Momentum con control de efecto base. El ranking no premia a la red que
// creció 400% desde cincuenta direcciones: ese caso vive en "emergentes",
// con su tamaño relativo a la vista.

function MomentumRow({ row, showRaw = false }: { row: Row; showRaw?: boolean }) {
  const { momentum, network } = row;
  return (
    <li className="flex items-center gap-2 border-b border-line/60 py-1.5 last:border-0">
      <span className="min-w-0 flex-1 truncate text-[12px]">{network.name}</span>
      <TrendChip signal={momentum.signal} />
      <span className="w-16 text-right text-[11px]">
        <Delta value={momentum.rawGrowthPct} />
      </span>
      {showRaw && (
        <span
          className="w-10 text-right text-[10px] tabular-nums text-ink-muted"
          title="Peso por tamaño: 0 = base insignificante, 1 = red grande. Multiplica al crecimiento."
        >
          ×{momentum.sizeFactor.toFixed(2)}
        </span>
      )}
    </li>
  );
}

export function MomentumPanel() {
  const { rows } = useIntel();

  const scored = rows.filter((r) => r.momentum.score !== null);
  const gainers = [...scored].sort((a, b) => b.momentum.score! - a.momentum.score!).slice(0, 5);
  const decliners = [...scored].sort((a, b) => a.momentum.score! - b.momentum.score!).slice(0, 5);
  const emerging = scored.filter((r) => r.momentum.emerging).sort((a, b) => (b.momentum.rawGrowthPct ?? 0) - (a.momentum.rawGrowthPct ?? 0));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Momentum de red
          <Info text="Compuesto de direcciones activas 30d (30%), transacciones 30d (25%), TVL 30d (30%) y commits 12s (15%), ajustado por tamaño." />
        </h3>
        <p className="text-[11px] text-ink-secondary">
          Crecimiento × tamaño relativo: una base chica no encabeza el ranking
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-up">Ganando momentum</p>
          {gainers.length === 0 ? (
            <p className="py-3 text-[11px] text-ink-muted">Sin series suficientes.</p>
          ) : (
            <ul>
              {gainers.map((row) => (
                <MomentumRow key={row.network.id} row={row} showRaw />
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-down">Perdiendo actividad</p>
          {decliners.length === 0 ? (
            <p className="py-3 text-[11px] text-ink-muted">Sin series suficientes.</p>
          ) : (
            <ul>
              {decliners.map((row) => (
                <MomentumRow key={row.network.id} row={row} showRaw />
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-warn">
            Emergentes
            <Info text="Crecimiento superior al 15% con tamaño relativo por debajo de la mediana: la cifra impresiona porque la base es chica." />
          </p>
          {emerging.length === 0 ? (
            <p className="py-3 text-[11px] text-ink-muted">
              Ninguna red chica está acelerando por encima del umbral en esta ventana.
            </p>
          ) : (
            <ul>
              {emerging.map((row) => (
                <MomentumRow key={row.network.id} row={row} showRaw />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function ResearchSignals() {
  const { signals } = useIntel();

  if (signals.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash bf-slash-gold" aria-hidden />
          Señales de research
        </h3>
        <p className="mt-0.5 max-w-3xl text-[11px] leading-relaxed text-ink-secondary">
          Dato, señal e interpretación separados a propósito. El texto se deriva por reglas de las
          mismas cifras del tablero: sin modelo de lenguaje, las mismas entradas dan siempre la
          misma lectura.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {signals.map((signal) => (
          <article key={signal.id} className="border-t-2 border-electric/70 bg-card-raised p-3">
            <p className="mb-2 text-[13px] font-semibold">{signal.network}</p>

            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Dato</p>
            <ul className="mb-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
              {signal.data.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="truncate text-ink-secondary">{row.label}</span>
                  <span
                    className={`shrink-0 tabular-nums ${
                      row.value === "N/A"
                        ? "text-ink-muted"
                        : row.direction === "up"
                          ? "text-up"
                          : row.direction === "down"
                            ? "text-down"
                            : "text-ink-secondary"
                    }`}
                  >
                    {row.value === "N/A" ? <Na /> : row.value}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Señal</p>
            <p className="mb-2 text-[11px] leading-relaxed text-ink">{signal.signal}</p>

            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gold">Interpretación</p>
            <p className="text-[11px] leading-relaxed text-ink-secondary">{signal.interpretation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Reexport para el panel de casos de uso, que muestra el mismo formato de cifra. */
export { formatPctValue };
