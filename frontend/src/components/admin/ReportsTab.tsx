'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Wallet, Landmark, HandCoins, Ticket, Users, CalendarCheck2, UserPlus, Star, Download, Table2, ChartColumn, ScanLine,
} from 'lucide-react';
import {
  DesglosePlataforma, ResumenPlataforma, SeriePlataforma, descargarCsv,
  fetchDesglosePlataforma, fetchResumenPlataforma, fetchVentasPlataforma,
} from '../../services/reportes';
import { EVENT_STATUS_LABELS, StatusPill } from '../../utils/labels';
import { BarChart, ProgressBars } from '../reports/charts';
import { Kpi } from '../reports/OrganizerReports';

// En los reportes un monto cero es $0 (el formatPrice del sitio lo mostraría como "Gratis")
const formatPrice = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const DIA = 86_400_000;
const hoyChile = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const restarDias = (fecha: string, dias: number) => new Date(new Date(`${fecha}T12:00:00Z`).getTime() - dias * DIA).toISOString().slice(0, 10);
const PERIODOS = [
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
  { id: 'anio', label: 'Este año' },
  { id: 'custom', label: 'Personalizado' },
] as const;
type PeriodoId = (typeof PERIODOS)[number]['id'];
type Medida = 'ventas' | 'cargo' | 'entradas';

const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fechaEvento = (f: string) => new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
const numero = (n: number) => n.toLocaleString('es-CL');

