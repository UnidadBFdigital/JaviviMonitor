import { FRESH, jsonCached } from "@/lib/httpCache";
import { getDailyCandles } from "@/lib/sources/cryptocom";
import { getYahooSeries, MACRO_SYMBOLS } from "@/lib/sources/yahoo";

// Matriz de correlación (Pearson sobre retornos log diarios, ~90 días).
// Cripto: Crypto.com (BNB vía Yahoo — Crypto.com no lo lista).
// Macro: Yahoo Finance. Si una serie falla, su fila/columna queda null.

const CRYPTO_CDC = [
  { id: "BTC", instrument: "BTC_USDT" },
  { id: "ETH", instrument: "ETH_USDT" },
  { id: "SOL", instrument: "SOL_USDT" },
];

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

export async function GET() {
  const [cdc, bnb, macro] = await Promise.all([
    Promise.all(CRYPTO_CDC.map((c) => getDailyCandles(c.instrument, 90))),
    getYahooSeries("BNB-USD", "6mo"),
    Promise.all(MACRO_SYMBOLS.map((m) => getYahooSeries(m.yahoo, "6mo"))),
  ]);

  const series: { label: string; byDate: Map<string, number> | null }[] = [
    ...CRYPTO_CDC.map((c, i) => ({
      label: c.id,
      byDate: cdc[i].ok
        ? new Map(cdc[i].data.map((k) => [k.date, k.close] as [string, number]))
        : null,
    })),
    {
      label: "BNB",
      byDate: bnb.ok
        ? new Map(bnb.data.slice(-90).map((p) => [p.date, p.close] as [string, number]))
        : null,
    },
    ...MACRO_SYMBOLS.map((m, i) => ({
      label: m.label,
      byDate: macro[i].ok
        ? new Map(macro[i].data.slice(-90).map((p) => [p.date, p.close] as [string, number]))
        : null,
    })),
  ];

  const labels = series.map((s) => s.label);
  const n = series.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!series[i].byDate || !series[j].byDate) continue;
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const dates = [...series[i].byDate!.keys()]
        .filter((d) => series[j].byDate!.has(d))
        .sort();
      if (dates.length < 15) continue; // solapamiento insuficiente
      const ra: number[] = [];
      const rb: number[] = [];
      for (let k = 1; k < dates.length; k++) {
        ra.push(Math.log(series[i].byDate!.get(dates[k])! / series[i].byDate!.get(dates[k - 1])!));
        rb.push(Math.log(series[j].byDate!.get(dates[k])! / series[j].byDate!.get(dates[k - 1])!));
      }
      matrix[i][j] = Number(pearson(ra, rb).toFixed(2));
    }
  }

  const unavailable = series.filter((s) => !s.byDate).map((s) => s.label);

  return jsonCached({
    ok: true,
    labels,
    matrix,
    unavailable,
    window: "~90 días, retornos log diarios (días comunes entre mercados)",
    sources: "Crypto.com Exchange (BTC/ETH/SOL) · Yahoo Finance (BNB y macro)",
    fetchedAt: new Date().toISOString(),
  }, FRESH.hour);
}
