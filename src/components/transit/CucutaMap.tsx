/**
 * CucutaMap
 * Mapa real de Cúcuta con Leaflet + OSM.
 * - Soporta varias capas (estándar, satélite, relieve, transporte, tráfico).
 * - Expone una API imperativa vía ref: zoomIn/Out, locateMe, setLayer.
 * - Dibuja la ruta principal y alternativa (siguen calles reales).
 * - Permite tocar el mapa para fijar origen/destino.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { LatLngExpression, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Punto } from "@/lib/routing";

const iconoOrigen = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#0f172a;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const iconoDestino = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#8A1538;border:4px solid white;box-shadow:0 4px 14px rgba(138,21,56,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:800;font-family:'IBM Plex Mono',monospace">●</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const iconoUbicacion = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;inset:0;border-radius:50%;background:#3B82F6;opacity:0.25;animation:pulseLoc 2s ease-out infinite"></div>
    <div style="width:14px;height:14px;border-radius:50%;background:#3B82F6;border:2.5px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6)"></div>
    <style>@keyframes pulseLoc{0%{transform:scale(0.8);opacity:0.5}100%{transform:scale(2);opacity:0}}</style>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function iconoFlechaNav(headingDeg: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;transform:rotate(${headingDeg}deg);transition:transform 200ms linear">
      <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
        <circle cx="17" cy="17" r="15" fill="white" stroke="#8A1538" stroke-width="2"/>
        <path d="M17 5 L26 26 L17 21 L8 26 Z" fill="#8A1538" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export type Capa = "estandar" | "satelite" | "relieve" | "transporte" | "trafico";

const CAPAS: Record<Capa, { url: string; subdomains?: string[]; attribution?: string }> = {
  estandar: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a", "b", "c", "d"],
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  },
  relieve: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
  },
  transporte: {
    url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
  },
  // "Tráfico" no existe gratis; usamos el básico y encima el panel pinta el tráfico simulado.
  trafico: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a", "b", "c", "d"],
  },
};

export interface CucutaMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  locateMe: () => void;
  setLayer: (c: Capa) => void;
  getLayer: () => Capa;
  centerOnUser: (zoom?: number) => void;
}


interface RutaParaMapa {
  coords: [number, number][];
  color?: string;
  weight?: number;
  dashed?: boolean;
}

interface CucutaMapProps {
  algoritmo: "astar" | "dijkstra";
  origen: Punto | null;
  destino: Punto | null;
  rutaPrincipal: [number, number][] | null;
  rutaAlterna: [number, number][] | null;
  /** Ruta extra para comparación (ej. "evitando semáforos"). */
  rutaComparacion?: RutaParaMapa | null;
  modoSeleccion: "origen" | "destino" | null;
  onSeleccionMapa: (lat: number, lng: number) => void;
  onUbicacion?: (lat: number, lng: number) => void;
  ubicacionUsuario?: { lat: number; lng: number } | null;
  /** Si está navegando, dibuja flecha de heading y divide la ruta en recorrida/pendiente. */
  navegando?: boolean;
  heading?: number | null;
}

