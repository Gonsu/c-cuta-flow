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

// Área Metropolitana de Cúcuta: Cúcuta + Los Patios + Villa del Rosario.
// Formato Nominatim viewbox: lon_min,lat_max,lon_max,lat_min
const CUCUTA_VIEWBOX = "-72.60,7.99,-72.42,7.77";
// Bounding-box estricto para validar coordenadas dentro del AMC
export const AMC_BBOX = { south: 7.77, north: 7.99, west: -72.60, east: -72.42 };
const CUCUTA_BOUNDS = { lat: 7.898144, lng: -72.488809 };

/** Verifica si un punto cae dentro del área metropolitana de Cúcuta. */
export function dentroDelAMC(p: { lat: number; lng: number }): boolean {
  return (
    p.lat >= AMC_BBOX.south &&
    p.lat <= AMC_BBOX.north &&
    p.lng >= AMC_BBOX.west &&
    p.lng <= AMC_BBOX.east
  );
}

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
  // Pedimos hasta 3 alternativas para que el usuario pueda elegir.
  // OSRM acepta `alternatives=number` para forzar varias rutas distintas.
  const altParam = alternativas || evitarSemaforos ? "3" : "false";
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordsParam}` +
    `?overview=full&geometries=geojson&alternatives=${altParam}` +
    `&continue_straight=false`;

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

  // Deduplicar geometrías muy parecidas (OSRM a veces devuelve casi-iguales).
  const unicas: RutaCalculada[] = [];
  for (const r of enriquecidas) {
    const dup = unicas.some(
      (u) =>
        Math.abs(u.distancia - r.distancia) < 60 &&
        Math.abs(u.duracion - r.duracion) < 25,
    );
    if (!dup) unicas.push(r);
  }

  // Ordenar:
  //  • "Evitar semáforos": prioriza menor densidad de intersecciones
  //  • Normal: prioriza menor ETA realista
  if (evitarSemaforos && unicas.length > 1) {
    unicas.sort(
      (a, b) =>
        a.densidadSemaforos * 60 + a.duracion / 60 -
        (b.densidadSemaforos * 60 + b.duracion / 60),
    );
  } else {
    unicas.sort((a, b) => a.duracion - b.duracion);
  }

  return unicas;
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


/* ------------------------------------------------------------------ */
/*  Geocodificación — Nominatim con normalización de direcciones CO    */
/*  Estrategia tipo Google Maps Place Autocomplete:                    */
/*    1) Parsear tokens CO (tipo vía, número, sufijo cardinal, casa,   */
/*       barrio).                                                      */
/*    2) Lanzar en paralelo:                                           */
/*         a) Búsqueda STRUCTURED (street + city) — la más precisa.    */
/*         b) Búsqueda libre normalizada acotada al AMC.               */
/*         c) Búsqueda libre cruda sin bounded (tolera typos).         */
/*    3) Mezclar, deduplicar, rankear por proximidad a Cúcuta y por    */
/*       match con tokens de la consulta.                              */
/* ------------------------------------------------------------------ */

const MUNICIPIOS_AMC = ["cúcuta", "cucuta", "los patios", "villa del rosario"];

interface DireccionParseada {
  /** Calle reconstruida lista para Nominatim, ej. "Calle 4 Norte 7E-30". */
  calle: string;
  /** Barrio / suburb si lo escribió, ej. "Los Pinos". */
  barrio?: string;
  /** Municipio si lo escribió, ej. "Los Patios". */
  municipio?: string;
  /** Texto restante (POI, lugar). */
  resto: string;
  /** True si parece una dirección estructurada (tipo vía + número). */
  esDireccion: boolean;
}

const TIPOS_VIA: Record<string, string> = {
  cl: "Calle", cll: "Calle", calle: "Calle",
  cra: "Carrera", kra: "Carrera", carr: "Carrera", carrera: "Carrera", kr: "Carrera",
  av: "Avenida", avda: "Avenida", avenida: "Avenida",
  diag: "Diagonal", diagonal: "Diagonal",
  trans: "Transversal", transv: "Transversal", transversal: "Transversal",
  autopista: "Autopista", auto: "Autopista",
};

const MUNICIPIOS_TOKENS = [
  { match: /\b(los\s*patios)\b/i, nombre: "Los Patios" },
  { match: /\b(villa\s*del\s*rosario)\b/i, nombre: "Villa del Rosario" },
  { match: /\b(c[uú]cuta)\b/i, nombre: "Cúcuta" },
];

/**
 * Parsea una consulta tipo "cl 4n #7e-30 los pinos, los patios".
 * Devuelve calle normalizada + barrio/municipio si los detecta.
 */
function parsearDireccionCO(input: string): DireccionParseada {
  let s = " " + input.toLowerCase().trim().replace(/\s+/g, " ") + " ";

  // Detectar municipio (lo quitamos antes de seguir parseando).
  let municipio: string | undefined;
  for (const m of MUNICIPIOS_TOKENS) {
    if (m.match.test(s)) {
      municipio = m.nombre;
      s = s.replace(m.match, " ");
      break;
    }
  }

  // Normalizar separadores #, No., nro
  s = s.replace(/#|n[ºo°]\.?|nro\.?|num\.?/g, " ");

  // Detectar tipo de vía + número [+ sufijo cardinal] [+ casa]
  // Ej: "cl 4 n 7 e 30", "calle 4n 7e-30", "carrera 12 5 20"
  const tipoRegex = new RegExp(
    `\\b(${Object.keys(TIPOS_VIA).join("|")})\\b\\.?`,
    "i",
  );
  let calle = "";
  let esDireccion = false;

  const tipoMatch = s.match(tipoRegex);
  if (tipoMatch) {
    const tipoCanonico = TIPOS_VIA[tipoMatch[1].toLowerCase()];
    const idx = s.indexOf(tipoMatch[0]);
    let after = s.slice(idx + tipoMatch[0].length).trim();
    // capturar: número con sufijo opcional (norte/sur/este/oeste o n/s/e/o), luego "número casa"
    const numRegex =
      /^(\d+)\s*(n|s|e|o|norte|sur|este|oeste)?(?:\s+(\d+)\s*(n|s|e|o|norte|sur|este|oeste)?(?:\s*[-–]\s*(\d+))?)?/i;
    const m = after.match(numRegex);
    if (m) {
      const sufijoMap: Record<string, string> = {
        n: "Norte", s: "Sur", e: "Este", o: "Oeste",
        norte: "Norte", sur: "Sur", este: "Este", oeste: "Oeste",
      };
      const num1 = m[1];
      const suf1 = m[2] ? sufijoMap[m[2].toLowerCase()] : "";
      const num2 = m[3] ?? "";
      const suf2 = m[4] ? sufijoMap[m[4].toLowerCase()] : "";
      const casa = m[5] ?? "";
      calle = `${tipoCanonico} ${num1}${suf1 ? " " + suf1 : ""}`;
      if (num2) calle += ` #${num2}${suf2 ? suf2 : ""}${casa ? "-" + casa : ""}`;
      esDireccion = true;
      // remover lo capturado para dejar como "resto" lo que quede (barrio, etc.)
      after = after.slice(m[0].length).trim();
      s = s.slice(0, idx).trim() + " " + after;
    } else {
      calle = tipoCanonico;
      esDireccion = true;
      s = s.slice(0, idx).trim() + " " + after;
    }
  }

  // Resto = lo que queda después de quitar tipo+número+municipio
  const resto = s.replace(/\s+/g, " ").trim();

  // Si quedó texto, asumimos que es barrio / POI
  let barrio: string | undefined = resto.length > 0 ? resto : undefined;

  return { calle, barrio, municipio, resto, esDireccion };
}

