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
  organizer: { id: string; name: string; email: string };
  status: EventStatus;
  statusReason?: string | null;
}

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

// "sáb 12 dic · 18:30"
export function formatEventDate(value: string) {
  const d = new Date(value);
  const day = d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export const formatPrice = (price: number) => (price === 0 ? 'Gratis' : `$${price.toLocaleString('es-CL')}`);
