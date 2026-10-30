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
};

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
  price: string; // solo dígitos
  image: File | null;
  currentImageUrl: string | null; // imagen ya guardada (al editar)
  removeImage: boolean;
}

export type FieldErrors = Partial<Record<keyof EventFormState, string>>;

const len = (v: string) => v.normalize('NFC').trim().length;

// Fecha y hora combinadas en la zona horaria del navegador
export const toDateTime = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`) : null);

export const STEPS = [
  { id: 'basics', title: 'Lo básico', subtitle: 'Nombre, categoría y descripción' },
  { id: 'when', title: 'Cuándo y dónde', subtitle: 'Fecha, hora y ubicación' },
  { id: 'tickets', title: 'Entradas e imagen', subtitle: 'Precio y foto de portada' },
  { id: 'review', title: 'Revisar', subtitle: 'Así lo verán los asistentes' },
] as const;

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
  if (step === 2 && !f.isFree) {
    const price = Number(f.price);
    if (!f.price || price <= 0) e.price = 'Ingresa el valor de la entrada o marca el evento como gratis';
    else if (price > EVENT_LIMITS.priceMax) e.price = 'El precio supera el máximo permitido';
  }
  return e;
}

export const finalPrice = (f: EventFormState) => (f.isFree ? 0 : Number(f.price) || 0);
