import { apiJson } from './auth';
import type { PortadaIa } from '../utils/portadas';

// Ayudas con IA para el organizador al crear o editar un evento

export interface DatosEventoIa {
  titulo: string;
  categoria?: string;
  descripcion: string;
}

export const mejorarDescripcion = (datos: DatosEventoIa) =>
  apiJson<{ descripcion: string; consejos: string[] }>('/ia/descripcion', { method: 'POST', body: JSON.stringify(datos) });

export const sugerirCategoria = (datos: DatosEventoIa) =>
  apiJson<{ categoryId: string; nombre: string; sugerenciaNueva: string | null }>('/ia/categoria', { method: 'POST', body: JSON.stringify(datos) });

export const disenarPortada = (datos: DatosEventoIa) =>
  apiJson<PortadaIa>('/ia/portada', { method: 'POST', body: JSON.stringify(datos) });

export type RevisionImagen =
  | { estado: 'APROBADA' }
  | { estado: 'SIN_VERIFICAR' } // la IA no pudo revisarla ahora: se publica y la revisa el equipo de UBIK
  | { estado: 'RECHAZADA'; motivo: string; mensaje: string };

export function verificarImagen(imagen: File) {
  const form = new FormData();
  form.append('image', imagen);
  return apiJson<RevisionImagen>('/ia/imagen/verificar', { method: 'POST', body: form });
}

// Achica fotos grandes antes de subirlas (máx. 1920 px de ancho, JPG): carga más rápido, ocupa menos y la IA
// puede revisarlas. Las imágenes chicas se dejan tal cual.
export async function optimizarImagen(file: File): Promise<File> {
  const MAX_ANCHO = 1920;
  if (file.size <= 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, MAX_ANCHO / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#0f172a'; // fondo para PNG con transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
