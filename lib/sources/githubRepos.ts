import { cached, readSnapshot } from "@/lib/cache";
import type { SourceResult } from "./types";

// Actividad de los repositorios núcleo de cada red.
//
// ADVERTENCIA METODOLÓGICA, deliberada y visible en la interfaz:
// esto NO es "desarrolladores del ecosistema". Mide commits del repositorio
// principal del cliente o protocolo. El conteo de desarrolladores activos de
// un ecosistema (Electric Capital) no tiene API pública —solo informes PDF
// anuales—, así que esa columna se publica como N/A con su fuente requerida,
// en vez de sustituirla por commits.
//
// GitHub anónimo da 60 consultas por hora y hacen falta dos por repositorio.
// Con quince redes, una tanda de recargas agota la cuota y deja el panel
// vacío. Por eso el adapter consulta primero el presupuesto —`/rate_limit` no
// consume cuota— y gasta solo lo que tiene, marcando el resto como no
// disponible con la hora de reposición. Con GITHUB_TOKEN el techo sube a
// 5.000/h y esta contabilidad deja de importar.

const API = "https://api.github.com";

export const SOURCE = "GitHub API";
export const SOURCE_URL = "https://docs.github.com/rest";

export type RepoActivity = {
  repo: string;
  stars: number | null;
  forks: number | null;
  openIssues: number | null;
  pushedAt: string | null;
  /** commits de las últimas 4 / 12 / 52 semanas */
  commits4w: number | null;
  commits12w: number | null;
  commits52w: number | null;
  /** commits de las 12 semanas anteriores a las últimas 12, para la variación */
  commitsPrev12w: number | null;
  /** solo con GITHUB_TOKEN: la paginación anónima no expone el total */
  contributors: number | null;
  /** commits por semana, 52 semanas, de la más antigua a la más reciente */
  weekly: number[];
  unavailable: string | null;
};

