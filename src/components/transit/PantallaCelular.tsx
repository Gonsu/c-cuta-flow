/**
 * PantallaCelular
 * Pantalla principal de la app móvil — el mapa es el protagonista.
 * Buscador arriba, panel de ruta deslizable abajo.
 */
import { useState } from "react";
import { Layers, Locate } from "lucide-react";
import { CucutaMap } from "./CucutaMap";
import { BuscadorRuta } from "./BuscadorRuta";
import { PanelRuta } from "./PanelRuta";

export function PantallaCelular() {
  const [origen, setOrigen] = useState("Ventura Plaza · Centro Comercial");
  const [destino, setDestino] = useState("UFPS · Campus Principal");
  const [algoritmo, setAlgoritmo] = useState<"astar" | "dijkstra">("astar");

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

      {/* Mapa de fondo (toda la pantalla) */}
      <div className="absolute inset-0 pt-7">
        <CucutaMap algoritmo={algoritmo} />
      </div>

      {/* Buscador superior */}
      <div className="pt-7">
        <BuscadorRuta
          origen={origen}
          destino={destino}
          onOrigen={setOrigen}
          onDestino={setDestino}
        />
      </div>

      {/* Botones flotantes laterales */}
      <div className="absolute right-3 top-44 z-[500] flex flex-col gap-2">
        <button className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-elevated transition hover:bg-paper">
          <Layers className="size-4" />
        </button>
        <button className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-elevated transition hover:bg-paper">
          <Locate className="size-4" />
        </button>
      </div>

      {/* Bottom sheet con ruta */}
      <PanelRuta algoritmo={algoritmo} onAlgoritmo={setAlgoritmo} />
    </div>
  );
}
