"use client";

import { useId } from "react";
import { CATEGORICAL, GOLD, NEUTRAL, STATUS } from "@/lib/palette";

// Gráficos del Blockchain Landscape Report.
//
// Por qué SVG a mano y no recharts: el informe termina en el diálogo de
// impresión. ResponsiveContainer mide el contenedor en el cliente y en el
// layout de impresión llega a medir cero; el resultado es un PDF con huecos
// donde iban los gráficos. Un <svg viewBox> con ancho 100% se imprime al
// tamaño real de la caja, sin depender de JavaScript ni de una medición.
//
// Reglas de la guía de dataviz que se aplican en todo el archivo:
//  · un solo eje por gráfico — nunca dos escalas superpuestas;
//  · los colores categóricos se asignan en orden fijo, jamás ciclados;
//  · marcas finas, grilla en hairline sólido y sin cajas de fondo;
//  · el valor SIEMPRE es legible sin tooltip (etiqueta directa o número
//    impreso dentro de la marca), porque en papel no hay hover;
//  · el color nunca va solo: signo, número o leyenda lo acompañan.
//
// La cromática neutra (grilla, ejes, texto) sale de variables CSS, no de
// literales: los gráficos mantienen el contraste del documento blanco.

const SURFACE = "var(--rp-surface)";

/** Anchos de viewBox estandarizados: el texto SVG escala con el ancho, así que
 *  un gráfico a media caja necesita un viewBox a media medida para que su
 *  tipografía salga del mismo cuerpo que la del gráfico de al lado. */
export const W_FULL = 640;
export const W_HALF = 310;
export const W_THIRD = 205;

