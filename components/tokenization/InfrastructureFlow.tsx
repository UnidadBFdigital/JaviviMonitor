// Cadena de infraestructura de una emisión tokenizada. SVG inline, sin
// dependencias: seis etapas y, debajo de cada una, quién responde por ella.
// El punto que comunica: cinco de las seis etapas son off-chain.

const STAGES: { label: string; actor: string; onchain: boolean }[] = [
  { label: "Activo físico", actor: "Productor · minera · emisor", onchain: false },
  { label: "Custodia", actor: "Almacén · bóveda · depositario", onchain: false },
  { label: "Verificación", actor: "Certificadora · auditor externo", onchain: false },
  { label: "Emisión", actor: "Vehículo legal · agente de registro", onchain: false },
  { label: "Blockchain", actor: "Registro y transferencia", onchain: true },
  { label: "Mercado secundario", actor: "Plataforma autorizada · creador de mercado", onchain: true },
];

export function InfrastructureFlow() {
  const W = 1120;
  const H = 190;
  const boxW = 158;
  const gap = (W - STAGES.length * boxW) / (STAGES.length - 1);

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Cadena de infraestructura de una emisión</h3>
      <p className="mb-3 text-xs text-ink-secondary">
        Del activo físico al mercado secundario. Cuatro de las seis etapas ocurren fuera de la
        blockchain — y son las que deciden si el token vale algo.
      </p>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[760px]" role="img">
          <title>Activo físico, custodia, verificación, emisión, blockchain y mercado secundario</title>
          <defs>
            <marker id="flowArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,1 L7,4 L0,7 z" fill="#4a4f52" />
            </marker>
          </defs>

          {STAGES.map((s, i) => {
            const x = i * (boxW + gap);
            const fill = s.onchain ? "rgba(47,102,255,0.12)" : "#1a1e21";
            const stroke = s.onchain ? "#2f66ff" : "#262a2b";
            return (
              <g key={s.label}>
                {i > 0 && (
                  <line
                    x1={x - gap + 4}
                    y1={54}
                    x2={x - 6}
                    y2={54}
                    stroke="#4a4f52"
                    strokeWidth={1.5}
                    markerEnd="url(#flowArrow)"
                  />
                )}
                <rect
                  x={x}
                  y={26}
                  width={boxW}
                  height={56}
                  rx={6}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.5}
                />
                <text
                  x={x + boxW / 2}
                  y={49}
                  textAnchor="middle"
                  fill="#e8edf2"
                  fontSize={13}
                  fontWeight={600}
                >
                  {s.label}
                </text>
                <text
                  x={x + boxW / 2}
                  y={67}
                  textAnchor="middle"
                  fill={s.onchain ? "#2f66ff" : "#64748b"}
                  fontSize={9.5}
                  letterSpacing={1}
                >
                  {s.onchain ? "ON-CHAIN" : "OFF-CHAIN"}
                </text>

                <foreignObject x={x} y={92} width={boxW} height={54}>
                  <div className="px-1 text-center text-[10px] leading-snug text-ink-secondary">
                    {s.actor}
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* llave que marca dónde se juega la confianza */}
          <line
            x1={0}
            y1={166}
            x2={4 * (boxW + gap) - gap / 2}
            y2={166}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text x={4} y={182} fill="#f59e0b" fontSize={10.5}>
            Acá se decide si el token está respaldado — la blockchain solo lo registra
          </text>
        </svg>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Corolario operativo: un proyecto de tokenización que empieza eligiendo blockchain empezó por
        la etapa equivocada. La pregunta previa es quién custodia, quién certifica y bajo qué figura
        legal se emite.
      </p>
    </section>
  );
}