/** Lanza una consulta a Nominatim. Soporta modo libre y estructurado. */
async function nominatimSearch(
  params: Record<string, string>,
  opts: { bounded?: boolean; limit?: number } = {},
): Promise<any[]> {
  const { bounded = true, limit = 8 } = opts;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("viewbox", CUCUTA_VIEWBOX);
  if (bounded) url.searchParams.set("bounded", "1");
  url.searchParams.set("countrycodes", "co");
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "Accept-Language": "es" },
    });
    if (!res.ok) {
      console.error(`[Nominatim] HTTP ${res.status} para`, params);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("[Nominatim] fetch error:", err, "params:", params);
    return [];
  }
}

/** Distancia cuadrada simple (sin sqrt) al centro de Cúcuta — para ranking. */
function distCuadradaAlCentro(lat: number, lng: number) {
  const dLat = lat - CUCUTA_BOUNDS.lat;
  const dLng = lng - CUCUTA_BOUNDS.lng;
  return dLat * dLat + dLng * dLng;
}

/**
 * Autocompletado tipo Google Maps Place Autocomplete, restringido al AMC.
 * Combina búsqueda estructurada (street + city) con búsquedas libres,
 * tolera typos y rankea por proximidad a Cúcuta.
 */
export async function buscarLugares(query: string): Promise<Punto[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const parseada = parsearDireccionCO(q);
  const promesas: Promise<any[]>[] = [];

  // (a) Búsqueda estructurada — usa parámetros separados (la más precisa).
  if (parseada.esDireccion && parseada.calle) {
    const ciudad = parseada.municipio ?? "Cúcuta";
    promesas.push(
      nominatimSearch(
        {
          street: parseada.calle,
          city: ciudad,
          county: "Cúcuta",
          state: "Norte de Santander",
          country: "Colombia",
        },
        { bounded: false, limit: 6 },
      ),
    );
    if (parseada.barrio) {
      promesas.push(
        nominatimSearch(
          {
            street: `${parseada.calle} ${parseada.barrio}`,
            city: ciudad,
            state: "Norte de Santander",
            country: "Colombia",
          },
          { bounded: false, limit: 6 },
        ),
      );
    }
  }

  // (b) Búsqueda libre — query crudo + variantes con ciudad.
  const ciudadHint = parseada.municipio ?? "Cúcuta";
  const libres = [
    q,
    `${q}, ${ciudadHint}, Norte de Santander, Colombia`,
  ];
  if (parseada.esDireccion && parseada.calle) {
    const completo = parseada.barrio
      ? `${parseada.calle}, ${parseada.barrio}, ${ciudadHint}`
      : `${parseada.calle}, ${ciudadHint}`;
    libres.push(`${completo}, Norte de Santander, Colombia`);
  }
  for (const v of libres) {
    promesas.push(nominatimSearch({ q: v }, { bounded: true, limit: 6 }));
  }
  // (c) Variantes sin bounded para tolerar coincidencias parciales.
  promesas.push(nominatimSearch({ q: `${q}, Cúcuta` }, { bounded: false, limit: 6 }));
  promesas.push(nominatimSearch({ q: `${q}, Norte de Santander, Colombia` }, { bounded: false, limit: 6 }));

  const lotes = await Promise.all(promesas);
  const crudos = lotes.flat();

  if (crudos.length === 0) {
    console.warn("[buscarLugares] Nominatim no devolvió resultados para:", q);
  }

  const tokens = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  type Cand = { p: Punto; score: number };
  const vistos = new Map<string, Cand>();

  // Bounding box ampliado (~5km) para tolerar resultados justo en el borde.
  const margen = 0.05;
  const bboxAmplio = {
    south: AMC_BBOX.south - margen,
    north: AMC_BBOX.north + margen,
    west: AMC_BBOX.west - margen,
    east: AMC_BBOX.east + margen,
  };

  for (const d of crudos) {
    const lat = parseFloat(d.lat);
    const lng = parseFloat(d.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // Aceptamos resultados dentro del bbox ampliado O en Norte de Santander.
    const addr = d.address ?? {};
    const enBbox =
      lat >= bboxAmplio.south &&
      lat <= bboxAmplio.north &&
      lng >= bboxAmplio.west &&
      lng <= bboxAmplio.east;
    const estado = (addr.state ?? "").toString().toLowerCase();
    const enEstado = estado.includes("santander") || estado.includes("norte de santander");
    if (!enBbox && !enEstado) continue;

    const key =
      d.osm_id != null
        ? `${d.osm_type}-${d.osm_id}`
        : `${lat.toFixed(5)}-${lng.toFixed(5)}`;

    const display = (d.display_name ?? "").toLowerCase();
    const matches = tokens.reduce(
      (acc, t) => acc + (display.includes(t) ? 1 : 0),
      0,
    );
    const tipo = (d.addresstype ?? d.class ?? "").toString();
    const tipoBonus =
      tipo === "road" || tipo === "house" || tipo === "highway" ? 0.5 : 0;
    const dist = distCuadradaAlCentro(lat, lng);
    const dentroBonus = dentroDelAMC({ lat, lng }) ? 0.4 : 0;
    const score =
      (Number(d.importance) || 0) +
      matches * 0.3 +
      tipoBonus +
      dentroBonus -
      dist * 50;

    const prev = vistos.get(key);
    if (!prev || score > prev.score) {
      vistos.set(key, {
        p: { label: formatearDireccion(d), lat, lng },
        score,
      });
    }
  }

  const finales = Array.from(vistos.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((c) => c.p);

  if (finales.length === 0 && crudos.length > 0) {
    console.warn(
      `[buscarLugares] ${crudos.length} resultados crudos filtrados a 0. Query: "${q}"`,
    );
  }

  return finales;
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
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "es" },
  });
  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const data = await res.json();
  return formatearDireccion(data);
}

