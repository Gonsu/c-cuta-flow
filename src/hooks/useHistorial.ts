/**
 * useHistorial — guarda las últimas 5 rutas calculadas en localStorage.
 */
import { useCallback, useEffect, useState } from "react";
import type { Punto } from "@/lib/routing";

export interface EntradaHistorial {
  id: string;
  origen: Punto;
  destino: Punto;
  duracionS: number;
  fecha: number;
}

const KEY = "transit:historial:v1";
const MAX = 5;

function leer(): EntradaHistorial[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function useHistorial() {
  const [items, setItems] = useState<EntradaHistorial[]>(() => leer());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* noop */
    }
  }, [items]);

  const agregar = useCallback((origen: Punto, destino: Punto, duracionS: number) => {
    setItems((prev) => {
      const id = `${origen.lat.toFixed(4)}_${origen.lng.toFixed(4)}__${destino.lat.toFixed(4)}_${destino.lng.toFixed(4)}`;
      const filtrado = prev.filter((x) => x.id !== id);
      const next: EntradaHistorial = {
        id,
        origen,
        destino,
        duracionS,
        fecha: Date.now(),
      };
      return [next, ...filtrado].slice(0, MAX);
    });
  }, []);

  const limpiar = useCallback(() => setItems([]), []);

  return { items, agregar, limpiar };
}
