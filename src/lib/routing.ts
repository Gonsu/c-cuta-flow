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

export interface ClimaCucuta {
  temperaturaC: number;
  lluviaMmH: number;
  vientoKmH: number;
  codigo: number;
  descripcion: string;
  factorClima: number;
}

export interface RutaCalculada {
  /** Polilínea siguiendo las calles reales [lat, lng] */
  coords: [number, number][];
  /** Distancia total en metros */
  distancia: number;
  /** Duración ajustada en segundos (modelo tipo Waze) */
  duracion: number;
  /** Duración base OSRM en flujo libre (sin tráfico) */
  duracionBase: number;
  /** Factor multiplicador combinado de tráfico+hora+clima */
  factorTrafico: number;
  nivelTrafico: "libre" | "moderado" | "pesado" | "congestionado";
  /** Semáforos OSM detectados sobre el buffer de la ruta */
  semaforos: number;
  /** Densidad de semáforos (sem/km) */
  densidadSemaforos: number;
  /** Segundos sumados por penalización de intersecciones */
  penalizacionSemaforosS: number;
  /** Clima usado para este cálculo */
  clima: ClimaCucuta | null;
}

const CUCUTA_VIEWBOX = "-72.58,7.95,-72.45,7.84"; // lon_min,lat_max,lon_max,lat_min
const CUCUTA_BOUNDS = { lat: 7.8939, lng: -72.5078 };

export interface OpcionesRuta {
  alternativas?: boolean;
  /** Si está activo, recalcula con multiplicador de penalización de semáforos
   *  alto y reordena las rutas para que la principal sea la de menor penalización. */
  evitarSemaforos?: boolean;
}

/**
 * Calcula una ruta real entre dos puntos usando OSRM público.
 * Enriquece con clima en vivo (Open-Meteo) y conteo real de semáforos
 * (Overpass / OSM) en un buffer alrededor de la polilínea.
 */
export async function calcularRutaOSRM(
  origen: Punto,
  destino: Punto,
  opciones: OpcionesRuta = {},
): Promise<RutaCalculada[]> {
  const { alternativas = false, evitarSemaforos = false } = opciones;
  const coordsParam = `${origen.lng},${origen.lat};${destino.lng},${destino.lat}`;
  // Si vamos a evitar semáforos pedimos siempre alternativas para poder elegir.
  const pedirAlt = alternativas || evitarSemaforos;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&alternatives=${pedirAlt}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error("Sin rutas");

  // Clima compartido para todas las alternativas (1 sola request).
  const clima = await obtenerClimaCucuta().catch(() => null);

  // Para cada ruta consultamos semáforos reales en paralelo.
  const enriquecidas: RutaCalculada[] = await Promise.all(
    data.routes.map(async (r: any) => {
      const coords: [number, number][] = r.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );
      const semaforos = await contarSemaforosOverpass(coords).catch(() => null);
      const ajuste = ajustarETA(
        r.distance,
        r.duration,
        semaforos,
        clima,
        evitarSemaforos,
      );
      return {
        coords,
        distancia: r.distance,
        duracionBase: r.duration,
        duracion: ajuste.duracion,
        factorTrafico: ajuste.factor,
        nivelTrafico: ajuste.nivel,
        semaforos: ajuste.semaforos,
        densidadSemaforos: ajuste.densidad,
        penalizacionSemaforosS: ajuste.penalizacionS,
        clima,
      } as RutaCalculada;
    }),
  );

  // Si "evitar semáforos" está activo, la ruta principal es la de menor
  // densidad de semáforos (penalización por km), con un sesgo a favor de
  // ETA total para no escoger un rodeo absurdo.
  if (evitarSemaforos && enriquecidas.length > 1) {
    enriquecidas.sort((a, b) => {
      const score = (r: RutaCalculada) =>
        r.densidadSemaforos * 60 + r.duracion / 60;
      return score(a) - score(b);
    });
  }

  return enriquecidas;
}

/* ------------------------------------------------------------------ */
/*  Modelo de ETA realista — Waze/Google Maps                         */
/* ------------------------------------------------------------------ */

/**
 * t_real = t_base · (f_trafico · f_hora · f_clima)  +  Σ penalización_semaforo
 *
 * - f_trafico:    densidad urbana base (1.6 en Cúcuta)
 * - f_hora:       hora pico laboral
 * - f_clima:      derivado de Open-Meteo (lluvia mm/h + temperatura)
 * - penalización: cada semáforo OSM aporta 18-32 s según densidad y tramo
 *
 * La penalización NO es un multiplicador plano: depende del número real
 * de `highway=traffic_signals` dentro del buffer de la polilínea, y se
 * ajusta por densidad (sem/km) — más densidad ⇒ ondas verdes peor sincronizadas.
 */