// ── utilidades ──────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Segmento de anillo. Ángulos en grados, horarios desde las 12. */
function annulus(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number
): string {
  const large = end - start > 180 ? 1 : 0;
  const a = polar(cx, cy, rOuter, start);
  const b = polar(cx, cy, rOuter, end);
  const c = polar(cx, cy, rInner, end);
  const d = polar(cx, cy, rInner, start);
  return [
    `M${a.x.toFixed(2)},${a.y.toFixed(2)}`,
    `A${rOuter},${rOuter} 0 ${large} 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`,
    `L${c.x.toFixed(2)},${c.y.toFixed(2)}`,
    `A${rInner},${rInner} 0 ${large} 0 ${d.x.toFixed(2)},${d.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Rectángulo con el extremo de dato redondeado y la base cuadrada. */
function capsule(
  x: number,
  y: number,
  w: number,
  h: number,
  side: "top" | "right"
): string {
  const r = Math.max(0, Math.min(4, side === "top" ? Math.min(w / 2, h) : Math.min(h / 2, w)));
  if (r === 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return side === "top"
    ? `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
    : `M${x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x},${y + h} Z`;
}

/** Ancho aproximado de un texto en unidades de viewBox, para decidir si una
 *  etiqueta entra dentro de la marca o tiene que salir afuera. Se mide por
 *  exceso a propósito: un rótulo recortado es peor que uno omitido. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.58;
}

/** Recorta un rótulo al ancho disponible. Un nombre cortado con puntos
 *  suspensivos se entiende; uno que invade la barra de al lado, no. */
function ellipsize(text: string, maxWidth: number, size: number): string {
  if (textWidth(text, size) <= maxWidth) return text;
  const keep = Math.max(1, Math.floor(maxWidth / (size * 0.58)) - 1);
  return `${text.slice(0, keep).trimEnd()}…`;
}

function niceTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

/**
 * Tinta legible sobre un relleno de color. La guía pide elegir blanco o tinta
 * por la luminancia del fondo en vez de fijar uno: la paleta categórica tiene
 * tonos medios donde el blanco baja de 3:1 y otros donde la tinta oscura no
 * llega. Se decide por relleno, no a ojo.
 */
export function inkOn(hex: string): string {
  const m = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const onWhite = 1.05 / (L + 0.05);
  const onBlack = (L + 0.05) / 0.05;
  return onWhite >= onBlack ? "#ffffff" : "#101315";
}

/**
 * Reparte un total en tramos contiguos con un hueco de superficie entre ellos
 * y devuelve la posición ya resuelta de cada uno.
 */
function stackRuns<T extends { value: number }>(
  items: T[],
  span: number,
  gap: number
): (T & { x: number; w: number })[] {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const out: (T & { x: number; w: number })[] = [];
  let offset = 0;
  for (let i = 0; i < items.length; i++) {
    const size = total > 0 ? (span * items[i].value) / total : 0;
    out.push({ ...items[i], x: offset, w: size - (i < items.length - 1 ? gap : 0) });
    offset += size;
  }
  return out;
}

/** Ángulo inicial y barrido de cada porción de un anillo. */
function stackArcs<T extends { value: number }>(items: T[]): (T & { start: number; sweep: number })[] {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const out: (T & { start: number; sweep: number })[] = [];
  let angle = 0;
  for (const item of items) {
    const sweep = total > 0 ? (item.value / total) * 360 : 0;
    out.push({ ...item, start: angle, sweep });
    angle += sweep;
  }
  return out;
}

/** Rampa secuencial por opacidad sobre un solo tono. Se usa opacidad y no una
 *  escala de hexadecimales: sobre el papel blanco, un tono más intenso
 *  representa una magnitud mayor. */
export function heat(t: number, hue = "57,135,229"): string {
  const clamped = Math.max(0, Math.min(1, t));
  return `rgba(${hue},${(0.08 + 0.72 * clamped).toFixed(3)})`;
}

export function toneColor(value: number | null): string {
  if (value === null) return NEUTRAL;
  return value > 0 ? STATUS.up : value < 0 ? STATUS.down : NEUTRAL;
}

// ── marco y leyenda ─────────────────────────────────────────────────

export function Chart({
  title,
  note,
  children,
  legend,
  wide,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  legend?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <figure className={`bf-rp-chart ${wide ? "bf-rp-chart--wide" : ""}`}>
      <figcaption>
        <span className="bf-rp-chart-t">{title}</span>
        {note && <span className="bf-rp-chart-n">{note}</span>}
      </figcaption>
      {children}
      {legend}
    </figure>
  );
}

export type LegendItem = {
  label: string;
  color: string;
  value?: string;
  shape?: "box" | "line" | "dot";
};

export function Legend({ items, columns }: { items: LegendItem[]; columns?: boolean }) {
  return (
    <ul className={`bf-rp-legend ${columns ? "bf-rp-legend--col" : ""}`}>
      {items.map((item) => (
        <li key={item.label}>
          <i className={`bf-rp-key bf-rp-key--${item.shape ?? "box"}`} style={{ background: item.color }} />
          <span className="bf-rp-legend-l">{item.label}</span>
          {item.value && <b>{item.value}</b>}
        </li>
      ))}
    </ul>
  );
}

// ── 1 · área de una serie temporal ──────────────────────────────────

export function AreaSeries({
  points,
  format,
  color = CATEGORICAL[0],
  width = W_FULL,
  height = 170,
  endLabel,
}: {
  points: { label: string; value: number }[];
  format: (v: number) => string;
  color?: string;
  width?: number;
  height?: number;
  endLabel?: string;
}) {
  const gid = useId();
  if (points.length < 2) return null;

  const padL = 52;
  const padR = 58;
  const padT = 16;
  const padB = 20;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // el piso no es cero: en una serie de 30 días de TVL, arrancar en cero
  // aplasta el movimiento real contra el techo y el gráfico no dice nada
  const span = rawMax - rawMin || rawMax || 1;
  const min = rawMin - span * 0.18;
  const max = rawMax + span * 0.12;

  const x = (i: number) => padL + (plotW * i) / (points.length - 1);
  const y = (v: number) => padT + plotH * (1 - (v - min) / (max - min));

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const maxIdx = values.indexOf(rawMax);
  const ticks = niceTicks(min, max, 3);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} className="bf-rp-grid" />
          <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" className="bf-rp-ax">
            {format(t)}
          </text>
        </g>
      ))}

      <polygon
        points={`${padL},${padT + plotH} ${line} ${padL + plotW},${padT + plotH}`}
        fill={`url(#${gid})`}
      />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* El máximo se rotula solo cuando tiene aire: pegado al eje pisa las
          marcas de la escala, y pegado al final pisa la etiqueta del cierre. */}
      {maxIdx > 2 && maxIdx < points.length - 4 && (
        <>
          <circle cx={x(maxIdx)} cy={y(rawMax)} r={3} fill={color} stroke={SURFACE} strokeWidth={2} />
          <text x={x(maxIdx)} y={y(rawMax) - 8} textAnchor="middle" className="bf-rp-val">
            {format(rawMax)}
          </text>
        </>
      )}

      <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill={color} stroke={SURFACE} strokeWidth={2} />
      <text x={padL + plotW + 9} y={y(last.value) - 1} className="bf-rp-val">
        {format(last.value)}
      </text>
      {endLabel && (
        <text x={padL + plotW + 9} y={y(last.value) + 10} className="bf-rp-ax">
          {endLabel}
        </text>
      )}

      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} className="bf-rp-axis" />
      <text x={padL} y={height - 6} className="bf-rp-ax">
        {points[0].label}
      </text>
      <text x={padL + plotW} y={height - 6} textAnchor="end" className="bf-rp-ax">
        {last.label}
      </text>
    </svg>
  );
}

// ── 2 · dos series en la MISMA unidad y el mismo eje ────────────────

