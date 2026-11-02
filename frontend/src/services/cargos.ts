import { apiJson } from './auth';
import { EventItem } from './events';

export interface HistorialParametro {
  id: string;
  valorAnterior: string | null;
  valorNuevo: string;
  motivo: string;
  fecha: string;
  admin: { id: string; name: string };
}

export interface HistorialCargoEvento {
  id: string;
  porcentajeAnterior: number;
  porcentajeNuevo: number;
  motivo: string;
  fecha: string;
  admin: { id: string; name: string };
}

export interface EventoCargo extends EventItem {
  condicionRevisadaPor?: { id: string; name: string } | null;
  historialCargos?: HistorialCargoEvento[];
}

export interface CargosResumen {
  configuracion: {
    porcentaje: number;
    actualizadoEn: string | null;
    actualizadoPor: { id: string; name: string } | null;
    historial: HistorialParametro[];
  };
  eventosConCargo: number;
  pendientes: EventoCargo[];
  resueltas: EventoCargo[];
  especiales: EventoCargo[];
}

export const fetchCargos = () => apiJson<CargosResumen>('/admin/cargos');

export const updateGlobalFee = (porcentaje: number, reason: string) =>
  apiJson<{ configuracion: CargosResumen['configuracion']; eventosQueMantienen: number }>('/admin/cargos/porcentaje', {
    method: 'PATCH',
    body: JSON.stringify({ porcentaje, reason }),
  });

export const answerCondition = (eventId: string, decision: 'APROBADA' | 'RECHAZADA', reason: string, porcentaje?: number) =>
  apiJson<EventoCargo>(`/admin/events/${eventId}/condicion`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, reason, ...(decision === 'APROBADA' ? { porcentaje } : {}) }),
  });

export const updateEventFee = (eventId: string, porcentaje: number, reason: string) =>
  apiJson<EventoCargo>(`/admin/events/${eventId}/cargo`, {
    method: 'PATCH',
    body: JSON.stringify({ porcentaje, reason }),
  });
