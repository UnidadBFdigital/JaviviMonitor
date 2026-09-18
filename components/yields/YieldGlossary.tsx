import Link from "next/link";

// Seis ideas para leer un rendimiento sin caer en las trampas más comunes.
// Texto corto y concreto: quien llega sin experiencia en DeFi tiene que poder
// decidir qué mirar después de leerlo.

const ENTRIES: { title: string; body: React.ReactNode }[] = [
  {
    title: "APY",
    body: "Lo que rendiría tu depósito en un año si la tasa de hoy se mantuviera, con interés compuesto. No está garantizado: cambia todos los días.",
  },
  {
    title: "Base e incentivos",
    body: "La base sale de la actividad real del pool (intereses, comisiones). Los incentivos se pagan en tokens del protocolo: si ese token cae o el programa termina, esa parte desaparece.",
  },
  {
    title: "Pérdida impermanente",
    body: "Al proveer liquidez con dos activos, si sus precios se separan terminás con más del que bajó y menos del que subió. Las comisiones pueden no compensarlo.",
  },
  {
    title: "Plazos y retiros",
    body: "Algunos pools piden esperar días para retirar, bloquean el depósito o vencen en una fecha. Una tasa fija solo es fija si esperás al vencimiento.",
  },
  {
    title: "Depositado (TVL)",
    body: "Cuánto capital hay en el pool. Más capital no es garantía de seguridad, pero en un pool chico la tasa se mueve mucho con pocos depósitos o retiros.",
  },
  {
    title: "Señales de riesgo",
    body: (
      <>
        Reglas visibles sobre capital, historial, incentivos y rendimientos atípicos. No auditan contratos: un hackeo puede
        pasar en cualquier protocolo. Mirá los antecedentes en{" "}
        <Link href="/seguridad" className="text-core underline hover:text-electric">
          Exploits & Seguridad
        </Link>
        .
      </>
    ),
  },
];

export function YieldGlossary() {
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold">
        <span className="bf-slash" aria-hidden />
        Cómo leer un rendimiento
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ENTRIES.map((entry, index) => (
          <article key={entry.title} className="rounded border border-line/70 bg-card-raised p-3">
            <p className="flex items-baseline gap-2 text-[12px] font-semibold">
              <span className="font-mono text-[10px] text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
              {entry.title}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">{entry.body}</p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-ink-muted">
        Información para análisis, no una recomendación de inversión. Antes de depositar, revisá la documentación del protocolo.
      </p>
    </section>
  );
}
