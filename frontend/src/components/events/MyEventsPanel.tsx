'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus, CalendarDays, MapPin, Pencil, Ban, Loader2, Inbox, Lock, ImageIcon, Copy, CalendarClock, Eye,
  ShieldAlert, Megaphone, PlayCircle, Check, Rocket,
} from 'lucide-react';
import {
  EntradaBitacora, EventItem, cancelEvent, fetchMyEvents, formatEventDate, formatPrice, imageSrc, postponeEvent,
  relativeTime, resumeEvent,
} from '../../services/events';
import { EventStatus } from '../../services/auth';
import { EVENT_STATUS_LABELS, StatusPill, formatDate } from '../../utils/labels';
import ReasonField, { validateReason } from '../admin/ReasonField';
import { ReasonToggle } from '../AuthModal';
import { Chip } from '../admin/UsersTab';

type Filter = 'upcoming' | 'past' | 'cancelled' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'upcoming', label: 'Próximos' },
  { id: 'past', label: 'Pasados' },
  { id: 'cancelled', label: 'Cancelados' },
  { id: 'all', label: 'Todos' },
];

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

type Action = { type: 'cancel' | 'postpone'; id: string } | null;

interface MyEventsPanelProps {
  canManage: boolean; // false si la cuenta está en revisión
  refreshKey: number; // cambia cuando se crea o edita un evento
  onCreate: () => void;
  onEdit: (event: EventItem) => void;
  onDuplicate: (event: EventItem) => void;
  onOpen: (event: EventItem) => void;
  onChanged: () => void;
}