export function DualSeries({
  points,
  series,
  format,
  width = W_FULL,
  height = 180,
}: {
  points: string[];
  series: { name: string; values: (number | null)[]; color: string }[];
  format: (v: number) => string;
  width?: number;
  height?: number;
}) {
  const padL = 52;
  const padR = 66;
  const padT = 14;
  const padB = 20;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length === 0 || points.length < 2) return null;
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const span = rawMax - rawMin || rawMax || 1;
  const min = rawMin - span * 0.12;
  const max = rawMax + span * 0.12;

  const x = (i: number) => padL + (plotW * i) / (points.length - 1);
  const y = (v: number) => padT + plotH * (1 - (v - min) / (max - min));
  const ticks = niceTicks(min, max, 3);

  // Etiquetas al final de cada línea. Si convergen, se separan con un
  // conector: moverlas sin conector las despega de su serie y se leen mal.
  const ends = series
    .map((s) => {
      const idx = s.values.findLastIndex((v) => v !== null);
      return idx < 0 ? null : { name: s.name, color: s.color, value: s.values[idx] as number, idx };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.value - b.value);

  const placed: { y: number; base: number; color: string; text: string }[] = [];
  for (const end of ends) {
    const base = y(end.value);
    const wanted = Math.min(base, padT + plotH - 4);
    const prev = placed[placed.length - 1];
    const finalY = prev && Math.abs(prev.y - wanted) < 12 ? prev.y - 12 : wanted;
    placed.push({ y: finalY, base, color: end.color, text: format(end.value) });
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} className="bf-rp-grid" />
          <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" className="bf-rp-ax">
            {format(t)}
          </text>
        </g>
      ))}

      {series.map((s) => {
        const d = s.values
          .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
          .filter((p): p is string => p !== null)
          .join(" ");
        return (
          <polyline
            key={s.name}
            points={d}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}

      {placed.map((p) => (
        <g key={p.text + p.y}>
          <line
            x1={padL + plotW}
            y1={p.base}
            x2={padL + plotW + 7}
            y2={p.y}
            className="bf-rp-grid"
          />
          <circle cx={padL + plotW} cy={p.base} r={3.5} fill={p.color} stroke={SURFACE} strokeWidth={2} />
          <text x={padL + plotW + 10} y={p.y + 3.5} className="bf-rp-val">
            {p.text}
          </text>
        </g>
      ))}

      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} className="bf-rp-axis" />
      <text x={padL} y={height - 6} className="bf-rp-ax">
        {points[0]}
      </text>
      <text x={padL + plotW} y={height - 6} textAnchor="end" className="bf-rp-ax">
        {points[points.length - 1]}
      </text>
    </svg>
  );
}

// ── 3 · columnas ────────────────────────────────────────────────────

export function Columns({
  points,
  format,
  width = W_FULL,
  height = 150,
  color = CATEGORICAL[0],
  labelEvery = 1,
  highlightMax = true,
}: {
  points: { label: string; value: number; tick?: string }[];
  format: (v: number) => string;
  width?: number;
  height?: number;
  color?: string;
  labelEvery?: number;
  highlightMax?: boolean;
}) {
  if (points.length === 0) return null;
  const padL = 46;
  const padR = 12;
  const padT = 20;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const max = Math.max(...points.map((p) => p.value), 1);
  const band = plotW / points.length;
  const barW = Math.min(24, band * 0.62);
  const ticks = niceTicks(0, max, 2);
  const maxIdx = points.findIndex((p) => p.value === max);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={padL + plotW}
            y1={padT + plotH * (1 - t / max)}
            y2={padT + plotH * (1 - t / max)}
            className="bf-rp-grid"
          />
          <text x={padL - 7} y={padT + plotH * (1 - t / max) + 3.5} textAnchor="end" className="bf-rp-ax">
            {format(t)}
          </text>
        </g>
      ))}

      {points.map((p, i) => {
        const h = p.value <= 0 ? 0 : Math.max(1.5, plotH * (p.value / max));
        const x = padL + band * i + (band - barW) / 2;
        return (
          <g key={`${p.label}-${i}`}>
            {p.value > 0 && (
              <path d={capsule(x, padT + plotH - h, barW, h, "top")} fill={color} opacity={0.92}>
                <title>{`${p.label}: ${format(p.value)}`}</title>
              </path>
            )}
            {highlightMax && i === maxIdx && p.value > 0 && (
              <text x={x + barW / 2} y={padT + plotH - h - 6} textAnchor="middle" className="bf-rp-val">
                {format(p.value)}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={height - 7} textAnchor="middle" className="bf-rp-ax">
                {p.tick ?? p.label}
              </text>
            )}
          </g>
        );
      })}

      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} className="bf-rp-axis" />
    </svg>
  );
}

// ── 4 · barras horizontales ordenadas ───────────────────────────────

