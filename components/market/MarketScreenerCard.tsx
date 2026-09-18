"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { useHistory } from "@/components/history/HistoryProvider";
import { exportCsv } from "@/lib/chartExport";
import { fetchShared } from "@/lib/fetchShared";
import { formatPct, formatUsdCompact } from "@/lib/format";
import { PAGE_SIZES, type ScreenerCoin, type ScreenerPayload, type ScreenerSort, type SortDir } from "@/lib/marketScreener";

// Todas las criptos con precio: el top ~1000 por market cap de CoinGecko,
// paginado en el servidor. Buscar, ordenar o cambiar de página pide solo la
// página visible; cada fila abre su histórico de precio en la ficha lateral.

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 4 })}`;
}

function Change({ value }: { value: number | null }) {
  return (
    <span className={value === null ? "text-ink-muted" : value >= 0 ? "text-up" : "text-down"}>
      {formatPct(value)}
    </span>
  );
}

/** Dónde está el precio dentro del rango de 24h. */
function DayRange({ coin }: { coin: ScreenerCoin }) {
  const { low24hUsd: low, high24hUsd: high, priceUsd: price } = coin;
  if (low === null || high === null || price === null || high <= low) {
    return <span className="text-ink-muted">—</span>;
  }
  const position = Math.min(Math.max((price - low) / (high - low), 0), 1) * 100;
  return (
    <span
      className="relative mx-auto block h-1.5 w-16 rounded-full bg-ice"
      title={`Mín ${formatPrice(low)} · Máx ${formatPrice(high)}`}
      aria-label={`Precio al ${position.toFixed(0)}% del rango de 24h`}
    >
      <span
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-electric"
        style={{ left: `${position}%` }}
      />
    </span>
  );
}

type ColumnDef = {
  key: string;
  /** null: columna sin orden (el rango de 24h no es una magnitud) */
  sort: ScreenerSort | null;
  header: string;
  /** clases responsivas: las columnas secundarias se ocultan en pantallas chicas */
  className?: string;
  cell: (coin: ScreenerCoin) => React.ReactNode;
};

const COLUMNS: ColumnDef[] = [
  { key: "price", sort: "price", header: "Precio", cell: (c) => formatPrice(c.priceUsd) },
  { key: "d1h", sort: "d1h", header: "1h", className: "hidden md:table-cell", cell: (c) => <Change value={c.change1hPct} /> },
  { key: "d24h", sort: "d24h", header: "24h", cell: (c) => <Change value={c.change24hPct} /> },
  { key: "d7d", sort: "d7d", header: "7d", cell: (c) => <Change value={c.change7dPct} /> },
  { key: "d30d", sort: "d30d", header: "30d", className: "hidden md:table-cell", cell: (c) => <Change value={c.change30dPct} /> },
  { key: "range", sort: null, header: "Rango 24h", className: "hidden text-center lg:table-cell", cell: (c) => <DayRange coin={c} /> },
  { key: "mcap", sort: "mcap", header: "Market cap", cell: (c) => (c.marketCapUsd === null ? "—" : formatUsdCompact(c.marketCapUsd)) },
  { key: "volume", sort: "volume", header: "Vol. 24h", className: "hidden sm:table-cell", cell: (c) => (c.volume24hUsd === null ? "—" : formatUsdCompact(c.volume24hUsd)) },
  { key: "ath", sort: "ath", header: "Desde ATH", className: "hidden lg:table-cell", cell: (c) => <Change value={c.athDrawdownPct} /> },
];

const PRESETS: { label: string; sort: ScreenerSort; dir: SortDir }[] = [
  { label: "Mayor market cap", sort: "rank", dir: "asc" },
  { label: "Más suben 24h", sort: "d24h", dir: "desc" },
  { label: "Más caen 24h", sort: "d24h", dir: "asc" },
  { label: "Mayor volumen", sort: "volume", dir: "desc" },
];

type Loaded = { key: string; payload: ScreenerPayload | null; error: boolean };

export function MarketScreenerCard() {
  const history = useHistory();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<ScreenerSort>("rank");
  const [dir, setDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(50);
  const [deep, setDeep] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>({ key: "", payload: null, error: false });

  // la búsqueda espera a que se deje de tipear: una petición por término, no por tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ sort, dir, page: String(page), size: String(size) });
  if (debounced) params.set("q", debounced);
  if (deep && debounced.length >= 2) params.set("deep", "1");
  const url = `/api/market/screener?${params.toString()}`;

  useEffect(() => {
    let alive = true;
    fetchShared<ScreenerPayload>(url)
      .then((payload) => alive && setLoaded({ key: url, payload, error: false }))
      .catch(() => alive && setLoaded({ key: url, payload: null, error: true }));
    return () => {
      alive = false;
    };
  }, [url]);

  const loading = loaded.key !== url;
  const payload = loaded.payload;
  const ready = payload?.ok ? payload : null;

  function sortBy(next: ScreenerSort) {
    if (next === sort) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(next);
      // el ranking se lee de arriba hacia abajo; el resto, de mayor a menor
      setDir(next === "rank" ? "asc" : "desc");
    }
    setPage(1);
  }

  function openHistory(coin: ScreenerCoin) {
    history.open({ kind: "asset", id: coin.id, label: `${coin.symbol} · ${coin.name}` });
  }

  function download() {
    if (!ready) return;
    exportCsv(
      ready.rows.map((c) => ({
        rank: c.rank, simbolo: c.symbol, nombre: c.name, precio_usd: c.priceUsd,
        cambio_1h_pct: c.change1hPct, cambio_24h_pct: c.change24hPct, cambio_7d_pct: c.change7dPct,
        cambio_30d_pct: c.change30dPct, market_cap_usd: c.marketCapUsd, volumen_24h_usd: c.volume24hUsd,
        desde_ath_pct: c.athDrawdownPct,
      })),
      `screener-cripto-p${ready.page}`
    );
  }

  function headerCell(key: string, label: string, sortKey: ScreenerSort | null, className = "") {
    const active = sortKey !== null && sort === sortKey;
    return (
      <th
        key={key}
        aria-sort={sortKey === null ? undefined : active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={`border-b border-line px-2 pb-1.5 font-medium uppercase tracking-wide ${className}`}
      >
        {sortKey === null ? (
          label
        ) : (
          <button type="button" onClick={() => sortBy(sortKey)} className="uppercase tracking-wide hover:text-ink">
            {label}
            {active && <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span>}
          </button>
        )}
      </th>
    );
  }

  return (
    <Card
      title="Todas las criptos"
      subtitle="Precio y momentum de los ~1000 criptoactivos de mayor market cap. Tocá una fila para ver su histórico."
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
            setDeep(false);
          }}
          placeholder="Buscar BTC, Solana, pepe…"
          aria-label="Buscar criptoactivo por símbolo o nombre"
          className="w-full rounded border border-line bg-surface px-2 py-1 text-xs outline-none placeholder:text-ink-muted focus:border-core sm:w-56"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Orden rápido">
          {PRESETS.map((preset) => {
            const active = sort === preset.sort && dir === preset.dir;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSort(preset.sort);
                  setDir(preset.dir);
                  setPage(1);
                }}
                className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                  active ? "border-electric bg-electric/10 text-ink" : "border-line text-ink-secondary hover:text-ink"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={download}
          disabled={!ready || ready.rows.length === 0}
          className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-ice/50 disabled:opacity-40"
        >
          CSV
        </button>
      </div>

      {!payload && loading && <div className="bf-shimmer h-96 rounded" />}
      {!loading && (loaded.error || (payload && !payload.ok)) && (
        <Unavailable source={payload && !payload.ok ? payload.source : "CoinGecko"} />
      )}

      {ready && (
        <>
          <div className={`max-h-[36rem] overflow-auto transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-[1] bg-card">
                <tr className="text-right text-[10px] text-ink-muted">
                  {headerCell("rank", "#", "rank", "w-10 pl-0 text-left")}
                  {headerCell("asset", "Activo", null, "text-left")}
                  {COLUMNS.map((column) => headerCell(column.key, column.header, column.sort, column.className))}
                </tr>
              </thead>
              <tbody>
                {ready.rows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="py-8 text-center text-xs text-ink-muted">
                      Sin coincidencias{ready.deep === "ok" ? " en CoinGecko" : ` en el top ${ready.universe}`}.
                    </td>
                  </tr>
                )}
                {ready.rows.map((coin) => (
                  <tr
                    key={coin.id}
                    onClick={() => openHistory(coin)}
                    className="group cursor-pointer border-b border-line/50 text-right tabular-nums last:border-0 hover:bg-ice/30"
                  >
                    <td className="py-1.5 pr-2 text-left text-[10px] text-ink-muted">{coin.rank ?? "—"}</td>
                    <td className="px-2 py-1.5 text-left">
                      <span className="flex min-w-0 items-center gap-2">
                        {coin.image ? (
                          // miniaturas de 25px del CDN de CoinGecko: pasarlas por el
                          // optimizador de imágenes solo sumaría carga al servidor
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={coin.image} alt="" width={16} height={16} loading="lazy" className="h-4 w-4 shrink-0 rounded-full" />
                        ) : (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ice text-[8px] text-ink-secondary" aria-hidden>
                            {coin.symbol.slice(0, 1)}
                          </span>
                        )}
                        <span className="font-medium">{coin.symbol}</span>
                        <span className="hidden truncate text-[10px] text-ink-muted sm:inline">{coin.name}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openHistory(coin);
                          }}
                          aria-label={`Ver histórico de ${coin.name}`}
                          className="text-[10px] text-core opacity-0 transition-opacity hover:text-electric focus:opacity-100 group-hover:opacity-100"
                        >
                          ↗
                        </button>
                      </span>
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column.key} className={`px-2 py-1.5 ${column.className ?? ""}`}>
                        {column.cell(coin)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* paginado */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary">
            <span className="tabular-nums">
              {ready.total === 0
                ? "0 resultados"
                : `${(ready.page - 1) * ready.query.size + 1}–${Math.min(ready.page * ready.query.size, ready.total)} de ${ready.total.toLocaleString("es-BO")}`}
            </span>
            <label className="flex items-center gap-1 text-[10px] text-ink-muted">
              Filas
              <select
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink outline-none focus:border-core"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, ready.page - 1))}
                disabled={ready.page <= 1}
                className="rounded border border-line px-2 py-0.5 hover:bg-ice/50 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="px-1 tabular-nums">
                {ready.page} / {ready.pages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(ready.pages, ready.page + 1))}
                disabled={ready.page >= ready.pages}
                className="rounded border border-line px-2 py-0.5 hover:bg-ice/50 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>

          {/* búsqueda fuera del top */}
          {debounced.length >= 2 && (
            <p className="mt-2 text-[11px] text-ink-secondary">
              {ready.deep === "off" && (
                <>
                  ¿No aparece? Solo se listan los {ready.universe} de mayor market cap.{" "}
                  <button type="button" onClick={() => setDeep(true)} className="text-core underline hover:text-electric">
                    Buscar «{debounced}» en todo CoinGecko
                  </button>
                </>
              )}
              {ready.deep === "ok" &&
                (ready.extra > 0
                  ? `Búsqueda ampliada: ${ready.extra} activo${ready.extra === 1 ? "" : "s"} fuera del top se suma${ready.extra === 1 ? "" : "n"} a los resultados.`
                  : "Búsqueda ampliada: CoinGecko no tiene otros activos con ese nombre fuera del top.")}
              {ready.deep === "failed" && (
                <span className="text-warn">La búsqueda ampliada no respondió; se muestran solo resultados del top.</span>
              )}
            </p>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
            Universo: {ready.universe} activos por market cap, refrescado cada 5 minutos
            {ready.pagesLoaded < ready.pagesRequested && " · cobertura parcial: CoinGecko no devolvió todas las páginas en esta consulta"}.
            «—» indica que la fuente no publica el dato (por ejemplo, market cap sin oferta circulante conocida).
          </p>
          <SourceBadge source={ready.source} fetchedAt={ready.fetchedAt} stale={ready.stale} />
        </>
      )}
    </Card>
  );
}
