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
  /**
   * Duración ajustada en segundos — incluye tráfico, semáforos,
   * hora pico y clima (modelo tipo Waze/Google Maps ETA).
   */
  duracion: number;
  /** Duración base en flujo libre devuelta por OSRM (sin tráfico). */
  duracionBase: number;
  /** Factor multiplicador aplicado (1.0 = flujo libre, 2.0 = doble de lento). */
  factorTrafico: number;
  /** Nivel cualitativo de tráfico estimado en la ruta. */
  nivelTrafico: "libre" | "moderado" | "pesado" | "congestionado";
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

  return data.routes.map((r: any) => {
    const coords: [number, number][] = r.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    );
    const ajuste = ajustarETA(r.distance, r.duration);
    return {
      coords,
      distancia: r.distance,
      duracionBase: r.duration,
      duracion: ajuste.duracion,
      factorTrafico: ajuste.factor,
      nivelTrafico: ajuste.nivel,
    };
  });
}

/**
 * Modelo de ETA realista tipo Waze / Google Maps.
 *
 * OSRM devuelve duración en *flujo libre* (vehículo solo, sin semáforos
 * ni congestión). En entornos urbanos como Cúcuta el tiempo real suele
 * ser 1.8x – 3.5x mayor. Aplicamos un modelo multifactor:
 *
 *   t_real = t_base · f_trafico · f_hora · f_clima  +  t_semaforos
 *
 * - f_trafico: depende del nivel base por densidad urbana (1.6 base)
 * - f_hora:    factor por hora pico (mañana 6:30-8:30, tarde 17:00-19:30)
 * - f_clima:   placeholder para integración meteorológica (lluvia → +15%)
 * - t_semaforos: penalización por intersecciones (≈ 25 s/km en zona urbana)
 *
 * Esto se documenta en el panel de telemetría como ventaja del proyecto
 * frente a un OSRM crudo.
 */
function ajustarETA(distanciaM: number, duracionBaseS: number) {
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  const diaSemana = ahora.getDay(); // 0 = domingo

  // 1) Factor de tráfico base por densidad urbana de Cúcuta
  const fTraficoBase = 1.6;

  // 2) Factor hora pico
  let fHora = 1.0;
  const esLaboral = diaSemana >= 1 && diaSemana <= 5;
  if (esLaboral) {
    if (hora >= 6.5 && hora <= 8.5) fHora = 1.45; // mañana
    else if (hora >= 11.5 && hora <= 13.5) fHora = 1.25; // almuerzo
    else if (hora >= 17 && hora <= 19.5) fHora = 1.55; // tarde
    else if (hora >= 22 || hora <= 5.5) fHora = 0.85; // madrugada
  } else {
    if (hora >= 11 && hora <= 14) fHora = 1.2;
    else if (hora >= 19 && hora <= 22) fHora = 1.15;
  }

  // 3) Factor clima (placeholder — se conectará con API meteorológica)
  const fClima = 1.0;

  // 4) Penalización por semáforos / intersecciones (≈ 25 s por km urbano)
  const tSemaforos = (distanciaM / 1000) * 25;

  const factor = fTraficoBase * fHora * fClima;
  const duracion = duracionBaseS * factor + tSemaforos;

  // Velocidad media efectiva (km/h) → clasificación cualitativa
  const velMedia = distanciaM / 1000 / (duracion / 3600);
  let nivel: RutaCalculada["nivelTrafico"];
  if (velMedia >= 35) nivel = "libre";
  else if (velMedia >= 22) nivel = "moderado";
  else if (velMedia >= 12) nivel = "pesado";
  else nivel = "congestionado";

  return { duracion, factor, nivel };
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
