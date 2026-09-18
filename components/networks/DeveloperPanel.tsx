"use client";

import { useState } from "react";
import { CATEGORICAL, CHART_THEME, STATUS } from "@/lib/palette";
import { toolingScore } from "@/lib/networks/score";
import { indexToBase100 } from "@/lib/networks/series";
import type { NetworkMetrics } from "@/lib/networks/types";
import { Delta, Info, Na, ScoreBar, formatCount, relativeTime } from "./atoms";
import { TrendLines, type TrendSeries } from "./TrendLines";
import { useIntel } from "./useNetworkIntel";

// Dos preguntas distintas, dos lecturas distintas:
//   1. ¿dónde se está escribiendo código del protocolo? → serie de commits
//   2. ¿qué tan fácil es empezar a construir? → stack declarado
// El conteo de desarrolladores del ecosistema NO se aproxima con commits: se
// publica vacío con la fuente que haría falta.

/* ---------- crecimiento en el tiempo ---------- */

/** Área de commits semanales, 52 semanas, escalada a su propio máximo:
 *  la ficha compara la forma de la curva, no el nivel entre redes. */
function CommitSpark({ points, tone }: { points: { value: number }[]; tone: string }) {
  if (points.length < 4) return null;
  const W = 150;
  const H = 34;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const step = W / (values.length - 1);
  const line = values.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * (H - 3)).toFixed(1)}`).join(" ");

  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={tone} opacity={0.16} />
      <polyline points={line} fill="none" stroke={tone} strokeWidth={1.4} strokeLinejoin="round" />
      <line x1={0} y1={H - 0.5} x2={W} y2={H - 0.5} stroke={CHART_THEME.grid} strokeWidth={1} />
    </svg>
  );
}

function DevCard({ network }: { network: NetworkMetrics }) {
  const change = network.dev.commitsChangePct;
  const tone = change === null ? CHART_THEME.axis : change >= 0 ? STATUS.up : STATUS.down;

  return (
    <article className="border border-line bg-card-raised p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[12px] font-medium">{network.name}</p>
        <span className="shrink-0 text-[11px]">
          <Delta value={change} />
        </span>
      </div>

      <div className="mt-1.5">
        {network.history.commits.length >= 4 ? (
          <CommitSpark points={network.history.commits} tone={tone} />
        ) : (
          <p className="flex h-[34px] items-center text-[10px]">
            <Na reason={network.dev.unavailable ?? "GitHub no devolvió la serie semanal."} />
          </p>
        )}
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-ink-muted">
        <span className="tabular-nums">
          {network.dev.commits12w === null ? "—" : formatCount(network.dev.commits12w)} commits · 12 sem
        </span>
        <span className="truncate" title={`${network.dev.repo}${network.dev.repoNote ? ` — ${network.dev.repoNote}` : ""}`}>
          {network.dev.repo.split("/")[1] ?? network.dev.repo}
        </span>
      </div>
    </article>
  );
}

export function DeveloperPanel() {
  const { rows } = useIntel();
  const [view, setView] = useState<"serie" | "fichas">("serie");
  const [indexed, setIndexed] = useState(false);

  const withSeries = rows
    .filter((r) => r.network.history.commits.length > 4)
    .sort((a, b) => (b.network.dev.commits52w ?? 0) - (a.network.dev.commits52w ?? 0));

  const series: TrendSeries[] = withSeries.slice(0, 8).map((r, i) => ({
    id: r.network.id,
    name: r.network.name,
    color: CATEGORICAL[i % CATEGORICAL.length],
    points: indexed ? indexToBase100(r.network.history.commits) : r.network.history.commits,
  }));

  const ordered = [...rows].sort(
    (a, b) => (b.network.dev.commitsChangePct ?? -999) - (a.network.dev.commitsChangePct ?? -999)
  );

  // sin series, el gráfico dice por qué: casi siempre es el límite anónimo de
  // GitHub, que se levanta configurando GITHUB_TOKEN
  const reason = rows.map((r) => r.network.dev.unavailable).find((value) => value !== null);

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Desarrollo en el tiempo
          <Info text="Commits semanales del repositorio núcleo, 52 semanas. Mide el ritmo del cliente o monorepo principal, no la comunidad del ecosistema." />
        </h3>
        <div className="flex flex-wrap gap-1">
          {view === "serie" && (
            <button
              type="button"
              onClick={() => setIndexed(!indexed)}
              aria-pressed={indexed}
              title="Cada repositorio arranca en 100: compara aceleración, no tamaño del equipo."
              className={`mr-2 rounded border px-2 py-1 text-[11px] transition-colors ${
                indexed
                  ? "border-gold bg-gold/10 text-gold-bright"
                  : "border-line text-ink-secondary hover:border-gold/50 hover:text-ink"
              }`}
            >
              Base 100
            </button>
          )}
          {(
            [
              ["serie", "Serie comparada"],
              ["fichas", "Por red"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                view === id
                  ? "border-electric bg-electric/10 text-ink"
                  : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "serie" ? (
        <>
          <TrendLines
            series={series}
            formatValue={(v) => v.toFixed(0)}
            height={250}
            emptyLabel={
              reason
                ? `${reason}. Con GITHUB_TOKEN configurado el límite sube de 60 a 5.000 consultas por hora.`
                : "GitHub no devolvió series semanales para las redes filtradas."
            }
          />
          <p className="mt-2 text-[10px] text-ink-muted">
            Commits por semana · GitHub · las ocho redes con más actividad anual; el resto se ve en
            la vista «por red»
            {indexed && " · indexado a 100 en la primera semana con actividad"}
          </p>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {ordered.map((r) => (
            <DevCard key={r.network.id} network={r.network} />
          ))}
        </div>
      )}

      <p className="mt-3 border-l-2 border-warn bg-warn/5 py-1.5 pl-2.5 pr-2 text-[11px] leading-relaxed text-ink-secondary">
        <span className="font-medium text-warn">Qué NO dice este gráfico: </span>
        commits no son desarrolladores. Mide el repositorio del cliente o monorepo principal, que en
        redes con varios clientes —Ethereum— o stacks compartidos —Base y OP Mainnet— cuenta una
        parte del trabajo real. El conteo de desarrolladores activos del ecosistema exige Electric
        Capital, que no publica API: esa columna queda declarada y vacía en la ficha de cada red.
      </p>
    </section>
  );
}

/* ---------- accesibilidad para desarrollar ---------- */

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      title={label}
      aria-label={`${label}: ${on ? "sí" : "no"}`}
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: on ? STATUS.up : "#2b2f31" }}
    />
  );
}

export function BuildStackPanel() {
  const { rows } = useIntel();
  const ordered = [...rows].sort((a, b) => toolingScore(b.network) - toolingScore(a.network));

  const CAPABILITIES = [
    { key: "foundry", label: "Foundry", get: (n: NetworkMetrics) => n.tooling.foundry },
    { key: "hardhat", label: "Hardhat", get: (n: NetworkMetrics) => n.tooling.hardhat },
    { key: "remix", label: "Remix", get: (n: NetworkMetrics) => n.tooling.remix },
    { key: "faucet", label: "Faucet", get: (n: NetworkMetrics) => n.faucet !== null },
    { key: "grants", label: "Grants", get: (n: NetworkMetrics) => n.grants !== null },
    { key: "aa", label: "Abstracción de cuentas", get: (n: NetworkMetrics) => !/^no/i.test(n.tooling.accountAbstraction) },
    { key: "oracle", label: "Oráculos ≥2", get: (n: NetworkMetrics) => n.tooling.oracles.length >= 2 },
    { key: "index", label: "Indexadores ≥2", get: (n: NetworkMetrics) => n.tooling.indexers.length >= 2 },
  ];

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Accesibilidad para construir
          <Info text="Herramientas verificables con las que se empieza: frameworks, faucet, grants, abstracción de cuentas, oráculos e indexadores." />
        </h3>
        <p className="text-[11px] text-ink-secondary">Registro curado · el nombre enlaza a la documentación oficial</p>
      </div>

      <div className="space-y-1">
        {ordered.map(({ network }) => (
          <div
            key={network.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line/50 py-1.5 last:border-0"
          >
            <a
              href={network.docs}
              target="_blank"
              rel="noreferrer"
              className="w-28 shrink-0 truncate text-[12px] font-medium transition-colors hover:text-electric"
              title="Documentación oficial"
            >
              {network.name}
            </a>
            <span className="w-32 shrink-0 truncate text-[10px] text-ink-muted" title={`${network.language} · ${network.vm}`}>
              {network.language} · {network.vm}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {CAPABILITIES.map((capability) => (
                <Dot key={capability.key} on={capability.get(network)} label={capability.label} />
              ))}
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-[10px] text-ink-muted lg:block">
              {network.tooling.sdks.join(" · ")}
            </span>
            <span className="ml-auto shrink-0">
              <ScoreBar value={toolingScore(network) * 10} />
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
        <span>Columnas de puntos, en orden:</span>
        {CAPABILITIES.map((capability) => (
          <span key={capability.key} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-ink-muted/60" aria-hidden />
            {capability.label}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        Las redes no-EVM no puntúan Foundry ni Hardhat porque no aplican: su stack se acredita por
        SDK, wallets e indexadores propios. Comparar tooling entre familias de VM exige mirar la
        columna de lenguaje antes que la barra. Último push del repositorio:{" "}
        {ordered[0] ? relativeTime(ordered[0].network.dev.pushedAt) : "—"} en la red mejor equipada.
      </p>
    </section>
  );
}
