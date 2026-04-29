/**
 * AnalysisPanel
 * Panel académico lateral — comparador Dijkstra vs A* + tráfico/clima.
 */
import { cn } from "@/lib/utils";

interface AnalysisPanelProps {
  algorithm: "astar" | "dijkstra";
  onAlgorithmChange: (a: "astar" | "dijkstra") => void;
}

const METRICS = {
  astar: {
    nodes: 482,
    time: "12.4 ms",
    cost: 84.5,
    heur: "Manhattan",
    eff: "94.2%",
  },
  dijkstra: {
    nodes: 1482,
    time: "28.1 ms",
    cost: 84.5,
    heur: "—",
    eff: "100%",
  },
};

const TRAFFIC_EDGES = [
  { name: "Av. Gran Colombia", weight: 1.8, level: "mid" as const },
  { name: "Diag. Santander", weight: 3.4, level: "heavy" as const },
  { name: "Canal Bogotá", weight: 0.9, level: "free" as const },
  { name: "Av. Libertadores", weight: 2.1, level: "mid" as const },
  { name: "Calle 10", weight: 1.2, level: "free" as const },
];

const trafficClass = {
  free: "text-traffic-free",
  mid: "text-traffic-mid",
  heavy: "text-traffic-heavy",
};

export function AnalysisPanel({ algorithm, onAlgorithmChange }: AnalysisPanelProps) {
  const m = METRICS[algorithm];

  return (
    <aside className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface shadow-panel">
      {/* Header */}
      <header className="border-b border-border bg-gradient-paper px-7 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Graph Theory Lab
            </p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">
              Pathfinding Telemetry
            </h1>
          </div>
          <div className="rounded border border-border bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            v0.1 · UFPS
          </div>
        </div>
      </header>

      {/* Selector algoritmo */}
      <section className="border-b border-border px-7 py-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Heuristic Engine
          </h2>
          <span className="rounded bg-traffic-free/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-traffic-free">
            Graph loaded
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-paper p-1">
          <AlgoBtn
            active={algorithm === "astar"}
            label="A* Search"
            sub="g(n) + h(n)"
            color="astar"
            onClick={() => onAlgorithmChange("astar")}
          />
          <AlgoBtn
            active={algorithm === "dijkstra"}
            label="Dijkstra"
            sub="∑ w(e)"
            color="dijkstra"
            onClick={() => onAlgorithmChange("dijkstra")}
          />
        </div>
      </section>

      {/* Métricas */}
      <section className="border-b border-border px-7 py-5">
        <h2 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          Algorithm Telemetry
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Metric label="Nodos evaluados" value={m.nodes.toLocaleString("es-CO")} />
          <Metric label="Tiempo cómputo" value={m.time} accent />
          <Metric label="Costo total f(n)" value={m.cost.toString()} suffix="w" />
          <Metric label="Eficiencia" value={m.eff} />
          <Metric label="Heurística" value={m.heur} />
          <Metric label="Aristas |E|" value="1.842" />
        </div>

        {/* Bar chart comparativa */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            <span>Nodos visitados</span>
            <span>menor = mejor</span>
          </div>
          <CompareBar label="A*" value={482} max={1482} color="bg-algo-astar" />
          <CompareBar
            label="Dijkstra"
            value={1482}
            max={1482}
            color="bg-algo-dijkstra"
          />
        </div>
      </section>

      {/* Tráfico vivo */}
      <section className="flex-1 overflow-y-auto px-7 py-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Edge Traffic Weights
          </h2>
          <span className="flex items-center gap-1 font-mono text-[9px] font-medium uppercase tracking-wider text-traffic-mid">
            <span className="size-1.5 animate-blink rounded-full bg-traffic-mid" />
            Live
          </span>
        </div>
        <ul className="space-y-1.5">
          {TRAFFIC_EDGES.map((e) => (
            <li
              key={e.name}
              className="flex items-center justify-between rounded border border-border bg-paper px-3 py-2"
            >
              <span className="text-xs font-medium text-ink">{e.name}</span>
              <div className="flex items-center gap-3">
                <span className={cn("font-mono text-xs font-semibold", trafficClass[e.level])}>
                  {e.weight.toFixed(1)}w
                </span>
                <TrafficBars level={e.level} />
              </div>
            </li>
          ))}
        </ul>

        {/* Clima */}
        <div className="mt-5 rounded-lg border border-border bg-gradient-paper p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">
                Condiciones meteorológicas
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                Soleado · 28° · Visibilidad alta
              </p>
            </div>
            <div className="font-mono text-2xl">☀</div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            Factor climático aplicado al peso de aristas:{" "}
            <span className="font-mono font-semibold text-ink">×1.00</span>
          </p>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-border bg-paper px-7 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
        <span>
          UFPS · ISC · <span className="text-ink">2026</span>
        </span>
        <span>f(n) = αd + βt</span>
      </footer>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function AlgoBtn({
  active,
  label,
  sub,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  sub: string;
  color: "astar" | "dijkstra";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group rounded-md px-3 py-2.5 text-left transition",
        active
          ? "border border-border bg-surface shadow-card"
          : "border border-transparent text-ink-muted hover:bg-surface/60"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            color === "astar" ? "bg-algo-astar" : "bg-algo-dijkstra",
            !active && "opacity-40"
          )}
        />
        <span className={cn("text-sm font-semibold", active ? "text-ink" : "text-ink-muted")}>
          {label}
        </span>
      </div>
      <p className="mt-0.5 pl-3.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {sub}
      </p>
    </button>
  );
}

function Metric({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-base font-semibold tabular-nums",
          accent ? "text-primary" : "text-ink"
        )}
      >
        {value}
        {suffix && <span className="ml-1 text-xs font-medium text-ink-muted">{suffix}</span>}
      </p>
    </div>
  );
}

function CompareBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] tabular-nums text-ink">
        <span className="font-semibold">{label}</span>
        <span className="text-ink-muted">{value.toLocaleString("es-CO")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrafficBars({ level }: { level: "free" | "mid" | "heavy" }) {
  const filled = level === "free" ? 1 : level === "mid" ? 2 : 3;
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "block w-1 rounded-sm",
            i === 1 && "h-1.5",
            i === 2 && "h-2.5",
            i === 3 && "h-3.5",
            i <= filled
              ? level === "free"
                ? "bg-traffic-free"
                : level === "mid"
                  ? "bg-traffic-mid"
                  : "bg-traffic-heavy"
              : "bg-border"
          )}
        />
      ))}
    </div>
  );
}
