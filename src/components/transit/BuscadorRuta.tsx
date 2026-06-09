/**
 * BuscadorRuta
 * Inputs editables estilo Google Maps con autocompletado en vivo (Nominatim).
 * - Escribes directamente en "Desde" o "Hacia" y aparecen sugerencias bajo el campo.
 * - Soporta favoritos (★) y selección sobre el mapa.
 */
import { ArrowUpDown, Crosshair, MapPin, Loader2, Star, X, LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buscarLugares, type Punto } from "@/lib/routing";
import { POIS_CUCUTA, poiAPunto } from "@/lib/poisCucuta";
import { cn } from "@/lib/utils";

interface BuscadorRutaProps {
  origen: Punto | null;
  destino: Punto | null;
  onOrigen: (p: Punto) => void;
  onDestino: (p: Punto) => void;
  onLimpiarOrigen?: () => void;
  onLimpiarDestino?: () => void;
  onInvertir: () => void;
  onPickEnMapa: (campo: "origen" | "destino") => void;
  onUsarMiUbicacion?: (campo: "origen" | "destino") => void;
  modoSeleccion: "origen" | "destino" | null;
  abrirEn?: "origen" | "destino" | null;
  onAbiertoConsumido?: () => void;
  favoritos?: Punto[];
  esLugarFavorito?: (p: Punto | null) => boolean;
  onToggleFavorito?: (p: Punto) => void;
  onEliminarFavorito?: (p: Punto) => void;
}

const SUGERENCIAS_RAPIDAS: Punto[] = POIS_CUCUTA.map(poiAPunto);

