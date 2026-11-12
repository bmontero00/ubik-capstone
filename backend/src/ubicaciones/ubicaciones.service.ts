import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { COMUNAS_RM, normalizarTexto } from './comunas-rm';

// Búsqueda de sectores para el mapa ("¿Dónde?"). Combina:
// - las comunas de la Región Metropolitana (lista local: instantánea y sin depender de nadie)
// - Photon (komoot), servicio basado en OpenStreetMap hecho para autocompletar: barrios, plazas, estaciones…
// - Nominatim (OpenStreetMap) solo para el contorno de una comuna elegida: una búsqueda puntual, no autocompletado
// Todo pasa por aquí (no desde el navegador) para cachear, limitar el uso y poder cambiar de proveedor en un solo lugar.
// Los servicios públicos sirven para desarrollo y la demo; en producción conviene uno con cuota.

export interface Ubicacion {
  id: string;
  nombre: string;
  detalle: string; // ej. "Comuna · Región Metropolitana"
  tipo: 'comuna' | 'lugar';
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // [oeste, sur, este, norte]
}

const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'UBIK/1.0 (plataforma de eventos, proyecto académico)';
const SANTIAGO = { lat: -33.4489, lng: -70.6693 };
const CHILE_BBOX = '-76,-56.5,-66,-17'; // oeste,sur,este,norte (Chile continental)
const TTL_BUSQUEDA = 24 * 3_600_000;
const MAX_CACHE = 1000;

// Tipos de lugar de OpenStreetMap que tienen sentido como "sector" (se descartan casas, tiendas, etc.)
const TIPOS: Record<string, string> = {
  city: 'Ciudad', town: 'Ciudad', village: 'Localidad', suburb: 'Barrio', neighbourhood: 'Barrio', quarter: 'Barrio',
  hamlet: 'Localidad', locality: 'Sector', district: 'Sector', borough: 'Sector', park: 'Parque', square: 'Plaza',
  station: 'Estación', stop: 'Estación', subway_entrance: 'Metro', university: 'Universidad', stadium: 'Estadio',
  mall: 'Centro comercial', attraction: 'Lugar de interés', museum: 'Museo', theatre: 'Teatro', hill: 'Cerro',
  peak: 'Cerro', residential: 'Calle', primary: 'Avenida', secondary: 'Avenida', tertiary: 'Calle', trunk: 'Avenida',
};

// Distancia aproximada entre dos puntos (fórmula de haversine)
const distanciaKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number; osm_key?: string; osm_value?: string; name?: string; street?: string; city?: string;
    district?: string; county?: string; state?: string; countrycode?: string; extent?: [number, number, number, number];
  };
}

@Injectable()
export class UbicacionesService {
  private readonly logger = new Logger('Ubicaciones');
  private readonly cacheBusqueda = new Map<string, { resultado: Ubicacion[]; hasta: number }>();
  private readonly cacheContorno = new Map<string, object>();

  async buscar(consulta: string): Promise<Ubicacion[]> {
    const q = normalizarTexto(consulta);
    if (q.length < 2) return [];

    const comunas = this.comunas(q);
    const enCache = this.cacheBusqueda.get(q);
    if (enCache && enCache.hasta > Date.now()) return enCache.resultado;

    // Photon solo desde 3 letras; si falla, quedan las comunas
    const lugares = q.length >= 3 ? await this.photon(consulta).catch((e) => {
      this.logger.warn(`Photon no respondió: ${(e as Error).message}`);
      return [] as Ubicacion[];
    }) : [];
    // Sin repetir una comuna que Photon también encontró (mismo nombre a menos de 3 km de su centro)
    const repiteComuna = (l: Ubicacion) =>
      COMUNAS_RM.some((c) => normalizarTexto(c.nombre) === normalizarTexto(l.nombre) && distanciaKm(c, l) < 3);
    const resultado = [...comunas, ...lugares.filter((l) => !repiteComuna(l))].slice(0, 8);

    if (this.cacheBusqueda.size > MAX_CACHE) this.cacheBusqueda.clear();
    this.cacheBusqueda.set(q, { resultado, hasta: Date.now() + TTL_BUSQUEDA });
    return resultado;
  }

