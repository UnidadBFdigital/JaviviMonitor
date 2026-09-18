"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";
import {
  formatMetric,
  levelFor,
  moduleXp,
  totalXp,
  type NexumCurriculum,
  type NexumMetric,
  type NexumModule,
} from "@/lib/nexum";
import { AnimatedNumber, NexumChartCard } from "./NexumVisuals";
import { SchemeCanvas } from "./SchemeCanvas";
import { TerminalMap, TERMINAL_VIEWS } from "./TerminalMap";
import { ExercisePanel } from "./ExercisePanel";
import { useNexumLive, useNexumMode, useNexumProgress, type LiveValue } from "./useNexum";

// NEXUM Intelligence Layer — la versión de aula del terminal.
//
// Pantalla fija: en escritorio la página ocupa exactamente el alto de la
// ventana y no scrollea; scrollea cada columna por dentro. Es deliberado —
// en clase, con la pantalla proyectada, el instructor necesita que el riel
// de módulos y el panel de práctica estén siempre a la vista. En móvil se
// desarma en una sola columna y vuelve el scroll normal.

type Tab = "panorama" | "esquema" | "glosario";

const TAB_LABEL: Record<Tab, string> = {
  panorama: "Panorama",
  esquema: "Esquema",
  glosario: "Glosario",
};

// El conteo de vistas sale de la navegación real, no del currículo: si
// mañana se agrega una vista al terminal, el aula la cuenta sola.
function resolveMetric(metric: NexumMetric): NexumMetric {
  return metric.id === "map.views" ? { ...metric, value: TERMINAL_VIEWS } : metric;
}

/* ---------- ficha de indicador ---------- */