export function BuscadorRuta({
  origen,
  destino,
  onOrigen,
  onDestino,
  onLimpiarOrigen,
  onLimpiarDestino,
  onInvertir,
  onPickEnMapa,
  onUsarMiUbicacion,
  modoSeleccion,
  abrirEn,
  onAbiertoConsumido,
  favoritos = [],
  esLugarFavorito,
  onToggleFavorito,
  onEliminarFavorito,
}: BuscadorRutaProps) {
  const [foco, setFoco] = useState<"origen" | "destino" | null>(null);
  const [qOrigen, setQOrigen] = useState("");
  const [qDestino, setQDestino] = useState("");
  const [resultados, setResultados] = useState<Punto[]>([]);
  const [cargando, setCargando] = useState(false);
  const refOrigen = useRef<HTMLInputElement>(null);
  const refDestino = useRef<HTMLInputElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Sincronizar texto del input con la selección actual cuando NO está enfocado
  useEffect(() => {
    if (foco !== "origen") setQOrigen(origen?.label ?? "");
  }, [origen, foco]);
  useEffect(() => {
    if (foco !== "destino") setQDestino(destino?.label ?? "");
  }, [destino, foco]);

  // Abrir desde control externo (botón "Indicaciones")
  useEffect(() => {
    if (!abrirEn) return;
    setFoco(abrirEn);
    setResultados([]);
    setTimeout(() => {
      const r = abrirEn === "origen" ? refOrigen : refDestino;
      r.current?.focus();
      r.current?.select();
    }, 50);
    onAbiertoConsumido?.();
  }, [abrirEn, onAbiertoConsumido]);

  // Ajuste cuando el teclado virtual aparece (Android/Capacitor):
  // visualViewport reduce su altura → calculamos el offset y lo aplicamos
  // como margen inferior para que el dropdown no quede oculto.
  const [kbOffset, setKbOffset] = useState(0);
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbOffset(offset);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // Cerrar dropdown al hacer click/touch afuera
  useEffect(() => {
    const onPointer = (e: Event) => {
      if (!contenedorRef.current?.contains(e.target as Node)) setFoco(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, []);

  // Debounce búsqueda Nominatim — basado en el campo enfocado
  const queryActiva = foco === "origen" ? qOrigen : foco === "destino" ? qDestino : "";
  useEffect(() => {
    if (!foco) return;
    const q = queryActiva.trim();
    if (q.length < 3) {
      setResultados([]);
      return;
    }
    setCargando(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarLugares(q);
        setResultados(r);
      } catch (err) {
        console.error("[BuscadorRuta] error buscando lugares:", err);
        setResultados([]);
      } finally {
        setCargando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [queryActiva, foco]);

  // Limpiar resultados al cambiar de campo (Desde ↔ Hacia)
  useEffect(() => {
    setResultados([]);
    setCargando(false);
  }, [foco]);

  // Cerrar dropdown con la tecla Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFoco(null);
        setResultados([]);
        refOrigen.current?.blur();
        refDestino.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const elegir = (p: Punto) => {
    if (foco === "origen") {
      onOrigen(p);
      setQOrigen(p.label);
    } else if (foco === "destino") {
      onDestino(p);
      setQDestino(p.label);
    }
    setFoco(null);
    setResultados([]);
  };

  const limpiarCampo = (campo: "origen" | "destino") => {
    if (campo === "origen") {
      setQOrigen("");
      onLimpiarOrigen?.();
    } else {
      setQDestino("");
      onLimpiarDestino?.();
    }
    setResultados([]);
    setFoco(campo);
    const r = campo === "origen" ? refOrigen : refDestino;
    r.current?.focus();
  };

  const lista = resultados.length > 0 ? resultados : SUGERENCIAS_RAPIDAS;
  const mostrarFavs = favoritos.length > 0 && resultados.length === 0;

  return (
    <div
      ref={contenedorRef}
      className="fixed inset-x-3 z-[600]"
      style={{
        top: `calc(env(safe-area-inset-top) + 12px)`,
        maxHeight: `calc(100dvh - env(safe-area-inset-top) - 24px - ${kbOffset}px)`,
      }}
    >
      <div className="overflow-hidden rounded-xl bg-surface shadow-elevated">
        <div className="relative flex items-stretch">
          <div className="flex flex-col items-center justify-center px-3 py-3">
            <div className="size-2.5 rounded-full border-[2.5px] border-ink bg-surface" />
            <div className="my-1 h-5 w-px border-l border-dashed border-ink-subtle" />
            <MapPin className="size-3.5 text-primary" strokeWidth={2.5} />
          </div>

          <div className="flex-1 py-2 pr-2">
            <div className="rounded-md px-2 py-1">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
                Desde
              </p>
              <div className="flex items-center gap-1">
                <input
                  ref={refOrigen}
                  value={qOrigen}
                  onChange={(e) => setQOrigen(e.target.value)}
                  onFocus={() => setFoco("origen")}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setFoco(null);
                    if (e.key === "Enter" && resultados[0]) {
                      e.preventDefault();
                      elegir(resultados[0]);
                    }
                  }}
                  placeholder="Selecciona origen"
                  className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-subtle"
                />
                {origen && onToggleFavorito && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onToggleFavorito(origen);
                    }}
                    aria-label={esLugarFavorito?.(origen) ? "Quitar de guardados" : "Guardar esta dirección"}
                    aria-pressed={esLugarFavorito?.(origen) ?? false}
                    className="rounded-full p-0.5 text-ink-muted transition hover:bg-border hover:text-primary"
                  >
                    <Star className={cn("size-3", esLugarFavorito?.(origen) && "fill-primary text-primary")} />
                  </button>
                )}
                {qOrigen && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      limpiarCampo("origen");
                    }}
                    aria-label="Limpiar origen"
                    className="rounded-full p-0.5 text-ink-muted transition hover:bg-border hover:text-ink"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

            </div>

            <div className="my-1 ml-2 h-px bg-border" />

            <div className="rounded-md px-2 py-1">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                Hacia
              </p>
              <div className="flex items-center gap-1">
                <input
                  ref={refDestino}
                  value={qDestino}
                  onChange={(e) => setQDestino(e.target.value)}
                  onFocus={() => setFoco("destino")}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setFoco(null);
                    if (e.key === "Enter" && resultados[0]) {
                      e.preventDefault();
                      elegir(resultados[0]);
                    }
                  }}
                  placeholder="Selecciona destino"
                  className="w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink-subtle"
                />
                {destino && onToggleFavorito && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onToggleFavorito(destino);
                    }}
                    aria-label={esLugarFavorito?.(destino) ? "Quitar de guardados" : "Guardar esta dirección"}
                    aria-pressed={esLugarFavorito?.(destino) ?? false}
                    className="rounded-full p-0.5 text-ink-muted transition hover:bg-border hover:text-primary"
                  >
                    <Star className={cn("size-3", esLugarFavorito?.(destino) && "fill-primary text-primary")} />
                  </button>
                )}
                {qDestino && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      limpiarCampo("destino");
                    }}
                    aria-label="Limpiar destino"
                    className="rounded-full p-0.5 text-ink-muted transition hover:bg-border hover:text-ink"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

            </div>
          </div>

          <button
            onClick={onInvertir}
            className="flex w-10 items-center justify-center border-l border-border text-ink-muted transition hover:bg-paper hover:text-ink"
            aria-label="Invertir origen y destino"
          >
            <ArrowUpDown className="size-4" />
          </button>
        </div>

        {foco && (
          <div className="border-t border-border bg-paper px-2 py-2">
            <div className="flex gap-1.5">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPickEnMapa(foco);
                  setFoco(null);
                }}
                className={`flex flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition ${
                  modoSeleccion === foco
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-ink hover:bg-border/50"
                }`}
              >
                <Crosshair className="size-3.5" />
                Tocar en el mapa
              </button>
              {onUsarMiUbicacion && (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onUsarMiUbicacion(foco);
                    setFoco(null);
                  }}
                  className="flex flex-1 items-center gap-2 rounded-md bg-surface px-2.5 py-2 text-left text-xs text-ink transition hover:bg-border/50"
                >
                  <LocateFixed className="size-3.5 text-primary" />
                  Mi ubicación
                </button>
              )}
            </div>

            {cargando && (
              <div className="mt-2 flex items-center gap-2 px-2 py-1 text-[10px] text-ink-muted">
                <Loader2 className="size-3 animate-spin" />
                Buscando…
              </div>
            )}

            {mostrarFavs && (
              <>
                <p className="mt-2 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                  ★ Favoritos
                </p>
                <ul className="max-h-32 overflow-y-auto">
                  {favoritos.map((p) => (
                    <li
                      key={`fav-${p.lat}-${p.lng}`}
                      className="group flex items-center gap-1 rounded-md hover:bg-surface"
                    >
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          elegir(p);
                        }}
                        className="flex flex-1 items-center gap-2 px-2 py-2 text-left"
                      >
                        <Star className="size-3.5 shrink-0 fill-primary text-primary" />
                        <span className="truncate text-xs text-ink">{p.label}</span>
                      </button>
                      {onEliminarFavorito && (
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onEliminarFavorito(p);
                          }}
                          aria-label="Eliminar favorito"
                          className="px-2 py-1 text-ink-muted opacity-0 transition group-hover:opacity-100 hover:text-ink"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="mt-2 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
              {resultados.length > 0
                ? "Sugerencias"
                : queryActiva.trim().length >= 3
                ? "Sin coincidencias — prueba otra dirección"
                : "Lugares populares"}
            </p>
            <ul className="max-h-52 overflow-y-auto">
              {lista.map((p) => {
                const fav = esLugarFavorito?.(p) ?? false;
                return (
                  <li
                    key={`${p.lat}-${p.lng}-${p.label}`}
                    className="group flex items-center gap-1 rounded-md hover:bg-surface"
                  >
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        elegir(p);
                      }}
                      className="flex flex-1 items-center gap-2 px-2 py-2 text-left"
                    >
                      <MapPin className="size-3.5 shrink-0 text-ink-muted" />
                      <span className="truncate text-xs text-ink">{p.label}</span>
                    </button>
                    {onToggleFavorito && (
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onToggleFavorito(p);
                        }}
                        aria-label={fav ? "Quitar de favoritos" : "Guardar como favorito"}
                        aria-pressed={fav}
                        className="px-2 py-1 text-ink-muted transition hover:text-primary"
                      >
                        <Star
                          className={cn("size-3.5", fav && "fill-primary text-primary")}
                        />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
