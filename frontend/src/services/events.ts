import { API_URL, EventStatus, apiJson, authFetch } from './auth';

export interface Category {
  id: string;
  name: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  price: number;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  distanceKm?: number;
  category: Category;
  // El correo solo llega en "Mis eventos" y en el panel de administración
  organizer: { id: string; name: string; email?: string; organizerProfile?: { organizationName: string | null } | null };
  status: EventStatus;
  statusReason?: string | null;
  statusChangedAt?: string | null;
  statusChangedById?: string | null;
  // Solo en "Mis eventos"
  ultimoAvisoEquipo?: EntradaBitacora | null;
  totalAnuncios?: number;
}

export type TipoBitacora = 'CREACION' | 'ANUNCIO' | 'CAMBIO_DATOS' | 'CAMBIO_ESTADO';

export interface CambioBitacora {
  campo: 'titulo' | 'fecha' | 'direccion' | 'precio' | 'categoria' | 'descripcion' | 'imagen' | 'estado';
  anterior?: string | number | null;
  nuevo?: string | number | null;
}

export interface EntradaBitacora {
  id: string;
  tipo: TipoBitacora;
  titulo: string | null;
  mensaje: string | null;
  cambios: CambioBitacora[];
  fechaCreacion: string;
  interna: boolean; // solo la ven el organizador y los admins (revisiones de moderación)
  autor: { id: string; nombre: string; esEquipoUbik: boolean };
}

export interface EventDetail extends EventItem {
  canManage: boolean;
  canAnnounce: boolean;
  bitacora: EntradaBitacora[];
}

// Nombre visible del organizador: su organización, o su nombre
export const organizerName = (event: Pick<EventItem, 'organizer'>) =>
  event.organizer.organizerProfile?.organizationName || event.organizer.name;

// Datos del formulario de evento; image es el archivo nuevo (si se eligió uno)
export interface EventPayload {
  title: string;
  description: string;
  price: number;
  date: string; // ISO con fecha y hora
  address: string;
  latitude: number;
  longitude: number;
  categoryId: string;
  image?: File | null;
  removeImage?: boolean;
  sourceEventId?: string; // al duplicar: reutiliza la imagen del evento original
}

export const imageSrc = (imageUrl?: string | null) => (imageUrl ? `${API_URL}${imageUrl}` : null);

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/events/categories`);
  if (!res.ok) throw new Error('No se pudieron cargar las categorías');
  return res.json();
}

export function fetchMyEvents(): Promise<EventItem[]> {
  return apiJson<EventItem[]>('/events/mine');
}

// El backend recibe multipart/form-data por la imagen
function toFormData(payload: Partial<EventPayload>): FormData {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || key === 'image') return;
    form.append(key, String(value));
  });
  if (payload.image) form.append('image', payload.image);
  return form;
}

async function sendEvent(path: string, method: 'POST' | 'PATCH', payload: Partial<EventPayload>): Promise<EventItem> {
  const res = await authFetch(path, { method, body: toFormData(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(message || 'No se pudo guardar el evento');
  }
  return data;
}

export const createEvent = (payload: EventPayload) => sendEvent('/events', 'POST', payload);
export const updateEvent = (id: string, payload: Partial<EventPayload>) => sendEvent(`/events/${id}`, 'PATCH', payload);

export function cancelEvent(id: string, reason: string): Promise<EventItem> {
  return apiJson<EventItem>(`/events/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) });
}

export function postponeEvent(id: string, date: string, reason: string): Promise<EventItem> {
  return apiJson<EventItem>(`/events/${id}/postpone`, { method: 'PATCH', body: JSON.stringify({ date, reason }) });
}

export function resumeEvent(id: string): Promise<EventItem> {
  return apiJson<EventItem>(`/events/${id}/resume`, { method: 'PATCH' });
}

// Detalle con bitácora; con sesión, el organizador del evento y los admins ven más
export function fetchEventDetail(id: string): Promise<EventDetail> {
  return apiJson<EventDetail>(`/events/${id}`);
}

export function createAnnouncement(id: string, mensaje: string, titulo?: string): Promise<EntradaBitacora> {
  return apiJson<EntradaBitacora>(`/events/${id}/bitacora`, {
    method: 'POST',
    body: JSON.stringify(titulo ? { titulo, mensaje } : { mensaje }),
  });
}

export async function deleteAnnouncement(eventId: string, entradaId: string): Promise<void> {
  const res = await authFetch(`/events/${eventId}/bitacora/${entradaId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'No se pudo eliminar el anuncio');
  }
}

// Enlace para compartir un evento: abre su detalle al entrar
export const eventShareUrl = (id: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/?evento=${id}`;

// "en 3 días", "mañana", "hace 2 horas"
export function relativeTime(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 6e4) return diff < 0 ? 'hace un momento' : 'en un momento';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 864e5], ['hour', 36e5], ['minute', 6e4]];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'minute') return rtf.format(Math.round(diff / ms), unit);
  }
  return '';
}

// "sáb 12 dic · 18:30"
export function formatEventDate(value: string) {
  const d = new Date(value);
  const day = d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export const formatPrice = (price: number) => (price === 0 ? 'Gratis' : `$${price.toLocaleString('es-CL')}`);
