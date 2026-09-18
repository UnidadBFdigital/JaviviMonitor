"use client";

import { usePayload } from "@/lib/useSource";
import { formatTimestamp } from "@/lib/format";

// Morning Brief: los hallazgos deterministas de /api/insights, priorizados
// como los leería un comité (riesgo primero) y numerados. Cada línea cita su
// fuente; ninguna se genera con IA libre.

type Insights = {
  ok: boolean;
  hallazgos: string[];
  riesgos: string[];
  oportunidades: string[];
  pregunta: string;
  method: string;
  fetchedAt: string;
};

type Tagged = { tag: string; tone: string; text: string };

function rank(data: Insights): Tagged[] {
  return [
    ...data.riesgos.map((text) => ({ tag: "Riesgo", tone: "text-down border-down/40", text })),
    ...data.hallazgos.map((text) => ({
      tag: "Hallazgo",
      tone: "text-electric border-electric/40",
      text,
    })),
    ...data.oportunidades.map((text) => ({
      tag: "Oportunidad",
      tone: "text-up border-up/40",
      text,
    })),
  ];
}

export function MorningBrief() {
  const { data, error } = usePayload<Insights>("/api/insights");
  const items = data?.ok ? rank(data) : [];

  return (
    <section className="bf-reveal border-t-2 border-electric/70 bg-card px-4 pb-4 pt-3.5">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold"><span className="bf-slash" aria-hidden />Morning Brief</h2>
      <p className="mb-3 text-[10px] text-ink-muted">
        {items.length} señales derivadas de los datos del terminal por reglas deterministas — cada
        línea cita su fuente.
      </p>

      {error && <p className="py-4 text-sm text-ink-muted">No disponible.</p>}
      {!data && !error && <div className="bf-shimmer h-56 rounded" />}

      {data?.ok && (
        <>
          <ol className="space-y-2.5">
            {items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-px w-5 shrink-0 text-right text-sm font-bold tabular-nums text-ink-muted">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <span
                    className={`mr-2 rounded border px-1.5 py-px align-middle text-[9px] font-semibold uppercase tracking-wider ${item.tone}`}
                  >
                    {item.tag}
                  </span>
                  <span className="text-[13px] leading-relaxed text-ink-secondary">
                    {item.text}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded border border-line/70 bg-card-raised px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-warn">
              Pregunta de investigación
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{data.pregunta}</p>
          </div>

          <p className="mt-2 text-[9px] text-ink-muted">Generado {formatTimestamp(data.fetchedAt)}</p>
        </>
      )}
    </section>
  );
}
