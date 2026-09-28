import { cached } from "@/lib/cache";
import { aggregateRwaAssets, extractRwaPageData, type RwaClass, type RwaPlatform } from "@/lib/rwaClasses";
import type { SourceResult } from "./types";

const RWA_PAGE_URL = "https://defillama.com/rwa";
const RWA_PUBLIC_READER_URL = "https://r.jina.ai/https://defillama.com/rwa";
export const RWA_DASHBOARD_SOURCE = "DeFiLlama RWA Dashboard";
/** La página completa pesa ~10 MB: el tope deja margen sin aceptar cualquier cosa. */
const MAX_HTML_BYTES = 16 * 1024 * 1024;

export type RwaDashboardMetrics = {
  activeMcapUsd: number;
  onchainMcapUsd: number;
  defiActiveTvlUsd: number;
  /** null cuando la página deja de publicar el conteo: no se reconstruye */
  issuerCount: number | null;
  sourceUrl: string;
  transport: "direct" | "public-reader-html" | "public-reader";
  /**
   * Market cap por clase de activo con el perímetro por defecto de DeFiLlama.
   * null cuando el transporte solo trajo el texto de la página, sin el detalle
   * por activo.
   */
  classes: RwaClass[] | null;
  /** Active AUM por plataforma emisora; null por la misma razón */
  platforms: RwaPlatform[] | null;
  scope: {
    stablecoins: boolean;
    governanceTokens: boolean;
    rwaPerps: boolean;
    bridgeInteropTvl: boolean;
  };
};

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
};

function sectionAfter(html: string, label: string): string {
  const start = html.indexOf(label);
  if (start === -1) throw new Error(`No se encontró la métrica "${label}"`);
  return html.slice(start + label.length, start + label.length + 500);
}

/**
 * Rótulos de cada KPI, del vigente al anterior. En septiembre de 2026
 * DeFiLlama pasó de "Mcap" a "AUM" sin cambiar la medida; se aceptan los dos
 * para que un cambio de nombre no vuelva a tumbar la fuente.
 */
const KPI_LABELS = {
  active: ["Total RWA Active AUM", "Total RWA Active Mcap"],
  onchain: ["Total RWA Onchain AUM", "Total RWA Onchain Mcap"],
  defi: ["DeFi Active TVL"],
} as const;

function parseCompactUsd(html: string, labels: readonly string[]): number {
  const label = labels.find((l) => html.includes(l));
  if (!label) throw new Error(`No se encontró la métrica ${labels.map((l) => `"${l}"`).join(" ni ")}`);
  const match = sectionAfter(html, label).match(/\$([0-9]+(?:[.,][0-9]+)?)([kmbt])?/i);
  if (!match) throw new Error(`Valor inválido para "${label}"`);

  const value = Number(match[1].replace(",", "."));
  const multiplier = match[2] ? MULTIPLIERS[match[2].toLowerCase()] : 1;
  const result = value * multiplier;
  if (!Number.isFinite(result) || result <= 0) {
    throw new Error(`Valor fuera de rango para "${label}"`);
  }
  return Math.round(result);
}

/**
 * El conteo de emisores es secundario: DeFiLlama lo retiró de la cabecera en
 * 2026 y su ausencia no debe tumbar los tres KPI principales. Si el rótulo no
 * está, es null; si está con un valor ilegible, sigue siendo un error.
 */
