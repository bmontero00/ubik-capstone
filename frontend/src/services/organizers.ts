import { API_URL, EventStatus } from './auth';
import { Category, OfferInfo } from './events';
import { Resena } from './resenas';
import type { PortadaIa } from '../utils/portadas';

export interface OrganizerEvent extends OfferInfo {
  id: string;
  title: string;
  date: string;
  address: string;
  price: number;
  precioFinal?: number;
  imageUrl: string | null;
  portadaIa?: PortadaIa | null;
  status: EventStatus;
  category: Category;
}

// Perfil público: sin datos de contacto ni de verificación (RUT, teléfono, correo)
export interface OrganizerProfile {
  id: string;
  nombre: string;
  responsable: string | null;
  descripcion: string;
  redSocial: string | null;
  verificadoDesde: string;
  miembroDesde: string;
  estadisticas: {
    eventosPublicados: number;
    proximos: number;
    realizados: number;
    cancelados: number;
    postergados: number;
    cumplimiento: number | null; // % realizados entre realizados y cancelados
  };
  categoriasFrecuentes: (Category & { eventos: number })[];
  proximosEventos: OrganizerEvent[];
  eventosRealizados: OrganizerEvent[];
  calificacion: { promedio: number | null; total: number; distribucion: Record<number, number> };
  ultimaResena: Resena | null; // la más reciente; el resto en GET /resenas/organizador/:id
}

export async function fetchOrganizerProfile(id: string): Promise<OrganizerProfile> {
  const res = await fetch(`${API_URL}/organizers/${id}`);
  const data = await res.json().catch(() => ({}));
  if (res.status >= 500) throw new Error('No pudimos cargar el perfil en este momento. Intenta de nuevo en unos segundos.');
  if (!res.ok) throw new Error(data.message || 'No se pudo cargar el perfil del organizador');
  return data;
}
