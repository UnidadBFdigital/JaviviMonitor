"use client";

import { useMemo, useState } from "react";
import {
  COMPUTE_SUFFIX,
  isComputeCorrect,
  shuffleStable,
  type NexumExercise,
  type NexumModule,
} from "@/lib/nexum";
import type { ExerciseState, NexumMode } from "./useNexum";

// Práctica del módulo. Un ejercicio por vez: en una pantalla fija, una lista
// larga obligaría a scrollear justo cuando el alumno necesita ver el gráfico
// del que sale la respuesta.
//
// Corregir es local e inmediato. Equivocarse no penaliza —se puede reintentar
// las veces que haga falta— pero ver la solución antes de acertar vale la
// mitad del XP: el incentivo empuja a pensar, no a bloquear.

type Status = "idle" | "correct" | "wrong";

function Feedback({
  status,
  explain,
  hint,
  showHint,
}: {
  status: Status;
  explain: string;
  hint: string;
  showHint: boolean;
}) {
  if (status === "idle") {
    return showHint ? (
      <p className="nx-enter mt-2.5 border-l-2 border-warn bg-warn/5 py-1.5 pl-2.5 pr-2 text-[11px] leading-relaxed text-ink-secondary">
        <span className="font-semibold text-warn">Pista. </span>
        {hint}
      </p>
    ) : null;
  }
  const ok = status === "correct";
  return (
    <p
      className={`nx-enter mt-2.5 border-l-2 py-1.5 pl-2.5 pr-2 text-[11px] leading-relaxed ${
        ok ? "border-up bg-up/5 text-ink-secondary" : "border-down bg-down/5 text-ink-secondary"
      }`}
    >
      <span className={`font-semibold ${ok ? "text-up" : "text-down"}`}>
        {ok ? "Correcto. " : "Todavía no. "}
      </span>
      {ok ? explain : hint}
    </p>
  );
}

/* ---------- opción múltiple (quiz y lectura de gráfico) ---------- */

