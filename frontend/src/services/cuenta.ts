import { API_URL, apiJson, getToken } from './auth';

// Mi cuenta: datos editables, foto de perfil (logo en organizadores) y cambio de contraseña
export interface Cuenta {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ORGANIZER' | 'ATTENDEE';
  createdAt: string;
  fotoPerfil: string | null;
  telefono: string | null; // asistente: "+56912345678"
  rut: string | null; // asistente: "12345678-5"
  organizerProfile: {
    status: string;
    organizationName: string | null;
    rut: string;
    phone: string;
    eventDescription: string;
    socialUrl: string | null;
    reviewedAt: string | null;
  } | null;
}

export type DatosCuenta = Partial<{
  name: string;
  telefono: string | null;
  rut: string | null;
  phone: string;
  eventDescription: string;
  socialUrl: string | null;
}>;

export const obtenerCuenta = () => apiJson<Cuenta>('/cuenta');

export const actualizarCuenta = (datos: DatosCuenta) => apiJson<Cuenta>('/cuenta', { method: 'PATCH', body: JSON.stringify(datos) });

// token: para subir el logo justo después del registro, antes de que la sesión quede guardada
export async function subirFoto(archivo: File, token?: string): Promise<Cuenta> {
  const form = new FormData();
  form.append('foto', archivo);
  const res = await fetch(`${API_URL}/cuenta/foto`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token ?? getToken()}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((Array.isArray(data.message) ? data.message[0] : data.message) || 'No pudimos guardar la imagen');
  return data;
}

export const quitarFoto = () => apiJson<Cuenta>('/cuenta/foto', { method: 'DELETE' });

export const cambiarContrasena = (actual: string, nueva: string) =>
  apiJson<{ mensaje: string; accessToken: string }>('/cuenta/contrasena', { method: 'POST', body: JSON.stringify({ actual, nueva }) });

// Formatos de JPG, PNG o WebP de hasta 5 MB
export const FOTO_MAX_BYTES = 5 * 1024 * 1024;
export const esFotoValida = (f: File) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= FOTO_MAX_BYTES;
