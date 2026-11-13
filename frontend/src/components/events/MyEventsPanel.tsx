'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus, CalendarDays, MapPin, Pencil, Ban, Loader2, Inbox, Lock, Copy, CalendarClock, Eye,
  ShieldAlert, Megaphone, PlayCircle, Check, Rocket, Hourglass, BadgePercent, Flag, Ticket, MessageSquareQuote, ChevronRight, Users,
  MoreHorizontal, ChartColumn, Search, X, ScanLine, ImagePlus, TrendingDown, ArrowDownWideNarrow,
} from 'lucide-react';
import {
  EntradaBitacora, EventItem, cancelEvent, fetchMyEvents, formatEventDate, formatPercent, formatPrice, imageSrc,
  postponeEvent, publicPrice, relativeTime, resumeEvent,
} from '../../services/events';
import { EventStatus } from '../../services/auth';
import { EVENT_STATUS_LABELS, StatusPill, formatDate } from '../../utils/labels';
import ReasonField, { validateReason } from '../admin/ReasonField';
import { ReasonToggle } from '../AuthModal';
import { Chip } from '../admin/UsersTab';
import OfferForm from './OfferForm';
import AccessTeamModal from './AccessTeamModal';
import { OfferBadge } from './OfferBadge';
import EventCover from './EventCover';
import StarRating from '../organizers/StarRating';
import EventReport from '../reports/EventReport';
import { ResenasOrganizador, fetchResenasOrganizador } from '../../services/resenas';
import { FilaEvento, fetchEventosReporte } from '../../services/reportes';
import { fetchEquipoAcceso } from '../../services/equipoAcceso';

type Filter = 'upcoming' | 'finished' | 'cancelled' | 'all';
// Filtros que se activan al tocar una tarjeta del resumen (se suman a las pestañas de arriba)
type Foco = 'published' | 'postponed' | 'notices' | 'announcements' | null;
type Orden = 'fecha' | 'ventas' | 'atencion';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'upcoming', label: 'Próximos' },
  { id: 'finished', label: 'Finalizados' },
  { id: 'cancelled', label: 'Cancelados' },
  { id: 'all', label: 'Todos' },
];
const FOCO_LABEL: Record<Exclude<Foco, null>, string> = {
  published: 'Publicados',
  postponed: 'Postergados',
  notices: 'Con avisos de UBIK',
  announcements: 'Con anuncios',
};
const ORDENES: { id: Orden; label: string }[] = [
  { id: 'fecha', label: 'Fecha' },
  { id: 'ventas', label: 'Más vendidos' },
  { id: 'atencion', label: 'Necesitan atención' },
];
const POR_PAGINA = 10;
const DIA = 86_400_000;

// Mismos estados que el backend permite editar al organizador
const EDITABLE = ['PUBLISHED', 'POSTPONED'];

// Avisos del equipo UBIK que el organizador ya marcó como vistos (solo en este navegador)
const SEEN_KEY = 'ubik_avisos_equipo_vistos';
const loadSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const diaChile = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const vendidasDe = (e: EventItem) => (e.tiposEntrada ?? []).reduce((n, t) => n + (t.vendidas ?? 0), 0);

type Action = { type: 'cancel' | 'postpone' | 'offer'; id: string } | null;

// Sugerencia de próximo paso para un evento (máximo dos por tarjeta)
interface Paso { id: string; icon: React.ElementType; texto: string; accion?: { label: string; run: () => void }; tono: 'emerald' | 'amber' | 'sky' }

interface MyEventsPanelProps {
  canManage: boolean; // false si la cuenta está en revisión
  refreshKey: number; // cambia cuando se crea o edita un evento
  onCreate: () => void;
  onEdit: (event: EventItem) => void;
  onDuplicate: (event: EventItem) => void;
  onOpen: (event: EventItem) => void;
  onChanged: () => void;
  organizerId: string;
  onOpenReviews: () => void; // abre sus reseñas para leerlas y responderlas
}

