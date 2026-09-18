"use client";

// Export de gráficos: PNG (serializa el SVG del contenedor) y CSV.

const BACKGROUND = "#14171b"; // fondo card: los gráficos se dibujan transparentes

// Los gráficos en canvas (lightweight-charts) no tienen SVG que serializar:
// se registran con su propia captura. Sin esto, el export tomaba el primer
// SVG del contenedor, que en esos gráficos es el logo de atribución.
const canvasCharts = new WeakMap<Element, () => HTMLCanvasElement>();

/** Registra la captura de un gráfico en canvas; devuelve la baja. */
export function registerCanvasChart(host: Element, capture: () => HTMLCanvasElement): () => void {
  canvasCharts.set(host, capture);
  return () => canvasCharts.delete(host);
}

function exportCanvas(shot: HTMLCanvasElement, filename: string) {
  const canvas = document.createElement("canvas");
  canvas.width = shot.width;
  canvas.height = shot.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(shot, 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) return;
    triggerDownload(URL.createObjectURL(blob), `${filename}.png`);
  });
}

export function exportSvgAsPng(container: HTMLElement, filename: string) {
  const host = [...container.querySelectorAll("[data-canvas-chart]")].find((el) => canvasCharts.has(el));
  if (host) {
    exportCanvas(canvasCharts.get(host)!(), filename);
    return;
  }
  const svg = container.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const scale = 2; // export nítido
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(URL.createObjectURL(blob), `${filename}.png`);
    });
  };
  img.src = url;
}

export function exportCsv(
  rows: Record<string, unknown>[],
  filename: string
) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), `${filename}.csv`);
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
