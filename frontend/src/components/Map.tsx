'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LocateFixed, Loader2, Plus, Minus, Crosshair } from 'lucide-react';
import { DARK_TILES, categoryColor } from '../utils/mapTiles';
import { formatEventDate, formatPrice, imageSrc } from '../services/events';
import { EVENT_STATUS_LABELS } from '../utils/labels';
import { OfferBadge, OfferPrice } from './events/OfferBadge';

interface MapEvent {
  id: string;
  title: string;
  price: number;
  precioFinal?: number; // incluye el cargo por servicio (y la oferta vigente)
  ofertaActiva?: boolean;
  variosPrecios?: boolean;
  agotado?: boolean;
  edadMinima?: number | null;
  precioSinOferta?: number;
  porcentajeDescuento?: number;
  ofertaHasta?: string | null;
  ventaPausada?: boolean;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
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
  onOpenEvent?: (id: string) => void; // botón "Ver más" del popup
  // Sector elegido en el buscador "¿Dónde?": centro de la búsqueda, con su contorno si es una comuna
  sector?: SectorMapa | null;
}

export interface SectorMapa {
  nombre: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // [oeste, sur, este, norte]
  contorno?: GeoJSON.GeoJsonObject;
}

// Pin del sector buscado
const sectorIcon = L.divIcon({
  className: '',
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  popupAnchor: [0, -32],
  html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.55))">
      <path d="M15 1C7.3 1 1.5 6.8 1.5 14.1 1.5 24.2 15 37 15 37s13.5-12.8 13.5-22.9C28.5 6.8 22.7 1 15 1z" fill="#6366f1" stroke="#e0e7ff" stroke-width="2"/>
      <circle cx="15" cy="14" r="5.5" fill="#e0e7ff"/>
    </svg>`,
});

// Encuadra el sector: el contorno de la comuna completo o, si no hay, el área del lugar
function FitSector({ sector }: { sector: SectorMapa }) {
  const map = useMap();
  const bbox = sector.bbox;
  useEffect(() => {
    if (!bbox) return;
    const [oeste, sur, este, norte] = bbox;
    // Lugares muy chicos (una plaza) no se acercan de más
    map.flyToBounds([[sur, oeste], [norte, este]], { padding: [32, 32], maxZoom: 15, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox?.join(','), map]);
  return null;
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

// Zoom con el que se abre el mapa (unos pocos kilómetros a la redonda) y al volver a la ubicación
const START_ZOOM = 13;
const LOCATED_ZOOM = 14; // con la ubicación real del usuario se acerca un poco más

// Mantiene la vista del mapa al día: se abre cerca del punto de referencia, se acerca a la
// ubicación cuando el usuario la entrega y muestra el radio completo cuando el usuario lo cambia
function SyncView({ lat, lng, radiusKm, located }: { lat: number; lng: number; radiusKm: number; located: boolean }) {
  const map = useMap();
  const previous = useRef<{ lat: number; lng: number; radiusKm: number } | null>(null);

  useEffect(() => {
    const prev = previous.current;
    previous.current = { lat, lng, radiusKm };
    if (!prev) {
      map.setView([lat, lng], located ? LOCATED_ZOOM : START_ZOOM, { animate: false });
    } else if (prev.radiusKm !== radiusKm) {
      map.flyToBounds(L.latLng(lat, lng).toBounds(radiusKm * 2000), { padding: [24, 24], duration: 0.8 });
    } else if (prev.lat !== lat || prev.lng !== lng) {
      map.flyTo([lat, lng], located ? LOCATED_ZOOM : START_ZOOM, { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm, map]);

  // El contenedor puede cambiar de tamaño después de montarse (animaciones, carga de la página).
  // Leaflet no se entera solo: sin esto el mapa queda cortado.
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Acercar, alejar y volver a la ubicación, con los colores del sitio. El botón de volver se
// destaca cuando el usuario se alejó del punto de referencia recorriendo el mapa.
function MapControls({ lat, lng, located, sectorNombre }: { lat: number; lng: number; located: boolean; sectorNombre?: string }) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);

  // Los clics en los botones no deben mover ni hacer zoom en el mapa
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);

  useMapEvents({
    moveend() {
      // Lejos: el punto de referencia quedó fuera del centro de la vista (más de un cuarto del alto)
      const center = map.latLngToContainerPoint([lat, lng]);
      const size = map.getSize();
      setAway(center.distanceTo(size.divideBy(2)) > size.y / 4);
    },
  });

  const recenter = () => map.flyTo([lat, lng], located ? LOCATED_ZOOM : START_ZOOM, { duration: 0.8 });
  const button = 'w-9 h-9 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800 transition-colors';

  return (
    <div ref={ref} className="absolute top-3 left-3 z-[400] flex flex-col gap-2">
      <div className="flex flex-col rounded-xl overflow-hidden bg-slate-900/90 border border-slate-700 shadow-lg backdrop-blur divide-y divide-slate-700">
        <button type="button" onClick={() => map.zoomIn()} aria-label="Acercar" title="Acercar" className={button}>
          <Plus className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => map.zoomOut()} aria-label="Alejar" title="Alejar" className={button}>
          <Minus className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={recenter}
        aria-label={sectorNombre ? `Volver a ${sectorNombre}` : located ? 'Volver a mi ubicación' : 'Volver al punto de referencia'}
        title={sectorNombre ? `Volver a ${sectorNombre}` : located ? 'Volver a mi ubicación' : 'Volver a Santiago centro'}
        className={`w-9 h-9 flex items-center justify-center rounded-xl border shadow-lg backdrop-blur transition-colors ${
          away
            ? 'bg-gradient-to-br from-emerald-400 to-cyan-400 border-transparent text-slate-950 hover:from-emerald-300 hover:to-cyan-300'
            : 'bg-slate-900/90 border-slate-700 text-emerald-400 hover:bg-slate-800'
        }`}
      >
        <Crosshair className="w-4 h-4" />
      </button>
    </div>
  );
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
  events, centerLat, centerLng, radiusKm, userLocation, locating, onLocate, onSelectLocationForNewEvent, onOpenEvent, sector,
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
      <MapContainer center={[centerLat, centerLng]} zoom={START_ZOOM} zoomSnap={0.5} zoomControl={false} scrollWheelZoom className="w-full h-full z-0 bg-slate-950">
        <TileLayer url={DARK_TILES.url} attribution={DARK_TILES.attribution} className={DARK_TILES.className} maxZoom={DARK_TILES.maxZoom} />

        <SyncView lat={centerLat} lng={centerLng} radiusKm={radiusKm} located={!!userLocation && !sector} />
        <MapControls lat={centerLat} lng={centerLng} located={!!userLocation && !sector} sectorNombre={sector?.nombre} />

        {sector && (
          <>
            <FitSector sector={sector} />
            {sector.contorno && (
              <GeoJSON
                key={sector.nombre}
                data={sector.contorno}
                interactive={false}
                style={{ color: '#a5b4fc', weight: 2, opacity: 0.9, fillColor: '#6366f1', fillOpacity: 0.06, dashArray: '4 4' }}
              />
            )}
            <Marker position={[sector.lat, sector.lng]} icon={sectorIcon} zIndexOffset={900}>
              <Popup>
                <strong className="block text-sm text-white">{sector.nombre}</strong>
                <span className="text-xs text-slate-400">Buscamos eventos a {radiusKm} km de este punto.</span>
              </Popup>
            </Marker>
          </>
        )}

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
                <strong className="block text-sm text-white">Tu ubicación actual</strong>
                <span className="text-xs text-slate-400">Desde aquí calculamos la distancia a los eventos.</span>
              </Popup>
            </Marker>
          </>
        )}

        {events.map((evt) => (
          <Marker key={evt.id} position={[evt.latitude, evt.longitude]} icon={iconFor(evt)}>
            <Popup>
              <div className="w-[220px]">
                {imageSrc(evt.imageUrl) && (
                  <img src={imageSrc(evt.imageUrl)!} alt="" className="w-full h-24 object-cover rounded-xl mb-2.5" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                {evt.ofertaActiva && <OfferBadge event={evt} className="mb-1.5 mr-1.5" />}
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-slate-950"
                  style={{ background: categoryColor(evt.category?.name) }}
                >
                  {evt.category?.name}
                </span>
                <strong className="block mt-1.5 text-sm font-bold text-white leading-snug">{evt.title}</strong>
                {evt.edadMinima ? <span className="block text-[11px] font-bold text-rose-300">Solo mayores de {evt.edadMinima} años</span> : null}
                {evt.status && evt.status !== 'PUBLISHED' && (
                  <span className="block text-[11px] font-bold text-rose-300">{EVENT_STATUS_LABELS[evt.status].label}</span>
                )}
                <span className="block mt-1 text-xs text-slate-300">{formatEventDate(evt.date)}</span>
                <span className="block text-xs text-slate-500 truncate">{evt.address}</span>
                {evt.ventaPausada && <span className="block mt-1 text-[11px] font-semibold text-amber-200">Venta de entradas próximamente</span>}
                {evt.agotado && <span className="block mt-1 text-[11px] font-extrabold uppercase tracking-wider text-rose-300">Sold Out</span>}
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className={`text-sm font-extrabold ${evt.price === 0 ? 'text-emerald-300' : 'text-white'}`}>
                    {evt.price === 0 ? 'Gratis' : <OfferPrice event={evt} price={evt.precioFinal ?? evt.price} compact />}
                  </span>
                  {onOpenEvent && (
                    <button
                      type="button"
                      onClick={() => onOpenEvent(evt.id)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-colors"
                    >
                      Ver más
                    </button>
                  )}
                </div>
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
