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

type ConPrecio = Pick<Event, 'price' | 'porcentajeCargo' | 'estadoCondicion' | 'precioOferta' | 'ofertaHasta'>;
type ConOferta = Pick<Event, 'price' | 'precioOferta' | 'ofertaHasta'>;

// Límites de una oferta: el descuento (sobre el precio que ve el público) va del 5% al 90%
export const OFERTA_LIMITS = { descuentoMin: 5, descuentoMax: 90 };

// La oferta está vigente si tiene precio y no llegó su término (sin término, dura hasta el evento)
export const ofertaVigente = (event: ConOferta, ahora = Date.now()) =>
  event.price > 0 && event.precioOferta !== null && (!event.ofertaHasta || event.ofertaHasta.getTime() > ahora);

// Lo que recibe el organizador por entrada en este momento (el precio de oferta si hay una vigente)
export const precioBaseVigente = (event: ConOferta) => (ofertaVigente(event) ? event.precioOferta! : event.price);

// % de descuento que ve el público, calculado sobre los precios finales (con cargo)
export const porcentajeDescuento = (precioNormal: number, precioOferta: number) =>
  precioNormal > 0 ? Math.round((1 - precioOferta / precioNormal) * 100) : 0;

// Campos de la condición especial que solo ven el organizador del evento y los administradores
const CAMPOS_CONDICION = [
  'justificacionCondicion',
  'porcentajeSolicitado',
  'respuestaCondicion',
  'condicionRevisadaEn',
  'condicionRevisadaPorId',
] as const;

// Agrega el precio final (con la oferta vigente, si hay) y si la venta está en pausa.
// Sin "privado", quita los datos de la solicitud de condición especial.
export function conPrecios<T extends ConPrecio>(event: T, privado = false) {
  const enOferta = ofertaVigente(event);
  const base = enOferta ? event.precioOferta! : event.price;
  const final = precioFinal(base, event.porcentajeCargo);
  const normal = precioFinal(event.price, event.porcentajeCargo);
  const result: Record<string, unknown> = {
    ...event,
    precioFinal: final,
    cargoPorEntrada: final - (base > 0 ? base : 0),
    // Precio final sin la oferta (para mostrarlo tachado) y el % de descuento
    ofertaActiva: enOferta,
    precioSinOferta: normal,
    porcentajeDescuento: enOferta ? porcentajeDescuento(normal, final) : 0,
    // Mientras se revisa la condición especial, el evento se ve pero no vende entradas
    ventaPausada: event.estadoCondicion === 'PENDIENTE',
  };
  if (!privado) CAMPOS_CONDICION.forEach((campo) => delete result[campo]);
  return result as T & {
    precioFinal: number;
    cargoPorEntrada: number;
    ventaPausada: boolean;
    ofertaActiva: boolean;
    precioSinOferta: number;
    porcentajeDescuento: number;
  };
}