function headers(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

type Fetched<T> = { data: T | null; computing: boolean };

async function json<T>(path: string): Promise<Fetched<T>> {
  const response = await fetch(`${API}${path}`, {
    cache: "no-store",
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
  });
  // 202 no es un fallo: GitHub está calculando las estadísticas del repo y las
  // devuelve en un pedido posterior. 403 es el límite; 404, repo movido.
  if (response.status === 202) return { data: null, computing: true };
  if (response.status === 403 || response.status === 404) return { data: null, computing: false };
  if (!response.ok) throw new Error(`${SOURCE} ${path} → HTTP ${response.status}`);
  return { data: (await response.json()) as T, computing: false };
}

/** Contador de llamadas compartido por toda la tanda. */
type Budget = { left: number; resetsAt: string | null };

/** `/rate_limit` es la única llamada que no descuenta cuota. */
async function readBudget(): Promise<Budget> {
  try {
    const response = await fetch(`${API}/rate_limit`, {
      cache: "no-store",
      headers: headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { left: 0, resetsAt: null };
    const body = (await response.json()) as {
      resources?: { core?: { remaining?: number; reset?: number } };
    };
    const core = body.resources?.core;
    return {
      left: typeof core?.remaining === "number" ? core.remaining : 0,
      resetsAt: typeof core?.reset === "number" ? new Date(core.reset * 1000).toISOString() : null,
    };
  } catch {
    return { left: 0, resetsAt: null };
  }
}

function exhaustedNote(budget: Budget): string {
  const reset = budget.resetsAt
    ? new Date(budget.resetsAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
    : null;
  // la hora va entre paréntesis: "10:34 a. m." ya cierra con punto
  return `Cuota de GitHub agotada${reset ? ` (se repone a las ${reset})` : ""}. Configurar GITHUB_TOKEN sube el límite de 60 a 5.000 consultas por hora.`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RawRepo = { stargazers_count?: number; forks_count?: number; open_issues_count?: number; pushed_at?: string };

function emptyActivity(repo: string): RepoActivity {
  return {
    repo,
    stars: null,
    forks: null,
    openIssues: null,
    pushedAt: null,
    commits4w: null,
    commits12w: null,
    commits52w: null,
    commitsPrev12w: null,
    contributors: null,
    weekly: [],
    unavailable: null,
  };
}

async function fetchRepo(repo: string, budget: Budget): Promise<RepoActivity> {
  const empty = emptyActivity(repo);
  if (budget.left < 2) return { ...empty, unavailable: exhaustedNote(budget) };

  try {
    budget.left -= 2;
    const [info, participation] = await Promise.all([
      json<RawRepo>(`/repos/${repo}`),
      json<{ all?: number[] }>(`/repos/${repo}/stats/participation`),
    ]);

    // Un solo reintento del 202, y solo si sobra presupuesto: la estadística de
    // un repo frío tarda unos segundos en calcularse del lado de GitHub, pero
    // reintentar sin control agota la cuota anónima en una sola carga.
    let weeks = participation.data?.all ?? [];
    if (weeks.length === 0 && participation.computing && budget.left >= 4) {
      await sleep(2_000);
      budget.left -= 1;
      const retry = await json<{ all?: number[] }>(`/repos/${repo}/stats/participation`);
      weeks = retry.data?.all ?? [];
    }

    if (!info.data && weeks.length === 0) {
      return {
        ...empty,
        unavailable:
          budget.left <= 0 ? exhaustedNote(budget) : "GitHub no devolvió datos de este repositorio",
      };
    }

    const sum = (from: number, to: number) =>
      weeks.length >= to ? weeks.slice(weeks.length - to, weeks.length - from).reduce((a, b) => a + b, 0) : null;

    return {
      ...empty,
      stars: info.data?.stargazers_count ?? null,
      forks: info.data?.forks_count ?? null,
      openIssues: info.data?.open_issues_count ?? null,
      pushedAt: info.data?.pushed_at ?? null,
      commits4w: sum(0, 4),
      commits12w: sum(0, 12),
      commits52w: weeks.length > 0 ? weeks.reduce((a, b) => a + b, 0) : null,
      commitsPrev12w: sum(12, 24),
      contributors: null,
      weekly: weeks,
      unavailable:
        weeks.length === 0 ? "GitHub aún calcula las estadísticas de commits de este repositorio" : null,
    };
  } catch {
    return { ...empty, unavailable: "GitHub no disponible" };
  }
}

const hasData = (activity: RepoActivity) => activity.weekly.length > 0 || activity.stars !== null;

/** Último dato válido por repositorio: una cuota agotada no borra lo que ya se sabía. */
const lastGood = new Map<string, RepoActivity>();

const FULL_TTL_MS = 12 * 60 * 60 * 1000;
/** Con repositorios sin dato, se reintenta pronto en vez de fijar el hueco doce horas. */
const PARTIAL_TTL_MS = 30 * 60 * 1000;

/**
 * Actividad de una lista de repos, en tandas de tres para no disparar ráfagas.
 * Completa se cachea doce horas. Si la cuota dejó repositorios sin dato, cada
 * uno conserva su último valor válido y la tanda se reintenta a los treinta
 * minutos. Una caída total no se cachea.
 */
export async function getRepoActivity(repos: string[]): Promise<SourceResult<Record<string, RepoActivity>>> {
  const key = `github:repos:${repos.slice().sort().join(",")}`;
  try {
    const { data, fetchedAt, stale } = await cached(
      key,
      async () => {
        // proceso nuevo (un reinicio, una recompilación): el último dato válido
        // por repositorio sale de la copia en disco en vez de perderse
        if (lastGood.size === 0) {
          const snapshot = await readSnapshot<Record<string, RepoActivity>>(key);
          for (const activity of Object.values(snapshot?.data ?? {})) {
            if (hasData(activity)) lastGood.set(activity.repo, activity);
          }
        }
        const budget = await readBudget();
        const out: Record<string, RepoActivity> = {};

        for (let i = 0; i < repos.length; i += 3) {
          const batch = await Promise.all(repos.slice(i, i + 3).map((repo) => fetchRepo(repo, budget)));
          batch.forEach((activity) => {
            if (hasData(activity)) {
              lastGood.set(activity.repo, activity);
              out[activity.repo] = activity;
            } else {
              out[activity.repo] = lastGood.get(activity.repo) ?? activity;
            }
          });
        }

        // El motivo viaja en el error para que la interfaz pueda explicarlo:
        // "no disponible" sin causa obliga a abrir la consola para entender.
        if (!Object.values(out).some(hasData)) {
          throw new Error(budget.left <= 0 ? exhaustedNote(budget) : `${SOURCE}: ningún repositorio devolvió datos`);
        }
        return out;
      },
      (result) => (Object.values(result).every(hasData) ? FULL_TTL_MS : PARTIAL_TTL_MS),
      // con la cuota anónima agotada justo tras un reinicio, la copia en disco
      // evita que el panel y el informe queden "sin respuesta"
      { persist: true }
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return {
      ok: false,
      source: SOURCE,
      error: error instanceof Error ? error.message : "actividad de repositorios no disponible",
    };
  }
}
