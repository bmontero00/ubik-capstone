import { API_URL, EventStatus } from './auth';
import { Category } from './events';

export interface OrganizerEvent {
  id: string;
  title: string;
  date: string;
  address: string;
  price: number;
  imageUrl: string | null;
  status: EventStatus;
  category: Category;
}

export interface OrganizerReview {
  id: string;
  autor: string;
  estrellas: number;
  comentario: string;
  fecha: string;
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
  calificacion: { promedio: number | null; total: number };
  resenas: OrganizerReview[];
}

export async function fetchOrganizerProfile(id: string): Promise<OrganizerProfile> {
  const res = await fetch(`${API_URL}/organizers/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudo cargar el perfil del organizador');
  return data;
}
