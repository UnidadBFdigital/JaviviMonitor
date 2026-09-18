// Cabecera única de todas las vistas. El eyebrow nombra la vertical del menú,
// así el usuario siempre sabe en qué capa del terminal está parado. La
// retícula de fondo y el filete diagonal la separan del contenido sin
// recurrir a otra ficha más.
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="bf-reveal relative overflow-hidden border-b border-line pb-4">
      <div className="bf-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-0.5"
        style={{ background: "linear-gradient(to bottom, var(--color-gold), transparent)" }}
        aria-hidden
      />
      <div className="relative pl-3.5">
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-electric">
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {actions}
        </div>
        {subtitle && (
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-ink-secondary">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