  // Comunas que calzan: primero las que empiezan con lo escrito, luego las que lo contienen
  private comunas(q: string): Ubicacion[] {
    const puntaje = (nombre: string) => {
      const n = normalizarTexto(nombre);
      if (n.startsWith(q)) return 0;
      if (n.split(' ').some((p) => p.startsWith(q))) return 1;
      if (q.length >= 3 && n.includes(q)) return 2;
      return -1;
    };
    return COMUNAS_RM
      .map((c) => ({ c, p: puntaje(c.nombre) }))
      .filter((x) => x.p >= 0)
      .sort((a, b) => a.p - b.p || a.c.nombre.localeCompare(b.c.nombre))
      .slice(0, 5)
      .map(({ c }) => ({
        id: `comuna:${normalizarTexto(c.nombre)}`,
        nombre: c.nombre,
        detalle: 'Comuna · Región Metropolitana',
        tipo: 'comuna' as const,
        lat: c.lat,
        lng: c.lng,
      }));
  }

  private async photon(consulta: string): Promise<Ubicacion[]> {
    const params = new URLSearchParams({
      q: consulta, limit: '10', lat: String(SANTIAGO.lat), lon: String(SANTIAGO.lng), location_bias_scale: '0.3', bbox: CHILE_BBOX,
    });
    const res = await fetch(`${PHOTON}?${params}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const vistos = new Set<string>();
    const resultado: Ubicacion[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties;
      const tipo = TIPOS[p.osm_value ?? ''];
      if (p.countrycode !== 'CL' || !p.name || !tipo) continue;
      const zona = p.city || p.district || p.county;
      const region = p.state && /metropolitana/i.test(p.state) ? 'Región Metropolitana' : p.state?.replace(/^Región (de |del )?/, 'Región de ');
      const detalle = [tipo, zona && zona !== p.name ? zona : null, region ?? null].filter(Boolean).join(' · ');
      const [lng, lat] = f.geometry.coordinates;
      // Mismo lugar repetido en OpenStreetMap (mismo nombre y tipo a menos de 700 m): se muestra una vez
      const clave = `${normalizarTexto(p.name)}|${tipo}`;
      if (resultado.some((r) => `${normalizarTexto(r.nombre)}|${r.detalle.split(' · ')[0]}` === clave && distanciaKm(r, { lat, lng }) < 0.7)) continue;
      if (vistos.has(`${clave}|${normalizarTexto(zona ?? '')}`)) continue;
      vistos.add(`${clave}|${normalizarTexto(zona ?? '')}`);
      // extent de Photon: [oeste, norte, este, sur]
      const e = p.extent;
      resultado.push({
        id: `osm:${p.osm_key}:${p.osm_id ?? clave}`,
        nombre: p.name,
        detalle,
        tipo: 'lugar',
        lat,
        lng,
        ...(e && { bbox: [e[0], e[3], e[2], e[1]] as [number, number, number, number] }),
      });
    }
    return resultado.slice(0, 6);
  }

  // Contorno (GeoJSON) de una comuna de la Región Metropolitana, para dibujarlo en el mapa
  async contorno(nombre: string) {
    const comuna = COMUNAS_RM.find((c) => normalizarTexto(c.nombre) === normalizarTexto(nombre));
    if (!comuna) throw new NotFoundException('Solo hay contornos para las comunas de la Región Metropolitana');
    const clave = normalizarTexto(comuna.nombre);
    const enCache = this.cacheContorno.get(clave);
    if (enCache) return enCache;

    const params = new URLSearchParams({
      q: `${comuna.nombre}, Región Metropolitana de Santiago, Chile`, format: 'jsonv2', polygon_geojson: '1',
      polygon_threshold: '0.0008', limit: '5', countrycodes: 'cl',
    });
    const res = await fetch(`${NOMINATIM}?${params}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new NotFoundException('No pudimos obtener el contorno de la comuna');
    const lista = (await res.json()) as { geojson?: { type: string }; boundingbox?: string[]; addresstype?: string; type?: string }[];
    // El límite administrativo de la comuna (no un punto ni una calle con el mismo nombre)
    const limite = lista.find((r) => r.geojson && /Polygon/.test(r.geojson.type) && (r.type === 'administrative' || r.addresstype === 'municipality' || r.addresstype === 'city'));
    if (!limite?.geojson || !limite.boundingbox) throw new NotFoundException('No encontramos el contorno de esta comuna');
    const [sur, norte, oeste, este] = limite.boundingbox.map(Number);
    const resultado = { nombre: comuna.nombre, geojson: limite.geojson, bbox: [oeste, sur, este, norte] };
    this.cacheContorno.set(clave, resultado);
    return resultado;
  }
}