function KpiTile({
  metric,
  index,
  live,
}: {
  metric: NexumMetric;
  index: number;
  live?: LiveValue;
}) {
  const [open, setOpen] = useState(false);
  const drift =
    live && metric.value !== 0 ? ((live.value - metric.value) / metric.value) * 100 : null;

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      className={`nx-enter group relative overflow-hidden border p-2.5 text-left transition-colors ${
        metric.proprietary
          ? "bf-premium border-charcoal-line hover:bg-charcoal-raised"
          : "border-line bg-card hover:bg-card-raised"
      }`}
      style={{ "--nx-i": index } as React.CSSProperties}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[10px] uppercase tracking-[0.08em] text-ink-muted">
          {metric.label}
        </p>
        {metric.deltaPct !== undefined && metric.deltaPct !== null && (
          <span
            className={`shrink-0 text-[10px] font-medium tabular-nums ${
              metric.deltaPct >= 0 ? "text-up" : "text-down"
            }`}
          >
            {metric.deltaPct >= 0 ? "+" : "−"}
            {Math.abs(metric.deltaPct).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-1 flex items-end justify-between gap-2">
        <AnimatedNumber
          value={live ? live.value : metric.value}
          unit={metric.unit}
          className={`text-lg font-semibold ${metric.proprietary ? "text-gold-bright" : "text-ink"}`}
        />
        {metric.spark && <Sparkline values={metric.spark} width={68} height={22} positive />}
      </div>

      {live && drift !== null && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden />
          dato vivo · {drift >= 0 ? "+" : "−"}
          {Math.abs(drift).toFixed(1)}% vs. snapshot
        </p>
      )}

      {open && (
        <p className="nx-enter mt-1.5 border-t border-line pt-1.5 text-[10.5px] leading-relaxed text-ink-secondary">
          {metric.hint}
          {live && (
            <span className="mt-1 block text-ink-muted">
              Snapshot: {formatMetric(metric.value, metric.unit)} · fuente viva: {live.source}
            </span>
          )}
        </p>
      )}
      {!open && (
        <span className="pointer-events-none absolute bottom-1.5 right-2 text-[9px] text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
          ver lectura
        </span>
      )}
    </button>
  );
}

/* ---------- riel de módulos ---------- */

function ModuleRail({
  modules,
  activeId,
  solvedByModule,
  onSelect,
}: {
  modules: NexumModule[];
  activeId: string;
  solvedByModule: Record<string, number>;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="flex min-h-0 flex-col border border-line bg-card">
      <p className="border-b border-line px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        Ruta de aprendizaje
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {modules.map((item, i) => {
          const isActive = item.id === activeId;
          const solved = solvedByModule[item.id] ?? 0;
          const complete = solved === item.exercises.length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "true" : undefined}
              className={`mb-1 flex w-full items-start gap-2 border-l-2 py-1.5 pl-2 pr-1.5 text-left transition-all duration-150 ${
                isActive
                  ? "border-electric bg-electric/10"
                  : "border-transparent hover:border-line hover:bg-ice/40 hover:pl-2.5"
              }`}
            >
              <span
                className={`mt-px font-mono text-[9px] ${isActive ? "text-electric" : "text-ink-muted"}`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[12px] leading-tight ${
                    isActive ? "font-medium text-ink" : "text-ink-secondary"
                  }`}
                >
                  {item.title}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="h-0.5 w-12 bg-ice">
                    <span
                      className={`block h-full transition-all duration-500 ${
                        complete ? "bg-up" : "bg-electric"
                      }`}
                      style={{ width: `${(solved / item.exercises.length) * 100}%` }}
                    />
                  </span>
                  <span className="text-[9px] tabular-nums text-ink-muted">
                    {solved}/{item.exercises.length}
                  </span>
                  <span className="ml-auto text-[9px] text-ink-muted">{item.duration}′</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- cabecera ---------- */

function LevelRing({ progress, label }: { progress: number; label: string }) {
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90 h-9 w-9" aria-hidden>
        <circle cx="18" cy="18" r={R} fill="none" stroke="#262a2b" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke="#c9a227"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          className="nx-arc"
        />
      </svg>
      <span className="text-[9px] font-semibold tabular-nums text-gold">{label}</span>
    </span>
  );
}

function ModeSwitch({
  mode,
  pin,
  onChange,
}: {
  mode: "student" | "instructor";
  pin: string;
  onChange: (mode: "student" | "instructor") => void;
}) {
  const [asking, setAsking] = useState(false);
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);

  if (mode === "instructor") {
    return (
      <button
        type="button"
        onClick={() => onChange("student")}
        className="border border-gold/60 bg-gold/10 px-2 py-1 text-[10px] font-medium text-gold-bright transition-colors hover:bg-gold/20"
      >
        Modo instructor · salir
      </button>
    );
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="border border-line px-2 py-1 text-[10px] text-ink-secondary transition-colors hover:border-gold/60 hover:text-ink"
      >
        Modo instructor
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value === pin) {
          onChange("instructor");
          setAsking(false);
          setValue("");
          setBad(false);
        } else {
          setBad(true);
        }
      }}
      className="flex items-center gap-1"
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setBad(false);
        }}
        placeholder="PIN"
        aria-label="PIN de instructor"
        inputMode="numeric"
        className={`w-16 border bg-card-raised px-1.5 py-1 text-[10px] tabular-nums outline-none ${
          bad ? "nx-shake border-down" : "border-line focus:border-gold"
        }`}
      />
      <button type="submit" className="text-[10px] text-core hover:text-electric">
        ok
      </button>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          setValue("");
        }}
        className="text-[10px] text-ink-muted hover:text-ink"
      >
        ✕
      </button>
    </form>
  );
}

/* ---------- capa ---------- */

export function NexumLayer({ curriculum }: { curriculum: NexumCurriculum }) {
  const [activeId, setActiveId] = useState(curriculum.modules[0].id);
  const [tab, setTab] = useState<Tab>("panorama");
  const { progress, solve, reveal, visit, reset } = useNexumProgress();
  const { mode, setMode } = useNexumMode();
  const { live, on: liveOn, loading: liveLoading, error: liveError, toggle: toggleLive } = useNexumLive();
  const stageRef = useRef<HTMLDivElement>(null);

  const active = curriculum.modules.find((m) => m.id === activeId) ?? curriculum.modules[0];
  const max = totalXp(curriculum.modules);
  const { current, next, progress: levelProgress } = levelFor(progress.xp, curriculum.levels);

  const solvedByModule: Record<string, number> = {};
  curriculum.modules.forEach((m) => {
    solvedByModule[m.id] = m.exercises.filter((e) => progress.exercises[e.id]?.correct).length;
  });

  // se registra la visita al módulo abierto: alimenta el riel de progreso
  useEffect(() => {
    visit(active.id);
  }, [active.id, visit]);

  // el contenido nuevo se lee desde arriba, no desde donde quedó el anterior
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
  }, [activeId, tab]);

  // Flechas ← → para pasar de módulo: en clase, con la pantalla proyectada,
  // no se quiere buscar el riel con el mouse. Se ignora mientras se escribe.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const index = curriculum.modules.findIndex((m) => m.id === activeId);
      const step = event.key === "ArrowRight" ? 1 : -1;
      const target = curriculum.modules[index + step];
      if (!target) return;
      event.preventDefault();
      setActiveId(target.id);
      setTab("panorama");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, curriculum.modules]);

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-2.5rem)] lg:overflow-hidden">
      {/* ---------- cabecera del aula ---------- */}
      <header className="relative shrink-0 overflow-hidden border border-line bg-card px-3.5 py-2.5">
        <div className="bf-grid-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div
          className="nx-scan pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 opacity-40"
          style={{ background: "linear-gradient(90deg, transparent, rgba(47,102,255,0.14), transparent)" }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-electric">
              NEXUM Intelligence Layer
            </p>
            <h1 className="flex items-baseline gap-2 text-base font-semibold tracking-tight">
              <span className="bf-slash" aria-hidden />
              Aula del terminal
              <span className="text-[10px] font-normal text-ink-muted">
                {curriculum.snapshotLabel}
              </span>
            </h1>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleLive}
              aria-pressed={liveOn}
              className={`flex items-center gap-1.5 border px-2 py-1 text-[10px] font-medium transition-colors ${
                liveOn
                  ? "border-up/60 bg-up/10 text-up"
                  : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${liveOn ? "bg-up" : "bg-ink-muted"}`}
                aria-hidden
              />
              {liveLoading ? "consultando…" : liveOn ? "Dato vivo activo" : "Dato vivo"}
            </button>

            <ModeSwitch mode={mode} pin={curriculum.instructorPin} onChange={setMode} />

            <div className="flex items-center gap-2 border-l border-line pl-3">
              <LevelRing progress={levelProgress} label={`${Math.round(levelProgress * 100)}`} />
              <div className="leading-tight">
                <p className="text-[11px] font-semibold text-ink">{current.title}</p>
                <p className="text-[9px] tabular-nums text-ink-muted">
                  {progress.xp}/{max} XP
                  {next && ` · faltan ${next.xp - progress.xp} para ${next.title}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {liveError && (
          <p className="relative mt-1.5 text-[10px] text-warn">
            Las fuentes en vivo no respondieron. El snapshot sigue siendo válido para la clase.
          </p>
        )}
        {liveOn && !liveError && (
          // con el dato vivo encendido las fichas cambian de valor: hay que
          // decir explícitamente que los ejercicios siguen usando la foto
          <p className="relative mt-1.5 text-[10px] text-ink-muted">
            Las fichas muestran el valor de las fuentes ahora mismo. Los ejercicios se resuelven
            igual con el snapshot del {curriculum.snapshotDate}: la comparación es para ver cuánto
            se movió el mercado, no para cambiar la respuesta.
          </p>
        )}
      </header>

      {/* ---------- tres columnas ---------- */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[188px_minmax(0,1fr)_336px]">
        <div className="hidden min-h-0 lg:flex lg:flex-col">
          <ModuleRail
            modules={curriculum.modules}
            activeId={activeId}
            solvedByModule={solvedByModule}
            onSelect={(id) => {
              setActiveId(id);
              setTab("panorama");
            }}
          />
        </div>

        {/* selector compacto para móvil */}
        <div className="flex gap-1.5 overflow-x-auto lg:hidden">
          {curriculum.modules.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setActiveId(m.id);
                setTab("panorama");
              }}
              className={`shrink-0 border px-2 py-1 font-mono text-[10px] transition-colors ${
                m.id === activeId
                  ? "border-electric bg-electric/10 text-ink"
                  : "border-line text-ink-muted"
              }`}
            >
              {String(i + 1).padStart(2, "0")} {m.code}
            </button>
          ))}
        </div>

        {/* ---------- escenario ---------- */}
        <section className="flex min-h-0 flex-col border border-line bg-surface">
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-electric">
                {active.vertical}
              </p>
              <h2 className="truncate text-sm font-semibold">{active.title}</h2>
            </div>
            <Link
              href={active.href}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-core transition-colors hover:text-electric"
            >
              ver en el terminal ↗
            </Link>
            <div className="ml-auto flex items-center gap-1">
              {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={tab === key}
                  className={`border px-2 py-1 text-[10px] transition-colors ${
                    tab === key
                      ? "border-electric bg-electric/10 text-ink"
                      : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {key === "panorama" && active.stage === "map" ? "Mapa" : TAB_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          <div ref={stageRef} className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "panorama" && (
              <div key={`${active.id}-panorama`} className="space-y-3">
                <div className="nx-enter grid grid-cols-1 gap-2 md:grid-cols-3">
                  {(
                    [
                      ["Qué es", active.concept.what],
                      ["Cómo se lee", active.concept.read],
                      ["Por qué importa", active.concept.why],
                    ] as const
                  ).map(([label, text], i) => (
                    <div
                      key={label}
                      className="nx-enter border-t-2 border-electric/70 bg-card px-2.5 pb-2.5 pt-2"
                      style={{ "--nx-i": i } as React.CSSProperties}
                    >
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-electric">
                        {label}
                      </p>
                      <p className="text-[11.5px] leading-relaxed text-ink-secondary">{text}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                  {active.metrics.map((metric, i) => (
                    <KpiTile
                      key={metric.id}
                      metric={resolveMetric(metric)}
                      index={i}
                      live={live?.values[metric.id]}
                    />
                  ))}
                </div>

                {active.stage === "map" ? (
                  <TerminalMap />
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {active.charts.map((chart, i) => (
                      <NexumChartCard key={chart.id} chart={chart} index={i} />
                    ))}
                  </div>
                )}

                {/* el objetivo del módulo cierra el panorama: el alumno sabe
                    contra qué se mide antes de pasar a la práctica */}
                <div className="nx-enter border-t border-line pt-2.5">
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-gold">
                    Al terminar este módulo deberías poder
                  </p>
                  <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
                    {active.checkpoints.map((checkpoint, i) => (
                      <li
                        key={checkpoint}
                        className="nx-enter flex gap-2 border-l-2 border-gold/50 bg-charcoal py-1.5 pl-2 pr-2 text-[11px] leading-relaxed text-ink-secondary"
                        style={{ "--nx-i": i } as React.CSSProperties}
                      >
                        <span className="font-mono text-[10px] text-gold">{i + 1}</span>
                        {checkpoint}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tab === "esquema" && (
              <div key={`${active.id}-esquema`} className="nx-enter space-y-2">
                <div>
                  <h3 className="flex items-baseline gap-2 text-[13px] font-semibold">
                    <span className="bf-slash" aria-hidden />
                    {active.scheme.title}
                  </h3>
                  <p className="mt-0.5 max-w-3xl text-[11.5px] leading-relaxed text-ink-secondary">
                    {active.scheme.caption}
                  </p>
                </div>
                <SchemeCanvas scheme={active.scheme} />

                {/* el mismo recorrido en texto: el diagrama muestra la forma,
                    la lista fija el orden y sirve para dictarlo en clase */}
                <div className="border-t border-line pt-2.5">
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-electric">
                    Paso a paso
                  </p>
                  <ol className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                    {[...active.scheme.nodes]
                      .sort((a, b) => a.col - b.col || a.row - b.row)
                      .map((node, i) => (
                        <li
                          key={node.id}
                          className="nx-enter flex items-baseline gap-2 border border-line bg-card px-2 py-1.5"
                          style={{ "--nx-i": i } as React.CSSProperties}
                        >
                          <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12px] font-medium text-ink">{node.label}</span>
                            <span className="block text-[10.5px] leading-relaxed text-ink-secondary">
                              {node.sub}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              </div>
            )}

            {tab === "glosario" && (
              <div key={`${active.id}-glosario`} className="nx-enter grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold">
                    <span className="bf-slash" aria-hidden />
                    Vocabulario del módulo
                  </h3>
                  <dl className="space-y-1.5">
                    {active.glossary.map((entry, i) => (
                      <div
                        key={entry.term}
                        className="nx-enter border border-line bg-card p-2"
                        style={{ "--nx-i": i } as React.CSSProperties}
                      >
                        <dt className="text-[12px] font-semibold text-ink">{entry.term}</dt>
                        <dd className="mt-0.5 text-[11px] leading-relaxed text-ink-secondary">
                          {entry.def}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold">
                    <span className="bf-slash bf-slash-gold" aria-hidden />
                    Sobre los datos de este módulo
                  </h3>
                  <p className="border border-line bg-card p-2.5 text-[11.5px] leading-relaxed text-ink-secondary">
                    {curriculum.snapshotNote}
                  </p>
                  <p className="mt-2 border-l-2 border-gold/60 bg-charcoal py-2 pl-2.5 pr-2 text-[11.5px] leading-relaxed text-ink-secondary">
                    Foto tomada el{" "}
                    <span className="font-medium text-gold-bright">{curriculum.snapshotDate}</span>. En
                    el terminal, la misma cifra llega con su fuente y la hora exacta de consulta:
                    citarla sin esos dos datos es justamente el error que este módulo enseña a evitar.
                  </p>
                  <Link
                    href={active.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[11px] text-core transition-colors hover:text-electric"
                  >
                    Ver la vista real del terminal ↗
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---------- práctica ---------- */}
        <aside className="flex min-h-0 flex-col border border-line bg-card">
          <ExercisePanel
            key={active.id}
            moduleData={active}
            mode={mode}
            states={progress.exercises}
            onSolve={solve}
            onReveal={reveal}
          />
          <div className="flex shrink-0 items-center justify-between border-t border-line px-3 py-1.5">
            <span className="text-[9px] text-ink-muted">
              Módulo: {solvedByModule[active.id]}/{active.exercises.length} · {moduleXp(active)} XP
            </span>
            {mode === "instructor" && (
              <button
                type="button"
                onClick={reset}
                className="text-[9px] text-ink-muted transition-colors hover:text-down"
              >
                reiniciar progreso
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
