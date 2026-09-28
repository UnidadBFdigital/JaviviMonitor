"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { countByInterest, filterNav, MODULES, type Group } from "@/lib/nav";
import { INTEREST_BY_ID, INTERESTS, type InterestId } from "@/lib/interests";
import { createPrefStore } from "@/lib/prefStore";

const collapsedStore = createPrefStore<boolean>(
  "bf-nav-collapsed",
  false,
  (raw) => raw === "1",
  (value) => (value ? "1" : "0")
);

// El filtro por perfil se guarda como lista separada por comas: legible al
// depurar y estable entre pestañas. Los ids desconocidos se descartan, por si
// la taxonomía cambia mientras alguien tiene el filtro puesto.
const interestStore = createPrefStore<InterestId[]>(
  "bf-nav-interests",
  [],
  (raw) => raw.split(",").filter((id): id is InterestId => INTEREST_BY_ID.has(id as InterestId)),
  (value) => value.join(",")
);

function useInterests(): InterestId[] {
  return useSyncExternalStore(
    interestStore.subscribe,
    interestStore.getSnapshot,
    interestStore.getServerSnapshot
  );
}

/**
 * Filtro por punto de interés: "soy de cumplimiento, muéstrame lo mío".
 * Sin nada marcado se ve todo el terminal; marcar varios suma módulos, no los
 * cruza.
 */
function InterestFilter({ selected }: { selected: InterestId[] }) {
  const visible = filterNav(selected).reduce((total, group) => total + group.items.length, 0);

  function toggle(id: InterestId) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    interestStore.set(next);
  }

  return (
    <div className="mb-4 border-b border-line/70 pb-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 pl-2.5 pr-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          Ver por perfil
        </p>
        {selected.length > 0 && (
          <button
            onClick={() => interestStore.set([])}
            className="text-[10px] text-electric hover:underline"
          >
            Ver todo
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 px-2">
        {INTERESTS.map((interest) => {
          const on = selected.includes(interest.id);
          return (
            <button
              key={interest.id}
              onClick={() => toggle(interest.id)}
              aria-pressed={on}
              title={`${interest.audience}. ${interest.question} · ${countByInterest(interest.id)} módulos`}
              className={`border px-1.5 py-0.5 text-[10px] transition-colors ${
                on
                  ? "border-electric bg-electric/15 text-ink"
                  : "border-line text-ink-muted hover:border-line/80 hover:text-ink"
              }`}
            >
              {interest.short}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="mt-2 px-2 text-[10px] leading-relaxed text-ink-muted">
          {visible} de {MODULES.length} módulos ·{" "}
          {selected.map((id) => INTEREST_BY_ID.get(id)?.label).join(", ")}
        </p>
      )}
    </div>
  );
}

function NavLinks({ groups, onNavigate }: { groups: Group[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {groups.map((group) => (
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
                title={`${item.label} — ${item.interests.map((id) => INTEREST_BY_ID.get(id)?.label).join(" · ")}`}
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
function NavRail({ groups }: { groups: Group[] }) {
  const pathname = usePathname();
  return (
    <>
      {groups.map((group, gi) => (
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
        Blockfinity <span className="-ml-1 text-electric">BBIM</span>
      </p>
      <p className="mt-1 pl-[11px] text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        Blockchain Intelligence Monitor
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
  const collapsed = useSyncExternalStore(
    collapsedStore.subscribe,
    collapsedStore.getSnapshot,
    collapsedStore.getServerSnapshot
  );
  const selected = useInterests();
  const groups = filterNav(selected);

  function toggleCollapsed() {
    collapsedStore.set(!collapsedStore.getSnapshot());
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
            <InterestFilter selected={selected} />
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
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
            <span className="bf-slash mt-1.5 text-xl" aria-hidden title="Blockfinity BBIM" />
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
          {collapsed ? (
            <NavRail groups={groups} />
          ) : (
            <>
              <InterestFilter selected={selected} />
              <NavLinks groups={groups} />
            </>
          )}
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
