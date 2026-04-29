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
  },
  ref,
) {
  const center: LatLngExpression = origen
    ? [origen.lat, origen.lng]
    : [7.8939, -72.5078];

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
          mapRef.current?.flyTo([7.8939, -72.5078], 14, { duration: 0.8 });
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

      {rutaPrincipal && (
        <>
          <Polyline
            positions={rutaPrincipal}
            pathOptions={{
              color: colorPrincipal,
              weight: 12,
              opacity: 0.18,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={rutaPrincipal}
            pathOptions={{
              color: colorPrincipal,
              weight: 6,
              opacity: 1,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </>
      )}

      {origen && (
        <Marker position={[origen.lat, origen.lng]} icon={iconoOrigen} />
      )}
      {destino && (
        <Marker position={[destino.lat, destino.lng]} icon={iconoDestino} />
      )}
      {ubicacionUsuario && (
        <Marker
          position={[ubicacionUsuario.lat, ubicacionUsuario.lng]}
          icon={iconoUbicacion}
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
