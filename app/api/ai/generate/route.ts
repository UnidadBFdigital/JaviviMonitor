import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, executeTool } from "@/lib/ai/tools";
import { SYSTEM_PROMPT, buildReportPrompt, buildCarouselPrompt } from "@/lib/ai/prompts";

// Corridas largas (el loop consulta varias fuentes) — evitar timeout del route.
export const maxDuration = 300;

// Haiku por defecto (recolección y primer borrador); Sonnet como upgrade
// de calidad para la redacción final. El toggle vive en la UI.
const MODELS = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-5",
} as const;

// Límite duro del tool-use loop: si algo falla y el modelo entra en un
// ciclo de llamadas, cortamos acá para no gastar de más.
const MAX_ITERATIONS = 8;

// NOTA Batch API (pendiente, no bloqueante): las corridas del reporte
// semanal no son tiempo real, así que pueden migrarse a
// client.messages.batches.create(...) por 50% del costo. Requiere
// polling del batch y una UI de "resultado listo" — sumarlo como fase
// aparte cuando el volumen lo justifique.

type Body = {
  mode: "report" | "carousel";
  model?: keyof typeof MODELS;
  tema?: string;
  audiencia?: string;
  instrucciones?: string;
};

const MAX_BODY_BYTES = 50_000;
const MAX_TEMA_LENGTH = 300;
const MAX_AUDIENCIA_LENGTH = 500;
const MAX_INSTRUCCIONES_LENGTH = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("invalid_type");
  const text = value.trim();
  if (text.length > maxLength) throw new Error("too_long");
  return text || undefined;
}

function parseBody(value: unknown): Body | null {
  if (!isRecord(value) || (value.mode !== "report" && value.mode !== "carousel")) return null;
  if (value.model !== undefined && value.model !== "haiku" && value.model !== "sonnet") return null;

  try {
    return {
      mode: value.mode,
      model: value.model as Body["model"],
      tema: optionalText(value.tema, MAX_TEMA_LENGTH),
      audiencia: optionalText(value.audiencia, MAX_AUDIENCIA_LENGTH),
      instrucciones: optionalText(value.instrucciones, MAX_INSTRUCCIONES_LENGTH),
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY no configurada en .env.local" },
      { status: 500 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "body demasiado grande" }, { status: 413 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json({ ok: false, error: "parámetros inválidos" }, { status: 400 });
  }

  const model = MODELS[body.model ?? "haiku"];
  const fecha = new Date().toLocaleDateString("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let userPrompt: string;
  if (body.mode === "report") {
    userPrompt = buildReportPrompt(fecha, body.instrucciones);
  } else if (body.mode === "carousel") {
    if (!body.tema?.trim()) {
      return NextResponse.json({ ok: false, error: "falta el tema del carrusel" }, { status: 400 });
    }
    userPrompt = buildCarouselPrompt(
      body.tema.trim(),
      body.audiencia?.trim() || "clientes de asesoría cripto en Bolivia y LATAM",
      fecha,
      body.instrucciones
    );
  } else {
    return NextResponse.json({ ok: false, error: "mode inválido" }, { status: 400 });
  }

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
  const toolCalls: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model,
        max_tokens: 8000,
        // tools y system van primero y estables; el breakpoint al final del
        // system cachea todo el prefijo (tools + reglas) entre corridas.
        tools: TOOLS,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
      });

      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      if (response.stop_reason !== "tool_use") {
        const draft = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return NextResponse.json({
          ok: true,
          draft,
          toolCalls,
          usage: { inputTokens, outputTokens, cacheReadTokens, model },
        });
      }

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolUseBlocks) {
        toolCalls.push(tool.name);
        const result = await executeTool(tool.name, tool.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `se alcanzó el límite de ${MAX_ITERATIONS} iteraciones del agente sin borrador final`,
        toolCalls,
      },
      { status: 502 }
    );
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "rate limit de la API de Claude — reintentá en unos minutos" },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY inválida" },
        { status: 500 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { ok: false, error: `error de la API de Claude (${err.status}): ${err.message}` },
        { status: 502 }
      );
    }
    console.error("Unexpected AI generation error", err);
    return NextResponse.json(
      { ok: false, error: "error interno al generar el borrador" },
      { status: 500 }
    );
  }
}
