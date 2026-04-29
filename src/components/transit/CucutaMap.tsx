/**
 * CucutaMap
 * Mapa real de Cúcuta con Leaflet + OSM.
 * - Dibuja la ruta principal y alternativa que vienen de OSRM (siguen calles reales).
 * - Permite tocar el mapa para fijar origen/destino.
 */
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
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

interface CucutaMapProps {
  algoritmo: "astar" | "dijkstra";
  origen: Punto | null;
  destino: Punto | null;
  rutaPrincipal: [number, number][] | null;
  rutaAlterna: [number, number][] | null;
  modoSeleccion: "origen" | "destino" | null;
  onSeleccionMapa: (lat: number, lng: number) => void;
}

export function CucutaMap({
  algoritmo,
  origen,
  destino,
  rutaPrincipal,
  rutaAlterna,
  modoSeleccion,
  onSeleccionMapa,
}: CucutaMapProps) {
  const center: LatLngExpression = origen
    ? [origen.lat, origen.lng]
    : [7.8939, -72.5078];

  const colorPrincipal =
    algoritmo === "astar" ? "hsl(343 73% 31%)" : "hsl(217 91% 47%)";

  return (
    <MapContainer
      center={center}
      zoom={14}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
      style={{
        background: "#f4f3ee",
        cursor: modoSeleccion ? "crosshair" : "",
      }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />

      <ClickHandler enabled={!!modoSeleccion} onClick={onSeleccionMapa} />

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

      <FitBounds positions={rutaPrincipal} />
    </MapContainer>
  );
}

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
