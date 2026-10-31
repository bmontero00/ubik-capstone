import { EventStatus, apiJson } from './auth';
import { Category } from './events';

export type EstadoCompra = 'PENDIENTE_PAGO' | 'PAGADA' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA';

export interface AsistenteInput {
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string; // "+56 9 1234 5678"
  correo: string;
}

export interface Entrada {
  id: string;
  codigo: string | null; // solo llega cuando la entrada es válida (pagada o confirmada)
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string;
  correo: string;
}

export interface Compra {
  id: string;
  codigo: string;
  estado: EstadoCompra;
  cantidad: number;
  precioUnitario: number;
  total: number;
  medioPago: string | null;
  fechaCreacion: string;
  expiraEn: string | null;
  fechaPago: string | null;
  evento: {
    id: string;
    title: string;
    date: string;
    address: string;
    imageUrl: string | null;
    status: EventStatus;
    statusReason: string | null;
    price: number;
    latitude: number;
    longitude: number;
    category: Category;
    organizer: { id: string; name: string; organizerProfile: { organizationName: string | null } | null };
  };
  entradas: Entrada[];
}

export const compraValida = (c: Compra) => c.estado === 'PAGADA' || c.estado === 'CONFIRMADA';

export function createCompra(eventoId: string, asistentes: AsistenteInput[]): Promise<Compra> {
  return apiJson<Compra>('/compras', { method: 'POST', body: JSON.stringify({ eventoId, asistentes }) });
}

// Pago simulado mientras no exista pasarela (Webpay / Mercado Pago)
export function payCompra(id: string): Promise<Compra> {
  return apiJson<Compra>(`/compras/${id}/pagar`, { method: 'POST', body: JSON.stringify({ medioPago: 'SIMULADO' }) });
}

export function cancelCompra(id: string): Promise<Compra> {
  return apiJson<Compra>(`/compras/${id}/cancelar`, { method: 'PATCH' });
}

export function fetchMisCompras(): Promise<Compra[]> {
  return apiJson<Compra[]>('/compras/mias');
}