function parseOptionalCount(html: string, label: string): number | null {
  if (!html.includes(label)) return null;
  const text = sectionAfter(html, label).replace(/<[^>]+>/g, " ");
  const match = text.match(/\b([0-9][0-9,.]*)\b/);
  const value = match ? Number(match[1].replace(/[,.]/g, "")) : Number.NaN;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Valor inválido para "${label}"`);
  }
  return value;
}

/**
 * Extrae los KPI que el dashboard público de DeFiLlama muestra en su cabecera
 * y, si el HTML trae los datos embebidos de la página, el market cap por clase
 * y por plataforma. No se usa la suma de /protocols: TVL de protocolos y
 * market cap de activos son universos diferentes. La página es el fallback
 * público mientras los endpoints RWA estructurados sigan reservados a la API Pro.
 */
export function parseRwaDashboardHtml(
  html: string,
  transport: RwaDashboardMetrics["transport"] = "direct"
): RwaDashboardMetrics {
  const page = extractRwaPageData(html);
  const breakdown = page ? aggregateRwaAssets(page.assets, page.inclusion) : null;
  return {
    activeMcapUsd: parseCompactUsd(html, KPI_LABELS.active),
    onchainMcapUsd: parseCompactUsd(html, KPI_LABELS.onchain),
    defiActiveTvlUsd: parseCompactUsd(html, KPI_LABELS.defi),
    issuerCount: parseOptionalCount(html, "Total Asset Issuers"),
    sourceUrl: RWA_PAGE_URL,
    transport,
    classes: breakdown && breakdown.classes.length > 0 ? breakdown.classes : null,
    platforms: breakdown && breakdown.platforms.length > 0 ? breakdown.platforms : null,
    // Es el estado de filtros que acompaña a los KPI renderizados por defecto.
    scope: {
      stablecoins: false,
      governanceTokens: false,
      rwaPerps: false,
      bridgeInteropTvl: true,
    },
  };
}

/**
 * Lector público. En formato HTML devuelve la página completa, con los datos
 * por activo embebidos; en texto, solo lo renderizado (KPI sin desglose).
 */
async function fetchViaPublicReader(format: "html" | "text"): Promise<string> {
  const response = await fetch(RWA_PUBLIC_READER_URL, {
    cache: "no-store",
    headers: format === "html" ? { accept: "text/html", "x-return-format": "html" } : { accept: "text/plain" },
    signal: AbortSignal.timeout(format === "html" ? 45_000 : 20_000),
  });
  if (!response.ok) {
    throw new Error(`Render público de ${RWA_DASHBOARD_SOURCE} → HTTP ${response.status}`);
  }
  const body = await response.text();
  if (body.length > MAX_HTML_BYTES) throw new Error("Respuesta RWA demasiado grande");
  return body;
}

/**
 * `https.get` de Node, pedido en tiempo de ejecución.
 *
 * Un import estático de `node:https` rompe cualquier bundle que no sea el de
 * Node —el del navegador o el runtime edge, que compila el archivo de
 * instrumentación— aunque esta función nunca se ejecute ahí.
 */
function httpsGet() {
  const get = typeof process !== "undefined" ? process.getBuiltinModule : undefined;
  if (typeof get !== "function") throw new Error("https solo está disponible en el servidor");
  return get("node:https").get;
}

function fetchDashboardHtml(url = RWA_PAGE_URL, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = httpsGet()(
      url,
      {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
          // Cloudflare rechaza el fingerprint de undici/fetch en esta página,
          // pero a veces permite una petición HTTPS convencional con UA de navegador.
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location && redirects < 3) {
          response.resume();
          resolve(fetchDashboardHtml(new URL(location, url).toString(), redirects + 1));
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`${RWA_DASHBOARD_SOURCE} → HTTP ${status}`));
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_HTML_BYTES) {
            request.destroy(new Error("Respuesta RWA demasiado grande"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        response.on("error", reject);
      }
    );
    request.setTimeout(20_000, () => request.destroy(new Error("Timeout consultando RWA")));
    request.on("error", reject);
  });
}

export async function getRwaDashboardMetrics(): Promise<SourceResult<RwaDashboardMetrics>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      // v2: la entrada incluye el desglose por clase y plataforma
      "defillama:rwa-dashboard:v2",
      async () => {
        // 1) directo: la página está detrás de Cloudflare y suele responder 403
        try {
          return parseRwaDashboardHtml(await fetchDashboardHtml(), "direct");
        } catch {
          // sigue con el lector público
        }
        // 2) lector público en HTML: mismos KPI y además el detalle por activo
        try {
          return parseRwaDashboardHtml(await fetchViaPublicReader("html"), "public-reader-html");
        } catch {
          // 3) último recurso: solo el texto renderizado, sin desglose por clase
          return parseRwaDashboardHtml(await fetchViaPublicReader("text"), "public-reader");
        }
      },
      30 * 60 * 1000,
      // la portada y el brief piden esta fuente en cada carga: si el scrape
      // cae, se reintenta cada 10 minutos en vez de en cada petición. Por ser
      // un scrape, la última lectura buena queda en disco
      { failureTtlMs: 10 * 60 * 1000, persist: true }
    );
    return {
      ok: true,
      data,
      source: RWA_DASHBOARD_SOURCE,
      fetchedAt,
      stale,
    };
  } catch (error) {
    return { ok: false, source: RWA_DASHBOARD_SOURCE, error: String(error) };
  }
}
