import type { PortadaIa } from '../../utils/portadas';
import { TICKET_TYPE_LIMITS, nameKey, typeDescriptionError, typeNameError } from './ticketTypeRules';

// Mismos límites que el backend (backend/src/events/dto/event.dto.ts)
export const EVENT_LIMITS = {
  titleMin: 5,
  titleMax: 100,
  descriptionMin: 20,
  descriptionMax: 2000,
  addressMin: 3,
  addressMax: 200,
  priceMax: 10_000_000,
  imageMaxBytes: 5 * 1024 * 1024,
  // Solicitud de condición especial (mismos límites que el motivo en el backend)
  justificationMin: 10,
  justificationMax: 500,
  feeMax: 30,
};

// Un tipo de entrada en el formulario ("id" y "vendidas" solo en los que ya existen)
export interface TicketTypeForm {
  key: string; // identificador local para la lista
  id?: string;
  nombre: string;
  descripcion: string;
  precio: string; // solo dígitos
  cupo: string; // solo dígitos
  vendidas: number; // entradas vendidas o reservadas: el cupo no puede quedar bajo esto
}

export type ParkingOption = 'NINGUNO' | 'GRATUITO' | 'PAGADO';

export interface EventFormState {
  title: string;
  categoryId: string;
  description: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  address: string;
  latitude: number;
  longitude: number;
  isFree: boolean;
  tipos: TicketTypeForm[];
  aforo: string; // solo dígitos: debe ser igual a la suma de los cupos
  estacionamiento: ParkingOption;
  precioEstacionamiento: string;
  cuposEstacionamiento: string;
  indicacionesEstacionamiento: string;
  estacionamientosVendidos: number;
  image: File | null;
  currentImageUrl: string | null; // imagen ya guardada (al editar)
  removeImage: boolean;
  portadaIa: PortadaIa | null; // portada diseñada con IA (se usa si no hay imagen)
  // Condición especial de cargo por servicio (solo al crear un evento con valor)
  solicitarCondicion: boolean;
  justificacionCondicion: string;
  porcentajeSolicitado: string; // opcional, solo dígitos
}

export type FieldErrors = Partial<Record<keyof EventFormState, string>>;
export type TicketTypeErrors = Partial<Record<'nombre' | 'descripcion' | 'precio' | 'cupo', string>>;

const len = (v: string) => v.normalize('NFC').trim().length;
let nextKey = 0;
export const newTicketType = (nombre = ''): TicketTypeForm => ({
  key: `t${nextKey++}`, nombre, descripcion: '', precio: '', cupo: '', vendidas: 0,
});

