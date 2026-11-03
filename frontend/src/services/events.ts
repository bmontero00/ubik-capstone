import { API_URL, EventStatus, apiJson, authFetch } from './auth';

export interface Category {
  id: string;
  name: string;
}

// Tipo de entrada de un evento (General, VIP, Expositor...)
export interface TipoEntrada {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number; // lo que recibe el organizador
  cupo: number | null; // null en eventos antiguos (sin aforo)
  precioFinal: number; // lo que paga el público (con cargo y oferta)
  precioSinOferta: number;
  cargoPorEntrada: number;
  disponibles?: number | null; // null: sin límite
  vendidas?: number; // solo para el organizador y los admins
}

export type Estacionamiento = 'GRATUITO' | 'PAGADO';

export interface EventItem {
  id: string;
  title: string;
  description: string;
  price: number; // precio más bajo de sus tipos de entrada ("desde")
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  distanceKm?: number;
  category: Category;
  // El correo solo llega en "Mis eventos" y en el panel de administración
  organizer: {
    id: string;
    name: string;
    email?: string;
    organizerProfile?: { organizationName: string | null } | null;
    perfilPublico?: boolean; // solo en el detalle: si tiene perfil público para enlazar
  };
  status: EventStatus;
  statusReason?: string | null;
  statusChangedAt?: string | null;
  statusChangedById?: string | null;
  // Cargo por servicio: "price" es lo que recibe el organizador; el público paga "precioFinal"
  porcentajeCargo?: number;
  precioFinal?: number;
  cargoPorEntrada?: number;
  ventaPausada?: boolean; // condición especial en revisión: el evento se ve pero no vende
  // Oferta del organizador (% sobre todas las entradas): "precioFinal" ya trae el precio rebajado
  ofertaActiva?: boolean;
  precioSinOferta?: number; // precio final normal, para mostrarlo tachado
  porcentajeDescuento?: number;
  porcentajeOferta?: number | null;
  ofertaHasta?: string | null; // sin término, dura hasta el evento
  // Tipos de entrada y aforo (suma de los cupos)
  tiposEntrada?: TipoEntrada[];
  aforo?: number | null;
  variosPrecios?: boolean; // los tipos tienen precios distintos: se muestra "Desde"
  agotado?: boolean;
  // Estacionamiento
  estacionamiento?: Estacionamiento | null;
  precioEstacionamiento?: number | null;
  cuposEstacionamiento?: number | null;
  indicacionesEstacionamiento?: string | null;
  estacionamientosDisponibles?: number;
  estacionamientosVendidos?: number; // solo para el organizador
  // Condición especial (solo para el organizador del evento y los admins)
  estadoCondicion?: EstadoCondicion | null;
  justificacionCondicion?: string | null;
  porcentajeSolicitado?: number | null;
  respuestaCondicion?: string | null;
  condicionRevisadaEn?: string | null;
  // Solo en "Mis eventos"
  ultimoAvisoEquipo?: EntradaBitacora | null;
  totalAnuncios?: number;
}

export type EstadoCondicion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

// Lo mínimo para mostrar una oferta (lo comparten las tarjetas, el mapa y el perfil del organizador)
export type OfferInfo = Pick<EventItem, 'ofertaActiva' | 'precioSinOferta' | 'porcentajeDescuento' | 'ofertaHasta' | 'variosPrecios'>;

// Mismos límites que el backend (backend/src/parametros/cargos.ts)
export const OFFER_LIMITS = { discountMin: 5, discountMax: 90 };

// Precio del organizador con la oferta aplicada (mismo cálculo que el backend)
export const priceWithOffer = (price: number, percent: number) =>
  percent && price > 0 ? Math.max(10, Math.round((price * (1 - percent / 100)) / 10) * 10) : price;

// "Hasta el lun 9 nov" o "Hasta el día del evento"
export function offerEndsLabel(event: OfferInfo) {
  if (!event.ofertaActiva) return null;
  if (!event.ofertaHasta) return 'Oferta válida hasta el día del evento';
  const d = new Date(event.ofertaHasta);
  return `Oferta válida hasta el ${d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })} a las ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

// Precio que ve y paga el público (incluye el cargo por servicio)
export const publicPrice = (event: { price: number; precioFinal?: number }) => event.precioFinal ?? event.price;

// Mismo cálculo que el backend: precio del organizador + cargo, redondeado a la decena
export const priceWithFee = (base: number, porcentaje: number) =>
  base <= 0 ? 0 : Math.round((base * (1 + porcentaje / 100)) / 10) * 10;

export const formatPercent = (value: number) => `${value.toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`;

export type TipoBitacora = 'CREACION' | 'ANUNCIO' | 'CAMBIO_DATOS' | 'CAMBIO_ESTADO';

export interface CambioBitacora {
  campo:
    | 'titulo' | 'fecha' | 'direccion' | 'precio' | 'categoria' | 'descripcion' | 'imagen' | 'estado' | 'cargo' | 'venta'
    | 'oferta' | 'entradas' | 'estacionamiento';
  anterior?: string | number | null;
  nuevo?: string | number | null;
  descuento?: number; // solo en "oferta"
  hasta?: string | null;
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

// Tipo de entrada en el formulario ("id" solo en los que ya existen)
export interface TipoEntradaPayload {
  id?: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  cupo: number;
}

// Datos del formulario de evento; image es el archivo nuevo (si se eligió uno)
export interface EventPayload {
  title: string;
  description: string;
  tiposEntrada: TipoEntradaPayload[];
  aforo: number;
  estacionamiento: 'NINGUNO' | Estacionamiento;
  precioEstacionamiento?: number;
  cuposEstacionamiento?: number;
  indicacionesEstacionamiento?: string;
  date: string; // ISO con fecha y hora
  address: string;
  latitude: number;
  longitude: number;
  categoryId: string;
  image?: File | null;
  removeImage?: boolean;
  sourceEventId?: string; // al duplicar: reutiliza la imagen del evento original
  // Solicitud de condición especial de cargo (solo al crear)
  solicitarCondicionEspecial?: boolean;
  justificacionCondicion?: string;
  porcentajeSolicitado?: number;
}

export const imageSrc = (imageUrl?: string | null) => (imageUrl ? `${API_URL}${imageUrl}` : null);

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/events/categories`);
  if (!res.ok) throw new Error('No se pudieron cargar las categorías');
  return res.json();
}

// % de cargo por servicio vigente (lo que se fijará a un evento nuevo)
export async function fetchPublicConfig(): Promise<{ porcentajeCargoServicio: number }> {
  const res = await fetch(`${API_URL}/events/configuracion-publica`);
  if (!res.ok) throw new Error('No se pudo obtener la configuración');
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
    // Los tipos de entrada viajan como JSON dentro del formulario
    form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
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

// Oferta: % de descuento sobre todas las entradas; "hasta" es opcional (si no, dura hasta el evento)
export function setOffer(id: string, porcentaje: number, hasta?: string, mensaje?: string): Promise<EventItem> {
  return apiJson<EventItem>(`/events/${id}/oferta`, {
    method: 'PATCH',
    body: JSON.stringify({ porcentaje, ...(hasta && { hasta }), ...(mensaje && { mensaje }) }),
  });
}

export function endOffer(id: string): Promise<EventItem> {
  return apiJson<EventItem>(`/events/${id}/oferta`, { method: 'DELETE' });
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
