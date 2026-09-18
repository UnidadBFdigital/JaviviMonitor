"use client";

import { useState } from "react";
import Link from "next/link";
import { NAV } from "@/components/Sidebar";

// Mapa vivo del terminal. Se construye con el MISMO array de navegación que
// alimenta el sidebar, así que una vista nueva aparece acá sin tocar nada:
// lo único propio del aula es la pregunta que responde cada vista.
//
// Si una vista no tiene pregunta declarada, se muestra igual con su etiqueta;
// preferible un hueco visible a un mapa incompleto en silencio.

const QUESTION: Record<string, string> = {
  "/": "¿Qué pasó hoy y qué mueve el mercado?",
  "/informe": "¿Qué le entrego por escrito al cliente?",
  "/tokenizacion": "¿Cuánto activo real hay on-chain?",
  "/tokenizacion/clases": "¿Qué se tokeniza en cada clase de activo?",
  "/tokenizacion/casos": "¿Quién ya lo hizo y cómo le fue?",
  "/tokenizacion/bolivia": "¿Qué se puede tokenizar acá?",
  "/stablecoins": "¿Cuánto dólar digital circula y dónde?",
  "/capital-markets": "¿Qué hace el capital tradicional?",
  "/cbdc": "¿Qué está haciendo cada regulador?",
  "/indices": "¿Qué dicen los índices propios de Blockfinity?",
  "/blockchains": "¿Qué redes existen y cuánto pesan?",
  "/blockchains/scorecard": "¿Cómo se comparan con una nota única?",
  "/blockchains/riesgo": "¿Qué riesgo trae cada red?",
  "/bolivia/noticias": "¿Qué se publicó en Bolivia?",
  "/bolivia/timeline": "¿Cómo evolucionó la norma local?",
  "/mercado": "¿A qué precio cotiza y con qué volumen?",
  "/onchain": "¿Qué muestra la cadena de Bitcoin?",
  "/defi": "¿Qué protocolo gana dinero de verdad?",
  "/seguridad": "¿Qué falló y cuánto costó?",
  "/correlaciones": "¿Qué se mueve junto con qué?",
  "/noticias": "¿Qué anunciaron las instituciones?",
  "/partnerships": "¿Con quién conviene aliarse?",
  "/fan-tokens": "¿Cómo se comporta el segmento deportivo?",
  "/ia": "¿Puedo preguntarle a los datos en lenguaje natural?",
  "/nexum": "¿Cómo se aprende a leer todo lo anterior?",
};

/** Cuentas reales del terminal, para que el aula no declare un número propio. */
export const TERMINAL_VIEWS = NAV.reduce((sum, group) => sum + group.items.length, 0);
export const TERMINAL_SECTIONS = NAV.length;

export function TerminalMap() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] text-ink-secondary">
          {TERMINAL_SECTIONS} secciones del menú · {TERMINAL_VIEWS} vistas. Tocá una tarjeta para
          ver qué pregunta responde; el enlace la abre en el terminal, en otra pestaña.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {NAV.map((group, gi) => (
          <section
            key={group.title}
            className="nx-enter rounded-lg border border-line bg-card p-3"
            style={{ "--nx-i": gi } as React.CSSProperties}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="bf-slash" aria-hidden />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                {group.title}
              </h4>
              <span className="ml-auto text-[10px] tabular-nums text-ink-muted">
                {group.items.length}
              </span>
            </div>

            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = open === item.href;
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => setOpen(active ? null : item.href)}
                      aria-expanded={active}
                      className={`flex w-full items-center gap-2 border-l-2 py-1 pl-2 pr-1 text-left text-[12px] transition-all duration-150 ${
                        active
                          ? "border-electric bg-electric/10 text-ink"
                          : "border-transparent text-ink-secondary hover:border-line hover:bg-ice/40 hover:pl-3 hover:text-ink"
                      }`}
                    >
                      <span className="w-8 shrink-0 font-mono text-[9px] text-ink-muted">
                        {item.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </button>

                    {active && (
                      <div className="nx-enter mb-1 ml-2 border-l-2 border-electric/50 py-1 pl-2.5">
                        <p className="text-[11px] leading-relaxed text-ink-secondary">
                          {QUESTION[item.href] ?? "Vista del terminal."}
                        </p>
                        <Link
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-[11px] text-core transition-colors hover:text-electric"
                        >
                          Abrir en el terminal ↗
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
