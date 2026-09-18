"use client";

import { useState } from "react";
import { COMPONENTS, COVERAGE_LABEL, INDEX_NAME, INDEX_VERSION, PILLARS, PROFILES } from "@/lib/networks/score";
import { FreshnessTag } from "./atoms";
import { useIntel } from "./useNetworkIntel";

// Metodología completa, dentro de la página y plegada. Un índice propietario
// que no publica sus pesos, su normalización y sus límites no es research: es
// una opinión con decimales.

const IN_INDEX = new Set(PILLARS.flatMap((pillar) => Object.keys(pillar.components)));

export function MethodologyPanel() {
  const { payload } = useIntel();
  const [open, setOpen] = useState(false);

  if (!payload) return null;

  const sourceNames = [...new Set(payload.sources.map((s) => s.source))];

  return (
    <section id="metodologia" className="scroll-mt-4 rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash bf-slash-gold" aria-hidden />
          Cómo se calcula · {INDEX_NAME} {INDEX_VERSION}
        </h3>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="text-[11px] text-core transition-colors hover:text-electric"
        >
          {open ? "Ocultar metodología ▾" : "Ver pesos, fuentes y límites ▸"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-ink-secondary">
        Fuentes: {sourceNames.join(" · ")}.{" "}
        {payload.failed.length > 0 ? (
          <span className="text-warn">Sin respuesta en esta consulta: {payload.failed.join(", ")}.</span>
        ) : (
          "Todas respondieron en esta consulta."
        )}
      </p>

      {open && (
        <div className="mt-4 space-y-4 border-t border-line pt-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {payload.sources.map((source) => (
              <div key={source.block} className="border border-line bg-card-raised p-2">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] font-medium">{source.source}</span>
                  <FreshnessTag freshness={source.freshness} fetchedAt={source.fetchedAt} />
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-ink-secondary">{source.block}</p>
                <p className="mt-0.5 text-[10px] text-ink-muted">
                  {source.period}
                  {!source.ok && <span className="text-down"> · sin respuesta en esta consulta</span>}
                  {source.stale && <span className="text-warn"> · último valor válido en caché</span>}
                </p>
                {source.note && <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">{source.note}</p>}
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-electric">Regla principal</p>
            <p className="max-w-4xl text-[11px] leading-relaxed text-ink-secondary">
              Solo entran a la nota datos que existen para las {payload.universe} redes. Lo que publica una
              fuente para una parte del universo —el costo mediano por transacción y las transacciones por
              segundo de growthepie, que cubren a Ethereum y sus L2— se muestra como detalle rotulado, nunca
              dentro del puntaje: comparar a una red con datos contra otra sin ellos no es comparar.
            </p>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-electric">Normalización</p>
            <p className="max-w-4xl text-[11px] leading-relaxed text-ink-secondary">
              Cada componente se winsoriza al 5% y 95% —los extremos se recortan al percentil, no se
              descartan— y después se escala de 0 a 100 entre ese mínimo y ese máximo. Las magnitudes
              multiplicativas (comisiones, TVL, usuarios, commits) se transforman a logaritmo antes de
              escalar: sin eso, una red con cien veces más actividad aplasta a todas las demás contra el cero.
              Donde el valor bajo es mejor —comisión por usuario— la escala se invierte. Un dato ausente no
              puntúa cero: se renormalizan los pesos del pilar y, si queda menos del 50% cubierto, el pilar se
              publica sin nota. El índice exige al menos tres pilares y 60% de cobertura. La referencia son las
              redes del registro completo: los filtros y el comparador conservan las notas; cambiar el caso de
              uso sí cambia los pesos.
            </p>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-electric">Pilares y pesos del perfil general</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[11px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th className="py-1 font-medium">Pilar</th>
                    <th className="py-1 text-right font-medium">Peso</th>
                    <th className="py-1 font-medium">Componentes y peso interno</th>
                  </tr>
                </thead>
                <tbody>
                  {PILLARS.map((pillar) => (
                    <tr key={pillar.id} className="border-b border-line/60 last:border-0">
                      <td className="py-1.5 font-medium">{pillar.label}</td>
                      <td className="py-1.5 text-right tabular-nums">{pillar.weight}%</td>
                      <td className="py-1.5 text-ink-secondary">
                        {Object.entries(pillar.components)
                          .map(([id, weight]) => `${COMPONENTS.find((c) => c.id === id)?.label ?? id} ${weight}%`)
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-electric">Componentes</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[11px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th className="py-1 font-medium">Componente</th>
                    <th className="py-1 font-medium">Definición</th>
                    <th className="py-1 font-medium">Fuente</th>
                    <th className="py-1 font-medium">Cobertura</th>
                    <th className="py-1 text-center font-medium">Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPONENTS.map((component) => (
                    <tr key={component.id} className="border-b border-line/60 last:border-0">
                      <td className="py-1.5 font-medium">
                        {component.label}
                        <span className="block text-[10px] font-normal text-ink-muted">
                          {component.higherIsBetter ? "↑ mejor" : "↓ mejor"}
                          {component.log && " · logarítmica"}
                        </span>
                      </td>
                      <td className="py-1.5 leading-relaxed text-ink-secondary">{component.definition}</td>
                      <td className="py-1.5 text-ink-muted">{component.source}</td>
                      <td className={`py-1.5 ${component.coverage === "universal" ? "text-ink-secondary" : "text-warn"}`}>
                        {COVERAGE_LABEL[component.coverage]}
                      </td>
                      <td className="py-1.5 text-center">
                        {IN_INDEX.has(component.id) ? (
                          <span className="text-gold-bright">En la nota</span>
                        ) : (
                          <span className="text-ink-muted">Detalle</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-electric">Pesos por caso de uso</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[11px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th className="py-1 font-medium">Caso de uso</th>
                    {PILLARS.map((pillar) => (
                      <th key={pillar.id} className="py-1 text-right font-medium">
                        {pillar.short}
                      </th>
                    ))}
                    <th className="py-1 font-medium">Refuerzos</th>
                  </tr>
                </thead>
                <tbody>
                  {PROFILES.map((profile) => (
                    <tr key={profile.id} className="border-b border-line/60 last:border-0">
                      <td className="py-1.5 font-medium">{profile.label}</td>
                      {PILLARS.map((pillar) => (
                        <td key={pillar.id} className="py-1.5 text-right tabular-nums">
                          {profile.pillars[pillar.id]}%
                        </td>
                      ))}
                      <td className="py-1.5 text-ink-secondary">
                        {Object.entries(profile.emphasis).length === 0
                          ? "Sin refuerzos"
                          : Object.entries(profile.emphasis)
                              .map(([id, factor]) => `${COMPONENTS.find((c) => c.id === id)?.label ?? id} ×${factor}`)
                              .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-warn">Límites conocidos</p>
            <ul className="max-w-4xl space-y-1 text-[11px] leading-relaxed text-ink-secondary">
              <li>
                <span className="text-ink">Costo por usuario, no por transacción.</span> Es la única medida de costo
                que existe para todas las redes. Una cifra alta puede reflejar operaciones de más valor —DeFi en
                Ethereum— y no solo una red cara. Para presupuestar transacciones concretas en redes EVM está el
                detalle de costo mediano.
              </li>
              <li>
                <span className="text-ink">Direcciones no son personas.</span> Incluyen automatización, bots y
                varias cuentas de un mismo usuario. Donde DeFiLlama publica cero y growthepie tiene la serie (OP
                Mainnet, ZKsync Era), se usa growthepie y la ficha lo dice.
              </li>
              <li>
                <span className="text-ink">Comparar L1 con L2 tiene trampa.</span> Una L2 hereda la seguridad de
                su capa base y ahí su costo bajo tiene otro significado. El filtro de capa existe para comparar
                dentro de la misma clase antes que entre clases.
              </li>
              <li>
                <span className="text-ink">Commits no son desarrolladores.</span> Miden la actividad del
                repositorio núcleo de cada red. El conteo de desarrolladores del ecosistema no tiene fuente
                pública con API y por eso no se publica.
              </li>
              <li>
                <span className="text-ink">La tendencia es de capital.</span> Combina la variación del TVL con la
                de commits, las dos disponibles para todas las redes, ajustada por tamaño. Un TVL en USD también
                sube cuando sube el precio de lo depositado.
              </li>
              <li>
                <span className="text-ink">Seguridad con dos bases.</span> En L2 sale del stage y los riesgos de
                L2BEAT; en L1, de la nota editorial del BBI de Blockfinity. Cada ficha declara cuál usó.
              </li>
            </ul>
          </div>

          <p className="text-[10px] text-ink-muted">
            Ficha técnica curada revisada el {payload.registry.techReviewedAt}. {payload.registry.techNote}
          </p>
        </div>
      )}
    </section>
  );
}
