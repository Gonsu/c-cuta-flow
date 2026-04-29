/**
 * PantallaCelular
 * Orquesta búsqueda + mapa + panel. Usa OSRM para rutas reales.
 * Incluye: capas seleccionables, geolocalización, zoom, modo en vivo y
 * comparación "evitar semáforos".
 */
import { useEffect, useRef, useState } from "react";
import { Layers, Locate, Plus, Minus, Mountain, Satellite, Bus, TrafficCone, Map as MapIcon, Star, X } from "lucide-react";
import { CucutaMap, type CucutaMapHandle, type Capa } from "./CucutaMap";
import { BuscadorRuta } from "./BuscadorRuta";
import { PanelRuta } from "./PanelRuta";
import { useRuta } from "@/hooks/useRuta";
import { useFavoritos } from "@/hooks/useFavoritos";
import {
  calcularRutaOSRM,
  reverseGeocode,
  type Punto,
  type RutaCalculada,
} from "@/lib/routing";

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

const CAPAS_OPCIONES: { id: Capa; label: string; icono: React.ReactNode }[] = [
  { id: "estandar", label: "Estándar", icono: <MapIcon className="size-3.5" /> },
  { id: "satelite", label: "Satélite", icono: <Satellite className="size-3.5" /> },
  { id: "relieve", label: "Relieve", icono: <Mountain className="size-3.5" /> },
  { id: "transporte", label: "Transporte", icono: <Bus className="size-3.5" /> },
  { id: "trafico", label: "Tráfico", icono: <TrafficCone className="size-3.5" /> },
];

