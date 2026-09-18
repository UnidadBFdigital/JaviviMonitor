import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

// L2BEAT — arquitectura y riesgos de rollups. Se usa para la dimensión de
// seguridad de las L2, donde la nota editorial del BBI no tiene ficha: en vez
// de inventar una calificación, se toma el stage y los riesgos publicados.
//
// Las L1 no están en L2BEAT: para ellas la seguridad viene de la nota
// editorial del BBI. La interfaz muestra siempre cuál de las dos bases se usó.

const URL = "https://l2beat.com/api/scaling/summary";

export const SOURCE = "L2BEAT";
export const SOURCE_URL = "https://l2beat.com/scaling/summary";

export type L2Risk = {
  name: string;
  value: string;
  sentiment: string;
  description: string;
};

export type L2Project = {
  id: string;
  name: string;
  type: string | null;
  hostChain: string | null;
  category: string | null;
  providers: string[];
  /** "Stage 0" | "Stage 1" | "Stage 2" | null */
  stage: string | null;
  /** insignia de disponibilidad de datos, p. ej. "Ethereum with blobs" */
  dataAvailability: string | null;
  vm: string | null;
  risks: L2Risk[];
  underReview: boolean;
};

type RawBadge = { type?: unknown; name?: unknown };
type RawRisk = { name?: unknown; value?: unknown; sentiment?: unknown; description?: unknown };
type RawProject = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  hostChain?: unknown;
  category?: unknown;
  providers?: unknown;
  stage?: unknown;
  badges?: RawBadge[];
  risks?: RawRisk[];
  isUnderReview?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function badgeOfType(badges: RawBadge[] | undefined, type: string): string | null {
  const hit = badges?.find((b) => b.type === type);
  return hit ? text(hit.name) : null;
}

export function parseL2beat(raw: unknown): Record<string, L2Project> {
  const projects =
    (raw as { projects?: Record<string, RawProject> } | undefined)?.projects ?? {};
  const out: Record<string, L2Project> = {};
  for (const [id, project] of Object.entries(projects)) {
    out[id] = {
      id,
      name: text(project.name) ?? id,
      type: text(project.type),
      hostChain: text(project.hostChain),
      category: text(project.category),
      providers: Array.isArray(project.providers)
        ? project.providers.filter((p): p is string => typeof p === "string")
        : [],
      // el stage llega como "Stage 1" o como objeto cuando el proyecto no aplica
      stage: text(project.stage),
      dataAvailability: badgeOfType(project.badges, "DA"),
      vm: badgeOfType(project.badges, "VM"),
      risks: (project.risks ?? [])
        .map((risk) => ({
          name: text(risk.name) ?? "",
          value: text(risk.value) ?? "",
          sentiment: text(risk.sentiment) ?? "neutral",
          description: text(risk.description) ?? "",
        }))
        .filter((risk) => risk.name !== ""),
      underReview: project.isUnderReview === true,
    };
  }
  return out;
}

export async function getL2beatProjects(): Promise<SourceResult<Record<string, L2Project>>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "l2beat:summary",
      async () => {
        const response = await fetch(URL, {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(25_000),
        });
        if (!response.ok) throw new Error(`${SOURCE} → HTTP ${response.status}`);
        return parseL2beat(await response.json());
      },
      24 * 60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch {
    return { ok: false, source: SOURCE, error: "resumen de escalado no disponible" };
  }
}

/**
 * Seguridad 0-10 derivada del stage y de los riesgos publicados.
 * Es un proxy editorial de madurez: stage 0/1/2 fija la base y
 * cada riesgo con sentimiento negativo descuenta. Se publica en metodología.
 */
export function securityFromL2beat(project: L2Project): { score: number; basis: string } | null {
  if (project.underReview) return null;
  const base = project.stage === "Stage 2" ? 9 : project.stage === "Stage 1" ? 7.5 : project.stage === "Stage 0" ? 5.5 : null;
  if (base === null) return null;
  const bad = project.risks.filter((r) => r.sentiment === "bad").length;
  const warning = project.risks.filter((r) => r.sentiment === "warning").length;
  const score = Math.max(1, Math.min(10, base - bad * 0.8 - warning * 0.35));
  return {
    score,
    basis: `${project.stage}${bad + warning > 0 ? ` · ${bad + warning} riesgos señalados` : " · sin riesgos señalados"}`,
  };
}
