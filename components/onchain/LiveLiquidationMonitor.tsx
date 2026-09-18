"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { CHART_THEME, STATUS, TOOLTIP_STYLE } from "@/lib/palette";

type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

type RawLiquidation = {
  T: number;
  s: string;
  S: "Buy" | "Sell";
  v: string;
  p: string;
};

type StreamMessage = {
  topic?: string;
  data?: RawLiquidation[];
};

type Liquidation = {
  id: string;
  time: number;
  price: number;
  sizeBtc: number;
  notionalUsd: number;
  position: "long" | "short";
};

const compactUsd = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function useBybitLiquidations() {
  const [events, setEvents] = useState<Liquidation[]>([]);
  const [status, setStatus] = useState<ConnectionState>("connecting");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setStatus((current) => current === "connecting" ? "connecting" : "reconnecting");
      socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");

      socket.onopen = () => {
        setStatus("live");
        socket?.send(JSON.stringify({ op: "subscribe", args: ["allLiquidation.BTCUSDT"] }));
        heartbeat = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: "ping" }));
        }, 20_000);
      };

      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(String(message.data)) as StreamMessage;
          if (payload.topic !== "allLiquidation.BTCUSDT" || !Array.isArray(payload.data)) return;
          const next = payload.data.flatMap((item): Liquidation[] => {
            const price = Number(item.p);
            const sizeBtc = Number(item.v);
            if (!Number.isFinite(price) || !Number.isFinite(sizeBtc) || price <= 0 || sizeBtc <= 0) return [];
            return [{
              id: `${item.T}-${item.S}-${item.p}-${item.v}`,
              time: item.T,
              price,
              sizeBtc,
              notionalUsd: price * sizeBtc,
              // Bybit documenta Buy como una posición long liquidada.
              position: item.S === "Buy" ? "long" : "short",
            }];
          });
          if (next.length > 0) {
            setEvents((current) => [...current, ...next].slice(-400));
          }
        } catch {
          // Los mensajes de control (pong/subscribe) no contienen liquidaciones.
        }
      };

      socket.onerror = () => setStatus("offline");
      socket.onclose = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (!stopped) {
          setStatus("reconnecting");
          reconnect = setTimeout(connect, 4_000);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (heartbeat) clearInterval(heartbeat);
      if (reconnect) clearTimeout(reconnect);
      socket?.close();
    };
  }, []);

  return { events, status };
}

function LiquidationTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Liquidation }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      <p className="font-medium">{point.position === "long" ? "Long liquidado" : "Short liquidado"}</p>
      <p className="tabular-nums">{compactUsd.format(point.notionalUsd)}</p>
      <p className="text-[10px] text-ink-muted">
        {point.sizeBtc.toFixed(4)} BTC · ${point.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

export function LiveLiquidationMonitor({ markPrice }: { markPrice: number }) {
  const { events, status } = useBybitLiquidations();
  const longs = useMemo(() => events.filter((event) => event.position === "long"), [events]);
  const shorts = useMemo(() => events.filter((event) => event.position === "short"), [events]);
  const totalLong = longs.reduce((sum, event) => sum + event.notionalUsd, 0);
  const totalShort = shorts.reduce((sum, event) => sum + event.notionalUsd, 0);
  const firstTime = events[0]?.time ?? 0;
  const lastEventTime = events.at(-1)?.time ?? firstTime;
  const lastTime = lastEventTime > firstTime ? lastEventTime : firstTime + 60_000;
  const observedPrices = events.map((event) => event.price);
  const minPrice = Math.min(markPrice * 0.97, ...observedPrices);
  const maxPrice = Math.max(markPrice * 1.03, ...observedPrices);
  const statusLabel: Record<ConnectionState, string> = {
    connecting: "conectando",
    live: "en vivo",
    reconnecting: "reconectando",
    offline: "sin conexión",
  };

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Liquidaciones observadas</h3>
            <span className={`inline-flex items-center gap-1 text-[10px] ${status === "live" ? "text-up" : "text-warn"}`}>
              <i className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "animate-pulse bg-up" : "bg-warn"}`} />
              {statusLabel[status]}
            </span>
          </div>
          <p className="text-xs text-ink-secondary">BTCUSDT en Bybit desde que se abrió esta pantalla.</p>
        </div>
        <div className="flex gap-4 text-right text-[10px]">
          <div>
            <p className="text-ink-muted">LONGS</p>
            <p className="font-semibold tabular-nums text-down">{compactUsd.format(totalLong)}</p>
          </div>
          <div>
            <p className="text-ink-muted">SHORTS</p>
            <p className="font-semibold tabular-nums text-up">{compactUsd.format(totalShort)}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 h-64">
        {events.length === 0 ? (
          <div className="bf-grid-bg flex h-full flex-col items-center justify-center rounded border border-line/60 text-center">
            <p className="text-sm text-ink-secondary">Escuchando nuevas liquidaciones…</p>
            <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-ink-muted">
              No se rellena con historial simulado. Los puntos aparecerán cuando Bybit reporte una liquidación durante esta sesión.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 10, bottom: 0, left: 4 }}>
              <CartesianGrid stroke={CHART_THEME.grid} />
              <XAxis
                type="number"
                dataKey="time"
                domain={[firstTime, lastTime]}
                scale="time"
                tick={{ fontSize: 10, fill: CHART_THEME.axis }}
                tickFormatter={(value: number) => new Date(value).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
                tickLine={false}
                axisLine={{ stroke: CHART_THEME.grid }}
              />
              <YAxis
                type="number"
                dataKey="price"
                domain={[minPrice, maxPrice]}
                tick={{ fontSize: 10, fill: CHART_THEME.axis }}
                tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <ZAxis type="number" dataKey="notionalUsd" range={[36, 420]} />
              <Tooltip content={<LiquidationTooltip />} />
              <Scatter name="Long liquidado" data={longs} fill={STATUS.down} fillOpacity={0.72} />
              <Scatter name="Short liquidado" data={shorts} fill={STATUS.up} fillOpacity={0.72} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
        El tamaño de cada burbuja representa nocional estimado (precio de quiebra × BTC). Fuente: Bybit All Liquidation WebSocket · frecuencia 500 ms.
      </p>
    </section>
  );
}
