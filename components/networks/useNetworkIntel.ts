"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePayload } from "@/lib/useSource";
import {
  buildResearchSignals,
  computeMomentum,
  scoreUniverse,
  type Momentum,
  type MomentumWindow,
  type ProfileId,
  type ScoredNetworkResult,
} from "@/lib/networks/score";
import type { NetworkMetrics, Provenance } from "@/lib/networks/types";

// Un solo fetch para toda la sección; el scoring corre en el cliente porque
// es determinista y barato. Cambiar de caso de uso o de filtro no vuelve a
// pedir nada a la red: reordena lo que ya está en memoria.

export type NetworksPayload = {
  generatedAt: string;
  indexVersion: string;
  registry: { techReviewedAt: string; techNote: string };
  universe: number;
  failed: string[];
  sources: Provenance[];
  networks: NetworkMetrics[];
};

export type LayerFilter = "all" | "L1" | "L2";
export type VmFilter = "all" | "evm" | "nonevm";

export type NetworkIntel = {
  loading: boolean;
  error: boolean;
  payload: NetworksPayload | null;
  /** universo filtrado, ya puntuado y ordenado por score */
  rows: Row[];
  /** todas las redes puntuadas, sin filtrar (para el comparador) */
  all: NetworkMetrics[];
  scores: Map<string, ScoredNetworkResult>;
  momentum: Map<string, Momentum>;
  signals: ReturnType<typeof buildResearchSignals>;
  profile: ProfileId;
  setProfile: (id: ProfileId) => void;
  layer: LayerFilter;
  setLayer: (l: LayerFilter) => void;
  vm: VmFilter;
  setVm: (v: VmFilter) => void;
  window: MomentumWindow;
  setWindow: (w: MomentumWindow) => void;
};

export type Row = {
  network: NetworkMetrics;
  score: ScoredNetworkResult;
  momentum: Momentum;
};

export function useNetworkIntelState(): NetworkIntel {
  const { data, error } = usePayload<NetworksPayload>("/api/networks");
  const [profile, setProfile] = useState<ProfileId>("general");
  const [layer, setLayer] = useState<LayerFilter>("all");
  const [vm, setVm] = useState<VmFilter>("all");
  const [window, setWindow] = useState<MomentumWindow>(30);

  const networks = useMemo(() => data?.networks ?? [], [data]);

  // Los filtros cambian la vista; el registro completo fija la referencia.
  const filtered = useMemo(
    () =>
      networks.filter((n) => {
        if (layer !== "all" && n.layer !== layer) return false;
        if (vm === "evm" && !n.tooling.evm) return false;
        if (vm === "nonevm" && n.tooling.evm) return false;
        return true;
      }),
    [networks, layer, vm]
  );

  const scores = useMemo(() => scoreUniverse(networks, profile), [networks, profile]);
  const momentum = useMemo(() => computeMomentum(networks, window), [networks, window]);
  const signals = useMemo(
    () => buildResearchSignals(filtered, momentum, window),
    [filtered, momentum, window]
  );

  const rows = useMemo(() => {
    const list: Row[] = filtered.map((network) => ({
      network,
      score: scores.get(network.id)!,
      momentum: momentum.get(network.id)!,
    }));
    return list.sort((a, b) => (b.score.score ?? -1) - (a.score.score ?? -1));
  }, [filtered, scores, momentum]);

  return {
    loading: !data && !error,
    error,
    payload: data,
    rows,
    all: networks,
    scores,
    momentum,
    signals,
    profile,
    setProfile,
    layer,
    setLayer,
    vm,
    setVm,
    window,
    setWindow,
  };
}

const IntelContext = createContext<NetworkIntel | null>(null);

export const IntelProvider = IntelContext.Provider;

export function useIntel(): NetworkIntel {
  const value = useContext(IntelContext);
  if (!value) throw new Error("useIntel fuera del proveedor de Builder Radar");
  return value;
}
