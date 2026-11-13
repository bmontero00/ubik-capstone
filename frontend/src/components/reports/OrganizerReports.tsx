'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Wallet, Ticket, Gauge, Receipt, CalendarCheck2, Star, TrendingUp, TrendingDown, Sparkles, Download, ChevronRight,
  ArrowUpDown, Table2, ChartColumn, Lightbulb, Info,
} from 'lucide-react';
import {
  AnalisisIa, FilaEvento, FiltroReporte, ResumenReporte, SerieVentas, descargarCsv, fetchAnalisis, fetchEventosReporte, fetchResumen, fetchVentas,
} from '../../services/reportes';
import { formatPrice } from '../../services/events';
import { EVENT_STATUS_LABELS, StatusPill } from '../../utils/labels';
import { BarChart } from './charts';
import EventReport from './EventReport';

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

const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fechaEvento = (f: string) => new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });

// Reportes del organizador: resumen, análisis con IA, ventas en el tiempo y rendimiento por evento
export default function OrganizerReports() {
  const [periodo, setPeriodo] = useState<PeriodoId>('30');
  const [custom, setCustom] = useState({ desde: restarDias(hoyChile(), 30), hasta: hoyChile() });
  const [eventoId, setEventoId] = useState('');
  const [resumen, setResumen] = useState<ResumenReporte | null>(null);
  const [ventas, setVentas] = useState<SerieVentas | null>(null);
  const [eventos, setEventos] = useState<FilaEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [medida, setMedida] = useState<'entradas' | 'ingresos'>('entradas');
  const [verTabla, setVerTabla] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisIa | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorIa, setErrorIa] = useState<string | null>(null);
  const [orden, setOrden] = useState<{ col: keyof FilaEvento; asc: boolean }>({ col: 'fecha', asc: false });
  const pedido = useRef(0);

  const filtro: FiltroReporte = useMemo(() => {
    const hoy = hoyChile();
    if (periodo === 'custom') return { ...custom, eventoId: eventoId || undefined };
    const desde = periodo === 'anio' ? `${hoy.slice(0, 4)}-01-01` : restarDias(hoy, Number(periodo) - 1);
    return { desde, hasta: hoy, eventoId: eventoId || undefined };
  }, [periodo, custom, eventoId]);

  useEffect(() => {
    const id = ++pedido.current;
    setCargando(true);
    setError(null);
    setAnalisis(null);
    setErrorIa(null);
    Promise.all([fetchResumen(filtro), fetchVentas(filtro), fetchEventosReporte(filtro)])
      .then(([r, v, e]) => {
        if (id !== pedido.current) return;
        setResumen(r);
        setVentas(v);
        setEventos(e);
      })
      .catch((e) => id === pedido.current && setError((e as Error).message))
      .finally(() => id === pedido.current && setCargando(false));
  }, [filtro]);

  const pedirAnalisis = async () => {
    setAnalizando(true);
    setErrorIa(null);
    try {
      setAnalisis(await fetchAnalisis(filtro));
    } catch (e) {
      setErrorIa((e as Error).message);
    } finally {
      setAnalizando(false);
    }
  };

  const ordenados = useMemo(() => {
    if (!eventos) return [];
    const lista = eventoId ? eventos.filter((e) => e.id === eventoId) : eventos;
    return [...lista].sort((a, b) => {
      const va = a[orden.col] ?? -Infinity;
      const vb = b[orden.col] ?? -Infinity;
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return orden.asc ? c : -c;
    });
  }, [eventos, orden, eventoId]);

  const exportarEventos = () => {
    descargarCsv(`ubik-ventas-${filtro.desde}-a-${filtro.hasta}.csv`,
      ['Evento', 'Fecha', 'Estado', 'Categoría', 'Aforo', 'Entradas vendidas', 'Ocupación %', 'Ingresos netos', 'Tipo más vendido', 'Calificación', 'Reseñas'],
      ordenados.map((e) => [e.titulo, fechaEvento(e.fecha), EVENT_STATUS_LABELS[e.estado as keyof typeof EVENT_STATUS_LABELS]?.label ?? e.estado, e.categoria,
        e.aforo, e.vendidas, e.ocupacion, e.ingresosNetos, e.tipoMasVendido, e.calificacion, e.resenas]));
  };

  const columna = (col: keyof FilaEvento, label: string, alinear = 'text-left') => (
    <th scope="col" className={`px-3 py-2.5 font-semibold ${alinear}`}>
      <button type="button" onClick={() => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : false }))} className="inline-flex items-center gap-1 hover:text-white">
        {label} <ArrowUpDown className={`w-3 h-3 ${orden.col === col ? 'text-indigo-300' : 'text-slate-600'}`} />
      </button>
    </th>
  );

  const sinVentas = resumen && resumen.compras === 0;
  const etiquetaX = (f: string) => (ventas?.agrupacion === 'semana' ? `Sem. ${fechaCorta(f)}` : fechaCorta(f));

  return (
    <section className="mb-8">
      {/* Filtros (una sola fila sobre los gráficos) */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
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
        <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} aria-label="Evento"
          className="lg:ml-auto px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 max-w-xs">
          <option value="">Todos mis eventos</option>
          {(eventos ?? []).map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
        </select>
      </div>

      {error ? (
        <p className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200">{error}</p>
      ) : !resumen || !ventas || !eventos ? (
        <div className="py-16 flex justify-center text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          {/* 1. Indicadores */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi icon={Wallet} label="Ingresos netos" valor={formatPrice(resumen.ingresosNetos)} variacion={resumen.variacion.ingresosNetos}
              ayuda={`Lo que recibes. Cargo por servicio de UBIK aparte: ${formatPrice(resumen.cargoServicio)}`} />
            <Kpi icon={Ticket} label="Entradas" valor={resumen.entradas.toLocaleString('es-CL')} variacion={resumen.variacion.entradas} ayuda={`${resumen.compras} ${resumen.compras === 1 ? 'compra' : 'compras'}`} />
            <Kpi icon={Receipt} label="Ticket promedio" valor={formatPrice(resumen.ticketPromedio)} variacion={resumen.variacion.ticketPromedio} ayuda="Lo que paga en promedio cada compra" />
            <Kpi icon={Gauge} label="Ocupación" valor={resumen.ocupacion === null ? '—' : `${resumen.ocupacion.toLocaleString('es-CL')}%`} ayuda="Vendidas sobre el aforo de los eventos del período" />
            <Kpi icon={CalendarCheck2} label="Eventos realizados" valor={String(resumen.eventosRealizados)} ayuda={`De ${resumen.eventosEnPeriodo} con fecha en el período`} />
            <Kpi icon={Star} label="Calificación" valor={resumen.calificacion === null ? '—' : resumen.calificacion.toLocaleString('es-CL')} ayuda={resumen.resenas ? `${resumen.resenas} ${resumen.resenas === 1 ? 'reseña' : 'reseñas'} en el período` : 'Sin reseñas en el período'} />
          </div>
          <p className="text-[11px] text-slate-500 -mt-3">Comparado con los {Math.round((new Date(`${filtro.hasta}T12:00:00Z`).getTime() - new Date(`${filtro.desde}T12:00:00Z`).getTime()) / DIA) + 1} días anteriores. Solo se cuentan compras pagadas o confirmadas.</p>

          {/* Análisis con IA */}
          <div className="p-4 sm:p-5 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/15 via-slate-950 to-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-violet-300 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Análisis con IA</p>
                <p className="text-xs text-slate-400 mt-0.5">Hallazgos y recomendaciones a partir de tus ventas del período (sin datos personales).</p>
              </div>
              <button type="button" onClick={pedirAnalisis} disabled={analizando || !!sinVentas}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40">
                {analizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {analizando ? 'Analizando…' : analisis ? 'Volver a analizar' : 'Analizar mis ventas'}
              </button>
            </div>
            {sinVentas && <p className="mt-3 text-xs text-slate-500">Cuando tengas ventas en el período podrás generar un análisis.</p>}
            {errorIa && <p className="mt-3 text-xs text-rose-300">{errorIa}</p>}
            {analisis && (
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-200 mb-1.5">Lo que muestran tus datos</p>
                  <ul className="space-y-1.5">{analisis.hallazgos.map((h) => <li key={h} className="text-sm text-slate-300 flex gap-2"><span className="text-violet-300">•</span>{h}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-300" /> Recomendaciones</p>
                  <ul className="space-y-1.5">{analisis.recomendaciones.map((h) => <li key={h} className="text-sm text-slate-300 flex gap-2"><span className="text-amber-300">→</span>{h}</li>)}</ul>
                </div>
                <p className="md:col-span-2 text-[10px] text-slate-500 flex items-center gap-1"><Info className="w-3 h-3" /> Generado con IA: revisa las cifras antes de tomar decisiones.</p>
              </div>
            )}
          </div>

          {/* 2. Ventas en el tiempo */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-bold text-white">{medida === 'entradas' ? 'Entradas vendidas' : 'Ingresos netos'} por {ventas.agrupacion === 'semana' ? 'semana' : 'día'}</h3>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-700 p-0.5" role="radiogroup" aria-label="Medida">
                  {(['entradas', 'ingresos'] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={medida === m} onClick={() => setMedida(m)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold ${medida === m ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {m === 'entradas' ? 'Entradas' : 'Ingresos'}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setVerTabla((v) => !v)} title={verTabla ? 'Ver gráfico' : 'Ver como tabla'} aria-label={verTabla ? 'Ver gráfico' : 'Ver como tabla'}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white">
                  {verTabla ? <ChartColumn className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {sinVentas ? (
              <p className="py-12 text-center text-sm text-slate-500">Aún no tienes ventas en este período.</p>
            ) : verTabla ? (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-400"><tr><th className="text-left py-1.5">{ventas.agrupacion === 'semana' ? 'Semana' : 'Día'}</th><th className="text-right">Entradas</th><th className="text-right">Ingresos netos</th></tr></thead>
                  <tbody>{ventas.puntos.filter((p) => p.entradas).map((p) => (
                    <tr key={p.fecha} className="border-t border-slate-800"><td className="py-1.5 text-slate-300">{etiquetaX(p.fecha)}</td><td className="text-right tabular-nums">{p.entradas}</td><td className="text-right tabular-nums">{formatPrice(p.ingresos)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <BarChart
                datos={ventas.puntos.map((p) => ({ clave: p.fecha, valor: medida === 'entradas' ? p.entradas : p.ingresos }))}
                formato={(v) => (medida === 'entradas' ? `${v} ${v === 1 ? 'entrada' : 'entradas'}` : formatPrice(v))}
                etiquetaX={etiquetaX}
                descripcion={`${medida === 'entradas' ? 'Entradas vendidas' : 'Ingresos netos'} por ${ventas.agrupacion} entre ${filtro.desde} y ${filtro.hasta}`}
              />
            )}
          </div>

          {/* 3. Rendimiento por evento */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <div>
                <h3 className="text-base font-bold text-white">Rendimiento por evento</h3>
                <p className="text-xs text-slate-400">Eventos con fecha o ventas en el período. Las cifras son de todo su historial. Toca un evento para ver su detalle y la lista de acceso.</p>
              </div>
              <button type="button" onClick={exportarEventos} disabled={!ordenados.length} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40">
                <Download className="w-3.5 h-3.5" /> Exportar CSV
              </button>
            </div>
            {ordenados.length === 0 ? (
              <p className="px-5 pb-8 text-center text-sm text-slate-500">No tienes eventos en este período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="text-xs text-slate-400 bg-slate-950/60">
                    <tr>
                      {columna('titulo', 'Evento')}
                      {columna('fecha', 'Fecha')}
                      {columna('vendidas', 'Vendidas', 'text-right')}
                      {columna('ocupacion', 'Ocupación', 'text-right')}
                      {columna('ingresosNetos', 'Ingresos netos', 'text-right')}
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Más vendido</th>
                      {columna('calificacion', 'Calificación', 'text-right')}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.map((e) => (
                      <tr key={e.id} onClick={() => setDetalle(e.id)} className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer">
                        <td className="px-3 py-3">
                          <button type="button" onClick={() => setDetalle(e.id)} className="text-left font-semibold text-white hover:text-indigo-300">{e.titulo}</button>
                          <span className="block mt-0.5">{e.estado !== 'PUBLISHED' && <StatusPill {...EVENT_STATUS_LABELS[e.estado as keyof typeof EVENT_STATUS_LABELS]} />}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{fechaEvento(e.fecha)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-200">{e.vendidas.toLocaleString('es-CL')}{e.aforo ? <span className="text-slate-500"> / {e.aforo.toLocaleString('es-CL')}</span> : null}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{e.ocupacion === null ? <span className="text-slate-500">—</span> : `${e.ocupacion.toLocaleString('es-CL')}%`}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-200">{e.gratis ? <span className="text-emerald-300">Gratis</span> : formatPrice(e.ingresosNetos)}</td>
                        <td className="px-3 py-3 text-slate-300">{e.tipoMasVendido ?? '—'}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{e.calificacion === null ? <span className="text-slate-500">—</span> : <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />{e.calificacion.toLocaleString('es-CL')}</span>}</td>
                        <td className="px-2 text-slate-500"><ChevronRight className="w-4 h-4" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {detalle && <EventReport eventoId={detalle} onClose={() => setDetalle(null)} />}
    </section>
  );
}

function Kpi({ icon: Icon, label, valor, variacion, ayuda }: { icon: React.ElementType; label: string; valor: string; variacion?: number | null; ayuda: string }) {
  const sube = (variacion ?? 0) > 0;
  return (
    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800" title={ayuda}>
      <div className="flex items-center justify-between gap-2">
        <Icon className="w-4 h-4 text-indigo-300" />
        {variacion !== undefined && variacion !== null && variacion !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${sube ? 'text-emerald-300' : 'text-rose-300'}`} aria-label={`${sube ? 'Sube' : 'Baja'} ${Math.abs(variacion)}% respecto del período anterior`}>
            {sube ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(variacion) > 999 ? (sube ? '+999%' : '−999%') : `${sube ? '+' : '−'}${Math.abs(variacion).toLocaleString('es-CL')}%`}
          </span>
        )}
      </div>
      <p className="text-xl font-extrabold text-white mt-2 tabular-nums truncate">{valor}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{ayuda}</p>
    </div>
  );
}