export const CucutaMap = forwardRef<CucutaMapHandle, CucutaMapProps>(function CucutaMap(
  {
    algoritmo,
    origen,
    destino,
    rutaPrincipal,
    rutaAlterna,
    rutaComparacion,
    modoSeleccion,
    onSeleccionMapa,
    onUbicacion,
    ubicacionUsuario,
    navegando = false,
    heading = null,
  },
  ref,
) {
  // Mantenemos el último heading conocido para no perder dirección cuando el GPS no la entrega.
  const lastHeadingRef = useRef<number>(0);
  if (typeof heading === "number" && !Number.isNaN(heading)) {
    lastHeadingRef.current = heading;
  }
  const center: LatLngExpression = origen
    ? [origen.lat, origen.lng]
    : [7.898144, -72.488809];

  const colorPrincipal =
    algoritmo === "astar" ? "hsl(343 73% 31%)" : "hsl(217 91% 47%)";

  const [capa, setCapa] = useState<Capa>("estandar");
  const mapRef = useRef<LeafletMap | null>(null);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    setLayer: (c: Capa) => setCapa(c),
    getLayer: () => capa,
    locateMe: () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          mapRef.current?.flyTo([latitude, longitude], 16, { duration: 0.8 });
          onUbicacion?.(latitude, longitude);
        },
        () => {
          // Si geolocalización falla (ej. preview), centramos en Cúcuta.
          mapRef.current?.flyTo([7.898144, -72.488809], 14, { duration: 0.8 });
        },
        { enableHighAccuracy: true, timeout: 6000 },
      );
    },
  }));

  const cfg = CAPAS[capa];

  return (
    <MapContainer
      center={center}
      zoom={14}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
      ref={(m) => {
        mapRef.current = m ?? null;
      }}
      style={{
        background: "#f4f3ee",
        cursor: modoSeleccion ? "crosshair" : "",
      }}
    >
      <TileLayer
        key={capa}
        url={cfg.url}
        {...(cfg.subdomains ? { subdomains: cfg.subdomains } : {})}
        maxZoom={19}
      />

      <ClickHandler enabled={!!modoSeleccion} onClick={onSeleccionMapa} />

      {/* Ruta de comparación (ej. "evitando semáforos") por debajo de la principal */}
      {rutaComparacion && (
        <Polyline
          positions={rutaComparacion.coords}
          pathOptions={{
            color: rutaComparacion.color ?? "#10b981",
            weight: rutaComparacion.weight ?? 5,
            opacity: 0.85,
            dashArray: rutaComparacion.dashed ? "6 8" : undefined,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}

      {rutaAlterna && (
        <Polyline
          positions={rutaAlterna}
          pathOptions={{
            color: "#94a3b8",
            weight: 5,
            opacity: 0.6,
            dashArray: "1 8",
            lineCap: "round",
          }}
        />
      )}

      {rutaPrincipal && (() => {
        let idxCercano = 0;
        if (navegando && ubicacionUsuario && rutaPrincipal.length > 1) {
          let best = Infinity;
          for (let i = 0; i < rutaPrincipal.length; i++) {
            const [lat, lng] = rutaPrincipal[i];
            const dLat = lat - ubicacionUsuario.lat;
            const dLng = lng - ubicacionUsuario.lng;
            const d2 = dLat * dLat + dLng * dLng;
            if (d2 < best) { best = d2; idxCercano = i; }
          }
        }
        const recorrida = navegando && idxCercano > 0 ? rutaPrincipal.slice(0, idxCercano + 1) : null;
        const pendiente = navegando && idxCercano > 0 ? rutaPrincipal.slice(idxCercano) : rutaPrincipal;
        const colorPend = navegando ? "#8A1538" : colorPrincipal;
        return (
          <>
            {recorrida && recorrida.length > 1 && (
              <Polyline
                positions={recorrida}
                pathOptions={{ color: "#cbd5e1", weight: 6, opacity: 0.3, lineCap: "round", lineJoin: "round" }}
              />
            )}
            <Polyline
              positions={pendiente}
              pathOptions={{ color: colorPend, weight: 12, opacity: 0.18, lineCap: "round", lineJoin: "round" }}
            />
            <Polyline
              positions={pendiente}
              pathOptions={{ color: colorPend, weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }}
            />
          </>
        );
      })()}

      {origen && !navegando && (
        <Marker position={[origen.lat, origen.lng]} icon={iconoOrigen} />
      )}
      {destino && (
        <Marker position={[destino.lat, destino.lng]} icon={iconoDestino} />
      )}
      {ubicacionUsuario && (
        <Marker
          position={[ubicacionUsuario.lat, ubicacionUsuario.lng]}
          icon={navegando ? iconoFlechaNav(lastHeadingRef.current) : iconoUbicacion}
        />
      )}

      <FitBounds positions={rutaPrincipal} />
    </MapContainer>
  );
});

function ClickHandler({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ positions }: { positions: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    const bounds = L.latLngBounds(positions as L.LatLngTuple[]);
    map.fitBounds(bounds, { padding: [70, 70] });
  }, [map, positions]);
  return null;
}
