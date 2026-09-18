import { formatUsdCompact } from "@/lib/format";
import type { HistoryUnit } from "@/lib/historyTypes";

// Formatos de la ficha de histórico, compartidos por la vista de una métrica
// y por la comparación TVL vs precio.

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatValue(value: number, unit: HistoryUnit): string {
  if (unit === "usd") return formatUsdCompact(value);
  if (unit === "pct") return `${value.toFixed(Math.abs(value) >= 100 ? 0 : 2)}%`;
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) })}`;
}

/** Eje X: mes y año en rangos largos, día y mes en los cortos. */
export function formatDate(date: string, long: boolean): string {
  const [year, month, day] = date.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return long ? `${name} ${year.slice(2)}` : `${Number(day)} ${name}`;
}

export function formatFullDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** Diferencia entre dos tasas, en puntos porcentuales. */
export function signedPp(value: number): string {
  return `${value >= 0 ? "▲ +" : "▼ −"}${Math.abs(value).toFixed(2)} pp`;
}

export function signedPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}
