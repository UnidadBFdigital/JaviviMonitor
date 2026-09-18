// Noticias Bolivia — Google News RSS (gratis, sin key) con queries
// enfocadas en cripto, dólar y regulación financiera boliviana.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

export const SOURCE = "Google News (Bolivia)";

const QUERIES = [
  "bolivia (cripto OR criptomonedas OR USDT OR stablecoin OR bitcoin)",
  "bolivia (BCB OR ASFI OR \"dolar paralelo\" OR \"tipo de cambio\")",
];

export type BoliviaHeadline = {
  title: string;
  url: string;
  outlet: string;
  publishedAt: string;
};

function extract(tag: string, block: string): string | null {
  const m = block.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i")
  );
  return m ? m[1].trim() : null;
}

async function fetchQuery(q: string): Promise<BoliviaHeadline[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=BO&ceid=BO:es-419`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) throw new Error(`Google News → HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((block) => {
    const rawTitle = extract("title", block);
    const link = extract("link", block);
    const pubDate = extract("pubDate", block);
    const sourceName = extract("source", block);
    if (!rawTitle || !link || !pubDate) return [];
    const date = new Date(pubDate);
    if (Number.isNaN(date.getTime())) return [];
    // Google News formatea "Título - Medio"
    const title = rawTitle.replace(/\s+-\s+[^-]+$/, "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'");
    return [
      {
        title,
        url: link,
        outlet: sourceName ?? "Google News",
        publishedAt: date.toISOString(),
      },
    ];
  });
}

export async function getBoliviaNews(limit = 15): Promise<SourceResult<BoliviaHeadline[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "bolivia:news",
      async () => {
        const results = await Promise.allSettled(QUERIES.map(fetchQuery));
        const all = results
          .filter((r): r is PromiseFulfilledResult<BoliviaHeadline[]> => r.status === "fulfilled")
          .flatMap((r) => r.value);
        if (all.length === 0) throw new Error("Google News no respondió");
        // dedupe por título
        const seen = new Set<string>();
        return all
          .filter((h) => {
            const key = h.title.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      },
      30 * 60 * 1000
    );
    return { ok: true, data: data.slice(0, limit), source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