function ChoiceExercise({
  options,
  answer,
  status,
  setStatus,
  onSolve,
  solutionVisible,
}: {
  options: string[];
  answer: number;
  status: Status;
  setStatus: (s: Status) => void;
  onSolve: (correct: boolean) => void;
  solutionVisible: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);

  function choose(index: number) {
    if (status === "correct") return;
    setPicked(index);
    const correct = index === answer;
    setStatus(correct ? "correct" : "wrong");
    onSolve(correct);
  }

  return (
    <ul className="space-y-1.5">
      {options.map((option, i) => {
        const chosen = picked === i;
        const isAnswer = i === answer;
        const showAsCorrect = (status === "correct" && chosen) || (solutionVisible && isAnswer);
        const showAsWrong = status === "wrong" && chosen;
        return (
          <li key={option}>
            <button
              type="button"
              onClick={() => choose(i)}
              disabled={status === "correct"}
              className={`flex w-full items-start gap-2 border p-2 text-left text-[12px] leading-relaxed transition-colors ${
                showAsCorrect
                  ? "border-up bg-up/10 text-ink"
                  : showAsWrong
                    ? "nx-shake border-down bg-down/10 text-ink"
                    : "border-line bg-card-raised text-ink-secondary hover:border-electric/60 hover:text-ink"
              }`}
            >
              <span className="mt-px font-mono text-[10px] text-ink-muted">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0">{option}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- ordenar ---------- */

function OrderExercise({
  exercise,
  items,
  status,
  setStatus,
  onSolve,
  solutionVisible,
}: {
  exercise: NexumExercise;
  items: string[];
  status: Status;
  setStatus: (s: Status) => void;
  onSolve: (correct: boolean) => void;
  solutionVisible: boolean;
}) {
  const [current, setCurrent] = useState(() => shuffleStable(items, exercise.id));

  function move(index: number, direction: -1 | 1) {
    if (status === "correct") return;
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    setCurrent(next);
    setStatus("idle");
  }

  function check() {
    const correct = current.every((item, i) => item === items[i]);
    setStatus(correct ? "correct" : "wrong");
    onSolve(correct);
  }

  const shown = solutionVisible ? items : current;

  return (
    <div>
      <ul className="space-y-1">
        {shown.map((item, i) => {
          const inPlace = item === items[i];
          return (
            <li
              key={item}
              className={`flex items-center gap-2 border p-1.5 text-[12px] transition-colors ${
                status === "correct" || (solutionVisible && inPlace)
                  ? "border-up/60 bg-up/5"
                  : status === "wrong" && !inPlace
                    ? "border-down/50 bg-down/5"
                    : "border-line bg-card-raised"
              }`}
            >
              <span className="w-4 shrink-0 text-center font-mono text-[10px] tabular-nums text-ink-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 leading-snug text-ink-secondary">{item}</span>
              {!solutionVisible && status !== "correct" && (
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Subir «${item}»`}
                    className="px-1 text-[9px] leading-none text-ink-muted transition-colors hover:text-electric disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === shown.length - 1}
                    aria-label={`Bajar «${item}»`}
                    className="px-1 text-[9px] leading-none text-ink-muted transition-colors hover:text-electric disabled:opacity-30"
                  >
                    ▼
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {status !== "correct" && !solutionVisible && (
        <button
          type="button"
          onClick={check}
          className="mt-2 border border-electric/60 bg-electric/10 px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-electric/20"
        >
          Comprobar orden
        </button>
      )}
    </div>
  );
}

/* ---------- emparejar ---------- */

function MatchExercise({
  exercise,
  pairs,
  status,
  setStatus,
  onSolve,
  solutionVisible,
}: {
  exercise: NexumExercise;
  pairs: { term: string; def: string }[];
  status: Status;
  setStatus: (s: Status) => void;
  onSolve: (correct: boolean) => void;
  solutionVisible: boolean;
}) {
  const options = useMemo(
    () => shuffleStable(pairs.map((p) => p.def), exercise.id),
    [pairs, exercise.id]
  );
  const [assigned, setAssigned] = useState<Record<number, string>>({});
  const [activeRow, setActive] = useState<number | null>(null);

  function assign(def: string) {
    if (activeRow === null || status === "correct") return;
    setAssigned((prev) => {
      const next: Record<number, string> = {};
      // una definición no puede quedar en dos filas a la vez
      Object.entries(prev).forEach(([key, value]) => {
        if (value !== def) next[Number(key)] = value;
      });
      next[activeRow] = def;
      return next;
    });
    setActive(null);
    setStatus("idle");
  }

  const complete = Object.keys(assigned).length === pairs.length;

  function check() {
    const correct = pairs.every((pair, i) => assigned[i] === pair.def);
    setStatus(correct ? "correct" : "wrong");
    onSolve(correct);
  }

  const used = new Set(Object.values(assigned));

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {pairs.map((pair, i) => {
          const value = solutionVisible ? pair.def : assigned[i];
          const right = value === pair.def;
          return (
            <li key={pair.term}>
              <button
                type="button"
                onClick={() => status !== "correct" && !solutionVisible && setActive(activeRow === i ? null : i)}
                className={`flex w-full items-center gap-2 border p-1.5 text-left text-[12px] transition-colors ${
                  activeRow === i
                    ? "border-electric bg-electric/10"
                    : value
                      ? status === "idle"
                        ? "border-line bg-card-raised"
                        : right
                          ? "border-up/60 bg-up/5"
                          : "border-down/50 bg-down/5"
                      : "border-line bg-card-raised hover:border-electric/60"
                }`}
              >
                <span className="min-w-0 flex-1 leading-snug text-ink-secondary">{pair.term}</span>
                <span
                  className={`w-40 shrink-0 truncate border-l border-line pl-2 text-[11px] ${
                    value ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {value ?? "— elegir —"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!solutionVisible && status !== "correct" && (
        <>
          <p className="text-[10px] text-ink-muted">
            {activeRow === null
              ? "Elegí una fila y después su definición."
              : "Ahora tocá la definición que le corresponde."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((def) => (
              <button
                key={def}
                type="button"
                onClick={() => assign(def)}
                disabled={activeRow === null}
                className={`border px-2 py-1 text-[11px] transition-colors ${
                  used.has(def)
                    ? "border-line/60 bg-ice/30 text-ink-muted"
                    : "border-line bg-card-raised text-ink-secondary hover:border-electric/60 hover:text-ink"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {def}
              </button>
            ))}
          </div>
          {complete && (
            <button
              type="button"
              onClick={check}
              className="border border-electric/60 bg-electric/10 px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-electric/20"
            >
              Comprobar emparejamiento
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- calcular ---------- */

function ComputeExercise({
  given,
  answer,
  tolerance,
  unit,
  status,
  setStatus,
  onSolve,
  solutionVisible,
}: {
  given: { label: string; value: string }[];
  answer: number;
  tolerance: number;
  unit: keyof typeof COMPUTE_SUFFIX;
  status: Status;
  setStatus: (s: Status) => void;
  onSolve: (correct: boolean) => void;
  solutionVisible: boolean;
}) {
  const [value, setValue] = useState("");

  function check(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    const correct = isComputeCorrect(value, answer, tolerance);
    setStatus(correct ? "correct" : "wrong");
    onSolve(correct);
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
        Datos del snapshot
      </p>
      <dl className="grid grid-cols-2 gap-1.5">
        {given.map((row) => (
          <div key={row.label} className="border border-line bg-card-raised p-1.5">
            <dt className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">{row.label}</dt>
            <dd className="text-[13px] font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={check} className="flex items-center gap-2">
        <input
          value={solutionVisible ? String(answer) : value}
          onChange={(event) => {
            setValue(event.target.value);
            setStatus("idle");
          }}
          readOnly={solutionVisible || status === "correct"}
          inputMode="decimal"
          placeholder="Tu resultado"
          aria-label="Resultado"
          className={`w-32 border bg-card-raised px-2 py-1.5 text-[13px] tabular-nums outline-none transition-colors ${
            status === "correct"
              ? "border-up text-up"
              : status === "wrong"
                ? "nx-shake border-down text-ink"
                : "border-line text-ink focus:border-electric"
          }`}
        />
        <span className="text-[11px] text-ink-muted">{COMPUTE_SUFFIX[unit]}</span>
        {!solutionVisible && status !== "correct" && (
          <button
            type="submit"
            className="border border-electric/60 bg-electric/10 px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-electric/20"
          >
            Comprobar
          </button>
        )}
      </form>
      <p className="text-[10px] text-ink-muted">
        Se acepta un margen de ±{tolerance} {COMPUTE_SUFFIX[unit]}.
      </p>
    </div>
  );
}

/* ---------- tarjeta de ejercicio ---------- */

const TYPE_LABEL: Record<NexumExercise["type"], string> = {
  quiz: "Criterio",
  read: "Lectura de gráfico",
  order: "Ordenar",
  match: "Emparejar",
  compute: "Cálculo",
};

function ExerciseCard({
  exercise,
  state,
  mode,
  onSolve,
  onReveal,
}: {
  exercise: NexumExercise;
  state?: ExerciseState;
  mode: NexumMode;
  onSolve: (correct: boolean) => void;
  onReveal: () => void;
}) {
  const [status, setStatus] = useState<Status>(state?.correct ? "correct" : "idle");
  const [hint, setHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const solutionVisible = revealed || mode === "instructor";

  function reveal() {
    setRevealed(true);
    onReveal();
  }

  return (
    <div className={status === "correct" ? "nx-ring" : undefined}>
      <div className="mb-2 flex items-center gap-2">
        <span className="border border-line px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {TYPE_LABEL[exercise.type]}
        </span>
        <span className="text-[10px] tabular-nums text-gold">+{exercise.xp} XP</span>
        {state?.correct && <span className="text-[10px] text-up">resuelto ✓</span>}
      </div>

      <p className="mb-2.5 text-[12.5px] leading-relaxed text-ink">{exercise.prompt}</p>

      {(exercise.type === "quiz" || exercise.type === "read") && (
        <ChoiceExercise
          options={exercise.options}
          answer={exercise.answer}
          status={status}
          setStatus={setStatus}
          onSolve={onSolve}
          solutionVisible={solutionVisible}
        />
      )}
      {exercise.type === "order" && (
        <OrderExercise
          exercise={exercise}
          items={exercise.items}
          status={status}
          setStatus={setStatus}
          onSolve={onSolve}
          solutionVisible={solutionVisible}
        />
      )}
      {exercise.type === "match" && (
        <MatchExercise
          exercise={exercise}
          pairs={exercise.pairs}
          status={status}
          setStatus={setStatus}
          onSolve={onSolve}
          solutionVisible={solutionVisible}
        />
      )}
      {exercise.type === "compute" && (
        <ComputeExercise
          given={exercise.given}
          answer={exercise.answer}
          tolerance={exercise.tolerance}
          unit={exercise.unit}
          status={status}
          setStatus={setStatus}
          onSolve={onSolve}
          solutionVisible={solutionVisible}
        />
      )}

      <Feedback status={status} explain={exercise.explain} hint={exercise.hint} showHint={hint} />

      {solutionVisible && status !== "correct" && (
        <p className="nx-enter mt-2 border-l-2 border-gold bg-gold/5 py-1.5 pl-2.5 pr-2 text-[11px] leading-relaxed text-ink-secondary">
          <span className="font-semibold text-gold">Solución. </span>
          {exercise.explain}
        </p>
      )}

      {status !== "correct" && (
        <div className="mt-2.5 flex items-center gap-3">
          {!hint && (
            <button
              type="button"
              onClick={() => setHint(true)}
              className="text-[11px] text-core transition-colors hover:text-electric"
            >
              Ver pista
            </button>
          )}
          {!solutionVisible && (
            <button
              type="button"
              onClick={reveal}
              className="text-[11px] text-ink-muted transition-colors hover:text-ink"
            >
              Ver solución (vale la mitad del XP)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- panel ---------- */

export function ExercisePanel({
  moduleData,
  mode,
  states,
  onSolve,
  onReveal,
}: {
  moduleData: NexumModule;
  mode: NexumMode;
  states: Record<string, ExerciseState>;
  onSolve: (exerciseId: string, correct: boolean, xp: number) => void;
  onReveal: (exerciseId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const exercise = moduleData.exercises[Math.min(index, moduleData.exercises.length - 1)];
  const done = moduleData.exercises.filter((e) => states[e.id]?.correct).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="bf-slash" aria-hidden />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">Práctica</h3>
        <span className="ml-auto text-[10px] tabular-nums text-ink-muted">
          {done}/{moduleData.exercises.length} resueltos
        </span>
      </div>

      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        {moduleData.exercises.map((item, i) => {
          const solved = states[item.id]?.correct;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ejercicio ${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 flex-1 transition-colors ${
                i === index
                  ? "bg-electric"
                  : solved
                    ? "bg-up/70"
                    : "bg-ice hover:bg-ink-muted/50"
              }`}
            />
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          state={states[exercise.id]}
          mode={mode}
          onSolve={(correct) => onSolve(exercise.id, correct, exercise.xp)}
          onReveal={() => onReveal(exercise.id)}
        />
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="text-[11px] text-ink-secondary transition-colors hover:text-ink disabled:opacity-30"
        >
          ← Anterior
        </button>
        <span className="text-[10px] tabular-nums text-ink-muted">
          {index + 1} de {moduleData.exercises.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(moduleData.exercises.length - 1, i + 1))}
          disabled={index === moduleData.exercises.length - 1}
          className="text-[11px] text-ink-secondary transition-colors hover:text-ink disabled:opacity-30"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
