"use client";

import { MiniSpark } from "./ReportCharts";

// Piezas de maquetación compartidas por todos los capítulos del informe. Antes
// cada archivo de capítulo tenía su propia copia de la sección y la cifra; un
// ajuste de estilo en una no llegaba a las otras.

export function ReportFig({
  value,
  label,
  note,
  spark,
  positive,
}: {
  value: string;
  label: string;
  note?: string;
  /** serie corta bajo la cifra; la tarjeta deja de ser un número suelto */
  spark?: number[];
  positive?: boolean | null;
}) {
  return (
    <div className="bf-rp-fig">
      <b>{value}</b>
      <span>{label}</span>
      {note && <small>{note}</small>}
      {spark && spark.length > 1 && (
        <div className="bf-rp-fig-s">
          <MiniSpark values={spark} positive={positive} />
        </div>
      )}
    </div>
  );
}

export function ReportSection({
  code,
  layer,
  title,
  lead,
  pageBreak,
  children,
}: {
  code: string;
  layer: string;
  title: string;
  lead?: string;
  pageBreak?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`informe-${code}`}
      aria-labelledby={`informe-title-${code}`}
      className={`bf-rp-sect ${pageBreak ? "bf-rp-pagebreak" : ""}`}
    >
      <header className="bf-rp-section-head">
        <div className="bf-rp-cue">
          <div className="bf-rp-code">{code}</div>
          <div className="bf-rp-layer">{layer}</div>
          <div className="bf-rp-tick" aria-hidden />
        </div>
        <div className="bf-rp-section-intro">
          <h2 id={`informe-title-${code}`}>{title}</h2>
          {lead && <p className="bf-rp-lead">{lead}</p>}
        </div>
      </header>
      <div className="bf-rp-body">{children}</div>
    </section>
  );
}

export function ReportTable({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bf-rp-table">
      <table>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
