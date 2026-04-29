/**
 * BuscadorRuta
 * Buscador con autocompletado real (Nominatim) restringido a Cúcuta.
 * Soporta lugares favoritos (guardar/usar/eliminar).
 */
import { ArrowUpDown, Crosshair, MapPin, Navigation, Loader2, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buscarLugares, type Punto } from "@/lib/routing";
import { cn } from "@/lib/utils";

interface BuscadorRutaProps {
  origen: Punto | null;
  destino: Punto | null;
  onOrigen: (p: Punto) => void;
  onDestino: (p: Punto) => void;
  onInvertir: () => void;
  onPickEnMapa: (campo: "origen" | "destino") => void;
  modoSeleccion: "origen" | "destino" | null;
  /** Permite abrir el buscador desde un botón externo. */
  abrirEn?: "origen" | "destino" | null;
  onAbiertoConsumido?: () => void;
  /** Favoritos */
  favoritos?: Punto[];
  esLugarFavorito?: (p: Punto | null) => boolean;
  onToggleFavorito?: (p: Punto) => void;
  onEliminarFavorito?: (p: Punto) => void;
}

const SUGERENCIAS_RAPIDAS: Punto[] = [
  { label: "UFPS · Campus Principal", lat: 7.8995, lng: -72.4856 },
  { label: "Ventura Plaza · Centro Comercial", lat: 7.8942, lng: -72.5043 },
  { label: "Parque Santander · Centro", lat: 7.8895, lng: -72.5052 },
  { label: "Jardín Plaza Cúcuta", lat: 7.9044, lng: -72.5026 },
  { label: "Aeropuerto Camilo Daza", lat: 7.9275, lng: -72.5115 },
];

export function BuscadorRuta({
  origen,
  destino,
  onOrigen,
  onDestino,
  onInvertir,
  onPickEnMapa,
  modoSeleccion,
  abrirEn,
  onAbiertoConsumido,
  favoritos = [],
  esLugarFavorito,
  onToggleFavorito,
  onEliminarFavorito,
}: BuscadorRutaProps) {
  const [foco, setFoco] = useState<"origen" | "destino" | null>(null);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Punto[]>([]);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Abrir desde control externo (botón "Indicaciones")
  useEffect(() => {
    if (!abrirEn) return;
    setFoco(abrirEn);
    setQuery("");
    setResultados([]);
    setTimeout(() => inputRef.current?.focus(), 50);
    onAbiertoConsumido?.();
  }, [abrirEn, onAbiertoConsumido]);

  // Debounce búsqueda Nominatim
  useEffect(() => {
    if (!foco) return;
    if (query.trim().length < 3) {
      setResultados([]);
      return;
    }
    setCargando(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarLugares(query);
        setResultados(r);
      } finally {
        setCargando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, foco]);

  const abrir = (campo: "origen" | "destino") => {
    setFoco(campo);
    setQuery("");
    setResultados([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const elegir = (p: Punto) => {
    if (foco === "origen") onOrigen(p);
    else if (foco === "destino") onDestino(p);
    setFoco(null);
    setQuery("");
  };

  const lista = resultados.length > 0 ? resultados : SUGERENCIAS_RAPIDAS;

  return (
    <div className="absolute inset-x-3 top-3 z-[500]">
      <div className="overflow-hidden rounded-xl bg-surface shadow-elevated">
        <div className="relative flex items-stretch">
          <div className="flex flex-col items-center justify-center px-3 py-3">
            <div className="size-2.5 rounded-full border-[2.5px] border-ink bg-surface" />
            <div className="my-1 h-5 w-px border-l border-dashed border-ink-subtle" />
            <MapPin className="size-3.5 text-primary" strokeWidth={2.5} />
          </div>

          <div className="flex-1 py-2 pr-2">
            <button
              onClick={() => abrir("origen")}
              className="block w-full rounded-md px-2 py-1.5 text-left transition hover:bg-paper"
            >
              <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
                Desde
              </p>
              <p className="truncate text-sm font-medium text-ink">
                {origen?.label ?? "Selecciona origen"}
              </p>
            </button>

            <div className="my-1 ml-2 h-px bg-border" />

            <button
              onClick={() => abrir("destino")}
              className="block w-full rounded-md px-2 py-1.5 text-left transition hover:bg-paper"
            >
              <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                Hacia
              </p>
              <p className="truncate text-sm font-semibold text-ink">
                {destino?.label ?? "Selecciona destino"}
              </p>
            </button>
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
            <div className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5">
              {cargando ? (
                <Loader2 className="size-3.5 animate-spin text-ink-muted" />
              ) : (
                <Navigation className="size-3.5 text-ink-muted" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  foco === "origen"
                    ? "Buscar dirección de origen…"
                    : "Buscar dirección de destino…"
                }
                className="flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-subtle"
              />
            </div>

            <button
              onClick={() => {
                onPickEnMapa(foco);
                setFoco(null);
              }}
              className={`mt-1.5 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition ${
                modoSeleccion === foco
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-ink hover:bg-border/50"
              }`}
            >
              <Crosshair className="size-3.5" />
              Tocar en el mapa para fijar {foco}
            </button>

            {/* Acceso rápido a favoritos guardados */}
            {favoritos.length > 0 && resultados.length === 0 && (
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
                        onClick={() => elegir(p)}
                        className="flex flex-1 items-center gap-2 px-2 py-2 text-left"
                      >
                        <Star className="size-3.5 shrink-0 fill-primary text-primary" />
                        <span className="truncate text-xs text-ink">{p.label}</span>
                      </button>
                      {onEliminarFavorito && (
                        <button
                          onClick={() => onEliminarFavorito(p)}
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
              {resultados.length > 0 ? "Resultados" : "Lugares populares"}
            </p>
            <ul className="max-h-44 overflow-y-auto">
              {lista.map((p) => {
                const fav = esLugarFavorito?.(p) ?? false;
                return (
                  <li
                    key={`${p.lat}-${p.lng}-${p.label}`}
                    className="group flex items-center gap-1 rounded-md hover:bg-surface"
                  >
                    <button
                      onClick={() => elegir(p)}
                      className="flex flex-1 items-center gap-2 px-2 py-2 text-left"
                    >
                      <MapPin className="size-3.5 shrink-0 text-ink-muted" />
                      <span className="truncate text-xs text-ink">{p.label}</span>
                    </button>
                    {onToggleFavorito && (
                      <button
                        onClick={() => onToggleFavorito(p)}
                        aria-label={fav ? "Quitar de favoritos" : "Guardar como favorito"}
                        aria-pressed={fav}
                        className="px-2 py-1 text-ink-muted transition hover:text-primary"
                      >
                        <Star
                          className={cn(
                            "size-3.5",
                            fav && "fill-primary text-primary",
                          )}
                        />
                      </button>
                    )}
                  </li>
                );
              })}
              {lista.length === 0 && (
                <li className="px-2 py-2 text-xs text-ink-muted">Sin resultados.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