// Reportes de toda la plataforma (administrador): ventas, cargo por servicio de UBIK, crecimiento
// de usuarios y el desglose por organizador, categoría y evento
export default function ReportsTab() {
  const [periodo, setPeriodo] = useState<PeriodoId>('30');
  const [custom, setCustom] = useState({ desde: restarDias(hoyChile(), 30), hasta: hoyChile() });
  const [resumen, setResumen] = useState<ResumenPlataforma | null>(null);
  const [serie, setSerie] = useState<SeriePlataforma | null>(null);
  const [desglose, setDesglose] = useState<DesglosePlataforma | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [medida, setMedida] = useState<Medida>('ventas');
  const [verTabla, setVerTabla] = useState(false);
  const [todosEventos, setTodosEventos] = useState(false);
  const pedido = useRef(0);

  const filtro = useMemo(() => {
    const hoy = hoyChile();
    if (periodo === 'custom') return custom;
    return { desde: periodo === 'anio' ? `${hoy.slice(0, 4)}-01-01` : restarDias(hoy, Number(periodo) - 1), hasta: hoy };
  }, [periodo, custom]);

  useEffect(() => {
    const id = ++pedido.current;
    setCargando(true);
    setError(null);
    Promise.all([fetchResumenPlataforma(filtro), fetchVentasPlataforma(filtro), fetchDesglosePlataforma(filtro)])
      .then(([r, s, d]) => {
        if (id !== pedido.current) return;
        setResumen(r);
        setSerie(s);
        setDesglose(d);
      })
      .catch((e) => id === pedido.current && setError((e as Error).message))
      .finally(() => id === pedido.current && setCargando(false));
  }, [filtro]);

  const etiquetaX = (f: string) => (serie?.agrupacion === 'semana' ? `Sem. ${fechaCorta(f)}` : fechaCorta(f));
  const formatoMedida = (v: number) => (medida === 'entradas' ? `${numero(v)} ${v === 1 ? 'entrada' : 'entradas'}` : formatPrice(v));
  const totalCategorias = desglose?.categorias.reduce((n, c) => n + c.ventas, 0) ?? 0;
  const eventos = desglose ? (todosEventos ? desglose.eventos : desglose.eventos.slice(0, 10)) : [];
  const archivo = (nombre: string) => `ubik-plataforma-${nombre}-${filtro.desde}-a-${filtro.hasta}.csv`;

  return (
    <section className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-800 bg-slate-900/80 p-1 gap-1" role="radiogroup" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periodo === p.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {periodo === 'custom' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <input type="date" value={custom.desde} max={custom.hasta} onChange={(e) => setCustom((c) => ({ ...c, desde: e.target.value }))} aria-label="Desde"
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 [color-scheme:dark]" />
            a
            <input type="date" value={custom.hasta} min={custom.desde} max={hoyChile()} onChange={(e) => setCustom((c) => ({ ...c, hasta: e.target.value }))} aria-label="Hasta"
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 [color-scheme:dark]" />
          </div>
        )}
      </div>

      {error ? (
        <p className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200">{error}</p>
      ) : !resumen || !serie || !desglose ? (
        <div className="py-16 flex justify-center text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          {/* Indicadores */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Wallet} label="Ventas de la plataforma" valor={formatPrice(resumen.ventas)} variacion={resumen.variacion.ventas}
              ayuda={`Lo que pagó el público en ${numero(resumen.compras)} ${resumen.compras === 1 ? 'compra' : 'compras'}`} />
            <Kpi icon={Landmark} label="Cargo por servicio (UBIK)" valor={formatPrice(resumen.cargoServicio)} variacion={resumen.variacion.cargoServicio}
              ayuda={resumen.ventas ? `${numero(Math.round((resumen.cargoServicio / resumen.ventas) * 1000) / 10)}% de las ventas` : 'Ingresos de UBIK en el período'} />
            <Kpi icon={HandCoins} label="Para organizadores" valor={formatPrice(resumen.paraOrganizadores)}
              ayuda={`${resumen.organizadoresConVentas} ${resumen.organizadoresConVentas === 1 ? 'organizador vendió' : 'organizadores vendieron'} en el período`} />
            <Kpi icon={Ticket} label="Entradas" valor={numero(resumen.entradas)} variacion={resumen.variacion.entradas}
              ayuda={`Ticket promedio ${formatPrice(resumen.ticketPromedio)}`} />
            <Kpi icon={Users} label="Compradores" valor={numero(resumen.compradores)} ayuda="Personas distintas que compraron o confirmaron entradas" />
            <Kpi icon={CalendarCheck2} label="Eventos con fecha en el período" valor={numero(resumen.eventosEnPeriodo)}
              ayuda={`${resumen.eventosPublicados} publicados en el período${resumen.eventosCancelados ? ` · ${resumen.eventosCancelados} cancelados` : ''}`} />
            <Kpi icon={UserPlus} label="Nuevos usuarios" valor={numero(resumen.nuevosAsistentes + resumen.nuevosOrganizadores)}
              ayuda={`${resumen.nuevosAsistentes} asistentes y ${resumen.nuevosOrganizadores} organizadores`} />
            <Kpi icon={resumen.asistencia !== null ? ScanLine : Star}
              label={resumen.asistencia !== null ? 'Asistencia' : 'Calificación promedio'}
              valor={resumen.asistencia !== null ? `${numero(resumen.asistencia)}%` : resumen.calificacion === null ? '—' : numero(resumen.calificacion)}
              ayuda={resumen.asistencia !== null
                ? `En ${resumen.eventosConAcceso} ${resumen.eventosConAcceso === 1 ? 'evento validado' : 'eventos validados'} en el acceso${resumen.calificacion !== null ? ` · calificación ${numero(resumen.calificacion)}` : ''}`
                : resumen.resenas ? `${resumen.resenas} ${resumen.resenas === 1 ? 'reseña' : 'reseñas'} en el período` : 'Sin reseñas en el período'} />
          </div>
          <p className="text-[11px] text-slate-500 -mt-3">Comparado con el período anterior de igual largo. Solo se cuentan compras pagadas o confirmadas.</p>

          {/* Ventas en el tiempo */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-white">{serie.agrupacion === 'semana' ? 'Por semana' : 'Por día'}</h3>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-800 p-0.5" role="radiogroup" aria-label="Medida">
                  {([['ventas', 'Ventas'], ['cargo', 'Cargo UBIK'], ['entradas', 'Entradas']] as const).map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={medida === id} onClick={() => setMedida(id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold ${medida === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setVerTabla((v) => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700" aria-pressed={verTabla}>
                  {verTabla ? <ChartColumn className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />} {verTabla ? 'Gráfico' : 'Tabla'}
                </button>
              </div>
            </div>
            {verTabla ? (
              <div className="max-h-72 overflow-y-auto ubik-scroll">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-400 sticky top-0 bg-slate-900"><tr><th className="text-left py-2">Fecha</th><th className="text-right py-2">Ventas</th><th className="text-right py-2">Cargo UBIK</th><th className="text-right py-2">Entradas</th></tr></thead>
                  <tbody>
                    {serie.puntos.map((p) => (
                      <tr key={p.fecha} className="border-t border-slate-800">
                        <td className="py-1.5 text-slate-300">{etiquetaX(p.fecha)}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-200">{formatPrice(p.ventas)}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-200">{formatPrice(p.cargo)}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-200">{numero(p.entradas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <BarChart
                datos={serie.puntos.map((p) => ({ clave: p.fecha, valor: p[medida] }))}
                formato={formatoMedida}
                etiquetaX={etiquetaX}
                descripcion={`${medida === 'ventas' ? 'Ventas' : medida === 'cargo' ? 'Cargo por servicio' : 'Entradas'} de la plataforma ${serie.agrupacion === 'semana' ? 'por semana' : 'por día'}`}
              />
            )}
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Organizadores */}
            <div className="lg:col-span-3 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3">
                <h3 className="text-sm font-bold text-white">Organizadores</h3>
                <button type="button" disabled={!desglose.organizadores.length}
                  onClick={() => descargarCsv(archivo('organizadores'), ['Organizador', 'Eventos con ventas', 'Entradas', 'Ventas', 'Cargo UBIK', 'Calificación', 'Reseñas'],
                    desglose.organizadores.map((o) => [o.nombre, o.eventos, o.entradas, o.ventas, o.cargo, o.calificacion, o.resenas]))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              {desglose.organizadores.length === 0 ? (
                <p className="px-5 pb-8 text-center text-sm text-slate-500">Sin ventas en este período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="text-xs text-slate-400 bg-slate-950/60">
                      <tr><th className="text-left px-4 py-2">Organizador</th><th className="text-right px-3 py-2">Eventos</th><th className="text-right px-3 py-2">Entradas</th><th className="text-right px-3 py-2">Ventas</th><th className="text-right px-3 py-2">Cargo UBIK</th><th className="text-right px-4 py-2">Calificación</th></tr>
                    </thead>
                    <tbody>
                      {desglose.organizadores.map((o) => (
                        <tr key={o.id} className="border-t border-slate-800">
                          <td className="px-4 py-2.5 font-semibold text-white">{o.nombre}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{o.eventos}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{numero(o.entradas)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatPrice(o.ventas)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatPrice(o.cargo)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{o.calificacion === null ? <span className="text-slate-500">—</span> : <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />{numero(o.calificacion)}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Categorías */}
            <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <h3 className="text-sm font-bold text-white mb-4">Ventas por categoría</h3>
              {desglose.categorias.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Sin ventas en este período.</p>
              ) : (
                <ProgressBars filas={desglose.categorias.map((c) => ({
                  etiqueta: c.nombre,
                  valor: c.ventas,
                  total: totalCategorias,
                  detalle: `${formatPrice(c.ventas)} · ${totalCategorias ? Math.round((c.ventas / totalCategorias) * 100) : 0}% · ${numero(c.entradas)} entradas`,
                }))} />
              )}
            </div>
          </div>

          {/* Eventos con más ventas */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3">
              <h3 className="text-sm font-bold text-white">Eventos con más ventas</h3>
              <button type="button" disabled={!desglose.eventos.length}
                onClick={() => descargarCsv(archivo('eventos'), ['Evento', 'Fecha', 'Estado', 'Categoría', 'Organizador', 'Entradas', 'Ventas', 'Cargo UBIK'],
                  desglose.eventos.map((e) => [e.titulo, fechaEvento(e.fecha), EVENT_STATUS_LABELS[e.estado as keyof typeof EVENT_STATUS_LABELS]?.label ?? e.estado, e.categoria, e.organizador, e.entradas, e.ventas, e.cargo]))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            {desglose.eventos.length === 0 ? (
              <p className="px-5 pb-8 text-center text-sm text-slate-500">Sin ventas en este período.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="text-xs text-slate-400 bg-slate-950/60">
                      <tr><th className="text-left px-4 py-2">Evento</th><th className="text-left px-3 py-2">Organizador</th><th className="text-left px-3 py-2">Fecha</th><th className="text-right px-3 py-2">Entradas</th><th className="text-right px-3 py-2">Ventas</th><th className="text-right px-4 py-2">Cargo UBIK</th></tr>
                    </thead>
                    <tbody>
                      {eventos.map((e) => (
                        <tr key={e.id} className="border-t border-slate-800">
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-white">{e.titulo}</span>
                            <span className="block text-[11px] text-slate-500">{e.categoria}{e.estado !== 'PUBLISHED' && <span className="ml-1.5 align-middle"><StatusPill {...EVENT_STATUS_LABELS[e.estado as keyof typeof EVENT_STATUS_LABELS]} /></span>}</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">{e.organizador}</td>
                          <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{fechaEvento(e.fecha)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{numero(e.entradas)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatPrice(e.ventas)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{formatPrice(e.cargo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {desglose.eventos.length > 10 && (
                  <button type="button" onClick={() => setTodosEventos((v) => !v)} className="w-full py-2.5 text-xs font-semibold text-indigo-300 hover:text-white border-t border-slate-800">
                    {todosEventos ? 'Ver solo los 10 primeros' : `Ver los ${desglose.eventos.length} eventos`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
