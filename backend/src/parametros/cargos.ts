import type { Event, TipoEntrada } from '@prisma/client';

export const CLAVE_PORCENTAJE_CARGO = 'PORCENTAJE_CARGO_SERVICIO';
export const PORCENTAJE_CARGO_INICIAL = 10;
// Rango permitido para cualquier % de cargo (global, especial o solicitado); evita errores de digitación
export const PORCENTAJE_CARGO_MAX = 30;

// Precio que paga el público por una entrada: precio del organizador + cargo, redondeado a la decena.
// Las entradas gratuitas no llevan cargo.
export function precioFinal(precioBase: number, porcentaje: number): number {
  if (precioBase <= 0) return 0;
  return Math.round((precioBase * (1 + porcentaje / 100)) / 10) * 10;
}

type ConOferta = Pick<Event, 'price' | 'porcentajeOferta' | 'ofertaHasta'>;
type ConPrecio = ConOferta & Pick<Event, 'id' | 'porcentajeCargo' | 'estadoCondicion'> & {
  tiposEntrada?: TipoEntrada[];
  estacionamiento?: Event['estacionamiento'];
  cuposEstacionamiento?: number | null;
};

// Límites de una oferta: % de descuento sobre el precio de todas las entradas
export const OFERTA_LIMITS = { descuentoMin: 5, descuentoMax: 90 };

// La oferta está vigente si el evento es de pago y no llegó su término (sin término, dura hasta el evento)
export const ofertaVigente = (event: ConOferta, ahora = Date.now()) =>
  event.price > 0 && !!event.porcentajeOferta && (!event.ofertaHasta || event.ofertaHasta.getTime() > ahora);

// Lo que recibe el organizador por una entrada con la oferta aplicada (redondeado a la decena)
export const precioConOferta = (precio: number, porcentaje: number | null) =>
  porcentaje && precio > 0 ? Math.max(10, Math.round((precio * (1 - porcentaje / 100)) / 10) * 10) : precio;

// Precio de una entrada de un tipo en este momento: lo que recibe el organizador, lo que paga el público y el cargo
export function precioEntrada(event: ConOferta & Pick<Event, 'porcentajeCargo'>, precioTipo: number) {
  const base = precioConOferta(precioTipo, ofertaVigente(event) ? event.porcentajeOferta : null);
  const final = precioFinal(base, event.porcentajeCargo);
  return { base, final, cargo: base > 0 ? final - base : 0 };
}

// Entradas vendidas (o reservadas mientras se paga) por tipo, y estacionamientos por evento
export interface Disponibilidad {
  tipos: Map<string, number>;
  estacionamientos: Map<string, number>;
}

// Campos de la condición especial que solo ven el organizador del evento y los administradores
const CAMPOS_CONDICION = [
  'justificacionCondicion',
  'porcentajeSolicitado',
  'respuestaCondicion',
  'condicionRevisadaEn',
  'condicionRevisadaPorId',
] as const;

// Agrega los precios de cada tipo de entrada (con la oferta vigente), el precio "desde" del evento,
// la disponibilidad (si se entrega) y si la venta está en pausa. Sin "privado", quita los datos de la
// solicitud de condición especial y la cantidad vendida.
export function conPrecios<T extends ConPrecio>(event: T, privado = false, disponibilidad?: Disponibilidad) {
  const enOferta = ofertaVigente(event);
  const tipos = [...(event.tiposEntrada ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((t) => {
      const { final, cargo } = precioEntrada(event, t.precio);
      const vendidas = disponibilidad?.tipos.get(t.id) ?? 0;
      return {
        id: t.id,
        nombre: t.nombre,
        descripcion: t.descripcion,
        precio: t.precio,
        cupo: t.cupo,
        precioFinal: final,
        precioSinOferta: precioFinal(t.precio, event.porcentajeCargo),
        cargoPorEntrada: cargo,
        // Sin cupo (eventos antiguos) no hay límite
        ...(disponibilidad && { disponibles: t.cupo === null ? null : Math.max(0, t.cupo - vendidas) }),
        ...(disponibilidad && privado && { vendidas }),
      };
    });

  // Precio "desde": el tipo más barato (o el precio del evento si no se cargaron los tipos)
  const masBarato = tipos.length ? tipos.reduce((min, t) => (t.precioFinal < min.precioFinal ? t : min)) : null;
  const sinTipos = precioEntrada(event, event.price);
  const desde = masBarato
    ? { final: masBarato.precioFinal, cargo: masBarato.cargoPorEntrada, sinOferta: masBarato.precioSinOferta }
    : { final: sinTipos.final, cargo: sinTipos.cargo, sinOferta: precioFinal(event.price, event.porcentajeCargo) };

  const vendidosEstacionamiento = disponibilidad?.estacionamientos.get(event.id) ?? 0;
  const result: Record<string, unknown> = {
    ...event,
    tiposEntrada: tipos,
    precioFinal: desde.final,
    cargoPorEntrada: desde.cargo,
    variosPrecios: new Set(tipos.map((t) => t.precioFinal)).size > 1,
    // Precio sin la oferta (para mostrarlo tachado) y el % de descuento
    ofertaActiva: enOferta,
    precioSinOferta: desde.sinOferta,
    porcentajeDescuento: enOferta ? event.porcentajeOferta : 0,
    // Mientras se revisa la condición especial, el evento se ve pero no vende entradas
    ventaPausada: event.estadoCondicion === 'PENDIENTE',
    ...(disponibilidad && {
      agotado: tipos.length > 0 && tipos.every((t) => t.disponibles === 0),
      ...(event.estacionamiento === 'PAGADO' && {
        estacionamientosDisponibles: Math.max(0, (event.cuposEstacionamiento ?? 0) - vendidosEstacionamiento),
        ...(privado && { estacionamientosVendidos: vendidosEstacionamiento }),
      }),
    }),
  };
  if (!privado) CAMPOS_CONDICION.forEach((campo) => delete result[campo]);
  return result as Omit<T, 'tiposEntrada'> & {
    tiposEntrada: typeof tipos;
    precioFinal: number;
    cargoPorEntrada: number;
    variosPrecios: boolean;
    ventaPausada: boolean;
    ofertaActiva: boolean;
    precioSinOferta: number;
    porcentajeDescuento: number;
    agotado?: boolean;
  };
}
