// Fear & Greed Index — alternative.me, gratis, sin key.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

export const SOURCE = "Alternative.me";

export type FearGreed = {
  value: number; // 0-100
  classification: string;
  history: { date: string; value: number }[]; // últimos 30 días
};

type RawFng = {
  data: { value: string; value_classification: string; timestamp: string }[];
};

export async function getFearGreed(): Promise<SourceResult<FearGreed>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "feargreed",
      async () => {
        const res = await fetch("https://api.alternative.me/fng/?limit=30", {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${SOURCE} /fng → HTTP ${res.status}`);
        return res.json() as Promise<RawFng>;
      },
      60 * 60 * 1000 // 1 h — se actualiza diario
    );
    const items = data.data ?? [];
    if (items.length === 0) throw new Error("respuesta vacía");
    return {
      ok: true,
      data: {
        value: Number(items[0].value),
        classification: items[0].value_classification,
        history: items
          .map((d) => ({
            date: new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10),
            value: Number(d.value),
          }))
          .reverse(),
      },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
