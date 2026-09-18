"use client";

import { useState } from "react";
import { usePayload } from "@/lib/useSource";
import { relativeTime } from "@/components/news/NewsList";
import type { Headline } from "@/lib/sources/news";
import type { SourceResult } from "@/lib/sources/types";

// Radar institucional: cinco frentes, uno por pestaña, con el conteo visible
// para que se note de un vistazo dónde hay movimiento hoy.

type Payload = {
  stablecoins: SourceResult<Headline[]>;
  tokenizacion: SourceResult<Headline[]>;
  regulacion: SourceResult<Headline[]>;
  bancos: SourceResult<Headline[]>;
  riesgos: SourceResult<Headline[]>;
};

const FRENTES: { key: keyof Payload; label: string; tone: string }[] = [
  { key: "stablecoins", label: "Stablecoins", tone: "border-electric text-electric" },
  { key: "tokenizacion", label: "Tokenización", tone: "border-up text-up" },
  { key: "regulacion", label: "Regulación", tone: "border-warn text-warn" },
  { key: "bancos", label: "Bancos", tone: "border-core text-core" },
  { key: "riesgos", label: "Riesgos", tone: "border-down text-down" },
];

function count(r: SourceResult<Headline[]> | undefined): number {
  return r?.ok ? r.data.length : 0;
}

export function InstitutionalRadar() {
  const { data, error } = usePayload<Payload>("/api/terminal/radar");
  const [activo, setActivo] = useState<keyof Payload>("tokenizacion");

  const actual = data?.[activo];

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Radar institucional</h2>
        <p className="text-[10px] text-ink-muted">
          Alertas clasificadas por el motor de News B2B — sin ruido retail
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FRENTES.map((f) => {
          const n = count(data?.[f.key]);
          const on = activo === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActivo(f.key)}
              aria-pressed={on}
              className={`rounded border px-2.5 py-1 text-[11px] transition-colors ${
                on ? `${f.tone} bg-ice/40 font-medium` : "border-line text-ink-secondary hover:bg-ice/40"
              }`}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums text-ink-muted">{n}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="py-6 text-sm text-ink-muted">No disponible.</p>}
      {!data && !error && <div className="mt-3 h-56 animate-pulse rounded bg-ice/50" />}

      {data && (
        <div className="mt-3">
          {!actual?.ok || actual.data.length === 0 ? (
            <p className="py-6 text-sm text-ink-muted">
              Sin alertas de este frente en la ventana de noticias actual.
            </p>
          ) : (
            <ul>
              {actual.data.map((h) => (
                <li key={h.url} className="border-b border-line/60 py-2 last:border-0">
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] leading-snug hover:text-electric"
                  >
                    {h.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-semibold text-ink-secondary">{h.outlet}</span>
                    <span className="text-ink-muted">{relativeTime(h.publishedAt)}</span>
                    {h.entities.slice(0, 3).map((e) => (
                      <span key={e} className="rounded bg-ice px-1.5 py-0.5 text-ink-secondary">
                        {e}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
