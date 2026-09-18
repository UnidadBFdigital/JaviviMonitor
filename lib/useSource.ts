"use client";

import { useEffect, useState } from "react";
import { fetchShared } from "@/lib/fetchShared";
import type { SourceResult } from "@/lib/sources/types";

// Patrón común de todas las cards: fetch a una API route interna,
// estado de carga, y error normalizado si la red falla.
//
// Cada respuesta queda atada a la URL que la pidió. Al cambiar un selector
// (activo, período, filtro) el hook vuelve a "cargando" en vez de seguir
// devolviendo la respuesta anterior: si no, un título que ya dice ETH se
// mostraba un instante sobre las velas de BTC.

export function useSource<T>(url: string, source: string) {
  const [state, setState] = useState<{ url: string; result: SourceResult<T> } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchShared<SourceResult<T>>(url)
      .then((data) => alive && setState({ url, result: data }))
      .catch(() => alive && setState({ url, result: { ok: false, source, error: "network" } }));
    return () => {
      alive = false;
    };
  }, [url, source]);

  return state?.url === url ? state.result : null;
}

/** Igual que useSource pero para endpoints que devuelven varias fuentes juntas. */
export function usePayload<T>(url: string) {
  const [state, setState] = useState<{ url: string; data: T | null; error: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchShared<T>(url)
      .then((d) => alive && setState({ url, data: d, error: false }))
      .catch(() => alive && setState({ url, data: null, error: true }));
    return () => {
      alive = false;
    };
  }, [url]);

  const current = state?.url === url ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? false };
}
