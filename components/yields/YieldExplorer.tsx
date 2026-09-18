"use client";

import { useEffect, useState } from "react";
import { useHistory } from "@/components/history/HistoryProvider";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { fetchShared } from "@/lib/fetchShared";
import {
  ASSETS,
  OPERATION_BY_ID,
  RISK_PROFILES,
  type AssetFilter,
  type OperationId,
  type RiskProfileId,
  type YieldPool,
  type YieldSort,
} from "@/lib/yields";
import type { YieldReference, YieldsPayload } from "@/lib/yieldsPayload";
import { formatApy, formatUsdCompact } from "./atoms";
import { FeaturedPools } from "./FeaturedPools";
import { OperationCards } from "./OperationCards";
import { PoolTable } from "./PoolTable";
import { YieldGlossary } from "./YieldGlossary";
import { YieldRangeChart } from "./YieldRangeChart";

// Explorador de rendimientos DeFi. Se usa como una conversación en tres
// preguntas —qué tenés, qué querés hacer, cuánto riesgo aceptás— y todo lo
// demás responde a esas tres elecciones: rangos, destacados y tabla completa.

type Loaded = { key: string; payload: YieldsPayload | null; error: boolean };

const SORT_PRESETS: { label: string; sort: YieldSort; dir: "asc" | "desc" }[] = [
  { label: "Mayor rendimiento", sort: "apy", dir: "desc" },
  { label: "Más capital", sort: "tvl", dir: "desc" },
  { label: "Rendimiento en alza", sort: "trend", dir: "desc" },
  { label: "Menos señales de riesgo", sort: "risk", dir: "asc" },
];

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <p className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/60 font-mono text-[10px] text-gold-bright">
        {n}
      </span>
      <span className="text-[13px] font-semibold">{title}</span>
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </p>
  );
}

function PulseTile({
  label,
  value,
  note,
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="block text-[10px] uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      <span className="mt-1 block text-xl font-semibold tabular-nums leading-none">{value}</span>
      <span className="mt-1 block truncate text-[10px] text-ink-muted">{note}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="bf-reveal rounded-lg border border-line bg-card p-3 text-left transition-colors hover:border-electric/50">
      {body}
    </button>
  ) : (
    <div className="bf-reveal rounded-lg border border-line bg-card p-3">{body}</div>
  );
}

