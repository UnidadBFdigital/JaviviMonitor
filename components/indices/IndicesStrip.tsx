"use client";

import Link from "next/link";
import { usePayload } from "@/lib/useSource";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatUsdCompact, formatPct } from "@/lib/format";
import type { IndexResult } from "@/lib/indices";

type Payload = { indices: IndexResult[]; fetchedAt: string };

function short(idx: IndexResult): string {
  if (idx.value === null) return "—";
  if (idx.unit === "usd") return formatUsdCompact(idx.value);
  return idx.value.toFixed(1);
}

// Tira compacta de los índices propietarios en la portada: es el activo
// intelectual de Blockfinity y debe verse antes que cualquier dato de terceros.
export function IndicesStrip() {
  const { data, error } = usePayload<Payload>("/api/indices");

  if (error) return null;

  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <span className="bf-slash bf-slash-gold" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
          Índices Blockfinity
        </p>
        <div
          className="h-px flex-1"
          style={{ background: "linear-gradient(to right, var(--color-line), transparent)" }}
        />
        <Link
          href="/indices"
          className="text-[11px] text-core transition-colors hover:text-electric"
        >
          metodologías →
        </Link>
      </div>

      {!data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="bf-shimmer h-[84px] rounded" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {data.indices.map((idx, i) => {
            const goodWay =
              idx.changePct === null ? undefined : (idx.changePct >= 0) === idx.higherIsBetter;
            const tone =
              goodWay === undefined ? "text-ink-muted" : goodWay ? "text-up" : "text-down";
            return (
              <Link
                key={idx.code}
                href="/indices"
                className="bf-frame bf-premium-frame bf-reveal group transition-transform duration-200 hover:-translate-y-0.5"
                style={{ "--bf-cut": "10px", "--bf-i": i } as React.CSSProperties}
                title={`${idx.name} — ver metodología`}
              >
                <div className="bg-charcoal px-3 py-2 transition-colors group-hover:bg-charcoal-raised">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold tracking-wider text-gold">
                      {idx.code}
                    </span>
                    {!idx.higherIsBetter && (
                      <span className="text-[8px] uppercase tracking-wide text-warn">inv</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[17px] font-bold tabular-nums leading-none">
                    {short(idx)}
                  </p>
                  <div className="mt-1.5 flex h-4 items-end justify-between gap-1">
                    <span className={`text-[10px] tabular-nums ${tone}`}>
                      {idx.changePct !== null ? formatPct(idx.changePct) : ""}
                    </span>
                    {idx.spark && idx.spark.length > 1 && (
                      <Sparkline
                        values={idx.spark}
                        positive={goodWay}
                        width={46}
                        height={18}
                        area={false}
                      />
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
