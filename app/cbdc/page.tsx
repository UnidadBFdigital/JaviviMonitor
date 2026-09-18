import { PageHeader } from "@/components/PageHeader";
import { CbdcNews } from "@/components/cbdc/CbdcNews";
import { CbdcMap } from "@/components/cbdc/CbdcMap";
import { RegulatoryTimeline } from "@/components/cbdc/RegulatoryTimeline";
import cbdcJson from "@/data/cbdc-tracker.json";

export const metadata = { title: "CBDC & Regulación — Blockfinity Research" };

// Orden de avance, del proyecto más maduro al descartado.
const STATUS_RANK: Record<string, number> = {
  Lanzado: 0,
  Piloto: 1,
  Desarrollo: 2,
  Investigación: 3,
  Descartado: 4,
};

const STATUS_STYLE: Record<string, string> = {
  Lanzado: "bg-up/15 text-up",
  Piloto: "bg-electric/15 text-electric",
  Desarrollo: "bg-warn/15 text-warn",
  Investigación: "bg-ice text-ink-secondary",
  Descartado: "bg-down/15 text-down",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        STATUS_STYLE[status] ?? "bg-ice text-ink-secondary"
      }`}
    >
      {status}
    </span>
  );
}

function SourceLink({ name, url }: { name: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-[10px] text-core underline hover:text-electric"
    >
      {name}
    </a>
  );
}

export default function CbdcPage() {
  const {
    asOf,
    verifiedOn,
    trackerSourceName,
    trackerSourceUrl,
    globalContext,
    jurisdictions,
    frameworks,
  } = cbdcJson;

  const ordenadas = [...jurisdictions].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99)
  );

  const porEstado = jurisdictions.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Institutional Intelligence"
        title="CBDC & Regulación"
        subtitle={
          <>
            En qué punto está cada banco central con su moneda digital y bajo qué marcos operan hoy
            los activos virtuales. Se amplía editando{" "}
            <code className="rounded bg-ice px-1">data/cbdc-tracker.json</code>.
          </>
        }
      />

      {/* naturaleza del dato: esta página mezcla curado y live */}
      <div className="rounded-lg border border-line bg-card-raised px-4 py-2.5">
        <p className="text-xs leading-relaxed text-ink-secondary">
          <span className="font-semibold text-ink">Snapshot curado al {asOf}</span>, verificado fila
          por fila contra la fuente primaria el {verifiedOn}. Cada entrada enlaza la suya. El estado
          de un proyecto CBDC cambia rápido: revisá el enlace antes de citar. Las dos cards de
          noticias del final sí son datos en vivo.
        </p>
      </div>

      {/* contexto global, para no leer 12 filas como si fueran el mundo entero */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Países explorando una CBDC
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">
            {globalContext.exploring}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-secondary">más del 98% del PIB global</p>
        </div>
        <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Pilotos activos
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">
            {globalContext.pilots}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-secondary">
            {globalContext.advancedPhase} en fase avanzada
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Seguidos en este tracker
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">
            {jurisdictions.length}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-secondary">
            los relevantes para la tesis regional
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(porEstado)
          .sort((a, b) => (STATUS_RANK[a[0]] ?? 99) - (STATUS_RANK[b[0]] ?? 99))
          .map(([status, count]) => (
            <div key={status} className="flex-1 rounded-lg border border-line bg-card px-3 py-2.5">
              <p className="text-2xl font-bold tabular-nums leading-none">{count}</p>
              <p className="mt-1.5">
                <StatusChip status={status} />
              </p>
            </div>
          ))}
      </div>

      <CbdcMap />

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Jurisdicciones</h3>
        <p className="mb-3 text-xs text-ink-secondary">
          {jurisdictions.length} bancos centrales seguidos, ordenados por avance del proyecto.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="border-b border-line pb-1.5 pr-3 text-left font-medium">
                  Jurisdicción
                </th>
                <th className="border-b border-line px-2 pb-1.5 text-left font-medium">Proyecto</th>
                <th className="border-b border-line px-2 pb-1.5 text-left font-medium">Estado</th>
                <th className="border-b border-line px-2 pb-1.5 text-left font-medium">Desde</th>
                <th className="border-b border-line pb-1.5 pl-2 text-left font-medium">Lectura</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((j) => (
                <tr key={j.jurisdiction} className="border-b border-line/50 last:border-0">
                  <td className="py-2 pr-3 align-top">
                    <span className="font-medium">{j.jurisdiction}</span>
                    <span className="block text-[10px] text-ink-muted">{j.centralBank}</span>
                  </td>
                  <td className="px-2 py-2 align-top text-ink-secondary">{j.project}</td>
                  <td className="px-2 py-2 align-top">
                    <StatusChip status={j.status} />
                  </td>
                  <td className="px-2 py-2 align-top tabular-nums text-ink-secondary">{j.since}</td>
                  <td className="max-w-lg py-2 pl-2 align-top">
                    <p className="text-[12px] leading-relaxed text-ink-secondary">{j.note}</p>
                    <p className="mt-1">
                      <SourceLink name={j.sourceName} url={j.sourceUrl} />
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-ink-muted">
          Universo global y estados generales contrastados con{" "}
          <a
            href={trackerSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-core underline hover:text-electric"
          >
            {trackerSourceName}
          </a>
          .
        </p>
      </section>

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Marcos regulatorios de referencia</h3>
        <p className="mb-3 text-xs text-ink-secondary">
          Los regímenes contra los que se compara cualquier propuesta normativa de la región.
        </p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {frameworks.map((f) => (
            <div key={f.name} className="rounded border border-line/70 bg-card-raised p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">{f.name}</h4>
                <span className="rounded bg-electric/15 px-1.5 py-0.5 text-[10px] text-electric">
                  {f.jurisdiction}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">{f.scope}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">{f.note}</p>
              <p className="mt-2">
                <SourceLink name={f.sourceName} url={f.sourceUrl} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <RegulatoryTimeline />

      <CbdcNews />
    </div>
  );
}