export function YieldExplorer() {
  const history = useHistory();
  const [asset, setAsset] = useState<AssetFilter>("all");
  const [op, setOp] = useState<OperationId | "all">("all");
  const [risk, setRisk] = useState<RiskProfileId>("balanced");
  const [chain, setChain] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<YieldSort>("apy");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [loaded, setLoaded] = useState<Loaded>({ key: "", payload: null, error: false });

  // una petición por término buscado, no por tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ asset, op, risk, sort, dir, page: String(page), size: String(size) });
  if (chain) params.set("chain", chain);
  if (debounced) params.set("q", debounced);
  const url = `/api/yields?${params.toString()}`;

  useEffect(() => {
    let alive = true;
    fetchShared<YieldsPayload>(url)
      .then((payload) => alive && setLoaded({ key: url, payload, error: false }))
      .catch(() => alive && setLoaded({ key: url, payload: null, error: true }));
    return () => {
      alive = false;
    };
  }, [url]);

  const loading = loaded.key !== url;
  const payload = loaded.payload;
  const ready = payload?.ok ? payload : null;

  const openPool = (pool: YieldPool) =>
    history.open({ kind: "yield-pool", id: pool.id, label: `${pool.projectName} · ${pool.symbol}` });
  const openReference = (reference: YieldReference | null) =>
    reference ? () => history.open({ kind: "yield-pool", id: reference.poolId, label: reference.name }) : undefined;

  function choose<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function sortBy(next: YieldSort) {
    if (next === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(next);
      setDir(next === "risk" ? "asc" : "desc");
    }
    setPage(1);
  }

  const riskProfile = RISK_PROFILES.find((r) => r.id === risk)!;
  const assetInfo = ASSETS.find((a) => a.id === asset)!;
  const chainOptions = ready ? ready.chains : [];

  if (!payload && loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="bf-shimmer h-20 rounded-lg" />
          ))}
        </div>
        <div className="bf-shimmer h-40 rounded-lg" />
        <div className="bf-shimmer h-96 rounded-lg" />
      </div>
    );
  }

  if (!loading && (loaded.error || (payload && !payload.ok)) && !ready) {
    return (
      <div className="rounded-lg border border-line bg-card p-6">
        <Unavailable source={payload && !payload.ok ? payload.source : "DeFiLlama Yields"} />
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
      {/* pulso del mercado: referencias fijas, no cambian con los filtros */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <PulseTile
          label="Dólares, lo típico"
          value={formatApy(ready.pulse.dollarMedianApy)}
          note={`mediana de ${ready.pulse.dollarPools} pools de stablecoins con señales bajas`}
        />
        <PulseTile
          label="Staking de ETH"
          value={formatApy(ready.pulse.ethStaking?.apy ?? null)}
          note={ready.pulse.ethStaking?.name ?? "sin referencia"}
          onClick={openReference(ready.pulse.ethStaking)}
        />
        <PulseTile
          label="Staking de SOL"
          value={formatApy(ready.pulse.solStaking?.apy ?? null)}
          note={ready.pulse.solStaking?.name ?? "sin referencia"}
          onClick={openReference(ready.pulse.solStaking)}
        />
        <PulseTile
          label="BTC, lo típico"
          value={formatApy(ready.pulse.btcMedianApy)}
          note={`mediana de ${ready.pulse.btcPools} pools de BTC con señales bajas`}
        />
        <PulseTile
          label="Universo"
          value={ready.universe.pools.toLocaleString("es-BO")}
          note={`pools · ${formatUsdCompact(ready.universe.tvlUsd)} depositados`}
        />
      </div>

      {/* preguntas 1 y 3 */}
      <section className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-card p-4 lg:grid-cols-2">
        <div>
          <StepTitle n={1} title="¿Qué tenés?" hint={assetInfo.hint} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Activo">
            {ASSETS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(setAsset)(option.id)}
                aria-pressed={asset === option.id}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  asset === option.id
                    ? "border-electric bg-electric/10 text-ink"
                    : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <StepTitle n={3} title="¿Cuánto riesgo aceptás?" hint={riskProfile.hint} />
          <div className="flex" role="group" aria-label="Perfil de riesgo">
            {RISK_PROFILES.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(setRisk)(option.id)}
                aria-pressed={risk === option.id}
                className={`border px-3 py-1 text-[12px] transition-colors ${index > 0 ? "-ml-px" : ""} ${
                  index === 0 ? "rounded-l-full" : index === RISK_PROFILES.length - 1 ? "rounded-r-full" : ""
                } ${
                  risk === option.id
                    ? "border-gold bg-gold/10 text-gold-bright"
                    : "border-line text-ink-secondary hover:border-gold/50 hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* pregunta 2 */}
      <section>
        <StepTitle
          n={2}
          title="¿Qué querés hacer?"
          hint={op === "all" ? "Elegí una operación para ver solo esos pools." : OPERATION_BY_ID.get(op)?.description}
        />
        <OperationCards operations={ready.operations} selected={op} onSelect={choose(setOp)} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold">
            <span className="bf-slash" aria-hidden />
            ¿Cuánto rinde cada tipo de operación?
          </h3>
          <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-ink-secondary">
            Lo normal antes que lo excepcional: la barra muestra dónde rinde la mitad de los pools. Un APY muy por encima de
            su barra merece más preguntas, no menos.
          </p>
          <YieldRangeChart operations={ready.operations} selected={op} onSelect={choose(setOp)} />
        </section>

        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold">
            <span className="bf-slash bf-slash-gold" aria-hidden />
            Mejores opciones con señales bajas
          </h3>
          <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-ink-secondary">
            El mayor rendimiento entre pools con más de $10M, sin pérdida impermanente y sin señales de riesgo relevantes.
            Uno por protocolo. Tocá una para ver su histórico.
          </p>
          <FeaturedPools pools={ready.featured} onOpen={openPool} />
        </section>
      </div>

      {/* tabla completa */}
      <section className="rounded-lg border border-line bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold">
            <span className="bf-slash" aria-hidden />
            Todos los pools
          </h3>
          <p className="text-[11px] text-ink-secondary">
            {ready.total.toLocaleString("es-BO")} pools con estos filtros · tocá una fila para ver su histórico de APY y TVL
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar USDC, Aave, Base…"
            aria-label="Buscar pool por activo, protocolo o red"
            className="w-full rounded border border-line bg-surface px-2 py-1 text-xs outline-none placeholder:text-ink-muted focus:border-core sm:w-56"
          />
          <select
            value={chain}
            onChange={(event) => choose(setChain)(event.target.value)}
            aria-label="Red"
            className="rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-core"
          >
            <option value="">Todas las redes</option>
            {chain && !chainOptions.some((c) => c.name === chain) && <option value={chain}>{chain}</option>}
            {chainOptions.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name} ({option.count})
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Orden">
            {SORT_PRESETS.map((preset) => {
              const active = sort === preset.sort && dir === preset.dir;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSort(preset.sort);
                    setDir(preset.dir);
                    setPage(1);
                  }}
                  className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                    active ? "border-electric bg-electric/10 text-ink" : "border-line text-ink-secondary hover:text-ink"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <PoolTable rows={ready.rows} sort={sort} dir={dir} onSort={sortBy} onOpen={openPool} />

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary">
          <span className="tabular-nums">
            {ready.total === 0
              ? "0 resultados"
              : `${(ready.page - 1) * size + 1}–${Math.min(ready.page * size, ready.total)} de ${ready.total.toLocaleString("es-BO")}`}
          </span>
          <label className="flex items-center gap-1 text-[10px] text-ink-muted">
            Filas
            <select
              value={size}
              onChange={(event) => choose(setSize)(Number(event.target.value))}
              className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink outline-none focus:border-core"
            >
              {[12, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, ready.page - 1))}
              disabled={ready.page <= 1}
              className="rounded border border-line px-2 py-0.5 hover:bg-ice/50 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="px-1 tabular-nums">
              {ready.page} / {ready.pages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(ready.pages, ready.page + 1))}
              disabled={ready.page >= ready.pages}
              className="rounded border border-line px-2 py-0.5 hover:bg-ice/50 disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
          Universo: pools con más de $100k depositados que pagan rendimiento. Se excluyen{" "}
          {ready.universe.withoutYield.toLocaleString("es-BO")} pools que hoy rinden 0% (colateral sin interés).
          {!ready.universe.borrowRates && " La tasa para pedir prestado no respondió en esta consulta."} El APY de DeFiLlama es
          anualizado y variable; la tasa histórica de préstamo solo está en su API de pago.
        </p>
        <SourceBadge source={ready.source} url={ready.sourceUrl} fetchedAt={ready.fetchedAt} stale={ready.stale} />
      </section>

      <YieldGlossary />
    </div>
  );
}
