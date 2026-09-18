"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import type { BitcoinDerivativesData } from "@/lib/sources/binanceFutures";
import type { BitcoinOnchainData } from "@/lib/sources/coinmetrics";
import type { SourceResult } from "@/lib/sources/types";
import { usePayload } from "@/lib/useSource";

type Payload = {
  onchain: SourceResult<BitcoinOnchainData>;
  derivatives: SourceResult<BitcoinDerivativesData>;
  generatedAt: string;
};

const compact = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 2 });

/** Un dato ausente se dibuja como ausente. `?? 0` pintaba un "0" que se lee
 *  como "hoy no hubo actividad" cuando en realidad la fuente no respondió. */
function count(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : compact.format(value);
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded border border-line/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[9px] text-ink-muted">{note}</p>
    </div>
  );
}

export function BitcoinNetworkCard() {
  const { data, error } = usePayload<Payload>("/api/onchain/bitcoin-intelligence");
  const result = data?.onchain;

  return (
    <Card title="Red Bitcoin" subtitle="Seguridad y uso on-chain en el último cierre diario">
      {!data && !error && <div className="h-44 animate-pulse rounded bg-ice/40" />}
      {(error || result?.ok === false) && <Unavailable source={result?.source ?? "Coin Metrics Community"} />}
      {result?.ok && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Direcciones activas"
              value={count(result.data.snapshot.activeAddresses)}
              note="No equivale a usuarios"
            />
            <Stat
              label="Transacciones"
              value={count(result.data.snapshot.transactions)}
              note={`Cierre ${result.data.asOf}`}
            />
            <Stat
              label="Hash rate"
              value={result.data.snapshot.hashRateEh === null ? "—" : `${result.data.snapshot.hashRateEh.toFixed(0)} EH/s`}
              note="Media 24h · EH/s"
            />
            <Stat
              label="Fees pagadas"
              value={result.data.snapshot.feesBtc === null ? "—" : `${result.data.snapshot.feesBtc.toFixed(2)} BTC`}
              note="Comisiones diarias"
            />
          </div>
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
