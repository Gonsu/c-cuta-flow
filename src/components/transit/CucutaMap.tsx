/**
 * CucutaMap
 * Mapa real de Cúcuta usando Leaflet + OpenStreetMap.
 * Dibuja la ruta calculada como una polilínea destacada con marcadores
 * de origen y destino. Estilo claro tipo Waze/Google Maps.
 */
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
} from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

// Coordenadas de Cúcuta — recorrido representativo Centro → UFPS
// (puntos aproximados que siguen la malla vial)
const ROUTE_PRINCIPAL: LatLngExpression[] = [
  [7.8939, -72.5078], // Origen: Ventura Plaza / Centro
  [7.8956, -72.5068],
  [7.8978, -72.5055],
  [7.9002, -72.5031],
  [7.9028, -72.5008],
  [7.9051, -72.4985],
  [7.9072, -72.4960],
  [7.9089, -72.4933],
  [7.9099, -72.4905],
  [7.9105, -72.4880], // Destino: UFPS
];

const ROUTE_ALTERNA: LatLngExpression[] = [
  [7.8939, -72.5078],
  [7.8920, -72.5050],
  [7.8930, -72.5005],
  [7.8955, -72.4960],
  [7.8985, -72.4920],
  [7.9020, -72.4895],
  [7.9060, -72.4885],
  [7.9105, -72.4880],
];

const ORIGEN: LatLngExpression = [7.8939, -72.5078];
const DESTINO: LatLngExpression = [7.9105, -72.4880];

// Iconos personalizados con SVG inline (sin assets externos)
const iconoOrigen = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#0f172a;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const iconoDestino = L.divIcon({
  className: "",
  html: `
    <div style="position:relative">
      <div style="width:34px;height:34px;border-radius:50%;background:#8A1538;border:4px solid white;box-shadow:0 4px 14px rgba(138,21,56,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:800;font-family:'IBM Plex Mono',monospace;letter-spacing:-0.5px">U</div>
      <div style="position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:4px;background:#8A1538;color:white;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;font-family:'IBM Plex Mono',monospace;letter-spacing:0.1em;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">UFPS</div>
    </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

interface CucutaMapProps {
  algoritmo: "astar" | "dijkstra";
}

export function CucutaMap({ algoritmo }: CucutaMapProps) {
  // Centro entre origen y destino
  const center: LatLngExpression = [7.9022, -72.4979];

  const colorPrincipal =
    algoritmo === "astar" ? "hsl(343 73% 31%)" : "hsl(217 91% 47%)";

  return (
    <MapContainer
      center={center}
      zoom={14}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
      style={{ background: "#f4f3ee" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />

      {/* Ruta alternativa (atrás, gris) */}
      <Polyline
        positions={ROUTE_ALTERNA}
        pathOptions={{
          color: "#94a3b8",
          weight: 5,
          opacity: 0.55,
          dashArray: "1 8",
          lineCap: "round",
        }}
      />

      {/* Halo de la ruta principal */}
      <Polyline
        positions={ROUTE_PRINCIPAL}
        pathOptions={{
          color: colorPrincipal,
          weight: 12,
          opacity: 0.18,
          lineCap: "round",
          lineJoin: "round",
        }}
      />

      {/* Ruta principal */}
      <Polyline
        positions={ROUTE_PRINCIPAL}
        pathOptions={{
          color: colorPrincipal,
          weight: 6,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
        }}
      />

      <Marker position={ORIGEN} icon={iconoOrigen} />
      <Marker position={DESTINO} icon={iconoDestino} />

      <FitBounds positions={ROUTE_PRINCIPAL} />
    </MapContainer>
  );
}

function FitBounds({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions as L.LatLngTuple[]);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, positions]);
  return null;
}
