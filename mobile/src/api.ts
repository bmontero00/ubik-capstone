import { borrar, guardar, leer } from './almacen';

// Cliente de la API de UBIK para la app de validación.
// El celular no puede usar "localhost": la dirección es la IP del computador donde corre el backend
// (ej. http://192.168.1.20:3000), en la misma red Wi-Fi. Se define en mobile/.env (EXPO_PUBLIC_API_URL)
// y se puede cambiar desde la pantalla de inicio.

const CLAVE_SERVIDOR = 'ubik.servidor';
const CLAVE_SESION = 'ubik.sesion';
const SERVIDOR_POR_DEFECTO = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let servidor = SERVIDOR_POR_DEFECTO;
let token: string | null = null;
let alExpirar: (() => void) | null = null;

export const servidorActual = () => servidor;
export const onSesionExpirada = (fn: () => void) => { alExpirar = fn; };

export async function cargarServidor() {
  servidor = (await leer(CLAVE_SERVIDOR)) || SERVIDOR_POR_DEFECTO;
  return servidor;
}

export async function cambiarServidor(url: string) {
  const limpio = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(limpio)) throw new Error('Escribe una dirección como http://192.168.1.20:3000');
  servidor = limpio;
  await guardar(CLAVE_SERVIDOR, limpio);
}

// --- Tipos ---

export interface AccesoEquipo {
  nombre: string;
  puerta: string | null;
  todosLosTipos: boolean;
  tiposEntrada: { id: string; nombre: string }[];
  permiteEstacionamiento: boolean;
}

// Quien usa la app: el organizador con su cuenta o alguien de su equipo con un acceso vinculado
export type Sesion =
  | { tipo: 'organizador'; token: string; nombre: string }
  | { tipo: 'equipo'; token: string; nombre: string; eventoId: string; venceEn: string; acceso: AccesoEquipo };

export interface EventoApp {
  id: string;
  title: string;
  date: string;
  address: string;
  status: string;
  edadMinima: number | null;
  vendidas: number;
  ingresados: number;
  acceso: AccesoEquipo | null;
}

export type Resultado = 'VALIDA' | 'YA_USADA' | 'OTRO_EVENTO' | 'NO_PAGADA' | 'INEXISTENTE' | 'EVENTO_CANCELADO' | 'TIPO_NO_PERMITIDO';

export interface RespuestaValidacion {
  resultado: Resultado;
  valida: boolean;
  mensaje: string;
  codigo: string;
  tipo: 'ENTRADA' | 'ESTACIONAMIENTO' | null;
  asistente?: { nombre: string; apellido: string; rut: string; tipo: string; compra: string };
  estacionamiento?: { vehiculos: number; compra: string };
  usadaEn?: string | null;
  validadaPor?: string | null;
  evento: { id: string; titulo: string; edadMinima: number | null };
  contador: { vendidas: number; ingresados: number; porIngresar: number };
}

export interface Resumen {
  vendidas: number;
  ingresados: number;
  porIngresar: number;
  asistencia: number | null;
  porTipo: { id: string | null; nombre: string; vendidas: number; ingresados: number }[];
  estacionamiento: { vendidos: number; ingresados: number } | null;
}

export interface Escaneo {
  id: string;
  codigo: string;
  resultado: Resultado;
  mensaje: string;
  fecha: string;
  validadoPor: string | null;
  asistente: string | null;
  tipo: string | null;
}

// --- Llamadas ---

export class ErrorApi extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function pedir<T>(ruta: string, init: { method?: string; body?: unknown; sinToken?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${servidor}${ruta}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && !init.sinToken ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ErrorApi(`No hay conexión con el servidor (${servidor}). Revisa el Wi-Fi o la dirección del servidor.`, 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    if (res.status === 401 && token && !init.sinToken) alExpirar?.();
    throw new ErrorApi(msg || 'Ocurrió un error en el servidor', res.status);
  }
  return data as T;
}

export async function cargarSesion(): Promise<Sesion | null> {
  const s = await leer(CLAVE_SESION);
  if (!s) return null;
  try {
    const sesion = JSON.parse(s) as Sesion;
    token = sesion.token;
    return sesion;
  } catch {
    return null;
  }
}

async function iniciar(sesion: Sesion) {
  token = sesion.token;
  await guardar(CLAVE_SESION, JSON.stringify(sesion));
  return sesion;
}

export async function cerrarSesion() {
  token = null;
  await borrar(CLAVE_SESION);
}

// Organizador con su correo y contraseña de UBIK
export async function entrarComoOrganizador(email: string, password: string): Promise<Sesion> {
  const r = await pedir<{ accessToken: string; user: { name: string; role: string } }>('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    sinToken: true,
  });
  if (r.user.role !== 'ORGANIZER' && r.user.role !== 'ADMIN') {
    throw new ErrorApi('Esta app es para organizadores. Si eres parte del equipo de acceso, usa tu código de vinculación.', 403);
  }
  return iniciar({ tipo: 'organizador', token: r.accessToken, nombre: r.user.name });
}

// Equipo de acceso: código de un solo uso que entrega el organizador
export async function vincular(codigo: string, dispositivo: string): Promise<Sesion> {
  const r = await pedir<{ accessToken: string; venceEn: string; acceso: AccesoEquipo & { id: string }; evento: { id: string } }>('/equipo-acceso/vincular', {
    method: 'POST',
    body: { codigo: codigo.trim(), dispositivo },
    sinToken: true,
  });
  return iniciar({ tipo: 'equipo', token: r.accessToken, nombre: r.acceso.nombre, eventoId: r.evento.id, venceEn: r.venceEn, acceso: r.acceso });
}

export const fetchEventos = () => pedir<EventoApp[]>('/validaciones/eventos');
export const fetchResumen = (eventoId: string) => pedir<Resumen>(`/validaciones/eventos/${eventoId}/resumen`);
export const fetchHistorial = (eventoId: string) => pedir<Escaneo[]>(`/validaciones/eventos/${eventoId}/historial?limite=50`);
export const validar = (eventoId: string, codigo: string) =>
  pedir<RespuestaValidacion>('/validaciones', { method: 'POST', body: { eventoId, codigo } });
