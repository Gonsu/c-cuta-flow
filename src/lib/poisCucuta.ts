/**
 * POIs conocidos de Cúcuta con coordenadas verificadas.
 * Tienen prioridad sobre la geocodificación de Nominatim.
 */
import type { Punto } from "./routing";

export interface POICucuta {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  categoria: string;
  /** Alias adicionales para mejorar el matching parcial. */
  aliases?: string[];
}

export const POIS_CUCUTA: POICucuta[] = [
  {
    id: "jardin_plaza",
    nombre: "Jardín Plaza Cúcuta",
    lat: 7.9148,
    lng: -72.4836,
    categoria: "Centro Comercial",
    aliases: ["jardin plaza", "jardín plaza", "cc jardin plaza"],
  },
  {
    id: "unicentro",
    nombre: "Unicentro Cúcuta",
    lat: 7.9087,
    lng: -72.4958,
    categoria: "Centro Comercial",
    aliases: ["unicentro", "cc unicentro"],
  },
  {
    id: "parque_santander",
    nombre: "Parque Santander",
    lat: 7.88631,
    lng: -72.50429,
    categoria: "Punto de Referencia",
    aliases: ["parque santander", "plaza santander"],
  },
  {
    id: "terminal_cucuta",
    nombre: "Terminal de Transportes de Cúcuta",
    lat: 7.8896,
    lng: -72.5007,
    categoria: "Terminal",
    aliases: ["terminal", "terminal de transportes", "terminal cucuta"],
  },
  {
    id: "ufps",
    nombre: "UFPS · Campus Principal",
    lat: 7.898144,
    lng: -72.488809,
    categoria: "Universidad",
    aliases: ["ufps", "universidad francisco de paula santander", "campus ufps"],
  },
];

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function poiAPunto(poi: POICucuta): Punto {
  return {
    label: `${poi.nombre} · ${poi.categoria}`,
    lat: poi.lat,
    lng: poi.lng,
  };
}

/**
 * Busca POIs locales que coincidan (parcial / tokens) con la query.
 * Devuelve coincidencias ordenadas por relevancia.
 */
export function buscarPOIsLocales(query: string): Punto[] {
  const q = normalizar(query);
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);

  type Scored = { poi: POICucuta; score: number };
  const scored: Scored[] = [];

  for (const poi of POIS_CUCUTA) {
    const candidates = [poi.nombre, poi.id, ...(poi.aliases ?? [])].map(normalizar);
    let best = 0;
    for (const c of candidates) {
      if (c === q) best = Math.max(best, 100);
      else if (c.startsWith(q)) best = Math.max(best, 80);
      else if (c.includes(q)) best = Math.max(best, 60);
      else {
        const hits = tokens.filter((t) => c.includes(t)).length;
        if (hits > 0) best = Math.max(best, 20 + hits * 10);
      }
    }
    if (best > 0) scored.push({ poi, score: best });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => poiAPunto(s.poi));
}
