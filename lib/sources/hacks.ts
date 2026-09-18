// Módulo de incidentes de seguridad (api.llama.fi/hacks) — gratis, sin API key.
// Es el mismo registro que alimenta defillama.com/hacks: un evento por
// incidente confirmado, con vector, técnica, redes afectadas y monto robado.
//
// El endpoint devuelve el histórico completo (2011 → hoy) en un solo GET.
// Se normaliza acá y se manda entero al cliente: son ~350 KB sin comprimir
// y permite filtrar, ordenar y exportar todo el registro sin volver a la red.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const URL = "https://api.llama.fi/hacks";
export const SOURCE = "DeFiLlama Hacks";
export const SOURCE_URL = "https://defillama.com/hacks";

// El registro no actualiza más de una vez al día; 6 horas de TTL evitan
// releer 340 KB en cada visita sin quedarse atrás de un incidente nuevo.
const TTL_MS = 6 * 60 * 60 * 1000;

/** Alias que la fuente usa indistintamente para la misma red. Sin esto,
 *  BNB Chain aparece partida en cinco filas y ninguna refleja su peso real. */
const CHAIN_ALIASES: Record<string, string> = {
  BSC: "BNB Chain",
  "Binance Smart Chain": "BNB Chain",
  BNB: "BNB Chain",
  Binance: "BNB Chain",
  TRON: "Tron",
  XRP: "XRP Ledger",
  Ripple: "XRP Ledger",
  XRPL: "XRP Ledger",
  ETC: "Ethereum Classic",
  RSK: "Rootstock",
  Near: "NEAR",
  Doge: "Dogecoin",
  BitcoinCash: "Bitcoin Cash",
  "Terra Classic": "Terra",
  Terra2: "Terra 2.0",
  Wemix: "WEMIX",
  "WEMIX3.0": "WEMIX",
  Heco: "HECO",
  "Huobi Eco Chain": "HECO",
  "Gnosis Chain": "Gnosis",
  Elrond: "MultiversX",
  Multiple: "Multi-red",
  "Multi-Chain": "Multi-red",
};

type RawHack = {
  date: number; // unix segundos, siempre a las 00:00 UTC
  name: string;
  classification: string | null;
  technique: string | null;
  amount: number | null;
  chain: string[] | null;
  bridgeHack: boolean | null;
  targetType: string | null;
  source: string | null;
  returnedFunds: number | null;
  defillamaId: string | null;
  language: string | null;
};

export type HackEvent = {
  /** fecha + nombre: la fuente no trae un id estable por incidente */
  id: string;
  /** YYYY-MM-DD en UTC */
  date: string;
  name: string;
  /** null cuando el monto nunca se confirmó — no es cero */
  amountUsd: number | null;
  returnedUsd: number | null;
  chains: string[];
  classification: string;
  technique: string;
  targetType: string;
  bridgeHack: boolean;
  language: string | null;
};

export type HacksDataset = {
  /** histórico completo, más reciente primero */
  events: HackEvent[];
  /** fecha del incidente más reciente del registro */
  lastDate: string;
  /** primer incidente del registro — acota el histórico en la UI */
  firstDate: string;
  totals: {
    count: number;
    amountUsd: number;
    returnedUsd: number;
    /** incidentes sin monto confirmado: quedan fuera de las sumas */
    unpricedCount: number;
  };
};

const UNKNOWN = "Sin clasificar";

function normalizeChain(chain: string): string {
  return CHAIN_ALIASES[chain] ?? chain;
}

function toEvent(raw: RawHack): HackEvent {
  const date = new Date(raw.date * 1000).toISOString().slice(0, 10);
  const chains = Array.from(
    new Set((raw.chain ?? []).filter(Boolean).map(normalizeChain))
  );
  return {
    id: `${date}-${raw.name}`,
    date,
    name: raw.name,
    amountUsd: typeof raw.amount === "number" && raw.amount > 0 ? raw.amount : null,
    returnedUsd: typeof raw.returnedFunds === "number" ? raw.returnedFunds : null,
    chains: chains.length > 0 ? chains : [UNKNOWN],
    classification: raw.classification || UNKNOWN,
    technique: raw.technique || UNKNOWN,
    targetType: raw.targetType || UNKNOWN,
    bridgeHack: raw.bridgeHack === true,
    language: raw.language || null,
  };
}

export async function getHacks(): Promise<SourceResult<HacksDataset>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "defillama:hacks",
      async () => {
        const res = await fetch(URL, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${SOURCE} → HTTP ${res.status}`);
        return (await res.json()) as RawHack[];
      },
      TTL_MS
    );

    const events = data
      .filter((raw) => typeof raw?.date === "number" && typeof raw?.name === "string")
      .map(toEvent)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name)));

    if (events.length === 0) throw new Error(`${SOURCE} devolvió un registro vacío`);

    const priced = events.filter((e) => e.amountUsd !== null);
    const dataset: HacksDataset = {
      events,
      lastDate: events[0].date,
      firstDate: events[events.length - 1].date,
      totals: {
        count: events.length,
        amountUsd: priced.reduce((sum, e) => sum + (e.amountUsd ?? 0), 0),
        returnedUsd: events.reduce((sum, e) => sum + (e.returnedUsd ?? 0), 0),
        unpricedCount: events.length - priced.length,
      },
    };

    return { ok: true, data: dataset, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
