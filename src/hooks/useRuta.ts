/**
 * useRuta — orquesta la llamada a OSRM con debounce y manejo de estado.
 */
import { useEffect, useState } from "react";
import { calcularRutaOSRM, type Punto, type RutaCalculada } from "@/lib/routing";

export function useRuta(origen: Punto | null, destino: Punto | null) {
  const [principal, setPrincipal] = useState<RutaCalculada | null>(null);
  const [alterna, setAlterna] = useState<RutaCalculada | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!origen || !destino) {
      setPrincipal(null);
      setAlterna(null);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);

    const t = setTimeout(async () => {
      try {
        const rutas = await calcularRutaOSRM(origen, destino, true);
        if (cancelado) return;
        setPrincipal(rutas[0] ?? null);
        setAlterna(rutas[1] ?? null);
      } catch (e: any) {
        if (!cancelado) setError(e.message ?? "Error de ruta");
      } finally {
        if (!cancelado) setCargando(false);
      }
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [origen, destino]);

  return { principal, alterna, cargando, error };
}
