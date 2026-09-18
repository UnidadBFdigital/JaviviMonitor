"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// La navegación se organiza por vertical de decisión (qué necesita saber el
// cliente), no por tipo de dato. Las URLs se mantienen como estaban.
//
// `code` es la etiqueta del modo contraído: tres caracteres en mono, que es
// lo único que entra en el riel de 56 px. No es decorativo — sin él, el
// sidebar contraído no diría en qué sección está parado el usuario.
export type Item = { label: string; href: string; code: string };
export type Group = { title: string; items: Item[] };

export const NAV: Group[] = [
  {
    title: "Executive Brief",
    items: [
      { href: "/", label: "Portada del día", code: "HOY" },
      { href: "/informe", label: "Informe descargable", code: "PDF" },
    ],
  },
  {
    title: "Institutional Intelligence",
    items: [
      { href: "/tokenizacion", label: "Tokenization Hub", code: "TKN" },
      { href: "/tokenizacion/clases", label: "· Asset Classes", code: "CLS" },
      { href: "/tokenizacion/casos", label: "· Global Case Studies", code: "CAS" },
      { href: "/tokenizacion/bolivia", label: "· Bolivia Opportunities", code: "OPB" },
      { href: "/stablecoins", label: "Stablecoin Intelligence", code: "STB" },
      { href: "/capital-markets", label: "Capital Markets", code: "CAP" },
      { href: "/cbdc", label: "CBDC & Regulation", code: "CBD" },
    ],
  },
  {
    title: "Blockfinity Indices",
    items: [{ href: "/indices", label: "Índices propietarios", code: "IDX" }],
  },
  {
    title: "Blockchain Intelligence",
    items: [
      { href: "/blockchains", label: "Landscape", code: "LND" },
      { href: "/blockchains/scorecard", label: "Scorecard & BBI", code: "BBI" },
      { href: "/blockchains/riesgo", label: "Risk Profiles", code: "RSK" },
      { href: "/blockchains/infraestructura", label: "Builder Radar", code: "BLD" },
    ],
  },
  {
    title: "Bolivia Intelligence",
    items: [
      { href: "/bolivia/noticias", label: "Bolivia News", code: "BNW" },
      { href: "/bolivia/timeline", label: "Timeline regulatorio", code: "TML" },
    ],
  },
  {
    title: "Market Intelligence",
    items: [
      { href: "/mercado", label: "Crypto Markets", code: "MKT" },
      { href: "/onchain", label: "Bitcoin & On-chain", code: "BTC" },
      { href: "/defi", label: "Protocol Analytics", code: "DFI" },
      { href: "/defi/yields", label: "· DeFi Yields", code: "YLD" },
      { href: "/seguridad", label: "Exploits & Seguridad", code: "SEC" },
      { href: "/correlaciones", label: "Correlation Lab", code: "COR" },
    ],
  },
  {
    title: "Research Lab",
    items: [
      { href: "/noticias", label: "News B2B", code: "NWS" },
      { href: "/partnerships", label: "Partnerships", code: "PTN" },
      { href: "/fan-tokens", label: "Fan Token Analytics", code: "FAN" },
      { href: "/ia", label: "AI Workspace", code: "IA" },
    ],
  },
  {
    title: "NEXUM Intelligence Layer",
    items: [{ href: "/nexum", label: "Aula del terminal", code: "NXM" }],
  },
];

const STORAGE_KEY = "bf-nav-collapsed";

// La preferencia de contraído vive en localStorage, que es un store externo:
// leerlo con useSyncExternalStore evita el render extra de un useEffect y
// mantiene sincronizadas dos pestañas abiertas del terminal.
const listeners = new Set<() => void>();
let snapshot: boolean | null = null;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // navegador con almacenamiento bloqueado: se queda expandido
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = null;
    listeners.forEach((listener) => listener());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Debe devolver el MISMO valor mientras no cambie el store, de ahí la caché. */
function getSnapshot(): boolean {
  if (snapshot === null) snapshot = readCollapsed();
  return snapshot;
}

/** En el servidor no hay preferencia: se renderiza expandido y el cliente
 *  corrige tras la hidratación. */
function getServerSnapshot(): boolean {
  return false;
}

