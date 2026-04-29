/**
 * routing.ts
 * Utilidades para consultar OSRM (geometría real sobre el grafo OSM)
 * y Nominatim (geocodificación / autocompletado) restringidos a Cúcuta.
 */

export interface Punto {
  label: string;
  lat: number;
  lng: number;
}

export interface RutaCalculada {
  /** Polilínea siguiendo las calles reales [lat, lng] */
  coords: [number, number][];
  /** Distancia total en metros */
  distancia: number;
  /** Duración estimada en segundos */
  duracion: number;
}

const CUCUTA_VIEWBOX = "-72.58,7.95,-72.45,7.84"; // lon_min,lat_max,lon_max,lat_min
const CUCUTA_BOUNDS = { lat: 7.8939, lng: -72.5078 };

/**
 * Calcula una ruta real entre dos puntos usando OSRM público.
 * El perfil "driving" devuelve geometría en GeoJSON (lon, lat).
 */
export async function calcularRutaOSRM(
  origen: Punto,
  destino: Punto,
  alternativas = false,
): Promise<RutaCalculada[]> {
  const coordsParam = `${origen.lng},${origen.lat};${destino.lng},${destino.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&alternatives=${alternativas}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error("Sin rutas");

  return data.routes.map((r: any) => ({
    coords: r.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    ),
    distancia: r.distance,
    duracion: r.duration,
  }));
}

/**
 * Autocompletado con Nominatim, restringido aproximadamente a Cúcuta.
 */
export async function buscarLugares(query: string): Promise<Punto[]> {
  if (query.trim().length < 3) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Cúcuta, Colombia`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("viewbox", CUCUTA_VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("countrycodes", "co");

  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "es" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((d: any) => ({
    label: prettyLabel(d.display_name),
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }));
}

/**
 * Geocodificación inversa — convierte coordenadas en etiqueta legible.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "17");
  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "es" },
  });
  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const data = await res.json();
  return prettyLabel(data.display_name ?? "");
}

function prettyLabel(full: string): string {
  // "Calle 12, Centro, Cúcuta, Norte de Santander, ..."  →  "Calle 12 · Centro"
  const parts = full.split(",").map((s) => s.trim());
  if (parts.length >= 2) return `${parts[0]} · ${parts[1]}`;
  return parts[0] ?? full;
}

export const CUCUTA_CENTER = CUCUTA_BOUNDS;
