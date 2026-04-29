/**
 * useRuta — orquesta la llamada a OSRM con debounce y manejo de estado.
 * Soporta:
 *   • opciones (`evitarSemaforos`, `alternativas`)
 *   • modo en vivo (`live`) que refresca semáforos + clima + ETA cada N segundos
 */
import { useEffect, useRef, useState } from "react";
import { calcularRutaOSRM, type Punto, type RutaCalculada } from "@/lib/routing";

interface UseRutaOpts {
  evitarSemaforos?: boolean;
  /** Refresca la ruta cada `liveIntervalMs` ms si está activo. */
  live?: boolean;
  liveIntervalMs?: number;
}

export function useRuta(
  origen: Punto | null,
  destino: Punto | null,
  opts: UseRutaOpts = {},
) {
  const { evitarSemaforos = false, live = false, liveIntervalMs = 60_000 } = opts;
  const [principal, setPrincipal] = useState<RutaCalculada | null>(null);
  const [alterna, setAlterna] = useState<RutaCalculada | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<number | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!origen || !destino) {
      setPrincipal(null);
      setAlterna(null);
      setUltimaActualizacion(null);
      return;
    }

    const myId = ++reqId.current;
    let cancelado = false;

    const ejecutar = async (silencioso: boolean) => {
      if (!silencioso) setCargando(true);
      setError(null);
      try {
        const rutas = await calcularRutaOSRM(origen, destino, {
          alternativas: true,
          evitarSemaforos,
        });
        if (cancelado || reqId.current !== myId) return;
        setPrincipal(rutas[0] ?? null);
        setAlterna(rutas[1] ?? null);
        setUltimaActualizacion(Date.now());
      } catch (e: any) {
        if (!cancelado) setError(e.message ?? "Error de ruta");
      } finally {
        if (!cancelado && !silencioso) setCargando(false);
      }
    };

    // Primera carga (con debounce corto)
    const t = setTimeout(() => ejecutar(false), 250);

    // Refresco en vivo
    let interval: ReturnType<typeof setInterval> | null = null;
    if (live) {
      interval = setInterval(() => ejecutar(true), liveIntervalMs);
    }

    return () => {
      cancelado = true;
      clearTimeout(t);
      if (interval) clearInterval(interval);
    };
  }, [origen, destino, evitarSemaforos, live, liveIntervalMs]);

  return { principal, alterna, cargando, error, ultimaActualizacion };
}
