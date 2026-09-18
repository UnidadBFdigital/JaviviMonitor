import cbdcJson from "@/data/cbdc-tracker.json";
import worldLand from "@/data/world-land.json";

// Mapa mundi de estados por jurisdicción. La silueta continental viene de
// Natural Earth (dominio público), ya decodificada de TopoJSON y simplificada
// en data/world-land.json: el mapa no depende de ninguna librería de mapas ni
// de descargar nada en runtime.
//
// Advertencia que la página mantiene: el tracker sigue 12 jurisdicciones, no
// las 146 que exploran una CBDC. El mapa ubica; no mide cobertura.

const STATUS_COLOR: Record<string, string> = {
  Lanzado: "#16c784",
  Piloto: "#2f66ff",
  Desarrollo: "#f59e0b",
  Investigación: "#8e9ba5",
  Descartado: "#ea3943",
};

const W = 1000;
const H = 480;
// Recorte estándar: se deja fuera la Antártida, que no aporta nada acá y
// gastaría un tercio del alto.
const LAT_TOP = 84;
const LAT_BOTTOM = -58;

function px(lon: number): number {
  return ((lon + 180) / 360) * W;
}
function py(lat: number): number {
  return ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H;
}

/** Silueta continental como un único path: menos nodos que 63 paths sueltos. */
const LAND_PATH = (worldLand.rings as [number, number][][])
  .map((ring) => ring.map(([lo, la], i) => `${i ? "L" : "M"}${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join("") + "Z")
  .join("");

type Placed = { x: number; y: number; w: number; h: number };

/** Coloca la etiqueta en el primer hueco libre alrededor del punto. Con
 *  Europa concentrando cuatro jurisdicciones, alternar arriba/abajo no
 *  alcanzaba: se superponían. */
function place(cx: number, cy: number, textW: number, taken: Placed[]) {
  const H_LABEL = 24;
  const candidatos = [
    { dx: 0, dy: 18, anchor: "middle" as const },
    { dx: 0, dy: -26, anchor: "middle" as const },
    { dx: 11, dy: 4, anchor: "start" as const },
    { dx: -11, dy: 4, anchor: "end" as const },
    { dx: 0, dy: 40, anchor: "middle" as const },
    { dx: 0, dy: -48, anchor: "middle" as const },
    { dx: 11, dy: 26, anchor: "start" as const },
    { dx: -11, dy: 26, anchor: "end" as const },
  ];
  for (const c of candidatos) {
    const x = cx + c.dx - (c.anchor === "middle" ? textW / 2 : c.anchor === "end" ? textW : 0);
    const box = { x, y: cy + c.dy - 11, w: textW, h: H_LABEL };
    const choca = taken.some(
      (t) => box.x < t.x + t.w && box.x + box.w > t.x && box.y < t.y + t.h && box.y + box.h > t.y
    );
    if (!choca) {
      taken.push(box);
      return { ...c, x: cx + c.dx, y: cy + c.dy };
    }
  }
  const f = candidatos[0];
  return { ...f, x: cx + f.dx, y: cy + f.dy };
}

export function CbdcMap() {
  const { jurisdictions } = cbdcJson;

  // se colocan de mayor a menor avance: los lanzados ganan el mejor hueco
  const orden = ["Lanzado", "Piloto", "Desarrollo", "Investigación", "Descartado"];
  const puntos = [...jurisdictions]
    .sort((a, b) => orden.indexOf(a.status) - orden.indexOf(b.status))
    .map((j) => ({ ...j, cx: px(j.lon), cy: py(j.lat) }));

  // Los marcadores se reservan ANTES de colocar etiquetas: si no, una
  // etiqueta puede caer justo encima del punto de otra jurisdicción — pasaba
  // con Jamaica sobre el rótulo de Bahamas.
  const taken: Placed[] = puntos.map((p) => ({
    x: p.cx - 11,
    y: p.cy - 11,
    w: 22,
    h: 22,
  }));
  const etiquetados = puntos.map((p) => ({
    ...p,
    label: place(p.cx, p.cy, p.jurisdiction.length * 6.1 + 6, taken),
  }));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Mapa de estados por jurisdicción</h3>
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(STATUS_COLOR).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-[10px] text-ink-secondary">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {status}
            </span>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-ink-secondary">
        Las {jurisdictions.length} jurisdicciones que sigue este tracker, ubicadas por coordenadas.
      </p>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[700px]" role="img">
          <title>Mapa mundial con la ubicación y el estado del proyecto CBDC de cada jurisdicción</title>

          {/* paralelos y meridianos: referencia sin competir con la tierra */}
          {[-120, -60, 0, 60, 120].map((lon) => (
            <line
              key={`m${lon}`}
              x1={px(lon)}
              y1={0}
              x2={px(lon)}
              y2={H}
              stroke="#222628"
              strokeWidth={1}
            />
          ))}
          {[60, 30, 0, -30].map((lat) => (
            <line
              key={`p${lat}`}
              x1={0}
              y1={py(lat)}
              x2={W}
              y2={py(lat)}
              stroke={lat === 0 ? "#2e3234" : "#222628"}
              strokeWidth={lat === 0 ? 1.2 : 1}
              strokeDasharray={lat === 0 ? undefined : "3 6"}
            />
          ))}

          {/* silueta continental */}
          <path d={LAND_PATH} fill="#1e2225" stroke="#31363a" strokeWidth={0.7} fillRule="evenodd" />

          {/* jurisdicciones */}
          {etiquetados.map((j) => {
            const color = STATUS_COLOR[j.status] ?? "#8e9ba5";
            return (
              <g key={j.jurisdiction}>
                {/* línea guía cuando la etiqueta se alejó del punto */}
                {Math.abs(j.label.dy) > 20 && (
                  <line
                    x1={j.cx}
                    y1={j.cy}
                    x2={j.label.x}
                    y2={j.label.y - (j.label.dy > 0 ? 9 : -4)}
                    stroke={color}
                    strokeWidth={0.8}
                    opacity={0.5}
                  />
                )}
                <circle cx={j.cx} cy={j.cy} r={10} fill={color} opacity={0.16} />
                <circle
                  cx={j.cx}
                  cy={j.cy}
                  r={4.5}
                  fill={color}
                  stroke="#14171b"
                  strokeWidth={1.5}
                />
                <text
                  x={j.label.x}
                  y={j.label.y}
                  textAnchor={j.label.anchor}
                  fill="#e8edf2"
                  fontSize={10.5}
                  fontWeight={600}
                  paintOrder="stroke"
                  stroke="#14171b"
                  strokeWidth={3}
                  strokeLinejoin="round"
                >
                  {j.jurisdiction}
                </text>
                <text
                  x={j.label.x}
                  y={j.label.y + 11}
                  textAnchor={j.label.anchor}
                  fill={color}
                  fontSize={9}
                  paintOrder="stroke"
                  stroke="#14171b"
                  strokeWidth={3}
                  strokeLinejoin="round"
                >
                  {j.project === "—" ? j.status : j.project}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        Silueta continental de Natural Earth (dominio público), simplificada y servida desde el
        proyecto — sin librerías de mapas. El tracker sigue {jurisdictions.length} jurisdicciones: el
        mapa las ubica, no mide cobertura global. El universo real son 146 países explorando una
        CBDC.
      </p>
    </section>
  );
}
