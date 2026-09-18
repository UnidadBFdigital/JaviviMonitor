"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CATEGORICAL, GOLD, NEUTRAL, STATUS } from "@/lib/palette";
import { formatMetric, formatAxis, type NexumChart, type NexumUnit } from "@/lib/nexum";
import { usePrefersReducedMotion } from "./useNexum";

// Gráficos del aula. Son versiones simplificadas de los del terminal: menos
// series, más anotación. Cada uno entra animado porque el movimiento acá
// enseña —la barra que crece muestra la proporción, el trazo que se dibuja
// muestra la dirección— y se apaga entero con prefers-reduced-motion.

/* ---------- cifra que cuenta ---------- */

export function AnimatedNumber({
  value,
  unit,
  className = "",
}: {
  value: number;
  unit: NexumUnit;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    const delta = value - start;
    // sin movimiento —o sin cambio— se pinta el valor final y no hay animación
    if (reduced || delta === 0) {
      from.current = value;
      return;
    }
    const t0 = performance.now();
    const DURATION = 900;
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      // easeOutCubic: arranca rápido y frena, como un contador mecánico
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(start + delta * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  // mientras dura la animación manda `shown`; con movimiento reducido, el valor real
  return (
    <span className={`tabular-nums ${className}`}>
      {formatMetric(reduced ? value : shown, unit)}
    </span>
  );
}

/* ---------- anotaciones ---------- */

function Beacon({ index, open, onClick }: { index: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={`Nota de lectura ${index + 1}`}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold transition-colors ${
        open
          ? "bg-electric text-white"
          : "nx-beacon bg-electric/25 text-electric hover:bg-electric/40"
      }`}
    >
      {index + 1}
    </button>
  );
}

/* ---------- barras horizontales ---------- */

function BarsChart({
  chart,
  openNote,
  toggleNote,
}: {
  chart: NexumChart;
  openNote: number | null;
  toggleNote: (index: number) => void;
}) {
  const max = Math.max(...chart.data.map((d) => d.value));
  const total = chart.data.reduce((sum, d) => sum + d.value, 0);
  const color = chart.proprietary ? GOLD : CATEGORICAL[0];

  return (
    <div className="space-y-1.5">
      {chart.data.map((point, i) => {
        const note = chart.annotations?.findIndex((a) => a.at === i) ?? -1;
        const share = total > 0 ? (point.value / total) * 100 : 0;
        const isRest = /otro|resto/i.test(point.label);
        return (
          <div key={point.label}>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[11px] text-ink-secondary" title={point.label}>
                {point.label}
              </span>
              <div className="relative h-4 min-w-0 flex-1 bg-ice/50">
                <div
                  className="bf-grow-x h-full"
                  style={
                    {
                      width: `${(point.value / max) * 100}%`,
                      background: isRest ? NEUTRAL : color,
                      opacity: isRest ? 0.6 : 1,
                      "--bf-i": i,
                    } as React.CSSProperties
                  }
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[11px] font-medium tabular-nums">
                {formatAxis(point.value, chart.unit)}
              </span>
              <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-ink-muted">
                {chart.unit === "index" ? "" : `${share.toFixed(0)}%`}
              </span>
              <span className="w-4 shrink-0">
                {note >= 0 && (
                  <Beacon index={note} open={openNote === note} onClick={() => toggleNote(note)} />
                )}
              </span>
            </div>
            {note >= 0 && openNote === note && (
              <p className="nx-enter mb-1 ml-30 mt-1 border-l-2 border-electric bg-electric/5 py-1 pl-2 pr-2 text-[11px] leading-relaxed text-ink-secondary">
                {chart.annotations![note].text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- área temporal ---------- */

function AreaChart({
  chart,
  openNote,
  toggleNote,
}: {
  chart: NexumChart;
  openNote: number | null;
  toggleNote: (index: number) => void;
}) {
  const gradId = useId();
  const W = 560;
  const H = 170;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;

  const values = chart.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // la base no arranca en cero: la serie es de nivel, no de conteo
  const floor = min - range * 0.18;
  const span = max - floor;
  const step = (W - padX * 2) / (chart.data.length - 1 || 1);

  const pts = chart.data.map((d, i) => ({
    x: padX + i * step,
    y: padTop + (H - padTop - padBottom) * (1 - (d.value - floor) / span),
  }));

  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  const last = pts[pts.length - 1];
  const color = chart.proprietary ? GOLD : CATEGORICAL[0];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={chart.title}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => {
          const y = padTop + (H - padTop - padBottom) * t;
          return <line key={t} x1={padX} y1={y} x2={W - padX} y2={y} stroke="#262a2b" strokeWidth={1} />;
        })}

        <polygon
          points={`${padX},${H - padBottom} ${line} ${(W - padX).toFixed(1)},${H - padBottom}`}
          fill={`url(#${gradId})`}
        />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="bf-draw"
          style={{ "--bf-len": length.toFixed(0) } as React.CSSProperties}
        />
        <circle cx={last.x} cy={last.y} r={3.5} fill={color} stroke="#14171b" strokeWidth={1.5} />

        {chart.data.map((d, i) => {
          if (i % 2 !== 0 && i !== chart.data.length - 1) return null;
          return (
            <text
              key={d.label}
              x={pts[i].x}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fill="#64748b"
            >
              {d.label}
            </text>
          );
        })}

        {chart.annotations?.map((note, n) => {
          const p = pts[note.at];
          if (!p) return null;
          return (
            <circle
              key={n}
              cx={p.x}
              cy={p.y}
              r={5.5}
              fill="none"
              stroke={openNote === n ? "#2f66ff" : "#2f66ff88"}
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      <div className="mt-1 flex items-baseline justify-between text-[10px] text-ink-muted">
        <span>
          Mín {formatAxis(min, chart.unit)} · Máx {formatAxis(max, chart.unit)}
        </span>
        <span className="flex items-center gap-1.5">
          {chart.annotations?.map((_, n) => (
            <Beacon key={n} index={n} open={openNote === n} onClick={() => toggleNote(n)} />
          ))}
        </span>
      </div>

      {openNote !== null && chart.annotations?.[openNote] && (
        <p className="nx-enter mt-2 border-l-2 border-electric bg-electric/5 py-1.5 pl-2 pr-2 text-[11px] leading-relaxed text-ink-secondary">
          {chart.annotations[openNote].text}
        </p>
      )}
    </div>
  );
}

/* ---------- donut de composición ---------- */

function DonutChart({
  chart,
  openNote,
  toggleNote,
}: {
  chart: NexumChart;
  openNote: number | null;
  toggleNote: (index: number) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (reduced) return;
    // un frame de espera: el arco arranca en cero y la transición se ve
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const placed = reduced || drawn;
  const total = chart.data.reduce((sum, d) => sum + d.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;

  // los desplazamientos se calculan antes del JSX: acumular dentro del map
  // deja una variable mutada entre renders
  const segments: { dash: number; offset: number }[] = [];
  chart.data.reduce((acc, point) => {
    const dash = C * (point.value / total);
    segments.push({ dash, offset: acc });
    return acc + dash;
  }, 0);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={chart.title}>
        <circle cx={70} cy={70} r={R} fill="none" stroke="#1a1e21" strokeWidth={18} />
        {chart.data.map((point, i) => {
          const { dash, offset } = segments[i];
          return (
            <circle
              key={point.label}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              stroke={CATEGORICAL[i % CATEGORICAL.length]}
              strokeWidth={hover === i ? 22 : 18}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={placed ? -offset : 0}
              className="nx-arc"
              opacity={hover === null || hover === i ? 1 : 0.45}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.2,0.8,0.25,1), stroke-width 150ms, opacity 150ms" }}
            />
          );
        })}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1">
        {chart.data.map((point, i) => {
          const note = chart.annotations?.findIndex((a) => a.at === i) ?? -1;
          return (
            <li key={point.label}>
              <div
                className="flex items-center gap-2 text-[11px]"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0"
                  style={{ background: CATEGORICAL[i % CATEGORICAL.length] }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-ink-secondary">{point.label}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatAxis(point.value, chart.unit)}
                </span>
                {note >= 0 && (
                  <Beacon index={note} open={openNote === note} onClick={() => toggleNote(note)} />
                )}
              </div>
              {note >= 0 && openNote === note && (
                <p className="nx-enter mt-1 border-l-2 border-electric bg-electric/5 py-1 pl-2 text-[11px] leading-relaxed text-ink-secondary">
                  {chart.annotations![note].text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- medidor 0-100 ---------- */

function GaugeChart({ chart }: { chart: NexumChart }) {
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const value = chart.data[0]?.value ?? 0;

  useEffect(() => {
    if (reduced) return;
    // la aguja parte del cero y viaja hasta el valor: el recorrido es el dato
    const id = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(id);
  }, [reduced]);

  const angle = -90 + (Math.min(100, Math.max(0, value)) / 100) * 180;
  const ZONES = [
    { from: 0, to: 25, color: STATUS.down, label: "Miedo extremo" },
    { from: 25, to: 45, color: "#d95926", label: "Miedo" },
    { from: 45, to: 55, color: NEUTRAL, label: "Neutral" },
    { from: 55, to: 75, color: "#199e70", label: "Codicia" },
    { from: 75, to: 100, color: STATUS.up, label: "Codicia extrema" },
  ];
  const zone = ZONES.find((z) => value >= z.from && value <= z.to) ?? ZONES[2];

  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    const r = 62;
    const x0 = 80 + r * Math.cos(a0);
    const y0 = 80 - r * Math.sin(a0);
    const x1 = 80 + r * Math.cos(a1);
    const y1 = 80 - r * Math.sin(a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 100" className="h-28 w-44 shrink-0" role="img" aria-label={`${chart.title}: ${value}`}>
        {ZONES.map((z) => (
          <path key={z.label} d={arc(z.from, z.to)} stroke={z.color} strokeWidth={12} fill="none" opacity={0.85} />
        ))}
        <g
          className="nx-needle"
          style={{ transform: `rotate(${ready || reduced ? angle : -90}deg)`, transformOrigin: "80px 80px" }}
        >
          <line x1={80} y1={80} x2={80} y2={26} stroke="#e8edf2" strokeWidth={2.5} strokeLinecap="round" />
        </g>
        <circle cx={80} cy={80} r={5} fill="#e8edf2" />
        <text x={14} y={96} fontSize={8} fill="#64748b">0</text>
        <text x={140} y={96} fontSize={8} fill="#64748b">100</text>
      </svg>

      <div className="min-w-0">
        <p className="text-3xl font-semibold tabular-nums" style={{ color: zone.color }}>
          {value}
        </p>
        <p className="text-xs font-medium text-ink">{zone.label}</p>
        {chart.annotations?.[0] && (
          <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-ink-secondary">
            {chart.annotations[0].text}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- barras divergentes (rendimientos) ---------- */

function DeltaChart({
  chart,
  openNote,
  toggleNote,
}: {
  chart: NexumChart;
  openNote: number | null;
  toggleNote: (index: number) => void;
}) {
  const bound = Math.max(...chart.data.map((d) => Math.abs(d.value))) || 1;

  return (
    <div className="space-y-1.5">
      {chart.data.map((point, i) => {
        const note = chart.annotations?.findIndex((a) => a.at === i) ?? -1;
        const positive = point.value >= 0;
        const width = (Math.abs(point.value) / bound) * 50;
        return (
          <div key={point.label}>
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] text-ink-secondary">{point.label}</span>
              <div className="relative h-4 min-w-0 flex-1">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden />
                <div
                  className="bf-grow-x absolute inset-y-0"
                  style={
                    {
                      width: `${width}%`,
                      left: positive ? "50%" : `${50 - width}%`,
                      transformOrigin: positive ? "left center" : "right center",
                      background: positive ? STATUS.up : STATUS.down,
                      "--bf-i": i,
                    } as React.CSSProperties
                  }
                />
              </div>
              <span
                className="w-14 shrink-0 text-right text-[11px] font-medium tabular-nums"
                style={{ color: positive ? STATUS.up : STATUS.down }}
              >
                {positive ? "+" : "−"}
                {Math.abs(point.value).toFixed(1)}%
              </span>
              <span className="w-4 shrink-0">
                {note >= 0 && (
                  <Beacon index={note} open={openNote === note} onClick={() => toggleNote(note)} />
                )}
              </span>
            </div>
            {note >= 0 && openNote === note && (
              <p className="nx-enter mt-1 border-l-2 border-electric bg-electric/5 py-1 pl-2 text-[11px] leading-relaxed text-ink-secondary">
                {chart.annotations![note].text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- marco común ---------- */

export function NexumChartCard({ chart, index }: { chart: NexumChart; index: number }) {
  const [openNote, setOpenNote] = useState<number | null>(null);
  const toggleNote = (n: number) => setOpenNote((prev) => (prev === n ? null : n));

  const body =
    chart.kind === "area" ? (
      <AreaChart chart={chart} openNote={openNote} toggleNote={toggleNote} />
    ) : chart.kind === "donut" ? (
      <DonutChart chart={chart} openNote={openNote} toggleNote={toggleNote} />
    ) : chart.kind === "gauge" ? (
      <GaugeChart chart={chart} />
    ) : chart.kind === "delta" ? (
      <DeltaChart chart={chart} openNote={openNote} toggleNote={toggleNote} />
    ) : (
      <BarsChart chart={chart} openNote={openNote} toggleNote={toggleNote} />
    );

  return (
    <section
      className={`nx-enter rounded-lg border p-3.5 ${
        chart.proprietary ? "bf-premium border-charcoal-line" : "border-line bg-card"
      }`}
      style={{ "--nx-i": index } as React.CSSProperties}
    >
      <div className="mb-2.5">
        <h4 className="flex items-baseline gap-2 text-[13px] font-semibold">
          <span className={chart.proprietary ? "bf-slash bf-slash-gold" : "bf-slash"} aria-hidden />
          {chart.title}
          {chart.proprietary && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gold">
              Propietario
            </span>
          )}
        </h4>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-secondary">{chart.caption}</p>
      </div>
      {body}
      {chart.annotations && chart.annotations.length > 0 && chart.kind !== "gauge" && (
        <p className="mt-2.5 text-[10px] text-ink-muted">
          Los puntos numerados abren la nota de lectura del analista.
        </p>
      )}
    </section>
  );
}
