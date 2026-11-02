import type { Event } from '@prisma/client';

export const CLAVE_PORCENTAJE_CARGO = 'PORCENTAJE_CARGO_SERVICIO';
export const PORCENTAJE_CARGO_INICIAL = 10;
// Rango permitido para cualquier % de cargo (global, especial o solicitado); evita errores de digitación
export const PORCENTAJE_CARGO_MAX = 30;

// Precio que paga el público por una entrada: precio del organizador + cargo, redondeado a la decena.
// Los eventos gratuitos no llevan cargo.
export function precioFinal(precioBase: number, porcentaje: number): number {
  if (precioBase <= 0) return 0;
  return Math.round((precioBase * (1 + porcentaje / 100)) / 10) * 10;
}

type ConPrecio = Pick<Event, 'price' | 'porcentajeCargo' | 'estadoCondicion'>;

// Campos de la condición especial que solo ven el organizador del evento y los administradores
const CAMPOS_CONDICION = [
  'justificacionCondicion',
  'porcentajeSolicitado',
  'respuestaCondicion',
  'condicionRevisadaEn',
  'condicionRevisadaPorId',
] as const;

// Agrega el precio final y si la venta está en pausa. Sin "privado", quita los datos de la solicitud.
export function conPrecios<T extends ConPrecio>(event: T, privado = false) {
  const final = precioFinal(event.price, event.porcentajeCargo);
  const result: Record<string, unknown> = {
    ...event,
    precioFinal: final,
    cargoPorEntrada: final - (event.price > 0 ? event.price : 0),
    // Mientras se revisa la condición especial, el evento se ve pero no vende entradas
    ventaPausada: event.estadoCondicion === 'PENDIENTE',
  };
  if (!privado) CAMPOS_CONDICION.forEach((campo) => delete result[campo]);
  return result as T & { precioFinal: number; cargoPorEntrada: number; ventaPausada: boolean };
}
