// Tipo de cambio oficial del BCB — se lee en vivo de la página del Banco
// Central. Desde el 29 de junio de 2026 Bolivia dejó el régimen fijo
// (6.86/6.96 vigente desde 2011) y el oficial se determina a diario con
// el promedio ponderado de las operaciones de los bancos con sus clientes.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

export const SOURCE = "BCB";
const URL = "https://www.bcb.gob.bo/tco_reporte_ultima_cotizacion.php";

export type BankRate = {
  bank: string;
  buyBob: number;
  amountUsd: number;
  transactions: number;
};

export type BcbRate = {
  officialBob: number; // Bs por USD
  cutoffDate: string | null; // fecha de corte informada
  validFrom: string | null; // vigencia
  banks: BankRate[];
};

function parseNumber(raw: string): number {
  // formato boliviano: 11,52 (decimal coma) y 12.808.358 (miles punto)
  return Number(raw.replace(/\./g, "").replace(",", "."));
}

/**
 * El BCB no declara una codificación consistente: a veces sirve la página en
 * UTF-8 y a veces en windows-1252. Asumir una rompe los acentos (o produce
 * doble mojibake), así que se detecta: si los bytes son UTF-8 válido se usa
 * UTF-8; si no, es latin-1.
 */
function decodeHtml(buf: ArrayBuffer, contentType: string | null): string {
  const declared = contentType?.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
  if (declared && /^(iso-8859-1|latin1|windows-1252)$/.test(declared)) {
    return new TextDecoder("windows-1252").decode(buf);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export async function getBcbRate(): Promise<SourceResult<BcbRate>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "bcb:tco",
      async () => {
        const res = await fetch(URL, {
          cache: "no-store",
          headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        if (!res.ok) throw new Error(`${SOURCE} → HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const html = decodeHtml(buf, res.headers.get("content-type"));

        const plain = html
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<[^>]+>/g, "\n")
          .replace(/&nbsp;/gi, " ");
        const lines = plain
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // cotización principal: "Bs 11,52/$us"
        const quoteLine = lines.find((l) => /Bs\s*[\d.,]+\s*\/\s*\$us/i.test(l));
        const quoteMatch = quoteLine?.match(/Bs\s*([\d.,]+)/i);
        if (!quoteMatch) throw new Error(`${SOURCE} → no se encontró la cotización`);
        const officialBob = parseNumber(quoteMatch[1]);
        if (!Number.isFinite(officialBob) || officialBob <= 0) {
          throw new Error(`${SOURCE} → cotización inválida`);
        }

        const cutoff = lines.find((l) => /FECHA DE CORTE/i.test(l)) ?? null;
        const valid = lines.find((l) => /VIGENCIA/i.test(l)) ?? null;

        // tabla por banco: nombre, compra, monto, nº de transacciones
        const banks: BankRate[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (!/^BANCO\b/i.test(lines[i])) continue;
          const [buy, amount, tx] = [lines[i + 1], lines[i + 2], lines[i + 3]];
          if (!buy || !amount || !tx) continue;
          const buyBob = parseNumber(buy);
          const amountUsd = parseNumber(amount);
          const transactions = parseNumber(tx);
          if (!Number.isFinite(buyBob) || buyBob <= 0) continue;
          banks.push({
            bank: lines[i],
            buyBob,
            amountUsd: Number.isFinite(amountUsd) ? amountUsd : 0,
            transactions: Number.isFinite(transactions) ? transactions : 0,
          });
        }

        return {
          officialBob,
          cutoffDate: cutoff?.replace(/^FECHA DE CORTE:\s*/i, "") ?? null,
          validFrom: valid?.replace(/^VIGENCIA:\s*/i, "") ?? null,
          banks,
        };
      },
      60 * 60 * 1000 // 1 h — el BCB publica una vez por día hábil
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
