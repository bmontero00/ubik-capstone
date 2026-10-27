'use client';

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface MapProps {
  events: any[];
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  onSelectLocationForNewEvent?: (lat: number, lng: number) => void;
}

// 🔵 Ícono para los eventos en el mapa
const eventIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// 🟢 Ícono distintivo para la ubicación actual del usuario
const userLocationIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function MapContextMenu({ onRightClick }: { onRightClick: (lat: number, lng: number, containerPoint: L.Point) => void }) {
  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault();
      onRightClick(e.latlng.lat, e.latlng.lng, e.containerPoint);
    },
    click() {
      onRightClick(0, 0, new L.Point(-999, -999));
    }
  });
  return null;
}

export default function Map({ events, centerLat, centerLng, radiusKm, onSelectLocationForNewEvent }: MapProps) {
  const [contextMenu, setContextMenu] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);

  const handleRightClick = (lat: number, lng: number, containerPoint: L.Point) => {
    if (lat === 0 && lng === 0) {
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
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={13} 
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <Circle 
          center={[centerLat, centerLng]} 
          radius={radiusKm * 1000} 
          pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1 }}
        />

        {/* 🟢 Marcador de la ubicación del usuario con ícono verde */}
        <Marker position={[centerLat, centerLng]} icon={userLocationIcon}>
          <Popup>
            <strong>📍 Tu ubicación actual</strong><br/>
            Punto de referencia para búsqueda.
          </Popup>
        </Marker>

        {/* 🔵 Marcadores de los eventos registrados */}
        {events.map((evt) => (
          <Marker key={evt.id} position={[evt.latitude, evt.longitude]} icon={eventIcon}>
            <Popup>
              <div className="text-slate-800">
                <strong className="text-sm block mb-1">{evt.title}</strong>
                <span className="text-xs text-slate-500 block">{evt.category?.name}</span>
                <span className="text-xs font-bold text-indigo-600 block mt-1">
                  {evt.price === 0 ? 'Entrada Liberada' : `$${evt.price.toLocaleString('es-CL')}`}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapContextMenu onRightClick={handleRightClick} />
      </MapContainer>

      {contextMenu && contextMenu.x > 0 && (
        <div 
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="absolute z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-2 animate-fade-in text-xs text-white"
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