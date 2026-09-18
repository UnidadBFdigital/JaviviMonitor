// Contrato común de todos los módulos de fuentes de datos.
// Cada fuente devuelve solo los campos relevantes (nunca el JSON crudo):
// importa para legibilidad de la UI y para el costo cuando estos mismos
// datos se pasen como tools al agente de IA (Fase 4).

export type SourceResult<T> =
  | { ok: true; data: T; source: string; fetchedAt: string; stale: boolean }
  | { ok: false; source: string; error: string };
