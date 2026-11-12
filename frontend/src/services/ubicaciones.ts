import { API_URL } from './auth';

// Sectores para el buscador "¿Dónde?" del mapa (comunas de la RM y lugares de OpenStreetMap vía el backend)
export interface Ubicacion {
  id: string;
  nombre: string;
  detalle: string;
  tipo: 'comuna' | 'lugar';
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // [oeste, sur, este, norte]
}

export interface Contorno {
  nombre: string;
  geojson: GeoJSON.GeoJsonObject;
  bbox: [number, number, number, number];
}

export async function buscarUbicaciones(q: string, signal?: AbortSignal): Promise<Ubicacion[]> {
  const res = await fetch(`${API_URL}/ubicaciones/buscar?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'Demasiadas búsquedas seguidas. Espera unos segundos.' : 'No pudimos buscar en este momento');
  return res.json();
}

export async function contornoComuna(nombre: string): Promise<Contorno | null> {
  const res = await fetch(`${API_URL}/ubicaciones/contorno?comuna=${encodeURIComponent(nombre)}`);
  return res.ok ? res.json() : null;
}
