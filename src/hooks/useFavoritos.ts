/**
 * useFavoritos — persistencia local (localStorage) de:
 *   • Lugares favoritos (Punto)
 *   • Rutas favoritas (par origen + destino)
 *
 * Sin backend, solo el dispositivo. Pensado para el mockup académico.
 */
import { useCallback, useEffect, useState } from "react";
import type { Punto } from "@/lib/routing";

export interface RutaFavorita {
  id: string;
  nombre: string;
  origen: Punto;
  destino: Punto;
  creadaEn: number;
}

const KEY_LUGARES = "transit:favoritos:lugares:v1";
const KEY_RUTAS = "transit:favoritos:rutas:v1";

function leer<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function escribir<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

const idDeLugar = (p: Punto) => `${p.lat.toFixed(5)}_${p.lng.toFixed(5)}`;
const idDeRuta = (o: Punto, d: Punto) => `${idDeLugar(o)}__${idDeLugar(d)}`;

export function useFavoritos() {
  const [lugares, setLugares] = useState<Punto[]>(() => leer<Punto[]>(KEY_LUGARES, []));
  const [rutas, setRutas] = useState<RutaFavorita[]>(() =>
    leer<RutaFavorita[]>(KEY_RUTAS, []),
  );

  useEffect(() => escribir(KEY_LUGARES, lugares), [lugares]);
  useEffect(() => escribir(KEY_RUTAS, rutas), [rutas]);

  const esLugarFavorito = useCallback(
    (p: Punto | null) =>
      !!p && lugares.some((x) => idDeLugar(x) === idDeLugar(p)),
    [lugares],
  );

  const toggleLugar = useCallback((p: Punto) => {
    setLugares((prev) => {
      const id = idDeLugar(p);
      const existe = prev.some((x) => idDeLugar(x) === id);
      return existe ? prev.filter((x) => idDeLugar(x) !== id) : [p, ...prev].slice(0, 25);
    });
  }, []);

  const eliminarLugar = useCallback((p: Punto) => {
    setLugares((prev) => prev.filter((x) => idDeLugar(x) !== idDeLugar(p)));
  }, []);

  const esRutaFavorita = useCallback(
    (o: Punto | null, d: Punto | null) =>
      !!o && !!d && rutas.some((r) => r.id === idDeRuta(o, d)),
    [rutas],
  );

  const toggleRuta = useCallback((o: Punto, d: Punto, nombre?: string) => {
    setRutas((prev) => {
      const id = idDeRuta(o, d);
      const existe = prev.some((r) => r.id === id);
      if (existe) return prev.filter((r) => r.id !== id);
      const nueva: RutaFavorita = {
        id,
        nombre: nombre?.trim() || `${o.label} → ${d.label}`,
        origen: o,
        destino: d,
        creadaEn: Date.now(),
      };
      return [nueva, ...prev].slice(0, 15);
    });
  }, []);

  const eliminarRuta = useCallback((id: string) => {
    setRutas((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    lugares,
    rutas,
    esLugarFavorito,
    toggleLugar,
    eliminarLugar,
    esRutaFavorita,
    toggleRuta,
    eliminarRuta,
  };
}
