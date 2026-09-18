import Link from "next/link";

// Separador de capítulo del dashboard. El acento diagonal y la regla que se
// desvanece dan un corte más nítido que una línea plana, y el índice numerado
// deja claro que la portada se lee en orden.
export function SectionDivider({
  title,
  hint,
  href,
  linkLabel,
  index,
}: {
  title: string;
  hint?: string;
  href?: string;
  linkLabel?: string;
  index?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
      {index !== undefined && (
        <span className="text-[10px] font-semibold tabular-nums text-ink-muted">
          {String(index).padStart(2, "0")}
        </span>
      )}
      <span className="bf-slash" aria-hidden />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">{title}</p>
      {hint && <p className="text-[11px] text-ink-muted">{hint}</p>}
      <div
        className="h-px min-w-8 flex-1"
        style={{ background: "linear-gradient(to right, var(--color-line), transparent)" }}
      />
      {href && linkLabel && (
        <Link
          href={href}
          className="whitespace-nowrap text-[11px] text-core transition-colors hover:text-electric"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
