export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {subtitle && <p className="text-xs text-ink-secondary">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
