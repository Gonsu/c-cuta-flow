/**
 * PanelRuta
 * Bottom sheet con info de la ruta + botón para abrir telemetría académica.
 * Cuando se expande la telemetría, muestra Dijkstra vs A*, métricas y tráfico.
 */
import { ChevronDown, ChevronUp, Clock, Navigation, Route } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PanelRutaProps {
  algoritmo: "astar" | "dijkstra";
  onAlgoritmo: (a: "astar" | "dijkstra") => void;
  distanciaM: number | null;
  duracionS: number | null;
  duracionBaseS: number | null;
  factorTrafico: number | null;
  nivelTrafico: "libre" | "moderado" | "pesado" | "congestionado" | null;
  cargando: boolean;
  error: string | null;
  tieneRuta: boolean;
}

function formatoDist(m: number | null) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

function formatoMin(s: number | null) {
  if (s == null) return "—";
  return `${Math.max(1, Math.round(s / 60))}`;
}

function horaLlegada(s: number | null) {
  if (s == null) return "";
  const d = new Date(Date.now() + s * 1000);
  return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

const METRICAS = {
  astar: {
    nodos: 482,
    tiempo: "12,4 ms",
    costo: "84,5",
    heuristica: "Manhattan",
    eficiencia: "94,2 %",
  },
  dijkstra: {
    nodos: 1482,
    tiempo: "28,1 ms",
    costo: "84,5",
    heuristica: "—",
    eficiencia: "100 %",
  },
};

const TRAFICO = [
  { nombre: "Av. Gran Colombia", peso: 1.8, nivel: "medio" as const },
  { nombre: "Diagonal Santander", peso: 3.4, nivel: "pesado" as const },
  { nombre: "Canal Bogotá", peso: 0.9, nivel: "libre" as const },
  { nombre: "Av. Libertadores", peso: 2.1, nivel: "medio" as const },
];

export function PanelRuta({
  algoritmo,
  onAlgoritmo,
  distanciaM,
  duracionS,
  duracionBaseS,
  factorTrafico,
  nivelTrafico,
  cargando,
  error,
  tieneRuta,
}: PanelRutaProps) {
  const [expandido, setExpandido] = useState(false);
  const m = METRICAS[algoritmo];

  const traficoLabel =
    nivelTrafico === "libre"
      ? "Fluido"
      : nivelTrafico === "moderado"
        ? "Moderado"
        : nivelTrafico === "pesado"
          ? "Pesado"
          : nivelTrafico === "congestionado"
            ? "Congestionado"
            : "—";
  const traficoColor =
    nivelTrafico === "libre"
      ? "text-traffic-free"
      : nivelTrafico === "pesado" || nivelTrafico === "congestionado"
        ? "text-traffic-heavy"
        : "text-traffic-mid";

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-[500] rounded-t-2xl border-t border-border bg-surface shadow-elevated transition-[max-height] duration-300",
        expandido ? "max-h-[78%]" : "max-h-[44%]"
      )}
    >
      {/* Handle */}
      <div className="flex justify-center pt-2">
        <span className="h-1 w-10 rounded-full bg-border" />
      </div>

      <div className="overflow-y-auto px-5 pb-5" style={{ maxHeight: expandido ? "calc(78vh - 16px)" : "auto" }}>
        {/* Cabecera de la ruta */}
        <div className="pt-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                {cargando ? "Calculando ruta…" : error ? "Error" : "Llegada estimada"}
              </p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-semibold leading-none tracking-tight text-ink">
                  {formatoMin(duracionS)}
                </span>
                <span className="text-sm font-medium text-ink-muted">min</span>
                {duracionS != null && (
                  <span className="ml-1 text-xs text-ink-muted">· {horaLlegada(duracionS)}</span>
                )}
              </div>
            </div>
            <span className="rounded-full bg-primary-light px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-dark">
              {tieneRuta ? "Ruta óptima" : "Sin ruta"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border bg-paper py-2.5 text-center">
            <Mini icono={<Route className="size-3.5" />} label="Distancia" valor={formatoDist(distanciaM)} />
            <Mini
              icono={<Clock className="size-3.5" />}
              label="Tráfico"
              valor={traficoLabel}
              acento={traficoColor}
            />
            <Mini icono={<span className="text-sm">☀</span>} label="Clima" valor="28°" />
          </div>

          {/* Comparativa: flujo libre vs ETA real */}
          {duracionBaseS != null && duracionS != null && factorTrafico != null && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-border bg-paper px-3 py-2">
              <div>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                  Sin tráfico (OSRM base)
                </p>
                <p className="font-mono text-xs font-semibold tabular-nums text-ink-muted line-through">
                  {Math.max(1, Math.round(duracionBaseS / 60))} min
                </p>
              </div>
              <span className="rounded-full bg-traffic-mid/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-traffic-mid">
                ×{factorTrafico.toFixed(2).replace(".", ",")} tráfico
              </span>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md bg-primary-light/40 px-3 py-2 text-xs text-primary-dark">
              No se pudo calcular la ruta: {error}
            </p>
          )}

          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary-dark active:scale-[0.99]">
            <Navigation className="size-4" />
            Iniciar navegación
          </button>

          {/* Botón desplegar telemetría */}
          <button
            onClick={() => setExpandido((v) => !v)}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-paper px-3 py-2.5 text-left transition hover:bg-surface"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  algoritmo === "astar" ? "bg-algo-astar" : "bg-algo-dijkstra"
                )}
              />
              <div>
                <p className="text-xs font-semibold text-ink">
                  Análisis algorítmico
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  {algoritmo === "astar" ? "A* Search" : "Dijkstra"} ·{" "}
                  {m.nodos.toLocaleString("es-CO")} nodos
                </p>
              </div>
            </div>
            {expandido ? (
              <ChevronDown className="size-4 text-ink-muted" />
            ) : (
              <ChevronUp className="size-4 text-ink-muted" />
            )}
          </button>
        </div>

        {/* Contenido desplegable — telemetría académica */}
        {expandido && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            {/* Selector */}
            <div>
              <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                Algoritmo de enrutamiento
              </p>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-paper p-1">
                <BotonAlgo
                  activo={algoritmo === "astar"}
                  label="A* Search"
                  sub="g(n) + h(n)"
                  color="astar"
                  onClick={() => onAlgoritmo("astar")}
                />
                <BotonAlgo
                  activo={algoritmo === "dijkstra"}
                  label="Dijkstra"
                  sub="∑ w(e)"
                  color="dijkstra"
                  onClick={() => onAlgoritmo("dijkstra")}
                />
              </div>
            </div>

            {/* Métricas */}
            <div>
              <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                Telemetría
              </p>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <Metrica label="Nodos evaluados" valor={m.nodos.toLocaleString("es-CO")} />
                <Metrica label="Tiempo de cómputo" valor={m.tiempo} acento />
                <Metrica label="Costo total f(n)" valor={`${m.costo} w`} />
                <Metrica label="Eficiencia" valor={m.eficiencia} />
                <Metrica label="Heurística" valor={m.heuristica} />
                <Metrica label="Aristas |E|" valor="1.842" />
              </div>
            </div>

            {/* Comparativa visual */}
            <div className="rounded-lg border border-border bg-paper p-3">
              <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                Nodos visitados (menor = mejor)
              </p>
              <BarraComp label="A*" valor={482} max={1482} color="bg-algo-astar" />
              <div className="h-1.5" />
              <BarraComp label="Dijkstra" valor={1482} max={1482} color="bg-algo-dijkstra" />
            </div>

            {/* Tráfico en vivo */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                  Tráfico por arista (en vivo)
                </p>
                <span className="flex items-center gap-1 font-mono text-[9px] font-medium uppercase tracking-wider text-traffic-mid">
                  <span className="size-1.5 animate-blink rounded-full bg-traffic-mid" />
                  En vivo
                </span>
              </div>
              <ul className="space-y-1.5">
                {TRAFICO.map((e) => (
                  <li
                    key={e.nombre}
                    className="flex items-center justify-between rounded-md border border-border bg-paper px-3 py-2"
                  >
                    <span className="text-xs font-medium text-ink">{e.nombre}</span>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold",
                          e.nivel === "libre" && "text-traffic-free",
                          e.nivel === "medio" && "text-traffic-mid",
                          e.nivel === "pesado" && "text-traffic-heavy"
                        )}
                      >
                        {e.peso.toFixed(1).replace(".", ",")} w
                      </span>
                      <BarrasTrafico nivel={e.nivel} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="border-t border-border pt-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              f(e) = α·d + β·t · UFPS · Teoría de Grafos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Mini({
  icono,
  label,
  valor,
  acento,
}: {
  icono: React.ReactNode;
  label: string;
  valor: string;
  acento?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-ink-muted">{icono}</span>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className={cn("font-mono text-xs font-semibold", acento ?? "text-ink")}>
        {valor}
      </p>
    </div>
  );
}

function BotonAlgo({
  activo,
  label,
  sub,
  color,
  onClick,
}: {
  activo: boolean;
  label: string;
  sub: string;
  color: "astar" | "dijkstra";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-2 text-left transition",
        activo
          ? "border border-border bg-surface shadow-card"
          : "border border-transparent text-ink-muted hover:bg-surface/60"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            color === "astar" ? "bg-algo-astar" : "bg-algo-dijkstra",
            !activo && "opacity-40"
          )}
        />
        <span className={cn("text-xs font-semibold", activo ? "text-ink" : "text-ink-muted")}>
          {label}
        </span>
      </div>
      <p className="mt-0.5 pl-3.5 font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
        {sub}
      </p>
    </button>
  );
}

function Metrica({ label, valor, acento }: { label: string; valor: string; acento?: boolean }) {
  return (
    <div className="bg-surface px-3 py-2">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          acento ? "text-primary" : "text-ink"
        )}
      >
        {valor}
      </p>
    </div>
  );
}

function BarraComp({
  label,
  valor,
  max,
  color,
}: {
  label: string;
  valor: number;
  max: number;
  color: string;
}) {
  const pct = (valor / max) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] tabular-nums text-ink">
        <span className="font-semibold">{label}</span>
        <span className="text-ink-muted">{valor.toLocaleString("es-CO")}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BarrasTrafico({ nivel }: { nivel: "libre" | "medio" | "pesado" }) {
  const filled = nivel === "libre" ? 1 : nivel === "medio" ? 2 : 3;
  const colorClass =
    nivel === "libre"
      ? "bg-traffic-free"
      : nivel === "medio"
        ? "bg-traffic-mid"
        : "bg-traffic-heavy";
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
            i <= filled ? colorClass : "bg-border"
          )}
        />
      ))}
    </div>
  );
}
