import { apiJson } from './auth';

// Equipo de acceso de un evento: personas que validan entradas desde su celular sin la cuenta del organizador
export type EstadoAcceso = 'PENDIENTE' | 'ACTIVO' | 'REVOCADO' | 'VENCIDO';

export interface AccesoValidador {
  id: string;
  nombre: string;
  puerta: string | null;
  tiposEntradaIds: string[]; // vacío = todos los tipos
  tiposEntrada: { id: string; nombre: string }[];
  permiteEstacionamiento: boolean;
  estado: EstadoAcceso;
  vinculadoEn: string | null;
  dispositivo: string | null;
  ultimoUsoEn: string | null;
  revocadoEn: string | null;
  fechaCreacion: string;
  ingresos: number;
  escaneos: number;
}

export interface EquipoAcceso {
  evento: { id: string; titulo: string; fecha: string; estado: string; venceEn: string; tieneEstacionamiento: boolean };
  tiposEntrada: { id: string; nombre: string }[];
  accesos: AccesoValidador[];
}

export interface DatosAcceso {
  nombre: string;
  puerta: string | null;
  tiposEntradaIds: string[];
  permiteEstacionamiento: boolean;
}

export interface CodigoVinculacion {
  id: string;
  codigo: string; // se muestra una sola vez
  venceEn: string;
}

export const fetchEquipoAcceso = (eventoId: string) => apiJson<EquipoAcceso>(`/equipo-acceso/eventos/${eventoId}`);
export const crearAcceso = (eventoId: string, datos: DatosAcceso) =>
  apiJson<CodigoVinculacion>(`/equipo-acceso/eventos/${eventoId}`, { method: 'POST', body: JSON.stringify(datos) });
export const actualizarAcceso = (id: string, datos: Partial<DatosAcceso>) =>
  apiJson<{ ok: true }>(`/equipo-acceso/${id}`, { method: 'PATCH', body: JSON.stringify(datos) });
export const regenerarCodigoAcceso = (id: string) => apiJson<CodigoVinculacion>(`/equipo-acceso/${id}/codigo`, { method: 'POST' });
export const revocarAcceso = (id: string) => apiJson<{ ok: true }>(`/equipo-acceso/${id}`, { method: 'DELETE' });
