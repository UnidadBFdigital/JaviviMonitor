import { formatTimestamp } from "@/lib/format";

// Fuente + timestamp de última consulta — obligatorio en cada card/gráfico.
export function SourceBadge({
  source,
  url,
  fetchedAt,
  stale,
}: {
  source: string;
  url?: string;
  fetchedAt: string;
  stale?: boolean;
}) {
  return (
    <p className="mt-3 text-[11px] text-ink-muted">
      Fuente:{" "}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="underline hover:text-electric">
          {source}
        </a>
      ) : (
        source
      )}{" "}
      · consultado {formatTimestamp(fetchedAt)}
      {stale && <span className="ml-1 text-warn">(dato en caché, fuente sin responder)</span>}
    </p>
  );
}

export function Unavailable({ source }: { source: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-ink-muted">
      <span>Dato no disponible</span>
      <span className="text-[11px]">Fuente: {source} — sin respuesta</span>
    </div>
  );
}
