"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { HistoryTarget } from "@/lib/historyTypes";

// La ficha trae recharts. Importada de forma estática viajaba en el chunk del
// layout raíz y cada ruta la descargaba aunque nadie la abriera; así se pide
// recién la primera vez que alguien abre un histórico.
const HistoryDrawer = dynamic(() => import("./HistoryDrawer").then((m) => m.HistoryDrawer), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div className="bf-fade-in absolute inset-0 bg-surface/60" />
      <div className="bf-drawer-in relative h-full w-full max-w-2xl space-y-3 border-l border-line bg-card p-4 shadow-2xl">
        <div className="bf-shimmer h-10 rounded" />
        <div className="bf-shimmer h-16 rounded" />
        <div className="bf-shimmer h-64 rounded" />
      </div>
    </div>
  ),
});

// Ficha lateral de histórico, única para todo el terminal. Vive en el layout
// raíz: cualquier fila, barra o tarjeta llama a `open(target)` y la ficha se
// abre a la derecha sin sacar al usuario de la vista en la que está.
//
// Guarda una pila para el drill-down: desde un sector se entra a uno de sus
// protocolos y «Volver» regresa al sector, sin cerrar la ficha.

type HistoryApi = {
  open: (target: HistoryTarget) => void;
  close: () => void;
  enabled: boolean;
};

const NOOP: HistoryApi = { open: () => {}, close: () => {}, enabled: false };

const HistoryContext = createContext<HistoryApi>(NOOP);

/** Fuera del proveedor devuelve un no-op: un componente reutilizado en una
 *  vista sin ficha (el informe impreso, por ejemplo) no se rompe. */
export function useHistory(): HistoryApi {
  return useContext(HistoryContext);
}

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<HistoryTarget[]>([]);
  // el foco vuelve al control que abrió la ficha al cerrarla
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback((target: HistoryTarget) => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
    setStack([target]);
  }, []);

  const close = useCallback(() => {
    setStack([]);
    opener.current?.focus();
    opener.current = null;
  }, []);

  const drill = useCallback((target: HistoryTarget) => setStack((prev) => [...prev, target]), []);
  const back = useCallback(() => setStack((prev) => prev.slice(0, -1)), []);

  const api = useMemo<HistoryApi>(() => ({ open, close, enabled: true }), [open, close]);
  const current = stack.at(-1) ?? null;

  return (
    <HistoryContext.Provider value={api}>
      {children}
      {current && (
        <HistoryDrawer
          target={current}
          parent={stack.length > 1 ? stack[stack.length - 2] : null}
          onBack={back}
          onClose={close}
          onDrill={drill}
        />
      )}
    </HistoryContext.Provider>
  );
}