export function PantallaCelular() {
  const [origen, setOrigen] = useState<Punto | null>(ORIGEN_DEFAULT);
  const [destino, setDestino] = useState<Punto | null>(DESTINO_DEFAULT);
  const [algoritmo, setAlgoritmo] = useState<"astar" | "dijkstra">("astar");
  const [modoSeleccion, setModoSeleccion] = useState<"origen" | "destino" | null>(null);

  // Modo en vivo y "evitar semáforos"
  const [enVivo, setEnVivo] = useState(false);
  const [intervaloMs, setIntervaloMs] = useState<number>(60_000);
  const [evitarSemaforos, setEvitarSemaforos] = useState(false);

  // Capas + ubicación + abrir buscador
  const [capa, setCapa] = useState<Capa>("estandar");
  const [menuCapas, setMenuCapas] = useState(false);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [abrirBuscadorEn, setAbrirBuscadorEn] = useState<"origen" | "destino" | null>(null);
  const [panelFavoritas, setPanelFavoritas] = useState(false);
  const mapaRef = useRef<CucutaMapHandle>(null);

  const favs = useFavoritos();

  const {
    rutas,
    principal,
    alterna,
    seleccionIdx,
    seleccionarRuta,
    cargando,
    error,
    ultimaActualizacion,
  } = useRuta(origen, destino, { evitarSemaforos, live: enVivo, liveIntervalMs: intervaloMs });

  // Comparación "ruta normal" vs "evitando semáforos":
  // mantenemos en estado la versión normal para compararla con la actual.
  const [normalParaComparar, setNormalParaComparar] = useState<RutaCalculada | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!evitarSemaforos || !origen || !destino) {
      setNormalParaComparar(null);
      return;
    }
    (async () => {
      try {
        const rutas = await calcularRutaOSRM(origen, destino, {
          alternativas: false,
          evitarSemaforos: false,
        });
        if (!cancelado) setNormalParaComparar(rutas[0] ?? null);
      } catch {
        if (!cancelado) setNormalParaComparar(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [evitarSemaforos, origen, destino, ultimaActualizacion]);

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

  const cambiarCapa = (c: Capa) => {
    setCapa(c);
    mapaRef.current?.setLayer(c);
    setMenuCapas(false);
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
          ref={mapaRef}
          algoritmo={algoritmo}
          origen={origen}
          destino={destino}
          rutaPrincipal={principal?.coords ?? null}
          rutaAlterna={alterna?.coords ?? null}
          rutaComparacion={
            evitarSemaforos && normalParaComparar
              ? { coords: normalParaComparar.coords, color: "#94a3b8", weight: 5, dashed: true }
              : null
          }
          modoSeleccion={modoSeleccion}
          onSeleccionMapa={handleSeleccionMapa}
          onUbicacion={(lat, lng) => setUbicacion({ lat, lng })}
          ubicacionUsuario={ubicacion}
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
          abrirEn={abrirBuscadorEn}
          onAbiertoConsumido={() => setAbrirBuscadorEn(null)}
          favoritos={favs.lugares}
          esLugarFavorito={favs.esLugarFavorito}
          onToggleFavorito={favs.toggleLugar}
          onEliminarFavorito={favs.eliminarLugar}
        />
      </div>

      {/* Indicador modo selección */}
      {modoSeleccion && (
        <div className="absolute left-1/2 top-44 z-[550] -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper shadow-elevated">
          Toca el mapa para fijar {modoSeleccion}
        </div>
      )}

      {/* Indicador "en vivo" */}
      {enVivo && (
        <div className="absolute left-3 top-44 z-[550] flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 shadow-elevated">
          <span className="size-1.5 animate-pulse rounded-full bg-traffic-mid" />
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink">
            En vivo
          </span>
        </div>
      )}

      {/* Botones flotantes — capas + ubicación */}
      <div className="absolute right-3 top-44 z-[500] flex flex-col gap-2">
        <div className="relative">
          <button
            onClick={() => setMenuCapas((v) => !v)}
            className={`flex size-10 items-center justify-center rounded-full shadow-elevated transition ${
              menuCapas ? "bg-ink text-paper" : "bg-surface text-ink hover:bg-paper"
            }`}
            aria-label="Cambiar capa"
          >
            <Layers className="size-4" />
          </button>
          {menuCapas && (
            <div className="absolute right-12 top-0 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-elevated">
              {CAPAS_OPCIONES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => cambiarCapa(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                    capa === c.id
                      ? "bg-primary-light/40 font-semibold text-primary-dark"
                      : "text-ink hover:bg-paper"
                  }`}
                >
                  {c.icono}
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => mapaRef.current?.locateMe()}
          className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-elevated transition hover:bg-paper"
          aria-label="Mi ubicación"
        >
          <Locate className="size-4" />
        </button>
      </div>

      {/* Botones de zoom (debajo, mismo lado) */}
      <div className="absolute bottom-[46%] right-3 z-[500] flex flex-col overflow-hidden rounded-full border border-border bg-surface shadow-elevated">
        <button
          onClick={() => mapaRef.current?.zoomIn()}
          className="flex size-9 items-center justify-center text-ink transition hover:bg-paper"
          aria-label="Acercar"
        >
          <Plus className="size-4" />
        </button>
        <span className="h-px bg-border" />
        <button
          onClick={() => mapaRef.current?.zoomOut()}
          className="flex size-9 items-center justify-center text-ink transition hover:bg-paper"
          aria-label="Alejar"
        >
          <Minus className="size-4" />
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
        semaforos={principal?.semaforos ?? null}
        densidadSemaforos={principal?.densidadSemaforos ?? null}
        penalizacionSemaforosS={principal?.penalizacionSemaforosS ?? null}
        clima={principal?.clima ?? null}
        cargando={cargando}
        error={error}
        tieneRuta={!!principal}
        enVivo={enVivo}
        onEnVivo={setEnVivo}
        ultimaActualizacion={ultimaActualizacion}
        evitarSemaforos={evitarSemaforos}
        onEvitarSemaforos={setEvitarSemaforos}
        comparacionEvitar={
          evitarSemaforos && normalParaComparar
            ? {
                duracion: normalParaComparar.duracion,
                semaforos: normalParaComparar.semaforos,
                penalizacionSemaforosS: normalParaComparar.penalizacionSemaforosS,
                distancia: normalParaComparar.distancia,
              }
            : null
        }
      />
    </div>
  );
}
