'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Interfaz para recibir los datos desde page.tsx
interface MapProps {
  events: any[];
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

// 🚀 FIX OBLIGATORIO: Solución al bug clásico de los íconos invisibles en react-leaflet con Next.js
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export default function Map({ events, centerLat, centerLng, radiusKm }: MapProps) {
  return (
    <MapContainer 
      center={[centerLat, centerLng]} 
      zoom={13} 
      scrollWheelZoom={false} 
      className="w-full h-full z-0"
    >
      {/* Capa base del mapa (Estilo oscuro para combinar con UBIK) */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Círculo dinámico que representa el radio de búsqueda (convertido de km a metros) */}
      <Circle 
        center={[centerLat, centerLng]} 
        radius={radiusKm * 1000} 
        pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1 }}
      />

      {/* Marcador del Usuario (Centro de búsqueda) */}
      <Marker position={[centerLat, centerLng]} icon={customIcon}>
        <Popup>
          <strong>📍 Tu ubicación actual</strong><br/>
          Punto de referencia para búsqueda.
        </Popup>
      </Marker>

      {/* Iterar y renderizar los eventos filtrados en el mapa */}
      {events.map((evt) => (
        <Marker key={evt.id} position={[evt.latitude, evt.longitude]} icon={customIcon}>
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
    </MapContainer>
  );
}