'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CalendarDays, MapPin, Pencil, Ban, Loader2, Inbox, Lock, ImageIcon } from 'lucide-react';
import { EventItem, cancelEvent, fetchMyEvents, formatEventDate, formatPrice, imageSrc } from '../../services/events';
import { EVENT_STATUS_LABELS, StatusPill } from '../../utils/labels';
import ReasonField, { validateReason } from '../admin/ReasonField';
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

interface MyEventsPanelProps {
  canManage: boolean; // false si la cuenta está en revisión
  refreshKey: number; // cambia cuando se crea o edita un evento
  onCreate: () => void;
  onEdit: (event: EventItem) => void;
  onChanged: () => void;
}

// Eventos del organizador: solo ve y administra los suyos
export default function MyEventsPanel({ canManage, refreshKey, onCreate, onEdit, onChanged }: MyEventsPanelProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMyEvents()
      .then((data) => { setEvents(data); setError(null); })
      .catch((e) => setError(e.message || 'No se pudieron cargar tus eventos'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const now = Date.now();
  const counts = useMemo(() => ({
    upcoming: events.filter((e) => e.status !== 'CANCELLED' && new Date(e.date).getTime() >= now).length,
    past: events.filter((e) => e.status !== 'CANCELLED' && new Date(e.date).getTime() < now).length,
    cancelled: events.filter((e) => e.status === 'CANCELLED').length,
    all: events.length,
  }), [events, now]);

  const visible = events
    .filter((e) => {
      const upcoming = new Date(e.date).getTime() >= now;
      if (filter === 'upcoming') return e.status !== 'CANCELLED' && upcoming;
      if (filter === 'past') return e.status !== 'CANCELLED' && !upcoming;
      if (filter === 'cancelled') return e.status === 'CANCELLED';
      return true;
    })
    .sort((a, b) => (filter === 'upcoming' ? +new Date(a.date) - +new Date(b.date) : +new Date(b.date) - +new Date(a.date)));

  const confirmCancel = async (event: EventItem) => {
    setReasonTouched(true);
    if (validateReason(reason)) return;
    setBusy(true);
    try {
      const updated = await cancelEvent(event.id, reason.normalize('NFC').trim());
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setNotice(`"${updated.title}" fue cancelado. Los asistentes verán el aviso con tu motivo.`);
      setCancelling(null);
      onChanged();
    } catch (e: any) {
      setNotice(e.message || 'No se pudo cancelar el evento');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8">
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
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm" role="status">{notice}</div>
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
            const src = imageSrc(e.imageUrl);
            const lockedReason = !canManage
              ? 'Tu cuenta está en revisión: no puedes modificar eventos'
              : 'Por su estado actual este evento ya no se puede modificar';
            return (
              <li key={e.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-36 h-28 sm:h-24 rounded-xl overflow-hidden bg-slate-950 shrink-0 flex items-center justify-center">
                    {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-white break-words">{e.title}</h4>
                      <StatusPill {...EVENT_STATUS_LABELS[e.status]} />
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {formatEventDate(e.date)}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {e.address}</p>
                    <p className="text-xs text-slate-300 mt-1">{e.category.name} · <span className="font-semibold">{formatPrice(e.price)}</span></p>
                    {e.statusReason && e.status !== 'PUBLISHED' && (
                      <p className="text-[11px] text-slate-400 mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 break-words">
                        Motivo: {e.statusReason}
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    {editable ? (
                      <>
                        <button onClick={() => onEdit(e)} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => { setCancelling(e.id); setReason(''); setReasonTouched(false); setNotice(null); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-rose-600/80 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" /> Cancelar evento
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500 max-w-[180px]" title={lockedReason}>
                        <Lock className="w-3.5 h-3.5 shrink-0" /> {lockedReason}
                      </span>
                    )}
                  </div>
                </div>

                {cancelling === e.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <ReasonField
                      label="Motivo de la cancelación (lo verán los asistentes)"
                      value={reason}
                      onChange={setReason}
                      onBlur={() => setReasonTouched(true)}
                      showError={reasonTouched}
                      placeholder="Ej. Se cancela por pronóstico de lluvia intensa. Pronto anunciaremos una nueva fecha."
                      tone="rose"
                      autoFocus
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Esta acción no se puede deshacer desde tu cuenta.</p>
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setCancelling(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
                        Volver
                      </button>
                      <button
                        onClick={() => confirmCancel(e)}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                      >
                        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar cancelación
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
