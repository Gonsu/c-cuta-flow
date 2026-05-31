/**
 * PantallaCelular
 * Orquesta búsqueda + mapa + panel. Usa OSRM para rutas reales.
 * Incluye: capas seleccionables, geolocalización, zoom, modo en vivo y
 * comparación "evitar semáforos".
 */
import { useEffect, useRef, useState } from "react";
import { Layers, Locate, Plus, Minus, Mountain, Satellite, Bus, TrafficCone, Map as MapIcon, Star, X, Pencil, Check, MapPin } from "lucide-react";
import { CucutaMap, type CucutaMapHandle, type Capa } from "./CucutaMap";
import { BuscadorRuta } from "./BuscadorRuta";
import { PanelRuta } from "./PanelRuta";
import { PanelDatosDesktop } from "./PanelDatosDesktop";
import { useRuta } from "@/hooks/useRuta";
import { useFavoritos } from "@/hooks/useFavoritos";
import {
  calcularRutaOSRM,
  reverseGeocode,
  dentroDelAMC,
  type Punto,
  type RutaCalculada,
} from "@/lib/routing";
import { toast } from "sonner";

const ORIGEN_DEFAULT: Punto = {
  label: "Ventura Plaza · Centro Comercial",
  lat: 7.8942,
  lng: -72.5043,
};
const DESTINO_DEFAULT: Punto = {
  label: "UFPS · Campus Principal · Cl. 2 #11A E-46, Quinta Oriental, Cúcuta",
  lat: 7.898144,
  lng: -72.488809,
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

  // Navegación turn-by-turn con geolocalización del dispositivo
  const [navegando, setNavegando] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Mostrar/ocultar bloque de datos (distancia, tráfico, clima, semáforos)
  const [mostrarDatos, setMostrarDatos] = useState(false);

  // Capas + ubicación + abrir buscador
  const [capa, setCapa] = useState<Capa>("estandar");
  const [menuCapas, setMenuCapas] = useState(false);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [abrirBuscadorEn, setAbrirBuscadorEn] = useState<"origen" | "destino" | null>(null);
  const [panelFavoritas, setPanelFavoritas] = useState(false);
  const [tabFav, setTabFav] = useState<"rutas" | "lugares">("rutas");
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreTemp, setNombreTemp] = useState("");
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

  const iniciarNavegacion = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalización no disponible en este dispositivo");
      return;
    }
    if (!destino) {
      toast.error("Selecciona un destino antes de iniciar la navegación");
      return;
    }
    setNavegando(true);
    setEnVivo(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUbicacion({ lat: latitude, lng: longitude });
        if (dentroDelAMC({ lat: latitude, lng: longitude })) {
          setOrigen({ label: "Tu ubicación", lat: latitude, lng: longitude });
        }

      },
      (err) => {
        toast.error("No se pudo obtener tu ubicación", { description: err.message });
        detenerNavegacion();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
    watchIdRef.current = id;
    toast.success("Navegación iniciada", {
      description: "Siguiendo tu ubicación en tiempo real",
    });
  };

  const detenerNavegacion = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setNavegando(false);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);


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
    if (!dentroDelAMC({ lat, lng })) {
      toast.error("Punto fuera del área metropolitana", {
        description: "Solo se permiten ubicaciones en Cúcuta, Los Patios o Villa del Rosario.",
      });
      return;
    }
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

  const usarMiUbicacion = (campo: "origen" | "destino") => {
    if (!navigator.geolocation) {
      toast.error("Geolocalización no disponible");
      return;
    }
    const tid = toast.loading("Obteniendo tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!dentroDelAMC({ lat: latitude, lng: longitude })) {
          toast.dismiss(tid);
          toast.error("Estás fuera del área metropolitana de Cúcuta");
          return;
        }
        // Punto provisional inmediato
        const provisional: Punto = {
          label: "Tu ubicación",
          lat: latitude,
          lng: longitude,
        };
        if (campo === "origen") setOrigen(provisional);
        else setDestino(provisional);
        setUbicacion({ lat: latitude, lng: longitude });
        try {
          const label = await reverseGeocode(latitude, longitude);
          const final: Punto = { label, lat: latitude, lng: longitude };
          if (campo === "origen") setOrigen(final);
          else setDestino(final);
          toast.dismiss(tid);
          toast.success("Ubicación fijada", { description: label });
        } catch {
          toast.dismiss(tid);
        }
      },
      (err) => {
        toast.dismiss(tid);
        toast.error("No se pudo obtener tu ubicación", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  };

  const cambiarCapa = (c: Capa) => {
    setCapa(c);
    mapaRef.current?.setLayer(c);
    setMenuCapas(false);
  };

  // Modo "solo ruta": durante la navegación con Datos OFF ocultamos
  // todos los paneles secundarios (buscador, favoritas, capas, etc.)
  // y dejamos únicamente mapa + ruta + marcador.
  const soloRuta = navegando && !mostrarDatos;

  // Cierra paneles secundarios al entrar en modo solo-ruta.
  useEffect(() => {
    if (soloRuta) {
      setPanelFavoritas(false);
      setMenuCapas(false);
      setAbrirBuscadorEn(null);
    }
  }, [soloRuta]);

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
          rutaAlterna={soloRuta ? null : alterna?.coords ?? null}
          rutaComparacion={
            !soloRuta && evitarSemaforos && normalParaComparar
              ? { coords: normalParaComparar.coords, color: "#94a3b8", weight: 5, dashed: true }
              : null
          }
          modoSeleccion={modoSeleccion}
          onSeleccionMapa={handleSeleccionMapa}
          onUbicacion={(lat, lng) => setUbicacion({ lat, lng })}
          ubicacionUsuario={ubicacion}
        />
      </div>

      {/* Buscador — oculto en modo solo-ruta */}
      {!soloRuta && (
        <div className="pt-7">
          <BuscadorRuta
            origen={origen}
            destino={destino}
            onOrigen={setOrigen}
            onDestino={setDestino}
            onLimpiarOrigen={() => setOrigen(null)}
            onLimpiarDestino={() => setDestino(null)}
            onInvertir={invertir}
            onPickEnMapa={setModoSeleccion}
            onUsarMiUbicacion={usarMiUbicacion}
            modoSeleccion={modoSeleccion}
            abrirEn={abrirBuscadorEn}
            onAbiertoConsumido={() => setAbrirBuscadorEn(null)}
            favoritos={favs.lugares}
            esLugarFavorito={favs.esLugarFavorito}
            onToggleFavorito={favs.toggleLugar}
            onEliminarFavorito={favs.eliminarLugar}
          />
        </div>
      )}

      {/* Indicador modo selección */}
      {modoSeleccion && (
        <div className="absolute left-1/2 top-44 z-[550] -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper shadow-elevated">
          Toca el mapa para fijar {modoSeleccion}
        </div>
      )}

      {/* Indicador "en vivo" / "Navegando" */}
      {enVivo && (
        <div className={`absolute left-3 z-[550] flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 shadow-elevated ${soloRuta ? "top-10" : "top-44"}`}>
          <span className="size-1.5 animate-pulse rounded-full bg-traffic-mid" />
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink">
            {navegando ? "Navegando" : "En vivo"}
          </span>
        </div>
      )}

      {/* Botones flotantes — capas + ubicación + favoritas */}
      <div className={`absolute right-3 z-[500] flex flex-col gap-2 ${soloRuta ? "top-10" : "top-44"}`}>
        {!soloRuta && (
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
        )}
        <button
          onClick={() => mapaRef.current?.locateMe()}
          className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-elevated transition hover:bg-paper"
          aria-label="Mi ubicación"
        >
          <Locate className="size-4" />
        </button>
        {!soloRuta && (
          <button
            onClick={() => setPanelFavoritas((v) => !v)}
            className={`relative flex size-10 items-center justify-center rounded-full shadow-elevated transition ${
              panelFavoritas ? "bg-primary text-primary-foreground" : "bg-surface text-ink hover:bg-paper"
            }`}
            aria-label="Rutas favoritas"
          >
            <Star className={`size-4 ${panelFavoritas ? "fill-current" : ""}`} />
            {favs.rutas.length > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-ink font-mono text-[9px] font-bold text-paper">
                {favs.rutas.length}
              </span>
            )}
          </button>
        )}
      </div>


      {/* Panel de favoritos: pestañas Rutas / Lugares guardados */}
      {panelFavoritas && (
        <div className="absolute right-3 top-[16.5rem] z-[600] w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
              Guardados
            </p>
            <button
              onClick={() => setPanelFavoritas(false)}
              className="text-ink-muted hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex border-b border-border">
            <button
              onClick={() => setTabFav("rutas")}
              className={`flex-1 px-3 py-2 text-[11px] font-semibold transition ${
                tabFav === "rutas"
                  ? "border-b-2 border-primary text-primary"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Rutas ({favs.rutas.length})
            </button>
            <button
              onClick={() => setTabFav("lugares")}
              className={`flex-1 px-3 py-2 text-[11px] font-semibold transition ${
                tabFav === "lugares"
                  ? "border-b-2 border-primary text-primary"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Lugares ({favs.lugares.length})
            </button>
          </div>

          {tabFav === "rutas" && (
            favs.rutas.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-ink-muted">Aún no tienes rutas guardadas.</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
                  Toca el ♥ del panel inferior
                </p>
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {favs.rutas.map((r) => (
                  <li
                    key={r.id}
                    className="group flex items-center gap-1 border-b border-border last:border-b-0 hover:bg-paper"
                  >
                    <button
                      onClick={() => {
                        setOrigen(r.origen);
                        setDestino(r.destino);
                        setPanelFavoritas(false);
                      }}
                      className="flex flex-1 flex-col gap-0.5 px-3 py-2 text-left"
                    >
                      <p className="truncate text-[11px] font-semibold text-ink">{r.nombre}</p>
                      <p className="truncate font-mono text-[9px] uppercase tracking-wider text-ink-muted">
                        {r.origen.label} → {r.destino.label}
                      </p>
                    </button>
                    <button
                      onClick={() => favs.eliminarRuta(r.id)}
                      aria-label="Eliminar ruta favorita"
                      className="px-2 py-2 text-ink-muted opacity-0 transition group-hover:opacity-100 hover:text-ink"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {tabFav === "lugares" && (
            favs.lugares.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-ink-muted">No tienes lugares guardados.</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
                  Toca la ★ junto a una dirección
                </p>
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {favs.lugares.map((l) => {
                  const id = `${l.lat}_${l.lng}`;
                  const editando = renombrandoId === id;
                  const fecha = new Date(l.guardadoEn).toLocaleString("es-CO", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <li
                      key={id}
                      className="group flex flex-col gap-1 border-b border-border px-3 py-2 last:border-b-0 hover:bg-paper"
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          {editando ? (
                            <input
                              autoFocus
                              value={nombreTemp}
                              onChange={(e) => setNombreTemp(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  favs.renombrarLugar(l, nombreTemp);
                                  setRenombrandoId(null);
                                } else if (e.key === "Escape") {
                                  setRenombrandoId(null);
                                }
                              }}
                              placeholder="Casa, Trabajo…"
                              className="w-full rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-ink outline-none focus:border-primary"
                            />
                          ) : (
                            <p className="truncate text-[11px] font-semibold text-ink">
                              {l.nombre || l.label}
                            </p>
                          )}
                          {l.nombre && !editando && (
                            <p className="truncate text-[10px] text-ink-muted">{l.label}</p>
                          )}
                          <p className="font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
                            Guardado · {fecha}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          {editando ? (
                            <button
                              onClick={() => {
                                favs.renombrarLugar(l, nombreTemp);
                                setRenombrandoId(null);
                              }}
                              aria-label="Guardar nombre"
                              className="rounded p-1 text-primary hover:bg-primary-light/40"
                            >
                              <Check className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setRenombrandoId(id);
                                setNombreTemp(l.nombre ?? "");
                              }}
                              aria-label="Renombrar"
                              className="rounded p-1 text-ink-muted opacity-0 transition group-hover:opacity-100 hover:text-ink"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => favs.eliminarLugar(l)}
                            aria-label="Eliminar lugar"
                            className="rounded p-1 text-ink-muted opacity-0 transition group-hover:opacity-100 hover:text-ink"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setOrigen({ label: l.nombre || l.label, lat: l.lat, lng: l.lng });
                            setPanelFavoritas(false);
                          }}
                          className="flex-1 rounded bg-paper px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-ink hover:bg-border/60"
                        >
                          Desde
                        </button>
                        <button
                          onClick={() => {
                            setDestino({ label: l.nombre || l.label, lat: l.lat, lng: l.lng });
                            setPanelFavoritas(false);
                          }}
                          className="flex-1 rounded bg-primary px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
                        >
                          Hacia
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>
      )}



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
        intervaloMs={intervaloMs}
        onIntervaloMs={setIntervaloMs}
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
        rutas={rutas}
        seleccionIdx={seleccionIdx}
        onSeleccionarRuta={seleccionarRuta}
        esRutaFavorita={favs.esRutaFavorita(origen, destino)}
        onToggleFavorita={() => {
          if (origen && destino) favs.toggleRuta(origen, destino);
        }}
        puedeAgregarFavorita={!!origen && !!destino}
        navegando={navegando}
        onIniciarNavegacion={iniciarNavegacion}
        onDetenerNavegacion={detenerNavegacion}
        mostrarDatos={mostrarDatos}
        onMostrarDatos={setMostrarDatos}
      />

      {/* Panel lateral de datos (≥1024px) — el bottom sheet se usa en móvil */}
      <PanelDatosDesktop
        abierto={mostrarDatos && !!principal && !soloRuta}
        onCerrar={() => setMostrarDatos(false)}
        distanciaM={principal?.distancia ?? null}
        duracionS={principal?.duracion ?? null}
        duracionBaseS={principal?.duracionBase ?? null}
        factorTrafico={principal?.factorTrafico ?? null}
        nivelTrafico={principal?.nivelTrafico ?? null}
        semaforos={principal?.semaforos ?? null}
        densidadSemaforos={principal?.densidadSemaforos ?? null}
        penalizacionSemaforosS={principal?.penalizacionSemaforosS ?? null}
        clima={principal?.clima ?? null}
      />
    </div>
  );
}
