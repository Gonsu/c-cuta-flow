/**
 * BuscadorRuta
 * Tarjeta superior estilo Google Maps / Waze: campo "Desde" y "Hacia"
 * con sugerencias y botón para invertir. Se superpone al mapa.
 */
import { ArrowUpDown, MapPin, Navigation } from "lucide-react";
import { useState } from "react";

interface BuscadorRutaProps {
  origen: string;
  destino: string;
  onOrigen: (v: string) => void;
  onDestino: (v: string) => void;
}

const SUGERENCIAS = [
  "UFPS · Campus Principal",
  "Mi casa · Barrio Caobos",
  "Ventura Plaza · Centro Comercial",
  "Parque Santander, Centro",
  "Jardín Plaza Cúcuta",
  "Aeropuerto Camilo Daza",
];

export function BuscadorRuta({ origen, destino, onOrigen, onDestino }: BuscadorRutaProps) {
  const [foco, setFoco] = useState<"origen" | "destino" | null>(null);

  const invertir = () => {
    onOrigen(destino);
    onDestino(origen);
  };

  return (
    <div className="absolute inset-x-3 top-3 z-[500]">
      <div className="overflow-hidden rounded-xl bg-surface shadow-elevated">
        <div className="relative flex items-stretch">
          {/* Iconos verticales */}
          <div className="flex flex-col items-center justify-center px-3 py-3">
            <div className="size-2.5 rounded-full border-[2.5px] border-ink bg-surface" />
            <div className="my-1 h-5 w-px border-l border-dashed border-ink-subtle" />
            <MapPin className="size-3.5 text-primary" strokeWidth={2.5} />
          </div>

          <div className="flex-1 py-2 pr-2">
            {/* Origen */}
            <button
              onClick={() => setFoco(foco === "origen" ? null : "origen")}
              className="block w-full rounded-md px-2 py-1.5 text-left transition hover:bg-paper"
            >
              <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
                Desde
              </p>
              <p className="truncate text-sm font-medium text-ink">{origen}</p>
            </button>

            <div className="my-1 ml-2 h-px bg-border" />

            {/* Destino */}
            <button
              onClick={() => setFoco(foco === "destino" ? null : "destino")}
              className="block w-full rounded-md px-2 py-1.5 text-left transition hover:bg-paper"
            >
              <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                Hacia
              </p>
              <p className="truncate text-sm font-semibold text-ink">{destino}</p>
            </button>
          </div>

          <button
            onClick={invertir}
            className="flex w-10 items-center justify-center border-l border-border text-ink-muted transition hover:bg-paper hover:text-ink"
            aria-label="Invertir origen y destino"
          >
            <ArrowUpDown className="size-4" />
          </button>
        </div>

        {/* Sugerencias desplegables */}
        {foco && (
          <div className="border-t border-border bg-paper px-2 py-1.5">
            <p className="px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
              Sugerencias
            </p>
            <ul className="max-h-44 overflow-y-auto">
              {SUGERENCIAS.filter(
                (s) => s !== (foco === "origen" ? origen : destino)
              ).map((s) => (
                <li key={s}>
                  <button
                    onClick={() => {
                      foco === "origen" ? onOrigen(s) : onDestino(s);
                      setFoco(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-surface"
                  >
                    <Navigation className="size-3.5 shrink-0 text-ink-muted" />
                    <span className="truncate text-xs text-ink">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
