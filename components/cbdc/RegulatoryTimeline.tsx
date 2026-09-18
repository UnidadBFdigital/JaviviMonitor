import cbdcJson from "@/data/cbdc-tracker.json";

// Línea de tiempo regulatoria. Solo hitos con fuente primaria verificada.
// Los que todavía no ocurrieron se marcan como próximos en vez de mezclarse
// con los ya consumados.

const ACTOR_TONE: { match: RegExp; cls: string }[] = [
  { match: /BCB|ASFI/, cls: "border-up text-up" },
  { match: /ESMA|Unión Europea|Europeo/, cls: "border-electric text-electric" },
  { match: /Estados Unidos|Senado/, cls: "border-down text-down" },
  { match: /Rusia|Riksbank/, cls: "border-warn text-warn" },
];

function actorTone(actor: string): string {
  return ACTOR_TONE.find((a) => a.match.test(actor))?.cls ?? "border-line text-ink-secondary";
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function RegulatoryTimeline() {
  const hoy = new Date().toISOString().slice(0, 10);
  const eventos = [...cbdcJson.timeline].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Línea de tiempo regulatoria</h3>
      <p className="mb-4 text-xs text-ink-secondary">
        Hitos de bancos centrales, reguladores y legisladores que cambian las reglas del activo.
        Cada uno enlaza su fuente primaria.
      </p>

      <ol className="relative border-l border-line pl-5">
        {eventos.map((e) => {
          const futuro = e.date > hoy;
          return (
            <li key={`${e.date}-${e.title}`} className="relative pb-5 last:pb-0">
              <span
                className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 ${
                  futuro ? "border-warn bg-surface" : "border-electric bg-electric"
                }`}
              />
              <div className="flex flex-wrap items-baseline gap-2">
                <time className="text-[11px] font-semibold tabular-nums text-ink-secondary">
                  {formatDate(e.date)}
                </time>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${actorTone(e.actor)}`}
                >
                  {e.actor}
                </span>
                {futuro && (
                  <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn">
                    próximo
                  </span>
                )}
              </div>
              <h4 className="mt-1 text-[13px] font-medium leading-snug">{e.title}</h4>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{e.detail}</p>
              <a
                href={e.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[10px] text-core underline hover:text-electric"
              >
                fuente
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
