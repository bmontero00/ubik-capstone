// Búsqueda de direcciones con Nominatim (OpenStreetMap), el mismo proveedor de los mapas.
// Si el servicio no responde, el formulario permite escribir la dirección a mano.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
}

// Deja la dirección legible: "Calle 123, Comuna, Región"
function shortLabel(item: any): string {
  const a = item.address ?? {};
  const street = [a.road ?? a.pedestrian ?? a.square ?? a.park, a.house_number].filter(Boolean).join(' ');
  const place = item.name && item.name !== a.road ? item.name : '';
  const area = a.suburb ?? a.neighbourhood ?? a.city_district ?? a.town ?? a.city ?? a.village;
  const parts = [place, street, area, a.city && a.city !== area ? a.city : ''].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(', ') : item.display_name;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'cl',
    limit: '5',
    'accept-language': 'es',
  });
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((item: any) => ({ label: shortLabel(item), lat: Number(item.lat), lng: Number(item.lon) }));
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', 'accept-language': 'es' });
  const res = await fetch(`${NOMINATIM}/reverse?${params}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.address ? shortLabel(data) : null;
}