function setCollapsed(next: boolean) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // la preferencia no persiste, pero la sesión sigue funcionando
  }
  listeners.forEach((listener) => listener());
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((group) => (
        <div key={group.title} className="mb-5">
          <div className="mb-1.5 flex items-center gap-2 pl-2.5 pr-2">
            <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              {group.title}
            </p>
            <span
              className="h-px min-w-0 flex-1"
              style={{ background: "linear-gradient(to right, var(--color-line), transparent)" }}
            />
          </div>
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 border-l-2 py-1.5 pl-2.5 pr-2 text-[13px] transition-all duration-150 ${
                  active
                    ? "border-electric bg-electric/10 font-medium text-ink"
                    : "border-transparent text-ink-secondary hover:border-line/80 hover:bg-ice/40 hover:pl-3.5 hover:text-ink"
                }`}
              >
                {active && (
                  <span
                    className="absolute right-2 h-1.5 w-1.5 rotate-45 bg-electric"
                    aria-hidden
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

/** Riel contraído: solo el código de tres letras, con el nombre completo en
 *  el tooltip nativo. El flyout en HTML no sirve acá — el `overflow-y-auto`
 *  del aside lo recortaría contra el borde. */
function NavRail() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((group, gi) => (
        <div key={group.title} className={gi === 0 ? "" : "mt-3 border-t border-line/70 pt-3"}>
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={`${group.title} — ${item.label}`}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`mb-0.5 flex items-center justify-center border-l-2 py-2 font-mono text-[10px] tracking-[0.04em] transition-colors duration-150 ${
                  active
                    ? "border-electric bg-electric/10 font-semibold text-ink"
                    : "border-transparent text-ink-muted hover:bg-ice/40 hover:text-ink"
                }`}
              >
                {item.code}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Brand() {
  return (
    <>
      <p className="flex items-baseline gap-2 text-sm font-bold tracking-tight">
        <span className="bf-slash" aria-hidden />
        Blockfinity <span className="-ml-1 text-electric">Research</span>
      </p>
      <p className="mt-1 pl-[11px] text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        Research Terminal
      </p>
    </>
  );
}

/** Chevron doble: apunta hacia donde va el panel al pulsar. */
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.5 3.5 5 8l4.5 4.5" />
      <path d="M13.5 3.5 9 8l4.5 4.5" />
    </svg>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggleCollapsed() {
    setCollapsed(!getSnapshot());
  }

  // Atajo "[" — el mismo gesto de los IDE. Se ignora mientras se escribe.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      event.preventDefault();
      toggleCollapsed();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const width = collapsed ? "w-14" : "w-56";

  return (
    <>
      {/* Barra superior en pantallas chicas */}
      <div className="bf-noprint sticky top-0 z-30 border-b border-line bg-card lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <Brand />
          </div>
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label="Menú de navegación"
            className="rounded border border-line px-2.5 py-1.5 text-xs text-ink-secondary hover:bg-ice/50"
          >
            {open ? "Cerrar ✕" : "Menú ☰"}
          </button>
        </div>
        {open && (
          <nav className="max-h-[70vh] overflow-y-auto border-t border-line px-2 py-3">
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
        )}
      </div>

      {/* Sidebar fijo en escritorio */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-line bg-card transition-[width] duration-200 ease-out lg:flex ${width}`}
      >
        <div
          className={`bf-grid-bg pointer-events-none fixed h-screen opacity-40 ${width}`}
          aria-hidden
        />
        <div
          className={`relative flex items-start justify-between gap-2 border-b border-line py-4 ${
            collapsed ? "px-2" : "px-4"
          }`}
        >
          {collapsed ? (
            <span className="bf-slash mt-1.5 text-xl" aria-hidden title="Blockfinity Research" />
          ) : (
            <div className="min-w-0">
              <Brand />
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"}
            title={`${collapsed ? "Expandir" : "Contraer"} navegación  [`}
            className="shrink-0 rounded border border-line p-1 text-ink-muted transition-colors hover:bg-ice/50 hover:text-ink"
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
        <nav className={`relative flex-1 py-3 ${collapsed ? "px-1" : "px-2"}`}>
          {collapsed ? <NavRail /> : <NavLinks />}
        </nav>
        {!collapsed && (
          <div className="relative border-t border-line px-4 py-3 text-[10px] leading-relaxed text-ink-muted">
            Uso exclusivo del equipo.
            <br />
            Los datos muestran fuente y timestamp.
          </div>
        )}
      </aside>
    </>
  );
}
