"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

// Estado local del aula. Todo vive en el navegador del alumno: no hay
// backend de progreso y no hace falta — el objetivo es que la persona vea su
// propio avance durante la clase, no llevar un registro académico.
//
// localStorage y matchMedia son stores externos, así que se leen con
// useSyncExternalStore: es el mismo patrón del sidebar, evita el render extra
// de un useEffect y mantiene sincronizadas dos pestañas del terminal.

const PROGRESS_KEY = "nexum-progress-v1";
const MODE_KEY = "nexum-mode-v1";

export type ExerciseState = { correct: boolean; attempts: number; revealed: boolean };

export type NexumProgress = {
  xp: number;
  exercises: Record<string, ExerciseState>;
  visited: string[];
};

const EMPTY: NexumProgress = { xp: 0, exercises: {}, visited: [] };

function readProgress(): NexumProgress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<NexumProgress>;
    return {
      xp: typeof parsed.xp === "number" ? parsed.xp : 0,
      exercises: parsed.exercises ?? {},
      visited: parsed.visited ?? [],
    };
  } catch {
    // almacenamiento bloqueado o JSON corrupto: se empieza de cero
    return EMPTY;
  }
}

/* ---------- store de progreso ---------- */

const listeners = new Set<() => void>();
let snapshot: NexumProgress | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribeProgress(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PROGRESS_KEY) return;
    snapshot = null;
    notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Debe devolver el MISMO objeto mientras el store no cambie: de ahí la caché. */
function getProgress(): NexumProgress {
  if (snapshot === null) snapshot = readProgress();
  return snapshot;
}

/** En el servidor no hay progreso: se renderiza vacío y el cliente corrige. */
function getServerProgress(): NexumProgress {
  return EMPTY;
}

function commit(next: NexumProgress) {
  snapshot = next;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // sin persistencia la sesión sigue viva; solo se pierde al recargar
  }
  notify();
}

export function useNexumProgress() {
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress);

  /** Suma XP solo la primera vez que el ejercicio se resuelve bien. */
  const solve = useCallback((exerciseId: string, correct: boolean, xp: number) => {
    const prev = getProgress();
    const previous = prev.exercises[exerciseId] ?? {
      correct: false,
      attempts: 0,
      revealed: false,
    };
    const firstWin = correct && !previous.correct;
    commit({
      ...prev,
      xp: prev.xp + (firstWin ? (previous.revealed ? Math.round(xp / 2) : xp) : 0),
      exercises: {
        ...prev.exercises,
        [exerciseId]: {
          correct: previous.correct || correct,
          attempts: previous.attempts + 1,
          revealed: previous.revealed,
        },
      },
    });
  }, []);

  /** Ver la solución no bloquea el ejercicio, pero vale la mitad del XP. */
  const reveal = useCallback((exerciseId: string) => {
    const prev = getProgress();
    commit({
      ...prev,
      exercises: {
        ...prev.exercises,
        [exerciseId]: {
          correct: prev.exercises[exerciseId]?.correct ?? false,
          attempts: prev.exercises[exerciseId]?.attempts ?? 0,
          revealed: true,
        },
      },
    });
  }, []);

  const visit = useCallback((moduleId: string) => {
    const prev = getProgress();
    if (prev.visited.includes(moduleId)) return;
    commit({ ...prev, visited: [...prev.visited, moduleId] });
  }, []);

  const reset = useCallback(() => commit(EMPTY), []);

  return { progress, solve, reveal, visit, reset };
}

/* ---------- modo de aula ---------- */

export type NexumMode = "student" | "instructor";

const modeListeners = new Set<() => void>();
let modeSnapshot: NexumMode | null = null;

function subscribeMode(onChange: () => void): () => void {
  modeListeners.add(onChange);
  return () => {
    modeListeners.delete(onChange);
  };
}

function getMode(): NexumMode {
  if (modeSnapshot === null) {
    try {
      modeSnapshot = window.sessionStorage.getItem(MODE_KEY) === "instructor" ? "instructor" : "student";
    } catch {
      modeSnapshot = "student";
    }
  }
  return modeSnapshot;
}

function getServerMode(): NexumMode {
  return "student";
}

/**
 * Modo estudiante / instructor. Es un control de aula, no una medida de
 * seguridad: el PIN vive en el currículo y se valida en el navegador. Lo que
 * protege el terminal de verdad es la autenticación del despliegue.
 */
export function useNexumMode() {
  const mode = useSyncExternalStore(subscribeMode, getMode, getServerMode);

  const setMode = useCallback((next: NexumMode) => {
    modeSnapshot = next;
    try {
      window.sessionStorage.setItem(MODE_KEY, next);
    } catch {
      // el modo dura lo que dure la pestaña
    }
    modeListeners.forEach((listener) => listener());
  }, []);

  return { mode, setMode };
}

/* ---------- preferencias del sistema ---------- */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Las animaciones del aula son contenido, pero nunca obligatorias. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}

/* ---------- dato vivo ---------- */

export type LiveValue = { value: number; source: string; fetchedAt: string; stale: boolean };
export type LivePayload = { values: Record<string, LiveValue>; failed: string[]; fetchedAt: string };

/**
 * Contraste contra las fuentes reales. Se consulta solo cuando el usuario lo
 * pide: la clase no debería depender de que las APIs respondan.
 */
export function useNexumLive() {
  const [data, setData] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [on, setOn] = useState(false);
  const requested = useRef(false);

  const toggle = useCallback(() => {
    setOn((prev) => !prev);
    if (requested.current) return;
    requested.current = true;
    setLoading(true);
    fetch("/api/nexum/live")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("http"))))
      .then((payload: LivePayload) => setData(payload))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { live: on ? data : null, on, loading, error, toggle };
}
