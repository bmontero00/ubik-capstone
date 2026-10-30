'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LocateFixed, Loader2 } from 'lucide-react';
import { DARK_TILES, categoryColor } from '../utils/mapTiles';
import { formatEventDate, formatPrice } from '../services/events';
import { EVENT_STATUS_LABELS } from '../utils/labels';

interface MapEvent {
  id: string;
  title: string;
  price: number;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  status?: keyof typeof EVENT_STATUS_LABELS;
  category?: { name: string };
}

interface MapProps {
  events: MapEvent[];
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  // Solo se dibuja el punto verde cuando hay una ubicación real del usuario dentro de Santiago
  userLocation?: { lat: number; lng: number; accuracy: number } | null;
  locating?: boolean;
  onLocate?: () => void;
  onSelectLocationForNewEvent?: (lat: number, lng: number) => void;
}

// Pin con el color de la categoría del evento
const eventIcon = (color: string, muted: boolean) =>
  L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="opacity:${muted ? 0.55 : 1};filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">
      <path d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.6 14 35 14 35s12.5-12.4 12.5-21.8C26.5 6.4 21 1 14 1z" fill="${color}" stroke="#0f172a" stroke-width="1.5"/>
      <circle cx="14" cy="13" r="5" fill="#0f172a"/>
    </svg>`,
  });

// Punto verde pulsante para la ubicación actual del usuario
const userIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span style="position:relative;display:block;width:22px;height:22px">
      <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:rgba(52,211,153,.45)"></span>
      <span style="position:absolute;inset:4px;border-radius:9999px;background:#10b981;border:3px solid #ecfdf5;box-shadow:0 0 0 2px rgba(16,185,129,.5)"></span>
    </span>`,
});

// Centra y ajusta el zoom al radio de búsqueda cuando cambia la ubicación o el radio
function FitToRadius({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap();
  const first = useRef(true);
  const bounds = () => L.latLng(lat, lng).toBounds(radiusKm * 2000);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      map.fitBounds(bounds(), { padding: [24, 24], animate: false });
    } else {
      map.flyToBounds(bounds(), { padding: [24, 24], duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm, map]);

  // El contenedor puede cambiar de tamaño después de montarse (animaciones, carga de la página).
  // Leaflet no se entera solo: sin esto el mapa queda cortado y con un zoom incorrecto.
  useEffect(() => {
    const container = map.getContainer();
    let last = `${container.clientWidth}x${container.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const size = `${container.clientWidth}x${container.clientHeight}`;
      if (size === last) return;
      last = size;
      map.invalidateSize();
      map.fitBounds(bounds(), { padding: [24, 24], animate: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, lat, lng, radiusKm]);
  return null;
}

function MapContextMenu({ onRightClick }: { onRightClick: (lat: number, lng: number, containerPoint: L.Point) => void }) {
  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault();
      onRightClick(e.latlng.lat, e.latlng.lng, e.containerPoint);
    },
    click() {
      onRightClick(0, 0, new L.Point(-999, -999));
    },
  });
  return null;
}

export default function Map({
  events, centerLat, centerLng, radiusKm, userLocation, locating, onLocate, onSelectLocationForNewEvent,
}: MapProps) {
  const [contextMenu, setContextMenu] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);
  const icons = useMemo(() => new globalThis.Map<string, L.DivIcon>(), []);
  const iconFor = (evt: MapEvent) => {
    const muted = !!evt.status && evt.status !== 'PUBLISHED';
    const key = `${evt.category?.name}-${muted}`;
    if (!icons.has(key)) icons.set(key, eventIcon(categoryColor(evt.category?.name), muted));
    return icons.get(key)!;
  };

  const handleRightClick = (lat: number, lng: number, containerPoint: L.Point) => {
    // Sin permiso para publicar no se muestra el menú contextual
    if (!onSelectLocationForNewEvent || (lat === 0 && lng === 0)) {
      setContextMenu(null);
      return;
    }
    setContextMenu({ lat, lng, x: containerPoint.x, y: containerPoint.y });
  };

  const handleCreateEventClick = () => {
    if (contextMenu && onSelectLocationForNewEvent) {
      onSelectLocationForNewEvent(contextMenu.lat, contextMenu.lng);
    }
    setContextMenu(null);
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer center={[centerLat, centerLng]} zoom={13} zoomSnap={0.5} scrollWheelZoom className="w-full h-full z-0 bg-slate-950">
        <TileLayer url={DARK_TILES.url} attribution={DARK_TILES.attribution} className={DARK_TILES.className} maxZoom={DARK_TILES.maxZoom} />

        <FitToRadius lat={centerLat} lng={centerLng} radiusKm={radiusKm} />

        <Circle
          center={[centerLat, centerLng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#6366f1', weight: 1.5, fillColor: '#6366f1', fillOpacity: 0.08, dashArray: '6 6' }}
        />

        {userLocation && (
          <>
            {/* Margen de error de la ubicación entregada por el navegador */}
            {userLocation.accuracy > 30 && userLocation.accuracy < 3000 && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy}
                pathOptions={{ color: '#10b981', weight: 1, fillColor: '#10b981', fillOpacity: 0.08 }}
              />
            )}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000}>
              <Popup>
                <strong>Tu ubicación actual</strong>
                <br />
                Desde aquí calculamos la distancia a los eventos.
              </Popup>
            </Marker>
          </>
        )}

        {events.map((evt) => (
          <Marker key={evt.id} position={[evt.latitude, evt.longitude]} icon={iconFor(evt)}>
            <Popup>
              <div className="text-slate-800 min-w-[180px]">
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1"
                  style={{ background: `${categoryColor(evt.category?.name)}33`, color: '#1e293b' }}
                >
                  {evt.category?.name}
                </span>
                <strong className="text-sm block leading-snug">{evt.title}</strong>
                {evt.status && evt.status !== 'PUBLISHED' && (
                  <span className="text-[11px] font-bold text-rose-600 block">{EVENT_STATUS_LABELS[evt.status].label}</span>
                )}
                <span className="text-xs text-slate-600 block mt-1">{formatEventDate(evt.date)}</span>
                <span className="text-xs text-slate-500 block">{evt.address}</span>
                <span className="text-xs font-bold text-indigo-600 block mt-1">{formatPrice(evt.price)}</span>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapContextMenu onRightClick={handleRightClick} />
      </MapContainer>

      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          title="Centrar el mapa en mi ubicación"
          className="absolute top-3 right-3 z-[400] flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white shadow-lg backdrop-blur disabled:opacity-70"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4 text-emerald-400" />}
          {locating ? 'Buscando…' : 'Usar mi ubicación'}
        </button>
      )}

      {contextMenu && contextMenu.x > 0 && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="absolute z-[500] bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-2 animate-fade-in text-xs text-white"
        >
          <button
            onClick={handleCreateEventClick}
            className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-600 rounded-lg transition-colors w-full text-left font-medium"
          >
            <span className="text-sm">📍</span> Crear un evento en este punto
          </button>
        </div>
      )}
    </div>
  );
}
