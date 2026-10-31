import { isValidRut } from '../../utils/rut';
import { isValidLocalPhone } from '../../utils/phone';

// Mismos límites que el backend (backend/src/compras/dto/compra.dto.ts)
export const TICKET_LIMITS = { maxPorCompra: 10, maxPorEvento: 10, minutosParaPagar: 15 };

// Datos de cada asistente en el formulario; el teléfono guarda solo la parte local ("9 1234 5678")
export interface AttendeeForm {
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string;
  correo: string;
}

export type AttendeeErrors = Partial<Record<keyof AttendeeForm, string>>;

export const emptyAttendee = (): AttendeeForm => ({ nombre: '', apellido: '', rut: '', telefono: '', correo: '' });

const NOMBRE = /^\p{L}[\p{L}' .-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const nameError = (value: string, field: string) => {
  const v = value.normalize('NFC').trim();
  if (!v) return `Ingresa el ${field}`;
  if (v.length < 2 || v.length > 50) return `El ${field} debe tener entre 2 y 50 caracteres`;
  if (!NOMBRE.test(v)) return `El ${field} solo puede contener letras`;
  return undefined;
};

export function validateAttendee(a: AttendeeForm): AttendeeErrors {
  const errors: AttendeeErrors = {
    nombre: nameError(a.nombre, 'nombre'),
    apellido: nameError(a.apellido, 'apellido'),
    rut: !a.rut ? 'Ingresa el RUT' : !isValidRut(a.rut) ? 'El RUT no es válido' : undefined,
    telefono: !a.telefono ? 'Ingresa el celular' : !isValidLocalPhone(a.telefono) ? 'Debe ser un celular de 9 dígitos que empiece con 9' : undefined,
    correo: !a.correo.trim() ? 'Ingresa el correo' : !EMAIL.test(a.correo.trim()) || a.correo.length > 120 ? 'El correo no es válido' : undefined,
  };
  (Object.keys(errors) as (keyof AttendeeForm)[]).forEach((k) => errors[k] === undefined && delete errors[k]);
  return errors;
}

// RUT sin puntos ni guion, para comparar entre entradas
export const rutKey = (rut: string) => rut.replace(/[^0-9kK]/g, '').toUpperCase();

// "12345678-5" del backend -> comparable con rutKey
export const backendRutKey = (rut: string) => rut.replace('-', '').toUpperCase();
