import { apiJson } from './auth';

// Mismos límites que el backend
export const RESENA = {
  minComentario: 20,
  maxComentario: 500,
  minRespuesta: 10,
  maxRespuesta: 500,
  diasParaResenar: 60,
};

export const ETIQUETAS_ESTRELLAS: Record<number, string> = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Regular',
  4: 'Buena',
  5: 'Excelente',
};

export interface Resena {
  id: string;
  autor: string; // nombre e inicial del apellido
  estrellas: number;
  comentario: string;
  fecha: string;
  editada: boolean;
  evento: { id: string; title: string; date: string };
  respuesta: { texto: string; fecha: string } | null;
  propia: boolean;
}

export interface ResumenCalificacion {
  promedio: number | null;
  total: number;
  distribucion?: Record<number, number>;
}

export interface ResenasOrganizador {
  resumen: Required<ResumenCalificacion>;
  resenas: Resena[];
  pagina: number;
  totalPaginas: number;
  total: number;
  esOrganizador: boolean;
  sinResponder: number; // solo se informa al organizador
}

export type MotivoSinResena = 'SIN_ENTRADAS' | 'CANCELADO' | 'NO_FINALIZADO' | 'PLAZO_VENCIDO';

export interface EstadoResena {
  eventoId: string;
  puedeResenar: boolean;
  puedeEditar: boolean;
  motivo?: MotivoSinResena | null;
  cierre: string;
  resena: Resena | null;
}

export const fetchResenasOrganizador = (id: string, pagina = 1, estrellas?: number) =>
  apiJson<ResenasOrganizador>(`/resenas/organizador/${id}?pagina=${pagina}${estrellas ? `&estrellas=${estrellas}` : ''}`);

export const fetchMisResenas = () => apiJson<EstadoResena[]>('/resenas/mias');

export const fetchEstadoResena = (eventoId: string) => apiJson<EstadoResena>(`/resenas/evento/${eventoId}`);

export const crearResena = (eventoId: string, estrellas: number, comentario: string) =>
  apiJson<Resena>('/resenas', { method: 'POST', body: JSON.stringify({ eventoId, estrellas, comentario }) });

export const editarResena = (id: string, estrellas: number, comentario: string) =>
  apiJson<Resena>(`/resenas/${id}`, { method: 'PATCH', body: JSON.stringify({ estrellas, comentario }) });

export const eliminarResena = (id: string) => apiJson<{ ok: true }>(`/resenas/${id}`, { method: 'DELETE' });

export const responderResena = (id: string, respuesta: string) =>
  apiJson<Resena>(`/resenas/${id}/respuesta`, { method: 'PUT', body: JSON.stringify({ respuesta }) });

export const quitarRespuesta = (id: string) => apiJson<Resena>(`/resenas/${id}/respuesta`, { method: 'DELETE' });

// Días que quedan para reseñar (para avisar "te quedan N días")
export const diasRestantes = (cierre: string) => Math.max(0, Math.ceil((new Date(cierre).getTime() - Date.now()) / 86_400_000));

export const fechaResena = (fecha: string) => new Date(fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
