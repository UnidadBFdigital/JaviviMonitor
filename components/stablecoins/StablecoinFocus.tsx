"use client";

import { useState } from "react";
import { usePayload } from "@/lib/useSource";
import { useHistory } from "@/components/history/HistoryProvider";
import { NewsList } from "@/components/news/NewsList";
import { formatUsdCompact, formatPct } from "@/lib/format";
import type { Stablecoin } from "@/lib/sources/stablecoins";
import type { Headline } from "@/lib/sources/news";
import type { SourceResult } from "@/lib/sources/types";
import cbdcJson from "@/data/cbdc-tracker.json";

type Payload = {
  focus: SourceResult<Stablecoin[]>;
  pagos: SourceResult<Headline[]>;
  banca: SourceResult<Headline[]>;
  regulacion: SourceResult<Headline[]>;
};

// Perfil de cada emisor: por qué está en la lista corta institucional.
const PERFIL: Record<string, string> = {
  USDT: "El más grande y el más usado en pagos reales de mercados emergentes. También el de perfil regulatorio más discutido.",
  USDC: "El de mayor aceptación institucional en Estados Unidos y Europa; emisor cotizado en bolsa.",
  RLUSD: "La apuesta de Ripple por el corredor de pagos transfronterizos con respaldo regulado.",
  PYUSD: "La entrada de una plataforma de pagos masiva: distribución sobre una base de usuarios ya existente.",
  FDUSD: "Emisor con base en Asia; relevante para corredores de comercio con esa región.",
};

const SUBSECCIONES = [
  { key: "pagos", label: "Payments", desc: "Redes de tarjetas, procesadores y remesas" },
  { key: "banca", label: "Banking Adoption", desc: "Bancos y custodios entrando al activo" },
  { key: "regulacion", label: "Regulatory Watch", desc: "Marcos que definen quién puede emitir" },
] as const;

export function StablecoinFocus() {
  const { data, error } = usePayload<Payload>("/api/stablecoins");
  const history = useHistory();
  const [tab, setTab] = useState<(typeof SUBSECCIONES)[number]["key"]>("pagos");

  const marcos = cbdcJson.frameworks.filter(
    (f) => f.name === "MiCA" || f.name === "GENIUS Act"
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Emisores en foco</h3>
        <p className="mb-3 text-xs text-ink-secondary">
          Los cinco que definen la tesis institucional. RLUSD, PYUSD y FDUSD quedan fuera del top 10
          por circulante, pero no por relevancia.
        </p>

        {error && <p className="py-6 text-sm text-ink-muted">No disponible.</p>}
        {!data && !error && <div className="h-40 animate-pulse rounded bg-ice/50" />}

        {data?.focus.ok && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.focus.data.map((s) => (
              <div key={s.symbol} className="rounded border border-line/70 bg-card-raised p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => history.open({ kind: "stablecoin", id: s.id, label: `${s.symbol} · ${s.name}` })}
                    title={`Ver histórico del supply de ${s.symbol}`}
                    className="text-sm font-semibold transition-colors hover:text-electric"
                  >
                    {s.symbol} <span className="text-[10px] font-normal text-core">histórico ↗</span>
                  </button>
                  <span
                    className={`text-[11px] tabular-nums ${
                      (s.change7dPct ?? 0) >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {formatPct(s.change7dPct)} 7d
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold tabular-nums leading-none">
                  {formatUsdCompact(s.circulatingUsd)}
                </p>
                <p className="mt-0.5 text-[10px] text-ink-muted">
                  {s.name} · {s.pegMechanism}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">
                  {PERFIL[s.symbol.toUpperCase()] ?? "—"}
                </p>
                {s.chains.length > 0 && (
                  <p className="mt-2 border-t border-line/60 pt-1.5 text-[10px] text-ink-muted">
                    Principales redes: {s.chains.slice(0, 3).map((c) => c.chain).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Frentes de adopción</h3>
          <p className="text-[10px] text-ink-muted">Clasificado por el motor de News B2B</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUBSECCIONES.map((s) => (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              aria-pressed={tab === s.key}
              className={`rounded border px-2.5 py-1 text-[11px] transition-colors ${
                tab === s.key
                  ? "border-electric bg-electric/10 font-medium text-electric"
                  : "border-line text-ink-secondary hover:bg-ice/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-ink-muted">
          {SUBSECCIONES.find((s) => s.key === tab)?.desc}
        </p>

        {!data && !error && <div className="mt-3 h-48 animate-pulse rounded bg-ice/50" />}
        {data && (
          <div className="mt-2">
            <NewsList
              result={data[tab]}
              emptyLabel="Sin titulares de este frente en la ventana actual."
            />
          </div>
        )}

        {tab === "regulacion" && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line/60 pt-3 lg:grid-cols-2">
            {marcos.map((f) => (
              <div key={f.name} className="rounded border border-line/70 bg-card-raised p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold">{f.name}</h4>
                  <span className="rounded bg-electric/15 px-1.5 py-0.5 text-[10px] text-electric">
                    {f.jurisdiction}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">{f.note}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
