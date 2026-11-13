'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Download, Search, ShieldCheck, BadgePercent, Car, Clock, Users, ChartColumn, DoorOpen, ScanLine, CircleCheck, CircleDashed } from 'lucide-react';
import { AsistenciaEvento, DetalleEvento, ListaAcceso, descargarCsv, fetchDetalleEvento, fetchListaAcceso } from '../../services/reportes';
import { formatEventDate, formatPrice } from '../../services/events';
import { formatRut } from '../../utils/rut';
import { AreaChart, BarChart, ProgressBars } from './charts';

const fechaHora = (f: string) => new Date(f).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const hora = (f: string) => new Date(f).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Detalle de un evento: ventas por tipo, curva hasta el evento, oferta y estacionamientos; y su lista de acceso
export default function EventReport({ eventoId, onClose }: { eventoId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'detalle' | 'acceso'>('detalle');
  const [detalle, setDetalle] = useState<DetalleEvento | null>(null);
  const [lista, setLista] = useState<ListaAcceso | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDetalleEvento(eventoId).then(setDetalle).catch((e) => setError((e as Error).message));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eventoId, onClose]);

  useEffect(() => {
    if (tab === 'acceso' && !lista) fetchListaAcceso(eventoId).then(setLista).catch((e) => setError((e as Error).message));
  }, [tab, lista, eventoId]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-labelledby="reporte-evento-titulo">
      <div className="relative w-full sm:max-w-4xl max-h-[94vh] overflow-y-auto ubik-scroll bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur px-5 sm:px-7 pt-5 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-bold text-indigo-300">Reporte del evento</p>
              <h2 id="reporte-evento-titulo" className="text-xl font-extrabold text-white truncate">{detalle?.evento.titulo ?? 'Cargando…'}</h2>
              {detalle && <p className="text-xs text-slate-400">{formatEventDate(detalle.evento.fecha)} · {detalle.evento.categoria}</p>}
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-3 flex gap-1" role="tablist">
            {([['detalle', 'Ventas', ChartColumn], ['acceso', 'Lista de acceso', Users]] as const).map(([id, label, Icon]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === id ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 sm:px-7 py-6">
          {error ? <p className="text-sm text-rose-300">{error}</p>
            : !detalle ? <div className="py-12 flex justify-center text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
              : tab === 'detalle' ? <Detalle d={detalle} />
                : !lista ? <div className="py-12 flex justify-center text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  : <Acceso lista={lista} />}
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-lg font-extrabold text-white tabular-nums">{valor}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

function Detalle({ d }: { d: DetalleEvento }) {
  const vendidas = d.totales.entradas;
  if (!vendidas) return <p className="py-10 text-center text-sm text-slate-500">Este evento aún no tiene entradas vendidas ni confirmadas.</p>;
  const inicioOferta = d.oferta ? Math.max(0, Math.ceil((new Date(d.evento.fecha).getTime() - new Date(d.oferta.desde).getTime()) / 86_400_000)) : null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Dato label="Entradas" valor={vendidas.toLocaleString('es-CL')} sub={d.evento.aforo ? `de ${d.evento.aforo.toLocaleString('es-CL')} de aforo` : undefined} />
        <Dato label="Ocupación" valor={d.ocupacion === null ? '—' : `${d.ocupacion.toLocaleString('es-CL')}%`} />
        <Dato label="Ingresos netos" valor={formatPrice(d.totales.ingresosNetos)} sub={`Cargo UBIK: ${formatPrice(d.totales.cargoServicio)}`} />
        <Dato label="Ticket promedio" valor={formatPrice(d.totales.ticketPromedio)} sub={`${d.totales.compras} compras`} />
      </div>

      {d.asistencia ? (
        <Asistencia a={d.asistencia} />
      ) : d.diasParaEvento === 0 ? (
        <p className="flex items-start gap-2 text-xs text-slate-400 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <ScanLine className="w-4 h-4 shrink-0 text-slate-500 mt-px" />
          No se validaron entradas en el acceso de este evento, así que no hay datos de asistencia. En tus próximos eventos, valida con la app o con tu equipo de acceso para ver quiénes llegaron y a qué hora.
        </p>
      ) : null}

      <section>
        <h3 className="text-sm font-bold text-white mb-3">Ventas por tipo de entrada</h3>
        <ProgressBars filas={d.porTipo.map((t) => ({
          etiqueta: t.nombre,
          valor: t.vendidas,
          total: t.cupo,
          detalle: `${t.vendidas}${t.cupo ? ` / ${t.cupo}` : ''} · ${t.ocupacion === null ? '' : `${t.ocupacion.toLocaleString('es-CL')}% · `}${formatPrice(t.ingresosNetos)}`,
        }))} />
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-white">Venta acumulada hasta el evento</h3>
          {d.ventaUltimaSemana !== null ? (
            <p className="text-xs text-slate-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-300" /> <strong className="text-white">{d.ventaUltimaSemana.toLocaleString('es-CL')}%</strong> se vendió en la última semana</p>
          ) : d.diasParaEvento > 0 ? (
            <p className="text-xs text-slate-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-300" /> Faltan <strong className="text-white">{d.diasParaEvento}</strong> días: la curva llega hasta hoy</p>
          ) : null}
        </div>
        <AreaChart
          datos={d.curva.map((c) => ({
            x: c.diasAntes,
            valor: c.acumuladas,
            etiqueta: c.diasAntes === 0 ? 'Día del evento' : c.diasAntes === d.diasParaEvento ? 'Hoy' : `${c.diasAntes} ${c.diasAntes === 1 ? 'día' : 'días'} antes`,
          }))}
          formato={(v) => `${v} ${v === 1 ? 'entrada' : 'entradas'}`}
          etiquetaX={(x) => (x === 0 ? 'Día' : x === d.diasParaEvento ? 'Hoy' : `-${x}`)}
          marcas={inicioOferta !== null ? [{ x: inicioOferta, texto: `Oferta ${d.oferta!.porcentaje}%` }] : []}
          descripcion={`Entradas acumuladas según los días que faltaban para el evento; total ${vendidas}`}
        />
        <p className="text-[11px] text-slate-500 mt-1">Eje horizontal: días que faltaban para el evento.</p>
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        {d.oferta && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/25">
            <p className="text-sm font-bold text-amber-100 flex items-center gap-1.5"><BadgePercent className="w-4 h-4" /> Oferta de {d.oferta.porcentaje}%</p>
            <p className="text-xs text-slate-300 mt-1.5">
              Durante la oferta: <strong className="text-white">{d.oferta.ventasPorDiaDurante.toLocaleString('es-CL')}</strong> entradas por día · antes: <strong className="text-white">{d.oferta.ventasPorDiaAntes.toLocaleString('es-CL')}</strong>
            </p>
            {d.oferta.variacion !== null && (
              <p className={`text-sm font-bold mt-1 ${d.oferta.variacion >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {d.oferta.variacion >= 0 ? '+' : ''}{d.oferta.variacion.toLocaleString('es-CL')}% de ventas diarias
              </p>
            )}
            <p className="text-[10px] text-slate-500 mt-1">Compara con el mismo número de días justo antes de la oferta.</p>
          </div>
        )}
        {d.estacionamiento && (
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <p className="text-sm font-bold text-white flex items-center gap-1.5"><Car className="w-4 h-4 text-sky-300" /> Estacionamientos</p>
            <p className="text-xs text-slate-300 mt-1.5"><strong className="text-white">{d.estacionamiento.vendidos}</strong> vendidos{d.estacionamiento.cupos ? ` de ${d.estacionamiento.cupos} cupos` : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Asistencia según las entradas validadas en el acceso: cuántos llegaron, de qué tipo, por qué acceso y a qué hora
function Asistencia({ a }: { a: AsistenciaEvento }) {
  const totalPorAcceso = a.porAcceso.reduce((n, x) => n + x.ingresos, 0);
  const etiquetaTramo = (desde: string) => {
    const fin = new Date(new Date(desde).getTime() + a.tramoMinutos * 60_000).toISOString();
    return `${hora(desde)}–${hora(fin)}`;
  };
  return (
    <section className="space-y-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5"><ScanLine className="w-4 h-4 text-emerald-300" /> Asistencia</h3>
        <p className="text-[11px] text-slate-400">Según las entradas validadas en el acceso · primer ingreso {hora(a.primerIngreso)}, último {hora(a.ultimoIngreso)}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Dato label="Ingresaron" valor={a.ingresados.toLocaleString('es-CL')} sub={`de ${a.vendidas.toLocaleString('es-CL')} entradas`} />
        <Dato label="No llegaron" valor={a.porIngresar.toLocaleString('es-CL')} sub="o aún no ingresan" />
        <Dato label="Asistencia" valor={a.porcentaje === null ? '—' : `${a.porcentaje.toLocaleString('es-CL')}%`} />
        <Dato label="Hora peak" valor={hora(a.pico.desde)} sub={`${a.pico.ingresos} ingresos en ${a.tramoMinutos === 60 ? 'esa hora' : '15 min'}`} />
      </div>

      <div>
        <h4 className="text-xs font-bold text-slate-300 mb-2">Llegadas {a.tramoMinutos === 60 ? 'por hora' : 'cada 15 minutos'}</h4>
        <BarChart
          datos={a.llegadas.map((l) => ({ clave: l.desde, valor: l.ingresos }))}
          formato={(v) => `${v} ${v === 1 ? 'ingreso' : 'ingresos'}`}
          etiquetaX={(k) => hora(k)}
          alto={170}
          descripcion={`Ingresos al evento ${a.tramoMinutos === 60 ? 'por hora' : 'cada 15 minutos'}; peak a las ${hora(a.pico.desde)}`}
        />
        <details className="mt-1">
          <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-300">Ver como tabla</summary>
          <table className="mt-2 text-xs w-full max-w-xs">
            <tbody>
              {a.llegadas.map((l) => (
                <tr key={l.desde} className="border-t border-slate-800"><td className="py-1 text-slate-400">{etiquetaTramo(l.desde)}</td><td className="py-1 text-right text-white tabular-nums">{l.ingresos}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <h4 className="text-xs font-bold text-slate-300 mb-2">Por tipo de entrada</h4>
          <ProgressBars filas={a.porTipo.map((t) => ({
            etiqueta: t.nombre,
            valor: t.ingresados,
            total: t.vendidas,
            detalle: `${t.ingresados} / ${t.vendidas} · ${t.vendidas ? Math.round((t.ingresados / t.vendidas) * 100) : 0}%`,
          }))} />
          {a.estacionamiento && (
            <p className="mt-3 text-xs text-slate-300 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-sky-300" /> Estacionamiento: <strong className="text-white">{a.estacionamiento.ingresados}</strong> de {a.estacionamiento.vendidos} vehículos ingresaron
            </p>
          )}
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5"><DoorOpen className="w-3.5 h-3.5" /> Por acceso</h4>
          <ProgressBars filas={a.porAcceso.map((x) => ({
            etiqueta: x.nombre,
            valor: x.ingresos,
            total: totalPorAcceso,
            detalle: `${x.ingresos} · ${totalPorAcceso ? Math.round((x.ingresos / totalPorAcceso) * 100) : 0}%`,
          }))} />
        </div>
      </div>
    </section>
  );
}

function Acceso({ lista }: { lista: ListaAcceso }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'ingresaron' | 'pendientes'>('todos');
  const conIngresos = lista.ingresados > 0;
  const visibles = useMemo(() => {
    const t = normalizar(q.trim()).replace(/[.\-\s]/g, '');
    const porEstado = lista.asistentes.filter((a) => filtro === 'todos' || (filtro === 'ingresaron' ? !!a.ingresoEn : !a.ingresoEn));
    if (!t) return porEstado;
    return porEstado.filter((a) => normalizar(`${a.nombre}${a.apellido}`).replace(/\s/g, '').includes(t) || a.rut.replace(/[.\-]/g, '').toLowerCase().includes(t) || a.codigo.toLowerCase().includes(t));
  }, [q, lista, filtro]);

  const exportar = () => descargarCsv(`ubik-lista-acceso-${normalizar(lista.evento.titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`,
    ['Apellido', 'Nombre', 'RUT', 'Tipo de entrada', 'Código de entrada', 'Compra', 'Fecha de compra', 'Ingresó', 'Hora de ingreso', 'Validado por'],
    lista.asistentes.map((a) => [
      a.apellido, a.nombre, formatRut(a.rut), a.tipo, a.codigo, a.compra, fechaHora(a.fechaCompra),
      a.ingresoEn ? 'Sí' : 'No', a.ingresoEn ? fechaHora(a.ingresoEn) : '', a.validadoPor ?? '',
    ]));

  return (
    <div>
      <div className="flex gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-100 mb-4">
        <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-300 mt-px" />
        <span>
          Úsala para validar el acceso: compara el RUT con la cédula de cada asistente. Contiene datos personales: compártela solo con tu equipo de acceso
          y elimínala después del evento.{lista.evento.edadMinima ? ` Evento para mayores de ${lista.evento.edadMinima} años.` : ''}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, RUT o código" aria-label="Buscar asistente"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
        </div>
        <span className="text-sm text-slate-300">
          <strong className="text-white">{lista.total}</strong> {lista.total === 1 ? 'asistente' : 'asistentes'}
          {conIngresos && <> · <strong className="text-emerald-300">{lista.ingresados}</strong> ingresaron</>}
        </span>
        <button type="button" onClick={exportar} disabled={!lista.total} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>
      {conIngresos && (
        <div className="flex gap-1.5 mb-3" role="group" aria-label="Filtrar por ingreso">
          {([['todos', 'Todos', lista.total], ['ingresaron', 'Ingresaron', lista.ingresados], ['pendientes', 'No han ingresado', lista.total - lista.ingresados]] as const).map(([id, label, n]) => (
            <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${filtro === id ? 'bg-indigo-500/20 border-indigo-400 text-white' : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
              {label} <span className="text-slate-400 tabular-nums">{n}</span>
            </button>
          ))}
        </div>
      )}
      {lista.total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aún no hay entradas vendidas ni confirmadas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm min-w-[680px]">
            <thead className="text-xs text-slate-400 bg-slate-950/60">
              <tr><th className="text-left px-3 py-2">Asistente</th><th className="text-left px-3 py-2">RUT</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Código</th><th className="text-left px-3 py-2">Ingreso</th></tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr key={a.codigo} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-white">{a.apellido}, {a.nombre}</td>
                  <td className="px-3 py-2 text-slate-200 tabular-nums">{formatRut(a.rut)}</td>
                  <td className="px-3 py-2 text-slate-300">{a.tipo}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{a.codigo}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.ingresoEn ? (
                      <span className="flex items-start gap-1.5 text-emerald-200">
                        <CircleCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
                        <span>{fechaHora(a.ingresoEn)}{a.validadoPor && <span className="block text-[10px] text-slate-500">{a.validadoPor}</span>}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-500"><CircleDashed className="w-3.5 h-3.5" /> Pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibles.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{q ? `Nadie coincide con «${q}».` : 'No hay asistentes en este filtro.'}</p>}
        </div>
      )}
    </div>
  );
}
