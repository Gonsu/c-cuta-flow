/**
 * MapGraph
 * Visualización abstracta del grafo dirigido sobre la "ciudad".
 * Muestra nodos (intersecciones), aristas (vías) con peso de tráfico,
 * y resalta la ruta óptima calculada hacia UFPS.
 */
import { cn } from "@/lib/utils";

type NodeKind = "origin" | "intersection" | "destination";

interface NodeDef {
  id: string;
  x: number; // %
  y: number; // %
  kind: NodeKind;
  label?: string;
}

interface EdgeDef {
  from: string;
  to: string;
  traffic: "free" | "mid" | "heavy";
  active?: boolean;
}

const NODES: NodeDef[] = [
  { id: "A", x: 8, y: 78, kind: "origin", label: "Origen" },
  { id: "B", x: 22, y: 58, kind: "intersection" },
  { id: "C", x: 36, y: 72, kind: "intersection" },
  { id: "D", x: 44, y: 42, kind: "intersection" },
  { id: "E", x: 60, y: 56, kind: "intersection" },
  { id: "F", x: 68, y: 30, kind: "intersection" },
  { id: "G", x: 82, y: 44, kind: "intersection" },
  { id: "H", x: 92, y: 22, kind: "destination", label: "UFPS" },
];

const EDGES: EdgeDef[] = [
  { from: "A", to: "B", traffic: "free", active: true },
  { from: "B", to: "D", traffic: "mid", active: true },
  { from: "D", to: "F", traffic: "free", active: true },
  { from: "F", to: "H", traffic: "free", active: true },
  { from: "B", to: "C", traffic: "heavy" },
  { from: "C", to: "E", traffic: "heavy" },
  { from: "E", to: "G", traffic: "mid" },
  { from: "G", to: "H", traffic: "mid" },
  { from: "D", to: "E", traffic: "mid" },
];

const trafficColor: Record<EdgeDef["traffic"], string> = {
  free: "hsl(var(--traffic-free))",
  mid: "hsl(var(--traffic-mid))",
  heavy: "hsl(var(--traffic-heavy))",
};

interface MapGraphProps {
  className?: string;
  algorithm?: "astar" | "dijkstra";
}

export function MapGraph({ className, algorithm = "astar" }: MapGraphProps) {
  const nodeMap = new Map(NODES.map((n) => [n.id, n]));
  const activeColor = algorithm === "astar" ? "hsl(var(--algo-astar))" : "hsl(var(--algo-dijkstra))";

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-paper", className)}>
      {/* Grid algorítmica */}
      <div className="absolute inset-0 bg-grid mask-radial opacity-70" />
      <div className="absolute inset-0 bg-grid-fine mask-radial opacity-30" />

      {/* Marca de cuadrante */}
      <div className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-widest text-ink-subtle">
        N · 7.9015° &nbsp; W · 72.4883°
      </div>
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded border border-border bg-surface/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted shadow-card backdrop-blur">
        <span className="size-1.5 animate-blink rounded-full bg-traffic-free" />
        Live · Cúcuta_Grid_v1
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* Aristas inactivas */}
        {EDGES.filter((e) => !e.active).map((e, i) => {
          const a = nodeMap.get(e.from)!;
          const b = nodeMap.get(e.to)!;
          return (
            <line
              key={`bg-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={trafficColor[e.traffic]}
              strokeOpacity={0.35}
              strokeWidth={0.6}
              strokeLinecap="round"
            />
          );
        })}

        {/* Halo ruta activa */}
        {EDGES.filter((e) => e.active).map((e, i) => {
          const a = nodeMap.get(e.from)!;
          const b = nodeMap.get(e.to)!;
          return (
            <line
              key={`halo-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={activeColor}
              strokeOpacity={0.18}
              strokeWidth={3.4}
              strokeLinecap="round"
            />
          );
        })}

        {/* Aristas activas */}
        {EDGES.filter((e) => e.active).map((e, i) => {
          const a = nodeMap.get(e.from)!;
          const b = nodeMap.get(e.to)!;
          return (
            <line
              key={`act-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={activeColor}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          );
        })}

        {/* Línea animada de "exploración" */}
        {EDGES.filter((e) => e.active).map((e, i) => {
          const a = nodeMap.get(e.from)!;
          const b = nodeMap.get(e.to)!;
          return (
            <line
              key={`anim-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="hsl(var(--surface))"
              strokeWidth={0.6}
              strokeDasharray="1.2 2.4"
              className="animate-dash"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Nodos */}
      {NODES.map((n) => {
        const isOrigin = n.kind === "origin";
        const isDest = n.kind === "destination";
        return (
          <div
            key={n.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            {isDest ? (
              <div className="relative">
                <div className="flex size-8 animate-pulse-node items-center justify-center rounded-full border-[3px] border-surface bg-primary text-[10px] font-bold tracking-tighter text-primary-foreground shadow-elevated">
                  U
                </div>
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-primary-foreground shadow-card">
                  UFPS
                </div>
              </div>
            ) : isOrigin ? (
              <div className="relative">
                <div className="size-5 rounded-full border-[3px] border-ink bg-surface shadow-card" />
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink shadow-card">
                  Origen
                </div>
              </div>
            ) : (
              <div className="size-2.5 rounded-full border-2 border-ink bg-surface" />
            )}
          </div>
        );
      })}

      {/* Leyenda */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-md border border-border bg-surface/90 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted shadow-card backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="block h-1 w-3 rounded-full bg-traffic-free" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block h-1 w-3 rounded-full bg-traffic-mid" /> Medio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block h-1 w-3 rounded-full bg-traffic-heavy" /> Pesado
        </span>
      </div>

      {/* Controles */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
        <button className="size-9 rounded-md border border-border bg-surface font-mono text-base leading-none text-ink shadow-card transition hover:bg-paper">
          +
        </button>
        <button className="size-9 rounded-md border border-border bg-surface font-mono text-base leading-none text-ink shadow-card transition hover:bg-paper">
          −
        </button>
      </div>
    </div>
  );
}
