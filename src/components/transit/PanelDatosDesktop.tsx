/**
 * PanelDatosDesktop
 * Panel lateral (≥1024px) que reemplaza al bloque "Datos" del bottom sheet
 * cuando hay espacio horizontal. Mantiene el bottom sheet en móvil.
 */
import { X, Route, Clock, CloudRain, TrafficCone, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClimaCucuta } from "@/lib/routing";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  distanciaM: number | null;
  duracionS: number | null;
  duracionBaseS: number | null;
  factorTrafico: number | null;
  nivelTrafico: "libre" | "moderado" | "pesado" | "congestionado" | null;
  semaforos: number | null;
  densidadSemaforos: number | null;
  penalizacionSemaforosS: number | null;
  clima: ClimaCucuta | null;
}

function formatoDist(m: number | null) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

function formatoMin(s: number | null) {
  if (s == null) return "—";
  return `${Math.max(1, Math.round(s / 60))} min`;
}

export function PanelDatosDesktop({
  abierto,
  onCerrar,
  distanciaM,
  duracionS,
  duracionBaseS,
  factorTrafico,
  nivelTrafico,
  semaforos,
  densidadSemaforos,
  penalizacionSemaforosS,
  clima,
}: Props) {
  if (!abierto) return null;

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
    <aside
      className="fixed right-6 top-24 z-[800] hidden max-h-[80vh] w-[440px] min-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated lg:flex"
      aria-label="Panel de datos de la ruta"
    >
      <header className="flex items-center justify-between border-b border-border bg-paper px-5 py-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Datos de la ruta
          </p>
          <h2 className="text-base font-semibold text-ink">
            {duracionS != null ? formatoMin(duracionS) : "—"}
            <span className="ml-2 font-mono text-xs font-normal text-ink-muted">
              · {formatoDist(distanciaM)}
            </span>
          </h2>
        </div>
        <button
          onClick={onCerrar}
          aria-label="Cerrar panel de datos"
          className="flex size-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-border hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          <Tarjeta
            icono={<Route className="size-4" />}
            titulo="Distancia"
            valor={formatoDist(distanciaM)}
            detalle="Trayecto total"
          />
          <Tarjeta
            icono={<Clock className="size-4" />}
            titulo="Tráfico"
            valor={traficoLabel}
            acento={traficoColor}
            detalle={
              factorTrafico != null
                ? `Factor ×${factorTrafico.toFixed(2).replace(".", ",")}`
                : "—"
            }
          />
          <Tarjeta
            icono={
              clima && clima.lluviaMmH > 0 ? (
                <CloudRain className="size-4" />
              ) : (
                <span className="text-base">☀</span>
              )
            }
            titulo="Clima"
            valor={
              clima
                ? `${Math.round(clima.temperaturaC)}°C`
                : "—"
            }
            detalle={
              clima
                ? `${clima.descripcion}${clima.lluviaMmH > 0 ? ` · ${clima.lluviaMmH.toFixed(1).replace(".", ",")} mm` : ""}`
                : "Sin datos"
            }
            acento={clima && clima.lluviaMmH >= 2.5 ? "text-primary" : undefined}
          />
          <Tarjeta
            icono={<TrafficCone className="size-4" />}
            titulo="Semáforos OSM"
            valor={semaforos != null ? String(semaforos) : "—"}
            detalle={
              densidadSemaforos != null
                ? `${densidadSemaforos.toFixed(1).replace(".", ",")} / km${
                    penalizacionSemaforosS != null
                      ? ` · +${Math.round(penalizacionSemaforosS)} s`
                      : ""
                  }`
                : "—"
            }
          />
          <Tarjeta
            className="col-span-2"
            icono={<Gauge className="size-4" />}
            titulo="ETA — flujo libre vs realista"
            valor={
              duracionS != null && duracionBaseS != null
                ? `${Math.max(1, Math.round(duracionBaseS / 60))} → ${Math.max(1, Math.round(duracionS / 60))} min`
                : "—"
            }
            detalle={
              factorTrafico != null
                ? `OSRM base · multiplicador ×${factorTrafico.toFixed(2).replace(".", ",")} (tráfico + hora + clima)`
                : "—"
            }
          />
        </div>

        {clima && (
          <p className="mt-4 rounded-md border border-dashed border-border bg-paper px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            Open-Meteo · Cúcuta · viento {clima.vientoKmH.toFixed(0)} km/h · f_clima ×
            {clima.factorClima.toFixed(2).replace(".", ",")}
          </p>
        )}
      </div>
    </aside>
  );
}

function Tarjeta({
  icono,
  titulo,
  valor,
  detalle,
  acento,
  className,
}: {
  icono: React.ReactNode;
  titulo: string;
  valor: string;
  detalle: string;
  acento?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-paper p-3.5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-ink-muted">
        {icono}
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest">
          {titulo}
        </p>
      </div>
      <p
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tabular-nums",
          acento ?? "text-ink",
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{detalle}</p>
    </div>
  );
}
