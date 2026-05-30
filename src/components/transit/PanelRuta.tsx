/**
 * PanelRuta
 * Bottom sheet con info de la ruta + telemetría académica.
 * Incluye toggle de "Modo en vivo" (refresca semáforos/clima/ETA) y
 * "Preferir evitar semáforos" con comparación directa vs ruta normal.
 */
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Heart,
  Navigation,
  Radio,
  Route,
  Square,
  TrafficCone,
  TrafficCone as ConeIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ClimaCucuta, RutaCalculada } from "@/lib/routing";

interface ComparacionEvitar {
  duracion: number;
  semaforos: number;
  penalizacionSemaforosS: number;
  distancia: number;
}

interface PanelRutaProps {
  algoritmo: "astar" | "dijkstra";
  onAlgoritmo: (a: "astar" | "dijkstra") => void;
  distanciaM: number | null;
  duracionS: number | null;
  duracionBaseS: number | null;
  factorTrafico: number | null;
  nivelTrafico: "libre" | "moderado" | "pesado" | "congestionado" | null;
  semaforos: number | null;
  densidadSemaforos: number | null;
  penalizacionSemaforosS: number | null;
  clima: ClimaCucuta | null;
  cargando: boolean;
  error: string | null;
  tieneRuta: boolean;
  // Modo en vivo
  enVivo: boolean;
  onEnVivo: (v: boolean) => void;
  ultimaActualizacion: number | null;
  intervaloMs: number;
  onIntervaloMs: (ms: number) => void;
  // Evitar semáforos
  evitarSemaforos: boolean;
  onEvitarSemaforos: (v: boolean) => void;
  comparacionEvitar?: ComparacionEvitar | null;
  // Alternativas seleccionables
  rutas: RutaCalculada[];
  seleccionIdx: number;
  onSeleccionarRuta: (i: number) => void;
  // Favoritos
  esRutaFavorita: boolean;
  onToggleFavorita: () => void;
  puedeAgregarFavorita: boolean;
  // Navegación en vivo (GPS device)
  navegando: boolean;
  onIniciarNavegacion: () => void;
  onDetenerNavegacion: () => void;
  // Mostrar/ocultar bloque de datos (distancia, tráfico, clima, semáforos)
  mostrarDatos: boolean;
  onMostrarDatos: (v: boolean) => void;
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
  semaforos,
  densidadSemaforos,
  penalizacionSemaforosS,
  clima,
  cargando,
  error,
  tieneRuta,
  enVivo,
  onEnVivo,
  ultimaActualizacion,
  intervaloMs,
  onIntervaloMs,
  evitarSemaforos,
  onEvitarSemaforos,
  comparacionEvitar,
  rutas = [],
  seleccionIdx,
  onSeleccionarRuta,
  esRutaFavorita,
  onToggleFavorita,
  puedeAgregarFavorita,
  navegando,
  onIniciarNavegacion,
  onDetenerNavegacion,
  mostrarDatos,
  onMostrarDatos,
}: PanelRutaProps) {
  const [expandido, setExpandido] = useState(false);
  const m = METRICAS[algoritmo];
  const intervaloS = Math.round((intervaloMs ?? 60_000) / 1000);

  const segundosDesdeUpdate =
    ultimaActualizacion != null
      ? Math.max(0, Math.floor((Date.now() - ultimaActualizacion) / 1000))
      : null;

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
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleFavorita}
                disabled={!puedeAgregarFavorita}
                aria-label={esRutaFavorita ? "Quitar ruta de favoritos" : "Guardar ruta como favorita"}
                aria-pressed={esRutaFavorita}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border transition",
                  esRutaFavorita
                    ? "border-primary bg-primary-light/40 text-primary"
                    : "border-border bg-paper text-ink-muted hover:bg-surface",
                  !puedeAgregarFavorita && "opacity-40",
                )}
              >
                <Heart
                  className={cn("size-3.5", esRutaFavorita && "fill-current")}
                />
              </button>
              <span className="rounded-full bg-primary-light px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-dark">
                {tieneRuta ? "Ruta óptima" : "Sin ruta"}
              </span>
            </div>
          </div>

          {mostrarDatos && (
            <div className="lg:hidden">
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border bg-paper py-2.5 text-center">
                <Mini icono={<Route className="size-3.5" />} label="Distancia" valor={formatoDist(distanciaM)} />
                <Mini
                  icono={<Clock className="size-3.5" />}
                  label="Tráfico"
                  valor={traficoLabel}
                  acento={traficoColor}
                />
                <Mini
                  icono={
                    clima && clima.lluviaMmH > 0 ? (
                      <CloudRain className="size-3.5" />
                    ) : (
                      <span className="text-sm">☀</span>
                    )
                  }
                  label="Clima"
                  valor={
                    clima
                      ? `${Math.round(clima.temperaturaC)}°${
                          clima.lluviaMmH > 0
                            ? ` · ${clima.lluviaMmH.toFixed(1).replace(".", ",")}mm`
                            : ""
                        }`
                      : "—"
                  }
                  acento={
                    clima && clima.lluviaMmH >= 2.5 ? "text-primary" : undefined
                  }
                />
              </div>

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

              {(semaforos != null || clima) && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {semaforos != null && (
                    <div className="rounded-lg border border-border bg-paper p-2.5">
                      <div className="flex items-center gap-1.5">
                        <TrafficCone className="size-3 text-traffic-mid" />
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                          Semáforos OSM
                        </p>
                      </div>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                        {semaforos}
                        {densidadSemaforos != null && (
                          <span className="ml-1 text-[10px] font-medium text-ink-muted">
                            · {densidadSemaforos.toFixed(1).replace(".", ",")}/km
                          </span>
                        )}
                      </p>
                      {penalizacionSemaforosS != null && (
                        <p className="font-mono text-[10px] text-ink-muted">
                          +{Math.round(penalizacionSemaforosS)} s
                        </p>
                      )}
                    </div>
                  )}
                  {clima && (
                    <div className="rounded-lg border border-border bg-paper p-2.5">
                      <div className="flex items-center gap-1.5">
                        <CloudRain className="size-3 text-primary" />
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                          Clima · Open-Meteo
                        </p>
                      </div>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                        {clima.descripcion}
                      </p>
                      <p className="font-mono text-[10px] text-ink-muted">
                        f_clima ×{clima.factorClima.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Alternativas seleccionables — pides 2-3 caminos para escoger */}
          {rutas.length > 1 && (
            <div className="mt-3">
              <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                Caminos sugeridos · elige uno
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {rutas.slice(0, 3).map((r, i) => {
                  const activo = i === seleccionIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => onSeleccionarRuta(i)}
                      aria-pressed={activo}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                        activo
                          ? "border-primary bg-primary-light/30"
                          : "border-border bg-paper hover:bg-surface",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                            activo
                              ? "bg-primary text-primary-foreground"
                              : "bg-border text-ink-muted",
                          )}
                        >
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-[11px] font-semibold text-ink">
                            {i === 0 ? "Más rápida" : i === 1 ? "Alternativa" : "Otra opción"}
                          </p>
                          <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                            {formatoDist(r.distancia)} · {r.semaforos} sem.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                          {Math.max(1, Math.round(r.duracion / 60))} min
                        </p>
                        {i > 0 && rutas[0] && (
                          <p className="font-mono text-[9px] text-ink-muted">
                            {(() => {
                              const diff = (r.duracion - rutas[0].duracion) / 60;
                              return diff > 0
                                ? `+${diff.toFixed(1).replace(".", ",")} min`
                                : "—";
                            })()}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggles: modo en vivo + evitar semáforos */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => onEnVivo(!enVivo)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                enVivo
                  ? "border-primary bg-primary-light/40"
                  : "border-border bg-paper hover:bg-surface",
              )}
              aria-pressed={enVivo}
            >
              <div className="flex items-center gap-2">
                <Radio
                  className={cn(
                    "size-3.5",
                    enVivo ? "text-primary animate-pulse" : "text-ink-muted",
                  )}
                />
                <div>
                  <p className="text-[11px] font-semibold text-ink">En vivo</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                    {enVivo
                      ? segundosDesdeUpdate != null
                        ? `act. hace ${segundosDesdeUpdate}s`
                        : "actualizando…"
                      : `Refresca cada ${intervaloS} s`}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "h-4 w-7 rounded-full p-0.5 transition",
                  enVivo ? "bg-primary" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "block size-3 rounded-full bg-surface transition",
                    enVivo && "translate-x-3",
                  )}
                />
              </span>
            </button>

            <button
              onClick={() => onEvitarSemaforos(!evitarSemaforos)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                evitarSemaforos
                  ? "border-traffic-mid bg-traffic-mid/15"
                  : "border-border bg-paper hover:bg-surface",
              )}
              aria-pressed={evitarSemaforos}
            >
              <div className="flex items-center gap-2">
                <ConeIcon
                  className={cn(
                    "size-3.5",
                    evitarSemaforos ? "text-traffic-mid" : "text-ink-muted",
                  )}
                />
                <div>
                  <p className="text-[11px] font-semibold text-ink">Evitar semáforos</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                    Recalcular ruta
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "h-4 w-7 rounded-full p-0.5 transition",
                  evitarSemaforos ? "bg-traffic-mid" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "block size-3 rounded-full bg-surface transition",
                    evitarSemaforos && "translate-x-3",
                  )}
                />
              </span>
            </button>
          </div>

          {/* Selector de intervalo de refresco — siempre visible */}
          {(

            <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-paper px-3 py-2">
              <div>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                  Intervalo de refresco
                </p>
                <p className="font-mono text-[10px] text-ink-muted">
                  Cada {intervaloS} s — clima + semáforos + ETA
                </p>
              </div>
              <div className="flex overflow-hidden rounded-md border border-border bg-surface">
                {[15_000, 30_000, 60_000].map((ms) => {
                  const activo = intervaloMs === ms;
                  return (
                    <button
                      key={ms}
                      onClick={() => onIntervaloMs(ms)}
                      className={cn(
                        "px-2 py-1 font-mono text-[10px] font-semibold tabular-nums transition",
                        activo
                          ? "bg-primary text-primary-foreground"
                          : "text-ink hover:bg-paper",
                      )}
                    >
                      {ms / 1000}s
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comparación directa: ruta normal vs evitando semáforos */}
          {mostrarDatos &&
            evitarSemaforos &&
            comparacionEvitar &&
            duracionS != null &&
            semaforos != null && (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-2 divide-x divide-border bg-paper">
                  <div className="p-2.5">
                    <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                      Ruta normal
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      {Math.max(1, Math.round(comparacionEvitar.duracion / 60))} min
                    </p>
                    <p className="font-mono text-[10px] text-ink-muted">
                      {comparacionEvitar.semaforos} semáforos · +
                      {Math.round(comparacionEvitar.penalizacionSemaforosS)} s
                    </p>
                  </div>
                  <div className="bg-traffic-mid/5 p-2.5">
                    <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-traffic-mid">
                      Evitando semáforos
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      {Math.max(1, Math.round(duracionS / 60))} min
                    </p>
                    <p className="font-mono text-[10px] text-ink-muted">
                      {semaforos} semáforos · +
                      {Math.round(penalizacionSemaforosS ?? 0)} s
                    </p>
                  </div>
                </div>
                {(() => {
                  const diff = (comparacionEvitar.duracion - duracionS) / 60;
                  const semDiff = comparacionEvitar.semaforos - semaforos;
                  const ahorra = diff > 0.3;
                  return (
                    <div
                      className={cn(
                        "px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
                        ahorra
                          ? "bg-traffic-free/15 text-traffic-free"
                          : "bg-paper text-ink-muted",
                      )}
                    >
                      {ahorra
                        ? `Ahorras ≈ ${diff.toFixed(1).replace(".", ",")} min y ${semDiff} semáforos`
                        : `Sin ahorro significativo (${diff.toFixed(1).replace(".", ",")} min)`}
                    </div>
                  );
                })()}
              </div>
            )}

          {error && (
            <p className="mt-3 rounded-md bg-primary-light/40 px-3 py-2 text-xs text-primary-dark">
              No se pudo calcular la ruta: {error}
            </p>
          )}

          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={navegando ? onDetenerNavegacion : onIniciarNavegacion}
              disabled={!tieneRuta && !navegando}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold shadow-card transition active:scale-[0.99]",
                navegando
                  ? "bg-traffic-heavy text-paper hover:opacity-90"
                  : "bg-primary text-primary-foreground hover:bg-primary-dark",
                !tieneRuta && !navegando && "opacity-50 cursor-not-allowed",
              )}
            >
              {navegando ? (
                <>
                  <Square className="size-4 fill-current" />
                  Detener navegación
                </>
              ) : (
                <>
                  <Navigation className="size-4" />
                  Iniciar navegación
                </>
              )}
            </button>
            <button
              onClick={() => onMostrarDatos(!mostrarDatos)}
              aria-pressed={mostrarDatos}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-semibold transition",
                mostrarDatos
                  ? "border-ink bg-ink text-paper"
                  : "border-border bg-paper text-ink hover:bg-surface",
              )}
            >
              <BarChart3 className="size-4" />
              Datos
            </button>
          </div>

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
