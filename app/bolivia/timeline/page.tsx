import eventsJson from "@/data/bolivia-events.json";
import { eventColor } from "@/lib/eventColors";

export const metadata = { title: "Timeline regulatorio Bolivia — BBIM" };



function formatDate(date: string, precision: string): string {
  if (precision === "year") return date.slice(0, 4);
  if (precision === "month") return date.slice(0, 7);
  return date;
}

export default function TimelinePage() {
  const events = [...eventsJson.events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Timeline regulatorio — Bolivia</h2>
        <p className="text-xs text-ink-muted">
          Eventos curados y verificados con fuente (BCB, ASFI, UIF, normativa). Se amplía editando{" "}
          <code className="rounded bg-ice px-1">data/bolivia-events.json</code>.
        </p>
      </div>
      <div className="relative ml-3 border-l border-line pl-6">
        {events.map((e) => (
          <details key={e.title} className="group relative mb-4 last:mb-0">
            <span
              className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card"
              style={{ background: eventColor(e.category) }}
            />
            <summary className="cursor-pointer list-none rounded-lg border border-line bg-card p-3 transition-colors hover:border-electric/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] tabular-nums text-ink-muted">
                  {formatDate(e.date, e.datePrecision)}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: `${eventColor(e.category)}26`,
                    color: eventColor(e.category),
                  }}
                >
                  {e.category}
                </span>
                <span className="text-[11px] text-ink-muted">{e.institution}</span>
              </div>
              <p className="mt-1 text-sm font-medium">{e.title}</p>
            </summary>
            <div className="mt-1 rounded-lg border border-line/60 bg-card-raised p-3 text-xs leading-relaxed">
              <p className="text-ink-secondary">{e.summary}</p>
              <p className="mt-2">
                <span className="font-semibold text-ink">Implicaciones: </span>
                <span className="text-ink-secondary">{e.implications}</span>
              </p>
              <p className="mt-2 text-[11px]">
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-core underline hover:text-electric"
                >
                  {e.sourceName}
                </a>
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