// Fecha y hora combinadas en la zona horaria del navegador
export const toDateTime = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`) : null);

export const STEPS = [
  { id: 'basics', title: 'Lo básico', subtitle: 'Nombre, categoría y descripción' },
  { id: 'when', title: 'Cuándo y dónde', subtitle: 'Fecha, hora y ubicación' },
  { id: 'tickets', title: 'Entradas', subtitle: 'Tipos de entrada, aforo y estacionamiento' },
  { id: 'image', title: 'Portada', subtitle: 'La imagen que verán en el catálogo' },
  { id: 'review', title: 'Revisar', subtitle: 'Así lo verán los asistentes' },
] as const;

export const TICKETS_STEP = 2;

export const assignedSeats = (f: EventFormState) => f.tipos.reduce((n, t) => n + (Number(t.cupo) || 0), 0);

// Errores de cada tipo de entrada (incluye los nombres repetidos dentro del evento)
export function ticketTypeErrors(f: EventFormState): TicketTypeErrors[] {
  const keys = f.tipos.map((t) => nameKey(t.nombre));
  return f.tipos.map((t, i) => {
    const e: TicketTypeErrors = {};
    const nameErr = typeNameError(t.nombre);
    if (nameErr) e.nombre = nameErr;
    else if (keys.indexOf(keys[i]) !== i) e.nombre = 'Ya tienes otra entrada con este nombre';
    const descErr = t.descripcion.trim() ? typeDescriptionError(t.descripcion) : null;
    if (descErr) e.descripcion = descErr;
    if (!f.isFree) {
      const price = Number(t.precio);
      if (!t.precio || price <= 0) e.precio = 'Indica el valor';
      else if (price > EVENT_LIMITS.priceMax) e.precio = 'Supera el máximo permitido';
    }
    const cupo = Number(t.cupo);
    if (!t.cupo || cupo < 1) e.cupo = 'Indica el cupo';
    else if (cupo > TICKET_TYPE_LIMITS.cupoMax) e.cupo = 'Supera el máximo permitido';
    else if (cupo < t.vendidas) e.cupo = `Ya vendiste ${t.vendidas}: no puede ser menor`;
    return e;
  });
}

// Errores de cada paso; el asistente no avanza mientras el paso tenga errores
export function validateStep(step: number, f: EventFormState): FieldErrors {
  const e: FieldErrors = {};
  if (step === 0) {
    if (len(f.title) < EVENT_LIMITS.titleMin) e.title = `Escribe un título de al menos ${EVENT_LIMITS.titleMin} caracteres`;
    else if (len(f.title) > EVENT_LIMITS.titleMax) e.title = `El título puede tener como máximo ${EVENT_LIMITS.titleMax} caracteres`;
    if (!f.categoryId) e.categoryId = 'Elige la categoría que mejor describe tu evento';
    if (len(f.description) < EVENT_LIMITS.descriptionMin) {
      e.description = `Cuéntales un poco más a los asistentes (mínimo ${EVENT_LIMITS.descriptionMin} caracteres)`;
    }
  }
  if (step === 1) {
    const when = toDateTime(f.date, f.time);
    if (!f.date) e.date = 'Elige la fecha';
    if (!f.time) e.time = 'Elige la hora de inicio';
    if (when && when.getTime() <= Date.now()) e.date = 'La fecha y hora deben ser futuras';
    if (len(f.address) < EVENT_LIMITS.addressMin) e.address = 'Indica la dirección o mueve el pin en el mapa';
  }
  if (step === TICKETS_STEP) {
    if (!f.tipos.length) e.tipos = 'Agrega al menos un tipo de entrada';
    else if (ticketTypeErrors(f).some((t) => Object.keys(t).length)) e.tipos = 'Revisa los tipos de entrada marcados';
    const aforo = Number(f.aforo);
    const asignado = assignedSeats(f);
    if (!f.aforo || aforo < 1) e.aforo = 'Indica el aforo total del evento';
    else if (aforo > TICKET_TYPE_LIMITS.aforoMax) e.aforo = 'El aforo supera el máximo permitido';
    else if (asignado !== aforo) {
      e.aforo = asignado < aforo
        ? `Te faltan ${aforo - asignado} entradas por repartir entre los tipos`
        : `Repartiste ${asignado - aforo} entradas más que el aforo`;
    }
    if (f.estacionamiento === 'PAGADO') {
      const precio = Number(f.precioEstacionamiento);
      if (!f.precioEstacionamiento || precio <= 0) e.precioEstacionamiento = 'Indica el valor por vehículo';
      else if (precio > EVENT_LIMITS.priceMax) e.precioEstacionamiento = 'Supera el máximo permitido';
      const cupos = Number(f.cuposEstacionamiento);
      if (!f.cuposEstacionamiento || cupos < 1) e.cuposEstacionamiento = 'Indica cuántos estacionamientos hay';
      else if (cupos > TICKET_TYPE_LIMITS.estacionamientoCuposMax) e.cuposEstacionamiento = 'Supera el máximo permitido';
      else if (cupos < f.estacionamientosVendidos) e.cuposEstacionamiento = `Ya vendiste ${f.estacionamientosVendidos}: no puede ser menor`;
    }
    if (f.estacionamiento !== 'NINGUNO' && f.indicacionesEstacionamiento.trim()) {
      const err = f.indicacionesEstacionamiento.trim().length > TICKET_TYPE_LIMITS.indicacionesMax
        ? `Máximo ${TICKET_TYPE_LIMITS.indicacionesMax} caracteres`
        : typeDescriptionError(f.indicacionesEstacionamiento);
      if (err) e.indicacionesEstacionamiento = err;
    }
    if (!f.isFree && f.solicitarCondicion) {
      const j = len(f.justificacionCondicion);
      if (j < EVENT_LIMITS.justificationMin) {
        e.justificacionCondicion = `Cuéntanos por qué solicitas una condición especial (mínimo ${EVENT_LIMITS.justificationMin} caracteres)`;
      } else if (j > EVENT_LIMITS.justificationMax) {
        e.justificacionCondicion = `La justificación puede tener como máximo ${EVENT_LIMITS.justificationMax} caracteres`;
      } else if (!/\p{L}/u.test(f.justificacionCondicion)) {
        e.justificacionCondicion = 'La justificación debe contener texto';
      }
      if (f.porcentajeSolicitado !== '' && Number(f.porcentajeSolicitado) > EVENT_LIMITS.feeMax) {
        e.porcentajeSolicitado = `El porcentaje puede ser como máximo ${EVENT_LIMITS.feeMax}%`;
      }
    }
  }
  return e;
}

// Precio más bajo de las entradas ("desde"), lo que recibe el organizador
export const lowestPrice = (f: EventFormState) =>
  f.isFree || !f.tipos.length ? 0 : Math.min(...f.tipos.map((t) => Number(t.precio) || 0));