function ajustarETA(
  distanciaM: number,
  duracionBaseS: number,
  semaforosReales: number | null,
  clima: ClimaCucuta | null,
  evitarSemaforos = false,
) {
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  const diaSemana = ahora.getDay();

  // 1) Tráfico urbano base
  const fTraficoBase = 1.6;

  // 2) Hora pico
  let fHora = 1.0;
  const esLaboral = diaSemana >= 1 && diaSemana <= 5;
  if (esLaboral) {
    if (hora >= 6.5 && hora <= 8.5) fHora = 1.45;
    else if (hora >= 11.5 && hora <= 13.5) fHora = 1.25;
    else if (hora >= 17 && hora <= 19.5) fHora = 1.55;
    else if (hora >= 22 || hora <= 5.5) fHora = 0.85;
  } else {
    if (hora >= 11 && hora <= 14) fHora = 1.2;
    else if (hora >= 19 && hora <= 22) fHora = 1.15;
  }

  // 3) Clima (Open-Meteo)
  const fClima = clima?.factorClima ?? 1.0;

  // 4) Penalización por intersecciones (modelo no-lineal)
  // Si Overpass falló: estimación por densidad urbana ≈ 2.2 sem/km
  const km = distanciaM / 1000;
  const semaforos = semaforosReales ?? Math.round(km * 2.2);
  const densidad = km > 0 ? semaforos / km : 0;

  // Costo unitario por semáforo: 18 s base + bonus por congestión local.
  // densidad alta ⇒ ondas verdes desincronizadas, costo crece logarítmicamente.
  // Si el usuario pidió "Evitar semáforos", el costo unitario sube ~70 %
  // para que el ranker prefiera rutas con menos intersecciones.
  const refuerzo = evitarSemaforos ? 1.7 : 1.0;
  const costoUnitario =
    (18 + 14 * Math.min(1, Math.log10(1 + densidad) / 0.6)) * refuerzo;
  const penalizacionS = semaforos * costoUnitario;

  const factor = fTraficoBase * fHora * fClima;
  const duracion = duracionBaseS * factor + penalizacionS;

  // Velocidad media efectiva → clasificación cualitativa
  const velMedia = km > 0 ? km / (duracion / 3600) : 0;
  let nivel: RutaCalculada["nivelTrafico"];
  if (velMedia >= 35) nivel = "libre";
  else if (velMedia >= 22) nivel = "moderado";
  else if (velMedia >= 12) nivel = "pesado";
  else nivel = "congestionado";

  return { duracion, factor, nivel, semaforos, densidad, penalizacionS };
}

/* ------------------------------------------------------------------ */
/*  Overpass — semáforos reales sobre el buffer de la polilínea       */
/* ------------------------------------------------------------------ */

/**
 * Cuenta `highway=traffic_signals` dentro del bounding-box que envuelve
 * la polilínea (con margen ~120 m). Usa la instancia pública de Overpass.
 */
async function contarSemaforosOverpass(
  coords: [number, number][],
): Promise<number> {
  if (coords.length < 2) return 0;
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const margin = 0.0011; // ~120 m
  const south = Math.min(...lats) - margin;
  const north = Math.max(...lats) + margin;
  const west = Math.min(...lngs) - margin;
  const east = Math.max(...lngs) + margin;

  const query = `[out:json][timeout:8];
node["highway"="traffic_signals"](${south},${west},${north},${east});
out count;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = await res.json();
  // `out count` devuelve un único elemento con tags.nodes
  const first = data.elements?.[0];
  const total = parseInt(first?.tags?.nodes ?? "0", 10);
  return Number.isFinite(total) ? total : 0;
}

/* ------------------------------------------------------------------ */
/*  Open-Meteo — clima en vivo para Cúcuta                            */
/* ------------------------------------------------------------------ */

let climaCache: { ts: number; data: ClimaCucuta } | null = null;
const CLIMA_TTL_MS = 10 * 60 * 1000; // 10 min

export async function obtenerClimaCucuta(): Promise<ClimaCucuta> {
  if (climaCache && Date.now() - climaCache.ts < CLIMA_TTL_MS) {
    return climaCache.data;
  }
  const { lat, lng } = CUCUTA_BOUNDS;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timezone", "America/Bogota");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();
  const c = data.current ?? {};
  const lluvia = Number(c.precipitation ?? 0);
  const temp = Number(c.temperature_2m ?? 28);
  const viento = Number(c.wind_speed_10m ?? 0);
  const codigo = Number(c.weather_code ?? 0);

  // Modelo del factor climático f_clima ∈ [1.00, 1.40]
  // Lluvia es el principal driver; temperaturas extremas y viento añaden marginalmente.
  let factor = 1.0;
  if (lluvia >= 7) factor += 0.28;            // lluvia fuerte
  else if (lluvia >= 2.5) factor += 0.18;     // moderada
  else if (lluvia >= 0.5) factor += 0.09;     // ligera
  else if (lluvia > 0) factor += 0.04;        // llovizna
  if (temp >= 36) factor += 0.04;             // calor extremo (Cúcuta)
  if (viento >= 35) factor += 0.04;           // ráfagas fuertes
  factor = Math.min(factor, 1.4);

  const data_: ClimaCucuta = {
    temperaturaC: temp,
    lluviaMmH: lluvia,
    vientoKmH: viento,
    codigo,
    descripcion: descripcionWMO(codigo),
    factorClima: Number(factor.toFixed(3)),
  };
  climaCache = { ts: Date.now(), data: data_ };
  return data_;
}

function descripcionWMO(code: number): string {
  if (code === 0) return "Despejado";
  if ([1, 2].includes(code)) return "Parcial";
  if (code === 3) return "Nublado";
  if ([45, 48].includes(code)) return "Niebla";
  if ([51, 53, 55].includes(code)) return "Llovizna";
  if ([61, 63, 65].includes(code)) return "Lluvia";
  if ([66, 67].includes(code)) return "Lluvia helada";
  if ([71, 73, 75, 77].includes(code)) return "Nieve";
  if ([80, 81, 82].includes(code)) return "Chubascos";
  if ([95, 96, 99].includes(code)) return "Tormenta";
  return "—";
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
