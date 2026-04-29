/**
 * MobileNavScreen
 * Pantalla principal del mockup móvil — estilo Waze/Maps con identidad UFPS.
 */
import { MapGraph } from "./MapGraph";

export function MobileNavScreen({ algorithm }: { algorithm: "astar" | "dijkstra" }) {
  return (
    <div className="relative flex h-full flex-col bg-paper pt-8">
      {/* Header bordeaux */}
      <div className="relative bg-primary px-5 pb-4 pt-3 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary-foreground/70">
              UFPS Transit
            </p>
            <h2 className="text-base font-semibold tracking-tight">Hola, Santiago</h2>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full border border-primary-foreground/20 bg-primary-dark text-xs font-bold">
            SG
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 space-y-1.5">
          <div className="relative pl-7">
            <div className="absolute left-2 top-3 size-3 rounded-full border-[3px] border-primary-foreground/70 bg-primary" />
            <div className="absolute left-[14px] top-6 h-4 w-px bg-primary-foreground/30" />
            <div className="rounded-md bg-primary-dark/60 px-3 py-2 text-xs">
              <span className="font-mono text-[9px] uppercase tracking-wider text-primary-foreground/60">
                Desde
              </span>
              <p className="font-medium">Ventura Plaza, Centro</p>
            </div>
          </div>
          <div className="relative pl-7">
            <div className="absolute left-2 top-3 size-3 rounded-sm bg-primary-foreground" />
            <div className="rounded-md bg-surface px-3 py-2 text-xs text-ink">
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                Hacia
              </span>
              <p className="font-medium">UFPS · Campus Principal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mapa-grafo */}
      <div className="relative flex-1">
        <MapGraph algorithm={algorithm} />

        {/* Chip de algoritmo flotante */}
        <div className="absolute left-4 right-4 top-3 flex items-center justify-between rounded-md border border-border bg-surface/95 px-3 py-2 shadow-card backdrop-blur">
          <div className="flex items-center gap-2">
            <span
              className={
                "size-2 rounded-full " +
                (algorithm === "astar" ? "bg-algo-astar" : "bg-algo-dijkstra")
              }
            />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink">
              {algorithm === "astar" ? "A* Search" : "Dijkstra"}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            {algorithm === "astar" ? "482 nodos · 12ms" : "1.482 nodos · 28ms"}
          </span>
        </div>
      </div>

      {/* Bottom sheet — tarjeta de ruta */}
      <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-border bg-surface px-5 pb-6 pt-3 shadow-elevated">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />

        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">
              Llegada estimada
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-semibold leading-none tracking-tight text-ink">
                14
              </span>
              <span className="text-sm font-medium text-ink-muted">min</span>
              <span className="ml-2 text-xs text-ink-muted">· 9:55 AM</span>
            </div>
          </div>
          <div className="rounded-full bg-primary-light px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-dark">
            Óptima
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-y border-border py-3 text-center">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
              Distancia
            </p>
            <p className="font-mono text-sm font-semibold text-ink">3.2 km</p>
          </div>
          <div className="border-x border-border">
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
              Tráfico
            </p>
            <div className="mx-auto mt-1 flex w-fit items-center gap-0.5">
              <span className="block h-3 w-1.5 rounded-sm bg-traffic-free" />
              <span className="block h-3 w-1.5 rounded-sm bg-traffic-free" />
              <span className="block h-3 w-1.5 rounded-sm bg-traffic-mid" />
              <span className="block h-3 w-1.5 rounded-sm bg-border" />
            </div>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
              Clima
            </p>
            <p className="font-mono text-sm font-semibold text-ink">28° ☀</p>
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-medium text-primary">vía</span> Av. Gran Colombia →
          Diag. Santander
        </p>

        <button className="mt-3 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary-dark">
          Iniciar navegación →
        </button>
      </div>
    </div>
  );
}
