/**
 * PantallaCelular
 * Orquesta búsqueda + mapa + panel. Usa OSRM para rutas reales.
 */
import { useState } from "react";
import { Layers, Locate } from "lucide-react";
import { CucutaMap } from "./CucutaMap";
import { BuscadorRuta } from "./BuscadorRuta";
import { PanelRuta } from "./PanelRuta";
import { useRuta } from "@/hooks/useRuta";
import { reverseGeocode, type Punto } from "@/lib/routing";

const ORIGEN_DEFAULT: Punto = {
  label: "Ventura Plaza · Centro Comercial",
  lat: 7.8942,
  lng: -72.5043,
};
const DESTINO_DEFAULT: Punto = {
  label: "UFPS · Campus Principal",
  lat: 7.8995,
  lng: -72.4856,
};

export function PantallaCelular() {
  const [origen, setOrigen] = useState<Punto | null>(ORIGEN_DEFAULT);
  const [destino, setDestino] = useState<Punto | null>(DESTINO_DEFAULT);
  const [algoritmo, setAlgoritmo] = useState<"astar" | "dijkstra">("astar");
  const [modoSeleccion, setModoSeleccion] = useState<"origen" | "destino" | null>(
    null,
  );

  const { principal, alterna, cargando, error } = useRuta(origen, destino);

  const invertir = () => {
    setOrigen(destino);
    setDestino(origen);
  };

  const handleSeleccionMapa = async (lat: number, lng: number) => {
    if (!modoSeleccion) return;
    const campo = modoSeleccion;
    setModoSeleccion(null);
    const provisional: Punto = {
      label: `Punto ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng,
    };
    if (campo === "origen") setOrigen(provisional);
    else setDestino(provisional);

    try {
      const label = await reverseGeocode(lat, lng);
      const final: Punto = { label, lat, lng };
      if (campo === "origen") setOrigen(final);
      else setDestino(final);
    } catch {
      /* ignorar */
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper">
      {/* Status bar */}
      <div className="absolute inset-x-0 top-0 z-[600] flex items-center justify-between px-7 pt-3 font-mono text-[11px] font-semibold tracking-tight text-ink">
        <span>9:41</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] tracking-wider">5G</span>
          <span className="block h-2.5 w-4 rounded-sm border border-ink">
            <span className="block h-full w-3/4 bg-ink" />
          </span>
        </span>
      </div>

      {/* Mapa */}
      <div className="absolute inset-0 pt-7">
        <CucutaMap
          algoritmo={algoritmo}
          origen={origen}
          destino={destino}
          rutaPrincipal={principal?.coords ?? null}
          rutaAlterna={alterna?.coords ?? null}
          modoSeleccion={modoSeleccion}
          onSeleccionMapa={handleSeleccionMapa}
        />
      </div>

      {/* Buscador */}
      <div className="pt-7">
        <BuscadorRuta
          origen={origen}
          destino={destino}
          onOrigen={setOrigen}
          onDestino={setDestino}
          onInvertir={invertir}
          onPickEnMapa={setModoSeleccion}
          modoSeleccion={modoSeleccion}
        />
      </div>

      {/* Indicador modo selección */}
      {modoSeleccion && (
        <div className="absolute left-1/2 top-44 z-[550] -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper shadow-elevated">
          Toca el mapa para fijar {modoSeleccion}
        </div>
      )}

      {/* Botones flotantes */}
      <div className="absolute right-3 top-44 z-[500] flex flex-col gap-2">
        <button className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-elevated transition hover:bg-paper">
          <Layers className="size-4" />
        </button>
        <button className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-elevated transition hover:bg-paper">
          <Locate className="size-4" />
        </button>
      </div>

      {/* Panel inferior */}
      <PanelRuta
        algoritmo={algoritmo}
        onAlgoritmo={setAlgoritmo}
        distanciaM={principal?.distancia ?? null}
        duracionS={principal?.duracion ?? null}
        duracionBaseS={principal?.duracionBase ?? null}
        factorTrafico={principal?.factorTrafico ?? null}
        nivelTrafico={principal?.nivelTrafico ?? null}
        cargando={cargando}
        error={error}
        tieneRuta={!!principal}
      />
    </div>
  );
}
