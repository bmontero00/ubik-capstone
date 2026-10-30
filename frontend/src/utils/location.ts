'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Primera fase del proyecto: UBIK funciona solo en Santiago
export const SANTIAGO_CENTER = { lat: -33.4372, lng: -70.6506 };

// Rectángulo aproximado del Gran Santiago (incluye Puente Alto, Maipú, Lo Barnechea, etc.)
export const SANTIAGO_BOUNDS = { south: -33.7, north: -33.25, west: -70.95, east: -70.4 };

export const isInSantiago = (lat: number, lng: number) =>
  lat >= SANTIAGO_BOUNDS.south && lat <= SANTIAGO_BOUNDS.north && lng >= SANTIAGO_BOUNDS.west && lng <= SANTIAGO_BOUNDS.east;

/**
 * idle: aún no se pide · locating: esperando al navegador · granted: ubicación dentro de Santiago
 * denied: el usuario negó el permiso · unavailable: el navegador no pudo obtenerla (sin señal, tiempo agotado)
 * unsupported: el navegador no tiene geolocalización · outside: la ubicación está fuera de Santiago
 */
export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'unsupported' | 'outside';

export interface UserCoords {
  lat: number;
  lng: number;
  accuracy: number; // metros
}

// Ubicación del usuario con permiso del navegador. Si no hay permiso, o la ubicación está fuera
// de Santiago, "center" vuelve a Santiago centro y "coords" queda en null (sin marcador).
export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const requested = useRef(false);

  const request = useCallback(() => {
    requested.current = true;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        if (!isInSantiago(c.latitude, c.longitude)) {
          setCoords(null);
          setStatus('outside');
          return;
        }
        setCoords({ lat: c.latitude, lng: c.longitude, accuracy: Math.round(c.accuracy) });
        setStatus('granted');
      },
      (error) => {
        setCoords(null);
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Si el usuario cambia el permiso desde el navegador, se actualiza sin recargar la página
  useEffect(() => {
    let permission: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        permission = p;
        p.onchange = () => {
          if (!requested.current) return;
          if (p.state === 'granted') request();
          if (p.state === 'denied') {
            setCoords(null);
            setStatus('denied');
          }
        };
      })
      .catch(() => {});
    return () => {
      if (permission) permission.onchange = null;
    };
  }, [request]);

  return { status, coords, center: coords ?? SANTIAGO_CENTER, request };
}
