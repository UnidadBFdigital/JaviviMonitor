"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Mode = "report" | "carousel";
type Model = "haiku" | "sonnet";

type GenerateResult = {
  ok: boolean;
  draft?: string;
  toolCalls?: string[];
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; model: string };
  error?: string;
};

const TOOL_LABELS: Record<string, string> = {
  get_top_protocols: "TVL por protocolo (DeFiLlama)",
  get_tvl_history: "Histórico TVL (DeFiLlama)",
  get_protocol_revenue: "Revenue (DeFiLlama)",
  get_defi_movers: "Movers DeFi (DeFiLlama)",
  get_asset_overview: "Panorama BTC/ETH (Messari)",
  get_spot_tickers: "Precios spot (Crypto.com)",
  get_btc_daily_candles: "Velas BTC (Crypto.com)",
  get_eth_network_stats: "Red Ethereum (Blockscout)",
  get_news_headlines: "Titulares (RSS)",
  get_dex_trades: "Trades DEX (Dune)",
  get_smart_money_netflow: "Smart money (Nansen)",
  get_global_market: "Market cap global (CoinGecko)",
  get_fear_greed: "Fear & Greed (Alternative.me)",
  get_stablecoins: "Stablecoins (DeFiLlama)",
  get_dex_overview: "Volumen DEX (DeFiLlama)",
  get_chains_tvl: "TVL por chain (DeFiLlama)",
  get_institutional_news: "Noticias B2B (RSS institucional)",
  get_bolivia_news: "Prensa Bolivia (Google News)",
};

export default function ZonaIAPage() {
  const [mode, setMode] = useState<Mode>("report");
  const [model, setModel] = useState<Model>("haiku");
  const [tema, setTema] = useState("");
  const [audiencia, setAudiencia] = useState("");
  const [instrucciones, setInstrucciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, model, tema, audiencia, instrucciones }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "error de red" });
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    if (!result?.draft) return;
    await navigator.clipboard.writeText(result.draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadDraft() {
    if (!result?.draft) return;
    const name = mode === "report" ? "reporte-semanal" : "carrusel";
    const blob = new Blob([result.draft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-borrador-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        eyebrow="Research Lab"
        title="AI Workspace"
        subtitle={
          <>
            Todo lo generado acá es un <strong className="text-ink">borrador</strong> que requiere
            revisión humana antes de usarse. Nada se publica automáticamente.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Panel de configuración */}
        <section className="rounded-lg border border-line bg-card p-4 lg:col-span-1">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-muted">Tipo de contenido</p>
          <div className="mb-4 flex gap-1 rounded border border-line p-0.5">
            {(
              [
                ["report", "Reporte semanal"],
                ["carousel", "Carrusel"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded px-2 py-1.5 text-sm ${
                  mode === m ? "bg-midnight text-white" : "text-ink-secondary hover:bg-ice/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "carousel" && (
            <>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-muted">
                Tema del carrusel *
              </label>
              <input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="ej. Qué es el TVL y por qué mirarlo"
                className="mb-3 w-full rounded border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-core"
              />
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-muted">
                Audiencia objetivo
              </label>
              <input
                value={audiencia}
                onChange={(e) => setAudiencia(e.target.value)}
                placeholder="ej. empresarios bolivianos sin experiencia cripto"
                className="mb-3 w-full rounded border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-core"
              />
            </>
          )}

          <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-muted">
            Instrucciones adicionales (opcional)
          </label>
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            rows={3}
            placeholder="ej. enfocarse en el movimiento de ETH de esta semana"
            className="mb-4 w-full rounded border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-core"
          />

          <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-muted">Modelo</p>
          <div className="mb-4 flex gap-1 rounded border border-line p-0.5">
            {(
              [
                ["haiku", "Haiku · económico"],
                ["sonnet", "Sonnet · más calidad"],
              ] as [Model, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={`flex-1 rounded px-2 py-1.5 text-sm ${
                  model === m ? "bg-midnight text-white" : "text-ink-secondary hover:bg-ice/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={loading || (mode === "carousel" && !tema.trim())}
            className="w-full rounded bg-electric px-3 py-2 text-sm font-medium text-white hover:bg-core disabled:cursor-not-allowed disabled:bg-steel"
          >
            {loading ? "Consultando fuentes y redactando…" : "Generar borrador"}
          </button>
        </section>

        {/* Panel de resultado */}
        <section className="rounded-lg border border-line bg-card p-4 lg:col-span-2">
          {!result && !loading && (
            <p className="py-16 text-center text-sm text-ink-muted">
              El borrador generado aparece acá.
            </p>
          )}
          {loading && (
            <div className="space-y-2 py-8">
              <div className="h-4 w-2/3 animate-pulse rounded bg-ice/50" />
              <div className="h-4 w-full animate-pulse rounded bg-ice/50" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-ice/50" />
              <p className="pt-2 text-center text-xs text-ink-muted">
                El agente está consultando las fuentes del dashboard…
              </p>
            </div>
          )}
          {result?.ok === false && (
            <p className="py-8 text-center text-sm text-down">Error: {result.error}</p>
          )}
          {result?.ok && result.draft && (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="rounded bg-warn/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warn">
                  Borrador — pendiente de revisión humana
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={copyDraft}
                    className="rounded border border-line px-2.5 py-1 text-xs text-ink-secondary hover:bg-ice/40"
                  >
                    {copied ? "Copiado ✓" : "Copiar"}
                  </button>
                  <button
                    onClick={downloadDraft}
                    className="rounded border border-line px-2.5 py-1 text-xs text-ink-secondary hover:bg-ice/40"
                  >
                    Descargar .md
                  </button>
                </div>
              </div>
              <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded border border-line/60 bg-surface p-3 font-body text-sm leading-relaxed">
                {result.draft}
              </pre>
              <div className="mt-3 text-[11px] text-ink-muted">
                {result.toolCalls && result.toolCalls.length > 0 && (
                  <p>
                    Fuentes consultadas:{" "}
                    {[...new Set(result.toolCalls)]
                      .map((t) => TOOL_LABELS[t] ?? t)
                      .join(" · ")}
                  </p>
                )}
                {result.usage && (
                  <p className="mt-0.5">
                    {result.usage.model} · {result.usage.inputTokens.toLocaleString()} tokens in (
                    {result.usage.cacheReadTokens.toLocaleString()} de cache) ·{" "}
                    {result.usage.outputTokens.toLocaleString()} out
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
