"use client";

import { useEffect, useRef, useState } from "react";
import { exportSvgAsPng, exportCsv } from "@/lib/chartExport";
import { formatTimestamp } from "@/lib/format";

// Marco común de toda visualización: título, fuente + timestamp,
// loading / error / "no disponible", fullscreen y export PNG/CSV.
export function ChartFrame({
  title,
  subtitle,
  source,
  fetchedAt,
  stale,
  loading,
  error,
  exportRows,
  exportName,
  toolbar,
  children,
  height = "h-64",
}: {
  title: string;
  subtitle?: string;
  source?: string;
  fetchedAt?: string;
  stale?: boolean;
  loading?: boolean;
  error?: string | null;
  exportRows?: Record<string, unknown>[];
  exportName?: string;
  toolbar?: React.ReactNode;
  children?: React.ReactNode;
  height?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  // el export PNG serializa un SVG: si el contenido es una tabla no aplica
  const [hasSvg, setHasSvg] = useState(false);
  const name = exportName ?? title.toLowerCase().replace(/\s+/g, "-");

  // Recharts monta el SVG de forma asíncrona (mide el contenedor primero),
  // así que no alcanza con mirar una vez: se observa el subárbol.
  useEffect(() => {
    const node = bodyRef.current;
    if (!node) {
      setHasSvg(false);
      return;
    }
    const check = () => setHasSvg(!!node.querySelector("svg"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [loading, error]);

  const body = (
    <>
      {loading && <div className={`${full ? "h-[70vh]" : height} animate-pulse rounded bg-ice/60`} />}
      {!loading && error && (
        <div className={`flex ${height} flex-col items-center justify-center gap-1 text-sm text-ink-muted`}>
          <span>Dato no disponible</span>
          {source && <span className="text-[11px]">Fuente: {source} — sin respuesta</span>}
        </div>
      )}
      {!loading && !error && (
        <div ref={bodyRef} className={full ? "h-[70vh]" : height}>
          {children}
        </div>
      )}
    </>
  );

  const exportControls = !loading && !error && (
    <div className="flex gap-1 opacity-60 transition-opacity hover:opacity-100">
      {hasSvg && (
        <button
          onClick={() => bodyRef.current && exportSvgAsPng(bodyRef.current, name)}
          title="Exportar PNG"
          className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-ice/50"
        >
          PNG
        </button>
      )}
      {exportRows && exportRows.length > 0 && (
        <button
          onClick={() => exportCsv(exportRows, name)}
          title="Exportar CSV"
          className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-ice/50"
        >
          CSV
        </button>
      )}
      <button
        onClick={() => setFull(!full)}
        title={full ? "Cerrar" : "Pantalla completa"}
        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-ice/50"
      >
        {full ? "✕" : "⛶"}
      </button>
    </div>
  );

  const frame = (
    <section
      className={`rounded-lg border border-line bg-card p-4 shadow-[0_1px_8px_rgba(0,0,0,0.25)] ${
        full ? "fixed inset-6 z-50 overflow-y-auto" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-ink-secondary">{subtitle}</p>}
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {toolbar}
          {exportControls}
        </div>
      </div>
      {body}
      {source && fetchedAt && !loading && !error && (
        <p className="mt-3 text-[11px] text-ink-muted" title={fetchedAt}>
          Fuente: {source} · consultado {formatTimestamp(fetchedAt)}
          {stale && <span className="ml-1 text-warn">(dato en caché)</span>}
        </p>
      )}
    </section>
  );

  return (
    <>
      {full && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setFull(false)}
        />
      )}
      {frame}
    </>
  );
}