// Eventos del organizador: solo ve y administra los suyos
export default function MyEventsPanel({ canManage, refreshKey, onCreate, onEdit, onDuplicate, onOpen, onChanged }: MyEventsPanelProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => setSeen(loadSeen()), []);

  useEffect(() => {
    setLoading(true);
    fetchMyEvents()
      .then((data) => { setEvents(data); setError(null); })
      .catch((e) => setError(e.message || 'No se pudieron cargar tus eventos'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const now = Date.now();
  const isUpcoming = (e: EventItem) => new Date(e.date).getTime() >= now;
  const pendingNotice = (e: EventItem) => (e.ultimoAvisoEquipo && !seen.includes(e.ultimoAvisoEquipo.id) ? e.ultimoAvisoEquipo : null);

  const counts = useMemo(() => ({
    upcoming: events.filter((e) => e.status !== 'CANCELLED' && isUpcoming(e)).length,
    past: events.filter((e) => e.status !== 'CANCELLED' && !isUpcoming(e)).length,
    cancelled: events.filter((e) => e.status === 'CANCELLED').length,
    all: events.length,
  }), [events, now]);

  const stats = useMemo(() => ({
    published: events.filter((e) => e.status === 'PUBLISHED' && isUpcoming(e)).length,
    postponed: events.filter((e) => e.status === 'POSTPONED').length,
    notices: events.filter((e) => pendingNotice(e)).length,
    announcements: events.reduce((sum, e) => sum + (e.totalAnuncios ?? 0), 0),
  }), [events, seen, now]);

  // El próximo evento vigente, destacado arriba
  const next = useMemo(
    () => events
      .filter((e) => EDITABLE.includes(e.status) && isUpcoming(e))
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0],
    [events, now],
  );

  const visible = events
    .filter((e) => {
      if (filter === 'upcoming') return e.status !== 'CANCELLED' && isUpcoming(e);
      if (filter === 'past') return e.status !== 'CANCELLED' && !isUpcoming(e);
      if (filter === 'cancelled') return e.status === 'CANCELLED';
      return true;
    })
    .sort((a, b) => (filter === 'upcoming' ? +new Date(a.date) - +new Date(b.date) : +new Date(b.date) - +new Date(a.date)));

  const markSeen = (id: string) => {
    const updated = [...seen, id];
    setSeen(updated);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(updated.slice(-200)));
    } catch {
      // Sin almacenamiento el aviso vuelve a mostrarse al recargar
    }
  };

  const openAction = (type: 'cancel' | 'postpone', e: EventItem) => {
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
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            <Stat icon={Check} label="Publicados y próximos" value={stats.published} tone="text-emerald-300" />
            <Stat icon={CalendarClock} label="Postergados" value={stats.postponed} tone="text-sky-300" />
            <Stat icon={ShieldAlert} label="Avisos del equipo UBIK" value={stats.notices} tone={stats.notices ? 'text-amber-300' : 'text-slate-400'} highlight={stats.notices > 0} />
            <Stat icon={Megaphone} label="Anuncios publicados" value={stats.announcements} tone="text-amber-200" />
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className="opacity-60 ml-0.5">{counts[f.id]}</span>
            </Chip>
          ))}
        </div>
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
            {events.length === 0 ? 'Aún no has publicado eventos' : 'No hay eventos en esta vista'}
          </p>
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
            return (
              <li key={e.id} className={`bg-slate-900/80 border rounded-2xl p-4 ${teamNotice ? 'border-amber-500/40' : 'border-slate-800'}`}>
                {teamNotice && <TeamNotice entry={teamNotice} status={e.status} onSeen={() => markSeen(teamNotice.id)} />}

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => onOpen(e)}
                    aria-label={`Ver detalle de ${e.title}`}
                    className="w-full sm:w-36 h-28 sm:h-24 rounded-xl overflow-hidden bg-slate-950 shrink-0 flex items-center justify-center"
                  >
                    {src ? <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" /> : <ImageIcon className="w-6 h-6 text-slate-700" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button onClick={() => onOpen(e)} className="font-bold text-white break-words text-left hover:text-indigo-300">{e.title}</button>
                      <StatusPill {...EVENT_STATUS_LABELS[e.status]} />
                      {!!e.totalAnuncios && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
                          <Megaphone className="w-3 h-3" /> {e.totalAnuncios} {e.totalAnuncios === 1 ? 'anuncio' : 'anuncios'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {formatEventDate(e.date)}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {e.address}</p>
                    <p className="text-xs text-slate-300 mt-1">{e.category.name} · <span className="font-semibold">{formatPrice(e.price)}</span></p>
                    {e.statusReason && e.status !== 'PUBLISHED' && !teamNotice && (
                      <p className="text-[11px] text-slate-400 mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 break-words">
                        Motivo: {e.statusReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 sm:w-40">
                    <ActionButton icon={Eye} onClick={() => onOpen(e)} primary>Ver más</ActionButton>
                    {editable && (
                      <>
                        <ActionButton icon={Pencil} onClick={() => onEdit(e)}>Editar</ActionButton>
                        {canResume ? (
                          <ActionButton icon={PlayCircle} disabled={busy} onClick={() => run(() => resumeEvent(e.id), (u) => `"${u.title}" vuelve a estar publicado y acepta reservas.`)}>
                            Reactivar
                          </ActionButton>
                        ) : (
                          <ActionButton icon={CalendarClock} active={current === 'postpone'} onClick={() => openAction('postpone', e)}>Postergar</ActionButton>
                        )}
                      </>
                    )}
                    {canManage && <ActionButton icon={Copy} onClick={() => onDuplicate(e)}>Duplicar</ActionButton>}
                    {editable && (
                      <ActionButton icon={Ban} danger active={current === 'cancel'} onClick={() => openAction('cancel', e)}>Cancelar evento</ActionButton>
                    )}
                    {!editable && (
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500" title={lockedReason}>
                        <Lock className="w-3.5 h-3.5 shrink-0" /> {lockedReason}
                      </span>
                    )}
                  </div>
                </div>

                {current && (
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
      )}
    </section>
  );
}

function Stat({ icon: Icon, label, value, tone, highlight = false }: {
  icon: React.ElementType; label: string; value: number; tone: string; highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border ${highlight ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900/80 border-slate-800'}`}>
      <Icon className={`w-4 h-4 ${tone}`} />
      <p className="text-2xl font-extrabold text-white mt-2">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
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
    <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${style}`}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

// Aviso de que el equipo UBIK actuó sobre el evento (cambió su estado, lo editó o publicó un anuncio)
function TeamNotice({ entry, status, onSeen }: { entry: EntradaBitacora; status: EventStatus; onSeen: () => void }) {
  const newStatus = entry.cambios.find((c) => c.campo === 'estado')?.nuevo as EventStatus | undefined;
  const text =
    entry.tipo === 'CAMBIO_ESTADO' && newStatus
      ? `El equipo de UBIK cambió el estado de este evento a "${EVENT_STATUS_LABELS[newStatus].label}".`
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
