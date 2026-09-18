import Link from "next/link";

// Contenedor de sección con cuatro registros visuales. El terminal venía
// resolviendo TODO con la misma ficha (borde + fondo + radio), y esa
// monotonía aplana la jerarquía: un gráfico ancho y una nota al pie pesaban
// lo mismo. Cada variante existe para un trabajo distinto.
//
//   card    ficha clásica — datos densos, tablas, listas
//   bare    sin chrome — el gráfico se apoya en el fondo de la página
//   cut     marco con chaflán — bloques de firma, lo que define al producto
//   flush   fondo sin borde ni radio, con filete superior — cambia el ritmo
export type PanelVariant = "card" | "bare" | "cut" | "flush";

const SHELL: Record<PanelVariant, string> = {
  card: "rounded-lg border border-line bg-card p-4",
  bare: "",
  cut: "", // lo aporta el marco de dos capas
  flush: "border-t-2 border-electric/70 bg-card px-4 pb-4 pt-3.5",
};

function Header({
  title,
  subtitle,
  href,
  linkLabel,
  aside,
  accent,
}: {
  title?: string;
  subtitle?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  aside?: React.ReactNode;
  accent?: boolean;
}) {
  if (!title && !subtitle && !aside) return null;
  return (
    <div className={subtitle ? "mb-3" : "mb-2"}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {title && (
          <h3 className="flex items-baseline gap-2 text-sm font-semibold">
            {accent && <span className="bf-slash" aria-hidden />}
            {title}
          </h3>
        )}
        <div className="flex items-baseline gap-3">
          {aside}
          {href && linkLabel && (
            <Link
              href={href}
              className="whitespace-nowrap text-[11px] text-core transition-colors hover:text-electric"
            >
              {linkLabel}
            </Link>
          )}
        </div>
      </div>
      {subtitle && (
        <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-ink-secondary">{subtitle}</p>
      )}
    </div>
  );
}

export function Panel({
  variant = "card",
  title,
  subtitle,
  href,
  linkLabel,
  aside,
  footer,
  className = "",
  index,
  children,
}: {
  variant?: PanelVariant;
  title?: string;
  subtitle?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  /** contenido a la derecha del título (una cifra, un chip de estado) */
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** posición en una grilla: escalona la animación de entrada */
  index?: number;
  children: React.ReactNode;
}) {
  const head = (
    <Header
      title={title}
      subtitle={subtitle}
      href={href}
      linkLabel={linkLabel}
      aside={aside}
      accent={variant === "bare" || variant === "cut"}
    />
  );

  const body = (
    <>
      {head}
      {children}
      {footer && <div className="mt-3 text-[11px] text-ink-muted">{footer}</div>}
    </>
  );

  const style = index !== undefined ? ({ "--bf-i": index } as React.CSSProperties) : undefined;

  if (variant === "cut") {
    return (
      <section className={`bf-frame bf-reveal ${className}`} style={style}>
        <div className="bg-card p-4">{body}</div>
      </section>
    );
  }

  return (
    <section className={`bf-reveal ${SHELL[variant]} ${className}`} style={style}>
      {body}
    </section>
  );
}
