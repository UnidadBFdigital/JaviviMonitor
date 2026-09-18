// Contrato del histórico a demanda. Cualquier fila, barra o tarjeta del
// terminal abre la ficha lateral con un HistoryTarget; el servidor resuelve la
// serie con la fuente que corresponde y devuelve siempre esta misma forma, así
// la ficha no necesita saber de dónde viene cada dato.
//
// Solo tipos: lo importan tanto el servidor como los componentes de cliente.

export type HistoryKind =
  | "protocol"
  | "rwa-sector"
  | "stablecoin"
  | "stablecoin-total"
  | "stablecoin-chain"
  | "asset"
  | "ticker"
  | "chain-tvl"
  | "quote"
  | "yield-pool";

export const HISTORY_KINDS: HistoryKind[] = [
  "protocol",
  "rwa-sector",
  "stablecoin",
  "stablecoin-total",
  "stablecoin-chain",
  "asset",
  "ticker",
  "chain-tvl",
  "quote",
  "yield-pool",
];

export type HistoryTarget = {
  kind: HistoryKind;
  /** identificador en la fuente: slug de DeFiLlama, id de CoinGecko, símbolo… */
  id: string;
  /** nombre legible, solo para mostrar */
  label: string;
};

export type HistoryPoint = { date: string; value: number };

/**
 * "price" se formatea con decimales según magnitud; "usd" en notación compacta;
 * "pct" es una tasa (APY): sus cambios se leen en puntos porcentuales, no en %.
 */
export type HistoryUnit = "usd" | "price" | "pct";

export type HistoryMetric = {
  key: string;
  label: string;
  unit: HistoryUnit;
  points: HistoryPoint[];
};

/** Series que suman el total: los protocolos que explican un sector. */
export type HistoryComposition = { key: string; label: string; points: HistoryPoint[] };

export type HistoryMember = {
  label: string;
  valueUsd: number;
  sharePct: number;
  /** abre el histórico del miembro dentro de la misma ficha */
  target: HistoryTarget | null;
};

export type HistoryPayload =
  | {
      ok: true;
      target: HistoryTarget;
      title: string;
      subtitle: string;
      /** la primera es la vista por defecto */
      metrics: HistoryMetric[];
      /**
       * Dos métricas de escalas distintas que conviene leer juntas (TVL y
       * precio del token). Nunca comparten eje: la ficha las indexa a 100 en
       * el primer día común del rango.
       */
      compare: { left: string; right: string; label: string } | null;
      composition: HistoryComposition[] | null;
      members: HistoryMember[] | null;
      source: string;
      sourceUrl: string | null;
      fetchedAt: string;
      stale: boolean;
      cadence: "Diario" | "Cada hora";
      notes: string[];
    }
  | { ok: false; target: HistoryTarget; source: string; error: string };
