import { apiJson } from './auth';

// Reportes del organizador (solo sus eventos). Fechas en formato AAAA-MM-DD (hora de Chile).
export interface FiltroReporte {
  desde: string;
  hasta: string;
  eventoId?: string;
}

const query = (f: FiltroReporte) => `desde=${f.desde}&hasta=${f.hasta}${f.eventoId ? `&eventoId=${f.eventoId}` : ''}`;

export interface ResumenReporte {
  ingresosNetos: number;
  cargoServicio: number;
  ingresosBrutos: number;
  entradas: number;
  compras: number;
  estacionamientos: number;
  ticketPromedio: number;
  ocupacion: number | null;
  eventosRealizados: number;
  eventosEnPeriodo: number;
  asistencia: number | null; // % de ingresados en los eventos donde se validaron entradas
  eventosConAcceso: number;
  calificacion: number | null;
  resenas: number;
  variacion: { ingresosNetos: number | null; entradas: number | null; ticketPromedio: number | null };
}

export interface SerieVentas {
  agrupacion: 'dia' | 'semana';
  puntos: { fecha: string; entradas: number; ingresos: number }[];
}

export interface FilaEvento {
  id: string;
  titulo: string;
  fecha: string;
  estado: string;
  categoria: string;
  gratis: boolean;
  aforo: number | null;
  vendidas: number;
  ocupacion: number | null;
  ingresados: number;
  asistencia: number | null; // null si no se validaron entradas en el acceso
  ingresosNetos: number;
  tipoMasVendido: string | null;
  calificacion: number | null;
  resenas: number;
}

export interface DetalleEvento {
  evento: { id: string; titulo: string; fecha: string; estado: string; categoria: string; aforo: number | null };
  totales: Omit<ResumenReporte, 'ocupacion' | 'eventosRealizados' | 'eventosEnPeriodo' | 'calificacion' | 'resenas' | 'variacion' | 'asistencia' | 'eventosConAcceso'>;
  ocupacion: number | null;
  porTipo: { nombre: string; cupo: number | null; vendidas: number; ocupacion: number | null; ingresosNetos: number }[];
  curva: { diasAntes: number; acumuladas: number }[];
  diasParaEvento: number; // 0 si ya se realizó
  ventaUltimaSemana: number | null;
  oferta: null | { porcentaje: number; desde: string; hasta: string; ventasPorDiaDurante: number; ventasPorDiaAntes: number; variacion: number | null };
  estacionamiento: null | { vendidos: number; cupos: number | null };
  asistencia: AsistenciaEvento | null; // null si aún no se valida ninguna entrada en el acceso
}

export interface AsistenciaEvento {
  vendidas: number;
  ingresados: number;
  porIngresar: number;
  porcentaje: number | null;
  primerIngreso: string;
  ultimoIngreso: string;
  tramoMinutos: number; // 15 o 60
  llegadas: { desde: string; ingresos: number }[];
  pico: { desde: string; ingresos: number };
  porTipo: { nombre: string; vendidas: number; ingresados: number }[];
  porAcceso: { nombre: string; ingresos: number }[];
  estacionamiento: { vendidos: number; ingresados: number } | null;
}

export interface ListaAcceso {
  evento: { id: string; titulo: string; fecha: string; edadMinima: number | null };
  total: number;
  ingresados: number;
  asistentes: {
    codigo: string; nombre: string; apellido: string; rut: string; tipo: string; compra: string; fechaCompra: string;
    ingresoEn: string | null; // hora en que se validó en el acceso
    validadoPor: string | null;
  }[];
}

export interface AnalisisIa {
  hallazgos: string[];
  recomendaciones: string[];
  generadoEn: string;
}

export const fetchResumen = (f: FiltroReporte) => apiJson<ResumenReporte>(`/reportes/resumen?${query(f)}`);
export const fetchVentas = (f: FiltroReporte) => apiJson<SerieVentas>(`/reportes/ventas?${query(f)}`);
export const fetchEventosReporte = (f: FiltroReporte) => apiJson<FilaEvento[]>(`/reportes/eventos?desde=${f.desde}&hasta=${f.hasta}`);
export const fetchDetalleEvento = (id: string) => apiJson<DetalleEvento>(`/reportes/eventos/${id}`);
export const fetchListaAcceso = (id: string) => apiJson<ListaAcceso>(`/reportes/eventos/${id}/asistentes`);
export const fetchAnalisis = (f: FiltroReporte) => apiJson<AnalisisIa>(`/reportes/analisis?${query(f)}`, { method: 'POST' });

// CSV que Excel en Chile abre bien: separador ";" y BOM para las tildes
export function descargarCsv(nombre: string, columnas: string[], filas: (string | number | null)[][]) {
  const celda = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const contenido = [columnas, ...filas].map((f) => f.map(celda).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Reportes de la plataforma (solo administradores) ---
export interface ResumenPlataforma {
  ventas: number; // lo que pagó el público
  cargoServicio: number; // lo que recibe UBIK
  paraOrganizadores: number;
  entradas: number;
  compras: number;
  compradores: number;
  ticketPromedio: number;
  eventosEnPeriodo: number;
  eventosCancelados: number;
  eventosPublicados: number;
  organizadoresConVentas: number;
  nuevosAsistentes: number;
  nuevosOrganizadores: number;
  asistencia: number | null;
  eventosConAcceso: number;
  calificacion: number | null;
  resenas: number;
  variacion: { ventas: number | null; cargoServicio: number | null; entradas: number | null };
}

export interface SeriePlataforma {
  agrupacion: 'dia' | 'semana';
  puntos: { fecha: string; ventas: number; cargo: number; entradas: number }[];
}

export interface FilaDesglose { id: string; nombre: string; eventos: number; ventas: number; cargo: number; entradas: number }

export interface DesglosePlataforma {
  organizadores: (FilaDesglose & { calificacion: number | null; resenas: number })[];
  categorias: FilaDesglose[];
  eventos: { id: string; titulo: string; fecha: string; estado: string; categoria: string; organizador: string; entradas: number; ventas: number; cargo: number }[];
}

const periodoQuery = (f: Pick<FiltroReporte, 'desde' | 'hasta'>) => `desde=${f.desde}&hasta=${f.hasta}`;
export const fetchResumenPlataforma = (f: Pick<FiltroReporte, 'desde' | 'hasta'>) => apiJson<ResumenPlataforma>(`/reportes/plataforma/resumen?${periodoQuery(f)}`);
export const fetchVentasPlataforma = (f: Pick<FiltroReporte, 'desde' | 'hasta'>) => apiJson<SeriePlataforma>(`/reportes/plataforma/ventas?${periodoQuery(f)}`);
export const fetchDesglosePlataforma = (f: Pick<FiltroReporte, 'desde' | 'hasta'>) => apiJson<DesglosePlataforma>(`/reportes/plataforma/desglose?${periodoQuery(f)}`);