/**
 * Construye una etiqueta tipo Google Maps:
 *   "Calle 4 N #7E-30 · Los Pinos · Cúcuta"
 */
function formatearDireccion(d: any): string {
  const addr = d.address ?? {};
  const via =
    addr.road ?? addr.pedestrian ?? addr.footway ?? addr.residential ?? "";
  const numero = addr.house_number ?? "";
  const barrio =
    addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? addr.city_district ?? "";
  const ciudad =
    addr.city ?? addr.town ?? addr.municipality ?? addr.village ?? "";
  // limpia el "Perímetro Urbano " que Nominatim suele poner en Cúcuta
  const ciudadLimpia = ciudad.replace(/^per[íi]metro urbano\s+/i, "");
  const partes: string[] = [];
  if (d.name && d.name !== via) partes.push(d.name);
  if (via) partes.push(numero ? `${via} #${numero}` : via);
  if (barrio) partes.push(barrio);
  if (ciudadLimpia) partes.push(ciudadLimpia);
  if (partes.length === 0) {
    const raw = (d.display_name ?? "").split(",").map((s: string) => s.trim());
    return raw.slice(0, 2).join(" · ");
  }
  // Deduplicar partes consecutivas iguales
  const out: string[] = [];
  for (const p of partes) if (out[out.length - 1] !== p) out.push(p);
  return out.join(" · ");
}

export const CUCUTA_CENTER = CUCUTA_BOUNDS;
