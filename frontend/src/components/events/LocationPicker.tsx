'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { DARK_TILES } from '../../utils/mapTiles';

const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

// Centra el mapa cuando la ubicación cambia desde fuera (por ejemplo, al elegir una dirección)
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

function ClickToMove({ onChange }: { onChange: LocationPickerProps['onChange'] }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Mapa pequeño con un pin arrastrable para fijar la ubicación exacta del evento
export default function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const handlers = useMemo(
    () => ({
      dragend() {
        const pos = markerRef.current?.getLatLng();
        if (pos) onChange(pos.lat, pos.lng);
      },
    }),
    [onChange],
  );

  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom className="w-full h-full z-0 bg-slate-950">
      <TileLayer url={DARK_TILES.url} attribution={DARK_TILES.attribution} className={DARK_TILES.className} maxZoom={DARK_TILES.maxZoom} />
      <Marker position={[lat, lng]} icon={pinIcon} draggable eventHandlers={handlers} ref={markerRef} />
      <Recenter lat={lat} lng={lng} />
      <ClickToMove onChange={onChange} />
    </MapContainer>
  );
}
