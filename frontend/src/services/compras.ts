import { EventStatus, apiJson } from './auth';
import type { PortadaIa } from '../utils/portadas';
import { Category } from './events';

export type EstadoCompra = 'PENDIENTE_PAGO' | 'PAGADA' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA';

export interface AsistenteInput {
  tipoEntradaId: string;
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string; // "+56 9 1234 5678"
  correo: string;
}

export interface Entrada {
  id: string;
  codigo: string | null; // solo llega cuando la entrada es válida (pagada o confirmada)
  tipo: string; // nombre del tipo de entrada
  tipoEntradaId: string | null;
  precio: number; // lo que se pagó por esta entrada (incluye el cargo)
  cargo: number;
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
  precioUnitario: number; // precio final por entrada (incluye el cargo)
  total: number;
  precioBase: number;
  porcentajeCargo: number;
  cargoServicio: number; // cargo total de la compra
  cantidadEstacionamiento: number;
  precioEstacionamiento: number; // por vehículo
  codigoEstacionamiento: string | null; // solo cuando la compra es válida
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
    portadaIa?: PortadaIa | null;
    edadMinima?: number | null;
    status: EventStatus;
    statusReason: string | null;
    price: number;
    estacionamiento: 'GRATUITO' | 'PAGADO' | null;
    indicacionesEstacionamiento: string | null;
    latitude: number;
    longitude: number;
    category: Category;
    organizer: { id: string; name: string; organizerProfile: { organizationName: string | null } | null };
  };
  entradas: Entrada[];
  pago: PagoCompra | null;
}

export type EstadoTransaccion = 'INICIADA' | 'AUTORIZADA' | 'RECHAZADA' | 'ANULADA' | 'REVERSADA' | 'ERROR';

// Último intento de pago de la compra (datos del comprobante de Webpay)
export interface PagoCompra {
  medio: string;
  estado: EstadoTransaccion;
  ordenCompra: string;
  monto: number;
  codigoAutorizacion: string | null;
  tipoPago: string | null;
  cuotas: number | null;
  montoCuota: number | null;
  ultimosDigitos: string | null;
  fecha: string;
}

// Tipos de pago que informa Transbank
export const PAYMENT_TYPES: Record<string, string> = {
  VD: 'Débito',
  VN: 'Crédito',
  VC: 'Crédito en cuotas',
  SI: '3 cuotas sin interés',
  S2: '2 cuotas sin interés',
  NC: 'Cuotas sin interés',
  VP: 'Prepago',
};

export const compraValida = (c: Compra) => c.estado === 'PAGADA' || c.estado === 'CONFIRMADA';

// Entradas elegidas en el detalle del evento (cantidad por tipo) y estacionamientos
export interface TicketSelection {
  tipos: { id: string; nombre: string; precioFinal: number; cargoPorEntrada: number; cantidad: number }[];
  estacionamientos: number;
  precioEstacionamiento: number;
}

export const selectionCount = (s: TicketSelection) => s.tipos.reduce((n, t) => n + t.cantidad, 0);

// confirmaEdad: en eventos con restricción de edad, el comprador confirma que todos los asistentes la cumplen
export function createCompra(eventoId: string, asistentes: AsistenteInput[], estacionamientos = 0, confirmaEdad = false): Promise<Compra> {
  return apiJson<Compra>('/compras', {
    method: 'POST',
    body: JSON.stringify({ eventoId, asistentes, ...(estacionamientos > 0 && { estacionamientos }), ...(confirmaEdad && { confirmaEdad }) }),
  });
}

export function fetchCompra(id: string): Promise<Compra> {
  return apiJson<Compra>(`/compras/${id}`);
}

// Medios de pago disponibles: el pago simulado solo existe fuera de producción
export interface PaymentConfig {
  webpay: { ambiente: 'integracion' | 'produccion' };
  pagoSimulado: boolean;
}

export function fetchPaymentConfig(): Promise<PaymentConfig> {
  return apiJson<PaymentConfig>('/pagos/configuracion');
}

// Crea la transacción en Webpay y lleva al comprador a su formulario de pago (Transbank exige
// enviar el token por POST). Al terminar, Transbank lo devuelve al sitio con ?pago=...&compra=...
export async function payWithWebpay(compraId: string): Promise<void> {
  const { url, token } = await apiJson<{ url: string; token: string }>('/pagos/webpay/iniciar', {
    method: 'POST',
    body: JSON.stringify({ compraId }),
  });
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token_ws';
  input.value = token;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

// Pago simulado (solo en desarrollo): se aprueba sin pasar por la pasarela
export function payCompra(id: string): Promise<Compra> {
  return apiJson<Compra>(`/compras/${id}/pagar`, { method: 'POST', body: JSON.stringify({ medioPago: 'SIMULADO' }) });
}

export function cancelCompra(id: string): Promise<Compra> {
  return apiJson<Compra>(`/compras/${id}/cancelar`, { method: 'PATCH' });
}

export function fetchMisCompras(): Promise<Compra[]> {
  return apiJson<Compra[]>('/compras/mias');
}