export function BarRows({
  items,
  format,
  width = W_FULL,
  gutter = 128,
  rowH = 22,
  color = CATEGORICAL[0],
  valueWidth = 74,
  subWidth = 0,
  log = false,
}: {
  items: { label: string; value: number; sub?: string; color?: string }[];
  format: (v: number) => string;
  width?: number;
  gutter?: number;
  rowH?: number;
  color?: string;
  valueWidth?: number;
  /** ancho reservado a la derecha para el dato de apoyo. Sin esta reserva la
   *  barra más larga empuja su valor encima del texto del extremo. */
  subWidth?: number;
  /** escala logarítmica, para magnitudes que difieren en órdenes (costos de
   *  $0,0002 junto a $0,50): en lineal las barras chicas desaparecen */
  log?: boolean;
}) {
  if (items.length === 0) return null;
  // el máximo sale de los datos: con un piso de 1, valores bajo un dólar
  // quedaban como barras de un píxel
  const max = Math.max(...items.map((i) => i.value)) || 1;
  const positive = items.map((i) => i.value).filter((v) => v > 0);
  const lo = Math.log10(Math.min(...positive, max));
  const decades = Math.max(1, Math.log10(max) - lo + 1);
  const share = (v: number) => (log ? (v > 0 ? (Math.log10(v) - lo + 1) / decades : 0) : v / max);
  const plotW = Math.max(20, width - gutter - valueWidth - subWidth);
  const height = items.length * rowH + 6;
  const barH = Math.min(14, rowH - 8);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {items.map((item, i) => {
        const y = i * rowH + 4;
        const w = Math.max(1.5, plotW * share(item.value));
        return (
          // un mismo pool puede aparecer dos veces (tasa fija y liquidez): la
          // posición desempata la clave
          <g key={`${i}-${item.label}`}>
            <text x={0} y={y + barH / 2 + 4} className="bf-rp-lab">
              {ellipsize(item.label, gutter - 8, 10)}
              <title>{item.label}</title>
            </text>
            <path d={capsule(gutter, y, w, barH, "right")} fill={item.color ?? color} opacity={0.92}>
              <title>{`${item.label}: ${format(item.value)}`}</title>
            </path>
            <text x={gutter + w + 7} y={y + barH / 2 + 4} className="bf-rp-val">
              {format(item.value)}
            </text>
            {item.sub && (
              <text x={width} y={y + barH / 2 + 4} textAnchor="end" className="bf-rp-ax">
                {item.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── 5 · barras divergentes (variaciones con signo) ──────────────────

export function DivergingBars({
  items,
  format,
  width = W_FULL,
  gutter = 128,
  rowH = 22,
}: {
  items: { label: string; value: number | null }[];
  format: (v: number) => string;
  width?: number;
  gutter?: number;
  rowH?: number;
}) {
  const priced = items.filter((i) => i.value !== null) as { label: string; value: number }[];
  if (priced.length === 0) return null;
  const bound = Math.max(...priced.map((i) => Math.abs(i.value)), 1);
  const plotW = width - gutter - 20;
  const zero = gutter + plotW / 2;
  const half = plotW / 2 - 44;
  const height = items.length * rowH + 6;
  const barH = Math.min(12, rowH - 9);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      <line x1={zero} x2={zero} y1={2} y2={height - 4} className="bf-rp-axis" />
      {items.map((item, i) => {
        const y = i * rowH + 4;
        if (item.value === null) {
          return (
            <g key={item.label}>
              <text x={0} y={y + barH / 2 + 4} className="bf-rp-lab">
                {ellipsize(item.label, gutter - 8, 10)}
              </text>
              <text x={zero + 8} y={y + barH / 2 + 4} className="bf-rp-ax">
                sin dato
              </text>
            </g>
          );
        }
        const w = Math.max(1.5, half * (Math.abs(item.value) / bound));
        const positive = item.value >= 0;
        const fill = positive ? STATUS.up : STATUS.down;
        return (
          <g key={item.label}>
            <text x={0} y={y + barH / 2 + 4} className="bf-rp-lab">
              {ellipsize(item.label, gutter - 8, 10)}
              <title>{item.label}</title>
            </text>
            <path
              d={
                positive
                  ? capsule(zero, y, w, barH, "right")
                  : `M${zero - w + 4},${y} L${zero},${y} L${zero},${y + barH} L${zero - w + 4},${y + barH} Q${zero - w},${y + barH} ${zero - w},${y + barH - 4} L${zero - w},${y + 4} Q${zero - w},${y} ${zero - w + 4},${y} Z`
              }
              fill={fill}
              opacity={0.92}
            >
              <title>{`${item.label}: ${format(item.value)}`}</title>
            </path>
            <text
              x={positive ? zero + w + 7 : zero - w - 7}
              y={y + barH / 2 + 4}
              textAnchor={positive ? "start" : "end"}
              className="bf-rp-val"
            >
              {format(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 6 · barra 100 % apilada ─────────────────────────────────────────

export function StackedShare({
  items,
  width = W_FULL,
  height = 30,
}: {
  items: { label: string; value: number; color: string }[];
  width?: number;
  height?: number;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return null;
  const laid = stackRuns(items, width, 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {laid.map((item) => {
        const { x, w } = item;
        const pct = `${((item.value / total) * 100).toFixed(0)}%`;
        const fits = textWidth(pct, 10) + 10 < w;
        return (
          <g key={item.label}>
            <rect x={x} y={0} width={Math.max(0, w)} height={height} fill={item.color} rx={2}>
              <title>{`${item.label}: ${pct}`}</title>
            </rect>
            {fits && (
              <text
                x={x + w / 2}
                y={height / 2 + 4}
                textAnchor="middle"
                className="bf-rp-inbar"
                fill={inkOn(item.color)}
              >
                {pct}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── 7 · anillo parte-todo ───────────────────────────────────────────

export function Donut({
  items,
  centerValue,
  centerLabel,
  size = 168,
}: {
  items: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const rO = size / 2 - 4;
  const rI = rO * 0.63;
  const arcs = stackArcs(items);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="bf-rp-svg" role="img">
      {arcs.map((item) => {
        if (item.sweep < 0.6) return null;
        return (
          <path
            key={item.label}
            d={annulus(cx, cy, rO, rI, item.start, item.start + item.sweep)}
            fill={item.color}
            stroke={SURFACE}
            strokeWidth={2}
          >
            <title>{`${item.label}: ${((item.value / total) * 100).toFixed(1)}%`}</title>
          </path>
        );
      })}
      <text x={cx} y={cy - 1} textAnchor="middle" className="bf-rp-center">
        {centerValue}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" className="bf-rp-ax">
        {centerLabel}
      </text>
    </svg>
  );
}

// ── 8 · radar de perfil (categorías 0-10) ───────────────────────────

export function Radar({
  axes,
  values,
  color,
  size = 168,
  max = 10,
}: {
  axes: string[];
  values: number[];
  color: string;
  size?: number;
  max?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;
  const step = 360 / axes.length;
  const point = (i: number, v: number) => polar(cx, cy, (r * v) / max, i * step);
  const shape = values.map((v, i) => point(i, v)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="bf-rp-svg" role="img">
      {[0.33, 0.66, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, i) => polar(cx, cy, r * ring, i * step))
            .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(" ")}
          fill="none"
          className="bf-rp-grid"
        />
      ))}
      {axes.map((_, i) => {
        const p = polar(cx, cy, r, i * step);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} className="bf-rp-grid" />;
      })}

      <polygon points={shape} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {values.map((v, i) => {
        const p = point(i, v);
        return <circle key={i} cx={p.x} cy={p.y} r={2.6} fill={color} stroke={SURFACE} strokeWidth={1.5} />;
      })}

      {axes.map((axis, i) => {
        const p = polar(cx, cy, r + 12, i * step);
        const anchor = Math.abs(p.x - cx) < 6 ? "middle" : p.x > cx ? "start" : "end";
        return (
          <text key={axis} x={p.x} y={p.y + 3} textAnchor={anchor} className="bf-rp-ax">
            {axis}
          </text>
        );
      })}
    </svg>
  );
}

// ── 9 · dispersión con cuadrantes ───────────────────────────────────

export function Quadrant({
  points,
  xLabel,
  yLabel,
  quadrants,
  width = W_FULL,
  height = 300,
  max = 10,
}: {
  points: { x: number; y: number; label: string; size?: number; muted?: boolean }[];
  xLabel: string;
  yLabel: string;
  quadrants: [string, string, string, string]; // NO, NE, SO, SE
  width?: number;
  height?: number;
  max?: number;
}) {
  const padL = 34;
  const padR = 16;
  const padT = 14;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const mid = max / 2;
  const px = (v: number) => padL + (plotW * v) / max;
  const py = (v: number) => padT + plotH * (1 - v / max);
  const maxSize = Math.max(...points.map((p) => p.size ?? 1), 1);
  const radius = (p: (typeof points)[number]) =>
    4 + 7 * Math.sqrt((p.size ?? 0) / maxSize);

  // rótulos de cuadrante: centrados arriba y abajo de cada mitad. Entran como
  // obstáculos para que el nombre de una red no se imprima encima de ellos.
  const quadLabels = [
    { text: quadrants[0], x: padL + plotW / 4, y: padT + 12 },
    { text: quadrants[1], x: padL + (plotW * 3) / 4, y: padT + 12 },
    { text: quadrants[2], x: padL + plotW / 4, y: padT + plotH - 6 },
    { text: quadrants[3], x: padL + (plotW * 3) / 4, y: padT + plotH - 6 },
  ];
  const quadBoxes = quadLabels.map((q) => {
    // mayúsculas de 8px con 0,12em de interletrado
    const w = q.text.length * 8 * 0.7 + 4;
    return { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - 9, y1: q.y + 3 };
  });
  const marks = placeLabels(
    points.map((p) => ({ ...p, cx: px(p.x), cy: py(p.y), r: radius(p) })),
    quadBoxes
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      <rect x={padL} y={padT} width={plotW / 2} height={plotH / 2} className="bf-rp-quad" />
      <rect x={padL + plotW / 2} y={padT + plotH / 2} width={plotW / 2} height={plotH / 2} className="bf-rp-quad" />

      {[0, mid, max].map((t) => (
        <g key={`x${t}`}>
          <line x1={px(t)} x2={px(t)} y1={padT} y2={padT + plotH} className={t === mid ? "bf-rp-axis" : "bf-rp-grid"} />
          <text x={px(t)} y={padT + plotH + 12} textAnchor="middle" className="bf-rp-ax">
            {t}
          </text>
        </g>
      ))}
      {[0, mid, max].map((t) => (
        <g key={`y${t}`}>
          <line x1={padL} x2={padL + plotW} y1={py(t)} y2={py(t)} className={t === mid ? "bf-rp-axis" : "bf-rp-grid"} />
          <text x={padL - 7} y={py(t) + 3.5} textAnchor="end" className="bf-rp-ax">
            {t}
          </text>
        </g>
      ))}

      {quadLabels.map((q) => (
        <text key={q.text} x={q.x} y={q.y} textAnchor="middle" className="bf-rp-quad-l">
          {q.text}
        </text>
      ))}

      {marks.map((p) => (
        <g key={p.label}>
          <circle
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={p.muted ? NEUTRAL : CATEGORICAL[0]}
            fillOpacity={p.muted ? 0.42 : 0.72}
            stroke={SURFACE}
            strokeWidth={2}
          >
            <title>{`${p.label} — ${xLabel} ${p.x}, ${yLabel} ${p.y}`}</title>
          </circle>
          {p.labelY !== null && (
            <text x={p.labelX} y={p.labelY} textAnchor={p.anchor} className="bf-rp-lab">
              {p.label}
            </text>
          )}
        </g>
      ))}

      <text x={padL + plotW} y={height - 6} textAnchor="end" className="bf-rp-ax">
        {xLabel} →
      </text>
      <text
        x={11}
        y={padT + plotH / 2}
        textAnchor="middle"
        className="bf-rp-ax"
        transform={`rotate(-90 11 ${padT + plotH / 2})`}
      >
        {yLabel} →
      </text>
    </svg>
  );
}

type Box = { x0: number; x1: number; y0: number; y1: number };

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/**
 * Coloca el rótulo de cada burbuja en la primera de cuatro posiciones libres
 * —arriba, abajo, derecha, izquierda—. En papel no hay tooltip que rescate un
 * nombre tapado, así que la de-colisión se resuelve de verdad y no alcanza con
 * empujar el texto hacia abajo. Si las cuatro están ocupadas el rótulo se
 * omite: dos nombres superpuestos no se leen ninguno de los dos, y el punto
 * sigue estando en el gráfico con su tooltip en pantalla.
 */
function placeLabels<T extends { cx: number; cy: number; r: number; label: string }>(
  marks: T[],
  obstacles: Box[] = []
): (T & { labelX: number; labelY: number; anchor: "start" | "middle" | "end" } | (T & { labelY: null }))[] {
  const taken: Box[] = [...obstacles];
  const out: (T & { labelX: number; labelY: number; anchor: "start" | "middle" | "end" } | (T & { labelY: null }))[] = [];
  // Se atienden primero las burbujas grandes: son las que el lector busca.
  const order = [...marks].sort((a, b) => b.r - a.r);
  const seats: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [];

  for (const mark of order) {
    const w = textWidth(mark.label, 10);
    const options: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
      { x: mark.cx, y: mark.cy - mark.r - 5, anchor: "middle" },
      { x: mark.cx, y: mark.cy + mark.r + 11, anchor: "middle" },
      { x: mark.cx + mark.r + 5, y: mark.cy + 3.5, anchor: "start" },
      { x: mark.cx - mark.r - 5, y: mark.cy + 3.5, anchor: "end" },
    ];
    const free = options.find((option) => {
      const x0 =
        option.anchor === "middle" ? option.x - w / 2 : option.anchor === "start" ? option.x : option.x - w;
      const box = { x0, x1: x0 + w, y0: option.y - 9, y1: option.y + 2 };
      return !taken.some((t) => overlaps(box, t));
    });
    if (!free) {
      out.push({ ...mark, labelY: null });
      seats.push({ x: 0, y: 0, anchor: "middle" });
      continue;
    }
    const x0 = free.anchor === "middle" ? free.x - w / 2 : free.anchor === "start" ? free.x : free.x - w;
    taken.push({ x0, x1: x0 + w, y0: free.y - 9, y1: free.y + 2 });
    out.push({ ...mark, labelX: free.x, labelY: free.y, anchor: free.anchor });
  }
  return out;
}

// ── 10 · aguja de sentimiento ───────────────────────────────────────

export function Gauge({
  value,
  label,
  zones,
  size = 190,
}: {
  value: number;
  label: string;
  zones: { to: number; color: string; name: string }[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size * 0.62;
  const rO = size / 2 - 8;
  const rI = rO * 0.7;
  const angle = (v: number) => -90 + (v / 100) * 180;
  const needle = polar(cx, cy, rO - 8, angle(Math.max(0, Math.min(100, value))));
  const bands = zones.map((zone, i) => ({ ...zone, from: i === 0 ? 0 : zones[i - 1].to }));

  return (
    <svg viewBox={`0 0 ${size} ${size * 0.78}`} className="bf-rp-svg" role="img">
      {bands.map((zone) => {
        const path = annulus(cx, cy, rO, rI, angle(zone.from), angle(zone.to));
        return (
          <path key={zone.name} d={path} fill={zone.color} fillOpacity={0.85} stroke={SURFACE} strokeWidth={2}>
            <title>{zone.name}</title>
          </path>
        );
      })}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} className="bf-rp-needle" />
      <circle cx={cx} cy={cy} r={4.5} className="bf-rp-needle-hub" />
      <text x={cx} y={cy + 26} textAnchor="middle" className="bf-rp-center">
        {value}
      </text>
      <text x={cx} y={cy + 39} textAnchor="middle" className="bf-rp-ax">
        {label}
      </text>
      <text x={cx - rO + 2} y={cy + 12} textAnchor="middle" className="bf-rp-ax">
        0
      </text>
      <text x={cx + rO - 2} y={cy + 12} textAnchor="middle" className="bf-rp-ax">
        100
      </text>
    </svg>
  );
}

// ── 11 · mapa de calor de scores ────────────────────────────────────

export function ScoreMatrix({
  cols,
  rows,
  max = 10,
  digits = 1,
  badgeLabel = "BBI",
}: {
  cols: string[];
  rows: { label: string; badge?: string; flag?: boolean; cells: (number | null)[] }[];
  max?: number;
  digits?: number;
  /** encabezado de la columna del puntaje final */
  badgeLabel?: string;
}) {
  return (
    <div className="bf-rp-matrix" style={{ "--cols": cols.length } as React.CSSProperties}>
      <div className="bf-rp-matrix-h">
        <span />
        <span className="bf-rp-matrix-badge">{badgeLabel}</span>
        {cols.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div className="bf-rp-matrix-r" key={row.label}>
          <span className="bf-rp-matrix-n">
            {/* el asterisco va fuera del texto recortable: es la marca que
                remite a la nota al pie y no puede perderse en el recorte */}
            <em>{row.label}</em>
            {row.flag && <s>*</s>}
          </span>
          <b className="bf-rp-matrix-badge">{row.badge}</b>
          {row.cells.map((cell, i) => (
            <span
              key={cols[i]}
              className="bf-rp-cell"
              style={{ background: cell === null ? "transparent" : heat(cell / max) }}
              title={`${row.label} · ${cols[i]}: ${cell === null ? "no aplica" : `${cell.toFixed(digits)}/${max}`}`}
            >
              {cell === null ? "—" : cell.toFixed(digits)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 12 · treemap ────────────────────────────────────────────────────

type TreeNode = { label: string; value: number; color: string; note?: string };
type Placed = TreeNode & { x: number; y: number; w: number; h: number };

function splitTree(items: TreeNode[], x: number, y: number, w: number, h: number, out: Placed[]) {
  if (items.length === 0) return;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return;
  }
  const total = items.reduce((s, i) => s + i.value, 0);
  let acc = items[0].value;
  let cut = 1;
  while (cut < items.length - 1 && acc + items[cut].value < total / 2) {
    acc += items[cut].value;
    cut += 1;
  }
  const head = items.slice(0, cut);
  const tail = items.slice(cut);
  const ratio = acc / total;
  if (w >= h) {
    splitTree(head, x, y, w * ratio, h, out);
    splitTree(tail, x + w * ratio, y, w * (1 - ratio), h, out);
  } else {
    splitTree(head, x, y, w, h * ratio, out);
    splitTree(tail, x, y + h * ratio, w, h * (1 - ratio), out);
  }
}

export function Treemap({
  items,
  format,
  width = W_FULL,
  height = 190,
}: {
  items: TreeNode[];
  format: (v: number) => string;
  width?: number;
  height?: number;
}) {
  if (items.length === 0) return null;
  const placed: Placed[] = [];
  splitTree([...items].sort((a, b) => b.value - a.value), 0, 0, width, height, placed);
  const gap = 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {placed.map((node) => {
        const w = Math.max(0, node.w - gap);
        const h = Math.max(0, node.h - gap);
        const nameFits = textWidth(node.label, 10) + 12 < w && h > 30;
        return (
          <g key={node.label}>
            <rect x={node.x} y={node.y} width={w} height={h} fill={node.color} rx={2}>
              <title>{`${node.label}: ${format(node.value)}`}</title>
            </rect>
            {nameFits && (
              <>
                <text x={node.x + 8} y={node.y + 17} className="bf-rp-inbar" fill={inkOn(node.color)}>
                  {node.label}
                </text>
                <text
                  x={node.x + 8}
                  y={node.y + 30}
                  className="bf-rp-inbar bf-rp-inbar--2"
                  fill={inkOn(node.color)}
                >
                  {format(node.value)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── 13 · tira de cadencia (semanas) ─────────────────────────────────

export function CadenceStrip({
  weeks,
  width = W_FULL,
  height = 54,
}: {
  weeks: { start: string; count: number }[];
  width?: number;
  height?: number;
}) {
  if (weeks.length === 0) return null;
  const max = Math.max(...weeks.map((w) => w.count), 1);
  const gap = 3;
  const cellW = (width - gap * (weeks.length - 1)) / weeks.length;
  const cellH = height - 18;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {weeks.map((week, i) => {
        const x = i * (cellW + gap);
        return (
          <g key={week.start}>
            <rect
              x={x}
              y={0}
              width={cellW}
              height={cellH}
              rx={2}
              fill={week.count === 0 ? "transparent" : heat(week.count / max, "234,57,67")}
              className={week.count === 0 ? "bf-rp-cell-empty" : undefined}
            >
              <title>{`Semana del ${week.start}: ${week.count} incidente(s)`}</title>
            </rect>
            <text x={x + cellW / 2} y={cellH / 2 + 4} textAnchor="middle" className="bf-rp-cellnum">
              {week.count || ""}
            </text>
            <text x={x + cellW / 2} y={height - 4} textAnchor="middle" className="bf-rp-ax">
              {week.start.slice(5).replace("-", "/")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 14 · esquema de las cuatro capas del método ─────────────────────

export function LayerDiagram({
  layers,
  width = W_FULL,
}: {
  layers: { code: string; name: string; indicators: string; cadence: string }[];
  width?: number;
}) {
  const rowH = 46;
  const gap = 6;
  const height = layers.length * (rowH + gap) + 16;
  const spine = 26;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      <line x1={spine} y1={10} x2={spine} y2={height - 18} className="bf-rp-spine" />
      {layers.map((layer, i) => {
        const y = i * (rowH + gap) + 6;
        // Pirámide: el ancho crece hacia abajo. Las capas se pasan de la 4 a la
        // 1 para que la arquitectura quede de base —sosteniendo todo— y la
        // adopción institucional arriba, que es la cara que ve el cliente.
        const t = layers.length > 1 ? i / (layers.length - 1) : 1;
        const w = (width - spine - 22) * (0.72 + 0.28 * t);
        return (
          <g key={layer.code}>
            <circle cx={spine} cy={y + rowH / 2} r={9} className="bf-rp-node" />
            <text x={spine} y={y + rowH / 2 + 3.5} textAnchor="middle" className="bf-rp-node-t">
              {layer.code}
            </text>
            <rect x={spine + 18} y={y} width={w} height={rowH} rx={3} className="bf-rp-band" />
            <rect x={spine + 18} y={y} width={3} height={rowH} fill={GOLD} />
            <text x={spine + 30} y={y + 17} className="bf-rp-val">
              {layer.name}
            </text>
            <text x={spine + 30} y={y + 32} className="bf-rp-lab">
              {layer.indicators}
            </text>
            <text x={spine + 18 + w - 10} y={y + 17} textAnchor="end" className="bf-rp-ax">
              {layer.cadence}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 15 · tubería de estados (categorías ordenadas) ──────────────────

export function Pipeline({
  stages,
  width = W_FULL,
  height = 132,
}: {
  stages: { name: string; count: number; detail: string }[];
  width?: number;
  height?: number;
}) {
  if (stages.length === 0) return null;
  const max = Math.max(...stages.map((s) => s.count), 1);
  const gap = 6;
  const colW = (width - gap * (stages.length - 1)) / stages.length;
  const barTop = 30;
  const barMax = height - barTop - 34;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {stages.map((stage, i) => {
        const x = i * (colW + gap);
        const h = Math.max(6, barMax * (stage.count / max));
        const y = barTop + barMax - h;
        // rampa ordinal: la etapa avanza, el tono se satura. El número va
        // impreso dentro, así que el color nunca carga solo el dato.
        const t = stages.length === 1 ? 1 : i / (stages.length - 1);
        return (
          <g key={stage.name}>
            <path d={capsule(x, y, colW, h, "top")} fill={heat(0.25 + 0.75 * t)}>
              <title>{`${stage.name}: ${stage.count} — ${stage.detail}`}</title>
            </path>
            <text x={x + colW / 2} y={y - 7} textAnchor="middle" className="bf-rp-center-s">
              {stage.count}
            </text>
            <text x={x + colW / 2} y={barTop + barMax + 15} textAnchor="middle" className="bf-rp-lab">
              {stage.name}
            </text>
            <text x={x + colW / 2} y={barTop + barMax + 27} textAnchor="middle" className="bf-rp-ax">
              {stage.detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 16 · sparkline de tarjeta ───────────────────────────────────────

export function MiniSpark({
  values,
  positive,
  width = 84,
  height = 24,
}: {
  values: number[];
  positive?: boolean | null;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => ({
    x: pad + i * step,
    y: pad + (height - pad * 2) * (1 - (v - min) / range),
  }));
  const color =
    positive === null || positive === undefined ? CATEGORICAL[0] : positive ? STATUS.up : STATUS.down;
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="bf-rp-spark" aria-hidden>
      <polyline
        points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={2.2} fill={color} />
    </svg>
  );
}

// ── 17 · medidor de cobertura de fuentes ────────────────────────────

export function CoverageBar({
  segments,
  width = W_FULL,
  height = 16,
}: {
  segments: { label: string; count: number; color: string }[];
  width?: number;
  height?: number;
}) {
  const total = segments.reduce((s, i) => s + i.count, 0);
  if (total <= 0) return null;
  const laid = stackRuns(
    segments.map((seg) => ({ ...seg, value: seg.count })),
    width,
    2
  );
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {laid.map((seg) => {
        if (seg.count === 0) return null;
        return (
          <rect key={seg.label} x={seg.x} y={0} width={Math.max(0, seg.w)} height={height} rx={2} fill={seg.color}>
            <title>{`${seg.label}: ${seg.count}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// ── 18 · rangos por categoría (mitad central y mediana) ─────────────

export function RangeRows({
  rows,
  format,
  width = W_FULL,
  gutter = 140,
  rowH = 30,
  rangeWidth = 96,
}: {
  rows: { label: string; low: number; mid: number; high: number; color: string; sub?: string }[];
  format: (v: number) => string;
  width?: number;
  gutter?: number;
  rowH?: number;
  /** ancho reservado a la derecha para imprimir el tramo */
  rangeWidth?: number;
}) {
  if (rows.length === 0) return null;
  const plotW = Math.max(40, width - gutter - rangeWidth - 12);
  const max = Math.max(...rows.map((r) => r.high), 0.0001) * 1.1;
  const ticks = niceTicks(0, max, 4);
  const x = (v: number) => gutter + (Math.max(0, v) / max) * plotW;
  const bodyH = rows.length * rowH;
  const height = bodyH + 18;
  const barH = 8;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="bf-rp-svg" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={0} y2={bodyH} className="bf-rp-grid" />
          <text x={x(t)} y={height - 4} textAnchor="middle" className="bf-rp-ax">
            {format(t)}
          </text>
        </g>
      ))}
      {rows.map((row, i) => {
        const cy = i * rowH + rowH / 2 + 4;
        return (
          <g key={row.label}>
            <text x={0} y={cy + 3.5} className="bf-rp-lab">
              {ellipsize(row.label, gutter - 8, 10)}
              <title>{row.label}</title>
            </text>
            {row.sub && (
              <text x={0} y={cy + 14} className="bf-rp-ax">
                {row.sub}
              </text>
            )}
            <rect
              x={x(row.low)}
              y={cy - barH / 2}
              width={Math.max(3, x(row.high) - x(row.low))}
              height={barH}
              rx={4}
              fill={row.color}
              opacity={0.5}
            >
              <title>{`${row.label}: la mitad central entre ${format(row.low)} y ${format(row.high)}`}</title>
            </rect>
            <circle cx={x(row.mid)} cy={cy} r={5} fill={row.color} stroke={SURFACE} strokeWidth={2} />
            <text x={x(row.mid)} y={cy - 9} textAnchor="middle" className="bf-rp-val">
              {format(row.mid)}
            </text>
            <text x={width} y={cy + 3.5} textAnchor="end" className="bf-rp-ax">
              {`${format(row.low)} – ${format(row.high)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export { CATEGORICAL, GOLD, NEUTRAL, STATUS };
