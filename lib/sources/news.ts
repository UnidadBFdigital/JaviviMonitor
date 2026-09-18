// Noticias — RSS de medios cripto institucionales, gratis, sin key.
// Clasificación B2B por reglas: categorías, entidades y filtro de ruido
// retail (predicciones de precio, memecoins, influencers).

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

export const SOURCE = "RSS institucional";

const FEEDS: { name: string; url: string }[] = [
  { name: "The Block", url: "https://www.theblock.co/rss.xml" },
  { name: "Blockworks", url: "https://blockworks.co/feed" },
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
];

// Prioridad visual de fuentes (institucionales primero)
export const SOURCE_PRIORITY = ["The Block", "Blockworks", "CoinDesk", "Cointelegraph", "Decrypt"];

const CATEGORIES: { id: string; label: string; pattern: RegExp }[] = [
  { id: "regulacion", label: "Regulación", pattern: /\b(SEC|CFTC|regulat|regulac|MiCA|compliance|AML|FATF|license|licencia|lawsuit|court|congress|senate|ley\b|normativ)/i },
  { id: "stablecoins", label: "Stablecoins", pattern: /\b(stablecoin|USDC|USDT|Tether|Circle\b|PYUSD|EURC|GENIUS Act)/i },
  { id: "banca", label: "Banca", pattern: /\b(bank|banco|banking|JPMorgan|Citi\b|Goldman|Morgan Stanley|HSBC|Santander|BBVA|custod)/i },
  { id: "rwa", label: "RWA / Tokenización", pattern: /\b(tokeniz|RWA|real[- ]world asset|treasur(y|ies)|money market|BUIDL|BENJI|bond|private credit)/i },
  { id: "pagos", label: "Pagos", pattern: /\b(payment|pago|remittance|remesa|Visa\b|Mastercard|Stripe|PayPal|SWIFT|settle|settlement)/i },
  { id: "cbdc", label: "CBDC", pattern: /\b(CBDC|central bank digital|digital euro|digital dollar|e-CNY)/i },
  { id: "capital", label: "Capital Markets", pattern: /\b(ETF|ETP|fund\b|BlackRock|Fidelity|Franklin|Nasdaq|NYSE|IPO|listing|index)/i },
  { id: "infra", label: "Infraestructura", pattern: /\b(infrastructure|L2\b|layer[- ]?2|rollup|validator|node|custody tech|Chainlink|oracle)/i },
  { id: "fintech", label: "Fintech", pattern: /\b(fintech|neobank|wallet provider|onramp|on-ramp)/i },
];

const RETAIL_NOISE =
  /\b(price prediction|could (hit|reach|surge)|why .{0,30} price|memecoin|meme coin|dogecoin|shiba|pepe\b|bonk\b|influencer|top \d+ coins|altcoin season|to the moon|analista predice|100x)/i;

const ENTITIES = [
  "Visa", "Mastercard", "Circle", "Coinbase", "Ripple", "JPMorgan", "Citi",
  "BlackRock", "Franklin Templeton", "Chainlink", "Polygon", "Tether",
  "Stripe", "PayPal", "SWIFT", "Goldman Sachs", "Morgan Stanley", "Fidelity",
  "Nasdaq", "SEC", "CFTC", "Fed", "ECB", "BIS", "FATF", "Santander", "BBVA",
  "HSBC", "DTCC", "Binance", "Kraken", "Bitstamp", "Societe Generale",
];

export type Headline = {
  title: string;
  url: string;
  outlet: string;
  publishedAt: string; // ISO
  categories: string[]; // labels
  entities: string[];
  institutionalScore: number;
};

function classify(title: string): Pick<Headline, "categories" | "entities" | "institutionalScore"> {
  const categories = CATEGORIES.filter((c) => c.pattern.test(title)).map((c) => c.label);
  const entities = ENTITIES.filter((e) =>
    new RegExp(`\\b${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title)
  );
  let score = categories.length * 2 + entities.length;
  if (RETAIL_NOISE.test(title)) score -= 6;
  return { categories, entities, institutionalScore: score };
}

function extract(tag: string, block: string): string | null {
  const m = block.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i")
  );
  return m ? m[1].trim() : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"');
}

async function fetchFeed(name: string, url: string): Promise<Headline[]> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/rss+xml, application/xml, text/xml",
      "user-agent": "BlockfinityResearch/1.0 (internal research tool)",
    },
  });
  if (!res.ok) throw new Error(`RSS ${name} → HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((block) => {
    const title = extract("title", block);
    const link = extract("link", block);
    const pubDate = extract("pubDate", block);
    if (!title || !link || !pubDate) return [];
    const date = new Date(pubDate);
    if (Number.isNaN(date.getTime())) return [];
    const clean = decodeEntities(title);
    return [
      {
        title: clean,
        url: link,
        outlet: name,
        publishedAt: date.toISOString(),
        ...classify(clean),
      },
    ];
  });
}

async function fetchAll(): Promise<Headline[]> {
  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f.name, f.url)));
  const all = results
    .filter((r): r is PromiseFulfilledResult<Headline[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
  if (all.length === 0) throw new Error("ningún feed RSS respondió");
  return all.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// Cronológico (todas las noticias, sin filtro)
export async function getHeadlines(limit = 12): Promise<SourceResult<Headline[]>> {
  try {
    const { data, fetchedAt, stale } = await cached("news:all", fetchAll, 30 * 60 * 1000);
    return { ok: true, data: data.slice(0, limit), source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// Solo B2B institucional: score > 0, ordenado por score y recencia
export async function getInstitutionalNews(limit = 20): Promise<SourceResult<Headline[]>> {
  try {
    const { data, fetchedAt, stale } = await cached("news:all", fetchAll, 30 * 60 * 1000);
    const scored = data
      .filter((h) => h.institutionalScore > 0)
      .sort(
        (a, b) =>
          b.institutionalScore - a.institutionalScore ||
          b.publishedAt.localeCompare(a.publishedAt)
      )
      .slice(0, limit);
    return { ok: true, data: scored, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// Eventos regulatorios recientes (subconjunto: categoría Regulación)
export async function getRegulatoryNews(limit = 8): Promise<SourceResult<Headline[]>> {
  try {
    const { data, fetchedAt, stale } = await cached("news:all", fetchAll, 30 * 60 * 1000);
    const reg = data.filter((h) => h.categories.includes("Regulación")).slice(0, limit);
    return { ok: true, data: reg, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

/** Titulares de una categoría concreta del clasificador (ver CATEGORIES). */
export async function getNewsByCategory(
  label: string,
  limit = 10
): Promise<SourceResult<Headline[]>> {
  try {
    const { data, fetchedAt, stale } = await cached("news:all", fetchAll, 30 * 60 * 1000);
    const filtered = data
      .filter((h) => h.categories.includes(label))
      .sort(
        (a, b) =>
          b.institutionalScore - a.institutionalScore ||
          b.publishedAt.localeCompare(a.publishedAt)
      )
      .slice(0, limit);
    return { ok: true, data: filtered, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