// Eventos del organizador: solo ve y administra los suyos
export default function MyEventsPanel({ canManage, refreshKey, onCreate, onEdit, onDuplicate, onOpen, onChanged, organizerId, onOpenReviews }: MyEventsPanelProps) {
  // Calificación que le dan los asistentes y reseñas pendientes de responder
  const [reviews, setReviews] = useState<ResenasOrganizador | null>(null);
  useEffect(() => {
    let active = true;
    fetchResenasOrganizador(organizerId).then((r) => active && setReviews(r)).catch(() => {});
    return () => { active = false; };
  }, [organizerId, refreshKey]);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [foco, setFoco] = useState<Foco>(null);
  const [orden, setOrden] = useState<Orden>('fecha');
  const [q, setQ] = useState('');
  const [mostrados, setMostrados] = useState(POR_PAGINA);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [equipoDe, setEquipoDe] = useState<string | null>(null); // evento cuyo equipo de acceso está abierto
  const [reporteDe, setReporteDe] = useState<string | null>(null); // evento cuyo reporte está abierto
  // Cifras de cada evento (ingresos, ocupación, asistencia) desde los reportes del organizador
  const [cifras, setCifras] = useState<Map<string, FilaEvento>>(new Map());
  // Eventos de los próximos días que aún no tienen equipo de acceso
  const [sinEquipo, setSinEquipo] = useState<Set<string>>(new Set());

  useEffect(() => setSeen(loadSeen()), []);

  useEffect(() => {
    setLoading(true);
    fetchMyEvents()
      .then((data) => { setEvents(data); setError(null); })
      .catch((e) => setError(e.message || 'No se pudieron cargar tus eventos'))
      .finally(() => setLoading(false));
    // Ventana de 3 años (el máximo de los reportes): dos hacia atrás y uno hacia adelante
    const hoy = diaChile(new Date());
    const desde = new Date(new Date(`${hoy}T12:00:00Z`).getTime() - 730 * DIA).toISOString().slice(0, 10);
    const hasta = new Date(new Date(`${hoy}T12:00:00Z`).getTime() + 360 * DIA).toISOString().slice(0, 10);
    fetchEventosReporte({ desde, hasta })
      .then((filas) => setCifras(new Map(filas.map((f) => [f.id, f]))))
      .catch(() => setCifras(new Map()));
  }, [refreshKey]);

  const now = Date.now();
  const hoy = diaChile(new Date(now));
  const isUpcoming = (e: EventItem) => new Date(e.date).getTime() >= now;
  const esHoy = (e: EventItem) => diaChile(e.date) === hoy;
  const pendingNotice = (e: EventItem) => (e.ultimoAvisoEquipo && !seen.includes(e.ultimoAvisoEquipo.id) ? e.ultimoAvisoEquipo : null);

  // Un evento sigue entre los próximos durante todo su día y se finaliza solo a la medianoche
  // siguiente (hora de Chile); los finalizados se cuentan por su estado
  const isOpen = (e: EventItem) => e.status !== 'CANCELLED' && e.status !== 'FINISHED';

  // ¿Tienen equipo de acceso los eventos de los próximos 3 días? (pocas consultas: solo esos)
  useEffect(() => {
    if (!canManage) return;
    const proximos = events.filter((e) => isOpen(e) && new Date(e.date).getTime() - Date.now() < 3 * DIA && new Date(e.date).getTime() > Date.now() - DIA);
    let vigente = true;
    Promise.all(proximos.map((e) => fetchEquipoAcceso(e.id).then((r) => (r.accesos.some((a) => a.estado === 'ACTIVO' || a.estado === 'PENDIENTE') ? null : e.id)).catch(() => null)))
      .then((ids) => vigente && setSinEquipo(new Set(ids.filter((x): x is string => !!x))));
    return () => { vigente = false; };
  }, [events, canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    upcoming: events.filter(isOpen).length,
    finished: events.filter((e) => e.status === 'FINISHED').length,
    cancelled: events.filter((e) => e.status === 'CANCELLED').length,
    all: events.length,
  }), [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ({
    published: events.filter((e) => e.status === 'PUBLISHED').length,
    postponed: events.filter((e) => e.status === 'POSTPONED').length,
    finished: events.filter((e) => e.status === 'FINISHED').length,
    sold: events.reduce((sum, e) => sum + vendidasDe(e), 0),
    notices: events.filter((e) => pendingNotice(e)).length,
    announcements: events.reduce((sum, e) => sum + (e.totalAnuncios ?? 0), 0),
  }), [events, seen]); // eslint-disable-line react-hooks/exhaustive-deps

  // El próximo evento vigente, destacado arriba
  const next = useMemo(
    () => events
      .filter((e) => EDITABLE.includes(e.status) && isUpcoming(e))
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0],
    [events, now], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const openAction = (type: 'cancel' | 'postpone' | 'offer', e: EventItem) => {
    setAction({ type, id: e.id });
    setReason('');
    setTouched(false);
    setNotice(null);
    // La nueva fecha parte una semana después de la actual, a la misma hora
    const d = new Date(Math.max(new Date(e.date).getTime(), Date.now()) + 7 * 864e5);
    const pad = (n: number) => String(n).padStart(2, '0');
    setNewDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setNewTime(`${pad(new Date(e.date).getHours())}:${pad(new Date(e.date).getMinutes())}`);
  };

  // Próximos pasos sugeridos según el estado del evento (los más urgentes primero)
  const pasos = (e: EventItem): Paso[] => {
    if (!isOpen(e) || !canManage) return [];
    const lista: Paso[] = [];
    const ms = new Date(e.date).getTime() - now;
    const dias = Math.ceil(ms / DIA);
    if (esHoy(e)) {
      lista.push({ id: 'hoy', icon: ScanLine, tono: 'emerald', texto: 'Es hoy: valida las entradas en el acceso', accion: { label: 'Equipo de acceso', run: () => setEquipoDe(e.id) } });
    } else if (sinEquipo.has(e.id) && dias <= 3) {
      lista.push({ id: 'equipo', icon: Users, tono: 'sky', texto: `${dias <= 1 ? 'Es mañana' : `Faltan ${dias} días`} y aún no tienes equipo de acceso`, accion: { label: 'Crear accesos', run: () => setEquipoDe(e.id) } });
    }
    if (e.estadoCondicion === 'PENDIENTE') {
      lista.push({ id: 'condicion', icon: Hourglass, tono: 'amber', texto: 'La venta de entradas espera la aprobación de UBIK' });
    }
    if (!e.imageUrl && !e.portadaIa && EDITABLE.includes(e.status)) {
      lista.push({ id: 'imagen', icon: ImagePlus, tono: 'sky', texto: 'Sin imagen: una portada propia o creada con IA atrae más asistentes', accion: { label: 'Agregar portada', run: () => onEdit(e) } });
    }
    const ocupacion = cifras.get(e.id)?.ocupacion;
    if (e.status === 'PUBLISHED' && e.price > 0 && !e.ofertaActiva && ms > 0 && dias <= 7 && ocupacion !== null && ocupacion !== undefined && ocupacion < 30) {
      lista.push({ id: 'oferta', icon: TrendingDown, tono: 'amber', texto: `Lleva ${Math.round(ocupacion)}% vendido y ${dias === 1 ? 'falta 1 día' : `faltan ${dias} días`}: prueba una oferta`, accion: { label: 'Poner en oferta', run: () => openAction('offer', e) } });
    }
    return lista.slice(0, 2);
  };

  const t = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtrados = events
    .filter((e) => {
      if (filter === 'upcoming') return isOpen(e);
      if (filter === 'finished') return e.status === 'FINISHED';
      if (filter === 'cancelled') return e.status === 'CANCELLED';
      return true;
    })
    .filter((e) => {
      if (foco === 'published') return e.status === 'PUBLISHED';
      if (foco === 'postponed') return e.status === 'POSTPONED';
      if (foco === 'notices') return !!pendingNotice(e);
      if (foco === 'announcements') return (e.totalAnuncios ?? 0) > 0;
      return true;
    })
    .filter((e) => !t || e.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t));
  const porFecha = (a: EventItem, b: EventItem) => (filter === 'upcoming' ? +new Date(a.date) - +new Date(b.date) : +new Date(b.date) - +new Date(a.date));
  const urgencia = (e: EventItem) => (pendingNotice(e) ? 3 : 0) + (esHoy(e) ? 2 : 0) + pasos(e).length;
  const ordenados = [...filtrados].sort((a, b) =>
    orden === 'ventas' ? vendidasDe(b) - vendidasDe(a) || porFecha(a, b)
      : orden === 'atencion' ? urgencia(b) - urgencia(a) || porFecha(a, b)
        // Por fecha, los eventos de hoy van siempre primero
        : (Number(esHoy(b)) - Number(esHoy(a))) || porFecha(a, b));
  const visible = ordenados.slice(0, mostrados);

  // Al cambiar de vista vuelve a mostrar los primeros
  useEffect(() => { setMostrados(POR_PAGINA); }, [filter, foco, orden, q]);

  const enfocar = (f: Exclude<Foco, null>) => {
    // Los postergados y publicados están entre los próximos; los avisos y anuncios pueden estar en cualquiera
    setFoco((actual) => (actual === f ? null : f));
    setFilter(f === 'published' || f === 'postponed' ? 'upcoming' : 'all');
  };

  const markSeen = (id: string) => {
    const updated = [...seen, id];
    setSeen(updated);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(updated.slice(-200)));
    } catch {
      // Sin almacenamiento el aviso vuelve a mostrarse al recargar
    }
  };

  const replace = (updated: EventItem) =>
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));

  const run = async (task: () => Promise<EventItem>, success: (e: EventItem) => string) => {
    setBusy(true);
    try {
      const updated = await task();
      replace(updated);
      setNotice({ text: success(updated), tone: 'ok' });
      setAction(null);
      onChanged();
    } catch (e: any) {
      setNotice({ text: e.message || 'No se pudo completar la acción', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const postponeDate = newDate && newTime ? new Date(`${newDate}T${newTime}`) : null;
  const postponeDateError = !postponeDate || isNaN(postponeDate.getTime())
    ? 'Indica la nueva fecha y hora'
    : postponeDate.getTime() <= Date.now() ? 'La nueva fecha debe ser futura' : null;

  const confirmAction = (e: EventItem) => {
    setTouched(true);
    if (validateReason(reason)) return;
    const text = reason.normalize('NFC').trim();
    if (action?.type === 'cancel') {
      run(() => cancelEvent(e.id, text), (u) => `"${u.title}" fue cancelado. Los asistentes verán el aviso con tu motivo.`);
    } else {
      if (postponeDateError) return;
      run(
        () => postponeEvent(e.id, postponeDate!.toISOString(), text),
        (u) => `"${u.title}" quedó postergado (nueva fecha: ${formatEventDate(u.date)}). Lo registramos en las novedades del evento.`,
      );
    }
  };

  return (
    <section className="mb-8">
      {!loading && !error && events.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {next ? (
            <div className="lg:col-span-1 p-5 rounded-2xl bg-gradient-to-br from-indigo-600/25 via-indigo-500/10 to-slate-900 border border-indigo-500/30">
              <p className="text-[11px] uppercase tracking-wider font-bold text-indigo-300 flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5" /> Tu próximo evento
              </p>
              <h4 className="mt-2 font-bold text-white text-lg leading-snug break-words">{next.title}</h4>
              <p className="text-xs text-slate-300 mt-1">{formatEventDate(next.date)}</p>
              <p className="text-2xl font-extrabold text-white mt-3 first-letter:uppercase">{relativeTime(next.date)}</p>
              <button onClick={() => onOpen(next)} className="mt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-200 hover:text-white">
                <Megaphone className="w-3.5 h-3.5" /> Ver detalle y publicar un anuncio
              </button>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-center">
              <p className="text-sm text-slate-300 font-semibold">No tienes eventos próximos</p>
              {canManage && (
                <button onClick={onCreate} className="mt-3 self-start flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950">
                  <CalendarPlus className="w-4 h-4" /> Crear evento
                </button>
              )}
            </div>
          )}
          {/* Tocar una tarjeta filtra la lista de abajo */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat icon={Check} label="Publicados y próximos" value={stats.published} tone="text-emerald-300" active={foco === 'published'} onClick={() => enfocar('published')} />
            <Stat icon={CalendarClock} label="Postergados" value={stats.postponed} tone="text-sky-300" active={foco === 'postponed'} onClick={() => enfocar('postponed')} />
            <Stat icon={Flag} label="Finalizados" value={stats.finished} tone="text-slate-300" active={filter === 'finished' && !foco} onClick={() => { setFoco(null); setFilter('finished'); }} />
            <Stat icon={Ticket} label="Entradas vendidas" value={stats.sold} tone="text-indigo-300" active={orden === 'ventas'} onClick={() => { setFoco(null); setFilter('all'); setOrden(orden === 'ventas' ? 'fecha' : 'ventas'); }} hint="Ordena por más vendidos" />
            <Stat icon={ShieldAlert} label="Avisos del equipo UBIK" value={stats.notices} tone={stats.notices ? 'text-amber-300' : 'text-slate-400'} highlight={stats.notices > 0} active={foco === 'notices'} onClick={() => enfocar('notices')} />
            <Stat icon={Megaphone} label="Anuncios publicados" value={stats.announcements} tone="text-amber-200" active={foco === 'announcements'} onClick={() => enfocar('announcements')} />
          </div>
        </div>
      )}

      {reviews && reviews.resumen.total > 0 && (
        <button
          onClick={onOpenReviews}
          className="mb-6 w-full flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 text-left transition-colors"
        >
          <span className="flex items-center gap-3 flex-1 min-w-0">
            <MessageSquareQuote className="w-5 h-5 text-amber-300 shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs text-slate-400">Tu calificación según los asistentes</span>
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-xl text-white">{reviews.resumen.promedio!.toFixed(1)}</strong>
                <StarRating value={reviews.resumen.promedio} size="sm" />
                <span className="text-xs text-slate-400">{reviews.resumen.total} {reviews.resumen.total === 1 ? 'reseña' : 'reseñas'}</span>
              </span>
            </span>
          </span>
          {reviews.sinResponder > 0 && (
            <span className="self-start sm:self-auto text-[11px] font-bold text-indigo-100 bg-indigo-500/25 rounded-lg px-2.5 py-1">
              {reviews.sinResponder} sin responder
            </span>
          )}
          <span className="self-start sm:self-auto flex items-center gap-1 text-xs font-bold text-amber-200">
            Ver y responder reseñas <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      )}

      {/* Vistas, búsqueda y orden (una sola fila sobre la lista) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => { setFilter(f.id); setFoco(null); }}>
              {f.label} <span className="opacity-60 ml-0.5">{counts[f.id]}</span>
            </Chip>
          ))}
          {foco && (
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-indigo-100 font-semibold">
              {FOCO_LABEL[foco]}
              <button type="button" onClick={() => setFoco(null)} aria-label={`Quitar el filtro ${FOCO_LABEL[foco]}`} className="p-0.5 rounded-full hover:bg-indigo-500/30"><X className="w-3.5 h-3.5" /></button>
            </span>
          )}
        </div>
        {events.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar en mis eventos"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <ArrowDownWideNarrow className="w-4 h-4" aria-hidden />
              <span className="sr-only">Ordenar por</span>
              <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}
                className="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {ORDENES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {notice && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm ${notice.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : error ? (
        <p className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <Inbox className="w-9 h-9 text-slate-600 mb-3" />
          <p className="text-sm text-slate-300 font-semibold">
            {events.length === 0 ? 'Aún no has publicado eventos' : q ? `Ningún evento coincide con «${q}»` : 'No hay eventos en esta vista'}
          </p>
          {events.length > 0 && (q || foco) && (
            <button onClick={() => { setQ(''); setFoco(null); }} className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Quitar filtros</button>
          )}
          {events.length === 0 && canManage && (
            <>
              <p className="text-xs text-slate-500 mt-1 mb-4">Crea tu primer evento en menos de dos minutos.</p>
              <button onClick={onCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950">
                <CalendarPlus className="w-4 h-4" /> Crear mi primer evento
              </button>
            </>
          )}
        </div>
      ) : (
        <>
        <ul className="space-y-3">
          {visible.map((e) => {
            const editable = canManage && EDITABLE.includes(e.status);
            // Solo se reactiva lo que el propio organizador postergó
            const canResume = editable && e.status === 'POSTPONED' && isUpcoming(e) && e.statusChangedById === e.organizer.id;
            const src = imageSrc(e.imageUrl);
            const teamNotice = pendingNotice(e);
            const lockedReason = !canManage
              ? 'Tu cuenta está en revisión: no puedes modificar eventos'
              : 'Por su estado actual este evento ya no se puede modificar';
            const current = action?.id === e.id ? action.type : null;
            // Solo se ponen en oferta los eventos de pago publicados que aún no se realizan
            const canOffer = editable && e.status === 'PUBLISHED' && e.price > 0 && isUpcoming(e);
            const hoyEs = esHoy(e) && isOpen(e);
            const cifra = cifras.get(e.id);
            const sugerencias = pasos(e);
            const menu: MenuItem[] = [
              ...(editable ? [canResume
                ? { icon: PlayCircle, label: 'Reactivar', disabled: busy, run: () => run(() => resumeEvent(e.id), (u) => `"${u.title}" vuelve a estar publicado y acepta reservas.`) }
                : { icon: CalendarClock, label: 'Postergar', run: () => openAction('postpone', e) }] : []),
              ...(canOffer ? [{ icon: BadgePercent, label: e.ofertaActiva ? 'Editar oferta' : 'Poner en oferta', run: () => openAction('offer', e) }] : []),
              ...(canManage && isOpen(e) ? [{ icon: Users, label: 'Equipo de acceso', run: () => setEquipoDe(e.id) }] : []),
              { icon: ChartColumn, label: 'Ver reporte', run: () => setReporteDe(e.id) },
              ...(canManage ? [{ icon: Copy, label: 'Duplicar', run: () => onDuplicate(e) }] : []),
              ...(editable ? [{ icon: Ban, label: 'Cancelar evento', danger: true, separado: true, run: () => openAction('cancel', e) }] : []),
            ];
            return (
              <li key={e.id} className={`bg-slate-900/80 border rounded-2xl p-4 ${teamNotice ? 'border-amber-500/40' : hoyEs ? 'border-emerald-500/40' : 'border-slate-800'}`}>
                {teamNotice && <TeamNotice entry={teamNotice} status={e.status} onSeen={() => markSeen(teamNotice.id)} />}

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => onOpen(e)}
                    aria-label={`Ver detalle de ${e.title}`}
                    className="relative w-full sm:w-36 h-28 sm:h-24 rounded-xl overflow-hidden bg-slate-950 shrink-0 flex items-center justify-center"
                  >
                    {src ? <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" /> : <EventCover portada={e.portadaIa} categoria={e.category?.name} size="thumb" />}
                    {hoyEs && <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-emerald-500 text-[10px] font-extrabold text-slate-950">HOY</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button onClick={() => onOpen(e)} className="font-bold text-white break-words text-left hover:text-indigo-300">{e.title}</button>
                      <StatusPill {...EVENT_STATUS_LABELS[e.status]} />
                      <OfferBadge event={e} />
                      {!!e.totalAnuncios && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
                          <Megaphone className="w-3 h-3" /> {e.totalAnuncios} {e.totalAnuncios === 1 ? 'anuncio' : 'anuncios'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {formatEventDate(e.date)}{hoyEs ? ' · hoy' : ''}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {e.address}</p>
                    <p className="text-xs text-slate-300 mt-1">
                      {e.category.name} ·{' '}
                      {e.price > 0 ? (
                        <>
                          <span className="font-semibold">Entradas {e.variosPrecios ? 'desde ' : ''}{formatPrice(publicPrice(e))}</span>
                          <span className="text-slate-500"> para el público ({formatPercent(e.porcentajeCargo ?? 0)} de cargo incluido)</span>
                        </>
                      ) : (
                        <span className="font-semibold">Gratis</span>
                      )}
                    </p>
                    <SalesSummary event={e} />
                    {/* Cifras clave del evento, con acceso a su reporte */}
                    {cifra && (cifra.vendidas > 0 || cifra.asistencia !== null) && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        {e.price > 0 && <span>Ingresos netos <strong className="text-white tabular-nums">{formatPrice(cifra.ingresosNetos)}</strong></span>}
                        {cifra.ocupacion !== null && <span>Ocupación <strong className="text-white tabular-nums">{cifra.ocupacion.toLocaleString('es-CL')}%</strong></span>}
                        {cifra.asistencia !== null && <span>Asistencia <strong className="text-white tabular-nums">{cifra.asistencia.toLocaleString('es-CL')}%</strong></span>}
                        <button type="button" onClick={() => setReporteDe(e.id)} className="inline-flex items-center gap-1 font-semibold text-indigo-300 hover:text-indigo-200">
                          <ChartColumn className="w-3.5 h-3.5" /> Ver reporte
                        </button>
                      </p>
                    )}
                    {e.estadoCondicion === 'APROBADA' && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2 py-1">
                        <BadgePercent className="w-3.5 h-3.5" /> Condición especial aprobada
                      </p>
                    )}
                    {e.statusReason && e.status !== 'PUBLISHED' && !teamNotice && (
                      <p className="text-[11px] text-slate-400 mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 break-words">
                        Motivo: {e.statusReason}
                      </p>
                    )}
                    {sugerencias.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {sugerencias.map((p) => (
                          <li key={p.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] px-2.5 py-1.5 rounded-lg border ${
                            p.tono === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-100' : p.tono === 'amber' ? 'bg-amber-500/10 border-amber-500/25 text-amber-100' : 'bg-sky-500/10 border-sky-500/25 text-sky-100'
                          }`}>
                            <p.icon className="w-3.5 h-3.5 shrink-0" /> <span className="font-semibold">{p.texto}</span>
                            {p.accion && <button type="button" onClick={p.accion.run} className="font-bold underline underline-offset-2 hover:no-underline">{p.accion.label}</button>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {/* Acciones: las dos más usadas a la vista y el resto en "Más acciones" */}
                  <div className="flex sm:flex-col gap-2 shrink-0 sm:w-40">
                    <ActionButton icon={Eye} onClick={() => onOpen(e)} primary>Ver más</ActionButton>
                    {editable && <ActionButton icon={Pencil} onClick={() => onEdit(e)}>Editar</ActionButton>}
                    <MoreMenu titulo={e.title} items={menu} />
                    {!editable && (
                      <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500" title={lockedReason}>
                        <Lock className="w-3.5 h-3.5 shrink-0" /> {canManage ? 'Ya no se puede modificar' : 'Cuenta en revisión'}
                      </span>
                    )}
                  </div>
                </div>
                {equipoDe === e.id && <AccessTeamModal eventoId={e.id} onClose={() => setEquipoDe(null)} />}

                {current === 'offer' && (
                  <OfferForm
                    event={e}
                    onCancel={() => setAction(null)}
                    onSaved={(updated, text) => {
                      replace(updated);
                      setNotice({ text, tone: 'ok' });
                      setAction(null);
                      onChanged();
                    }}
                  />
                )}

                {current && current !== 'offer' && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                    {current === 'postpone' && (
                      <div>
                        <p className="text-xs font-semibold text-slate-300 mb-1">Nueva fecha y hora <span className="text-rose-400">*</span></p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="date"
                            value={newDate}
                            onChange={(ev) => setNewDate(ev.target.value)}
                            className="px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500 [color-scheme:dark]"
                          />
                          <input
                            type="time"
                            value={newTime}
                            onChange={(ev) => setNewTime(ev.target.value)}
                            className="px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500 [color-scheme:dark]"
                          />
                        </div>
                        {touched && postponeDateError && <p className="text-[11px] text-rose-300 mt-1">{postponeDateError}</p>}
                        {!postponeDateError && postponeDate && (
                          <p className="text-[11px] text-sky-300 mt-1">
                            {formatEventDate(e.date)} → <strong>{formatEventDate(postponeDate.toISOString())}</strong>
                          </p>
                        )}
                      </div>
                    )}
                    <ReasonField
                      label={current === 'cancel' ? 'Motivo de la cancelación (lo verán los asistentes)' : 'Motivo de la postergación (lo verán los asistentes)'}
                      value={reason}
                      onChange={setReason}
                      onBlur={() => setTouched(true)}
                      showError={touched}
                      placeholder={
                        current === 'cancel'
                          ? 'Ej. Se cancela por pronóstico de lluvia intensa. Pronto anunciaremos una nueva fecha.'
                          : 'Ej. Por la alerta de lluvia trasladamos el evento una semana. Las reservas se mantienen.'
                      }
                      tone={current === 'cancel' ? 'rose' : 'indigo'}
                      autoFocus={current === 'cancel'}
                    />
                    <p className="text-[11px] text-slate-500">
                      {current === 'cancel'
                        ? 'Esta acción no se puede deshacer desde tu cuenta.'
                        : 'El evento seguirá visible con el aviso "Postergado" y la nueva fecha. Cuando quieras, podrás reactivarlo.'}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setAction(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
                        Volver
                      </button>
                      <button
                        onClick={() => confirmAction(e)}
                        disabled={busy}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 ${current === 'cancel' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-sky-600 hover:bg-sky-500'}`}
                      >
                        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {current === 'cancel' ? 'Confirmar cancelación' : 'Confirmar postergación'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-xs text-slate-500" aria-live="polite">Mostrando {visible.length} de {ordenados.length}</p>
          {visible.length < ordenados.length && (
            <button type="button" onClick={() => setMostrados((n) => n + POR_PAGINA)} className="px-5 py-2.5 text-sm font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
              Mostrar {Math.min(POR_PAGINA, ordenados.length - visible.length)} más
            </button>
          )}
        </div>
        </>
      )}
      {reporteDe && <EventReport eventoId={reporteDe} onClose={() => setReporteDe(null)} />}
    </section>
  );
}

function Stat({ icon: Icon, label, value, tone, highlight = false, active = false, onClick, hint }: {
  icon: React.ElementType; label: string; value: number; tone: string; highlight?: boolean; active?: boolean; onClick: () => void; hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint ?? `Ver ${label.toLowerCase()}`}
      className={`p-4 rounded-2xl border text-left transition-colors ${
        active ? 'bg-indigo-500/15 border-indigo-400 ring-1 ring-indigo-400/50' : highlight ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400/60' : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
      }`}
    >
      <Icon className={`w-4 h-4 ${tone}`} />
      <p className="text-2xl font-extrabold text-white mt-2">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </button>
  );
}

function ActionButton({ icon: Icon, children, onClick, primary, danger, active, disabled }: {
  icon: React.ElementType; children: React.ReactNode; onClick: () => void;
  primary?: boolean; danger?: boolean; active?: boolean; disabled?: boolean;
}) {
  const style = primary
    ? 'bg-indigo-600 hover:bg-indigo-500'
    : danger
      ? `${active ? 'bg-rose-600/80' : 'bg-slate-800'} hover:bg-rose-600/80`
      : `${active ? 'bg-slate-700' : 'bg-slate-800'} hover:bg-slate-700`;
  return (
    <button onClick={onClick} disabled={disabled} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${style}`}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

interface MenuItem { icon: React.ElementType; label: string; run: () => void; danger?: boolean; separado?: boolean; disabled?: boolean }

// "Más acciones": menú desplegable en pantalla ancha y hoja inferior en el celular.
// Se cierra al elegir, al tocar fuera o con Escape; las acciones destructivas van al final y separadas.
function MoreMenu({ titulo, items }: { titulo: string; items: MenuItem[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => { if (!ref.current?.contains(ev.target as Node)) setAbierto(false); };
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  if (!items.length) return null;
  return (
    <div ref={ref} className="relative flex-1 sm:flex-none">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Más acciones para ${titulo}`}
        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${abierto ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700'}`}
      >
        <MoreHorizontal className="w-4 h-4" /> Más
      </button>
      {abierto && (
        <>
          {/* En el celular el menú sube desde abajo, con el fondo oscurecido */}
          <div className="sm:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setAbierto(false)} aria-hidden />
          <div
            role="menu"
            aria-label={`Acciones de ${titulo}`}
            className="fixed sm:absolute inset-x-0 bottom-0 sm:bottom-auto sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 z-50 sm:w-56 p-2 pb-6 sm:p-1.5 rounded-t-2xl sm:rounded-xl bg-slate-900 border border-slate-700 shadow-2xl"
          >
            <p className="sm:hidden px-3 pt-1 pb-2 text-xs font-bold text-slate-400 truncate">{titulo}</p>
            {items.map((it) => (
              <React.Fragment key={it.label}>
                {it.separado && <div className="my-1 h-px bg-slate-800" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={() => { setAbierto(false); it.run(); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-3 sm:py-2 text-sm sm:text-xs font-semibold rounded-lg text-left disabled:opacity-50 ${
                    it.danger ? 'text-rose-300 hover:bg-rose-500/15' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <it.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" /> {it.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Aviso de que el equipo UBIK actuó sobre el evento (cambió su estado, lo editó o publicó un anuncio)
function TeamNotice({ entry, status, onSeen }: { entry: EntradaBitacora; status: EventStatus; onSeen: () => void }) {
  const newStatus = entry.cambios.find((c) => c.campo === 'estado')?.nuevo as EventStatus | undefined;
  const text =
    entry.tipo === 'CAMBIO_ESTADO' && newStatus
      ? `El equipo de UBIK cambió el estado de este evento a "${EVENT_STATUS_LABELS[newStatus].label}".`
      : entry.tipo === 'CAMBIO_DATOS' && entry.titulo
        ? `${entry.titulo}.`
        : entry.tipo === 'CAMBIO_DATOS'
          ? 'El equipo de UBIK actualizó datos de este evento. Revisa el detalle en sus novedades.'
        : 'El equipo de UBIK publicó un anuncio en este evento.';
  const hint =
    status === 'UNDER_REVIEW'
      ? 'Mientras esté en revisión no aparece en el catálogo. Si tienes dudas, escríbenos a soporte@ubik.cl.'
      : status === 'CANCELLED' || status === 'FINISHED'
        ? 'Si crees que es un error, escríbenos a soporte@ubik.cl.'
        : null;

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
      <ShieldAlert className="w-5 h-5 shrink-0 text-amber-300" />
      <div className="flex-1 text-sm text-amber-100">
        <p>
          <strong className="text-amber-200">{text}</strong>{' '}
          <span className="text-xs text-amber-200/70">{formatDate(entry.fechaCreacion, true)}</span>
        </p>
        {hint && <p className="text-xs text-amber-100/80 mt-0.5">{hint}</p>}
        {entry.mensaje && <ReasonToggle reason={entry.mensaje} dateLabel="Fecha del cambio" date={entry.fechaCreacion} tone="amber" compact />}
      </div>
      <button onClick={onSeen} className="self-end sm:self-start px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100">
        Entendido
      </button>
    </div>
  );
}

// Ventas del evento: entradas vendidas (o reservadas) por tipo sobre su cupo, y estacionamientos
function SalesSummary({ event }: { event: EventItem }) {
  const tipos = event.tiposEntrada ?? [];
  if (!tipos.length) return null;
  const vendidas = tipos.reduce((n, t) => n + (t.vendidas ?? 0), 0);
  const aforo = event.aforo ?? null;
  return (
    <div className="mt-2 max-w-md">
      {aforo ? (
        <>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Vendidas</span>
            <span className="tabular-nums"><span className="font-bold text-white">{vendidas.toLocaleString('es-CL')}</span> de {aforo.toLocaleString('es-CL')}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${Math.min(100, (vendidas / aforo) * 100)}%` }} />
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-400"><span className="font-bold text-white">{vendidas}</span> vendidas · sin aforo definido (edita el evento para indicarlo)</p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {tipos.map((t) => (
          <span key={t.id} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${t.cupo !== null && (t.vendidas ?? 0) >= t.cupo ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>
            {t.nombre} {t.vendidas ?? 0}{t.cupo !== null ? `/${t.cupo}` : ''}
          </span>
        ))}
        {event.estacionamiento === 'PAGADO' && (
          <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 border border-sky-500/30 bg-sky-500/10 text-sky-200">
            Estacionamientos {event.estacionamientosVendidos ?? 0}/{event.cuposEstacionamiento}
          </span>
        )}
      </div>
    </div>
  );
}
