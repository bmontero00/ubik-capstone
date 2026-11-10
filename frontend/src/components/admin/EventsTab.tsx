'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, Inbox, CalendarDays, MapPin, User as UserIcon, Tag, X, Megaphone, Lock } from 'lucide-react';
import { AccountStatus, EventStatus, apiJson } from '../../services/auth';
import {
  ACCOUNT_STATUS_LABELS, EVENT_STATUS_LABELS, StatusPill, formatDate,
} from '../../utils/labels';
import StatusChangeForm, { StatusOption } from './StatusChangeForm';
import { Chip } from './UsersTab';
import EventFeeForm from './EventFeeForm';
import type { EventoCargo } from '../../services/cargos';


interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  price: number;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  status: EventStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  category: { id: string; name: string };
  organizer: { id: string; name: string; email: string; status: AccountStatus };
  statusChangedBy: { id: string; name: string } | null;
  porcentajeCargo: number;
  precioFinal: number;
  estadoCondicion: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | null;
}

const EVENT_STATUSES = Object.keys(EVENT_STATUS_LABELS) as EventStatus[];

const EVENT_OPTIONS: StatusOption<EventStatus>[] = EVENT_STATUSES.map((value) => ({ value, ...EVENT_STATUS_LABELS[value] }));

// Un evento cancelado o finalizado ya no cambia de estado (el backend también lo impide)
const FINAL_STATUSES: EventStatus[] = ['CANCELLED', 'FINISHED'];

export default function EventsTab({ onChanged, onOpenEvent, initialStatuses }: {
  onChanged: () => void;
  onOpenEvent: (id: string) => void;
  initialStatuses?: EventStatus[]; // filtro con el que se abre desde el resumen (ej. cancelados y postergados)
}) {
  // Sin estados elegidos se muestran todos; desde el resumen pueden venir varios a la vez
  const [statuses, setStatuses] = useState<EventStatus[]>(initialStatuses ?? []);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statuses.length) params.set('status', statuses.join(','));
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    return params.toString();
  }, [statuses, debouncedSearch]);

  // Solo se muestra la respuesta de la consulta más reciente (al cambiar rápido de filtro)
  const lastRequest = useRef(0);
  const loadEvents = async () => {
    const request = ++lastRequest.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<AdminEvent[]>(`/admin/events?${query}`);
      if (request === lastRequest.current) setEvents(data);
    } catch (err: any) {
      if (request === lastRequest.current) setError(err.message || 'No se pudieron cargar los eventos.');
    } finally {
      if (request === lastRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [query]);

  const updateStatus = async (next: EventStatus, reason: string) => {
    if (!selected) return;
    const updated = await apiJson<AdminEvent>(`/admin/events/${selected.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next, reason }),
    });
    setSelected(updated);
    setEvents((prev) =>
      !statuses.length || statuses.includes(updated.status)
        ? prev.map((e) => (e.id === updated.id ? updated : e))
        : prev.filter((e) => e.id !== updated.id),
    );
    setNotice(`"${updated.title}" ahora está ${EVENT_STATUS_LABELS[updated.status].label.toLowerCase()}.`);
    onChanged();
  };

  return (
    <section className="mb-8">
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, dirección u organizador..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className="text-slate-500 font-semibold mr-1">Estado:</span>
        <Chip active={!statuses.length} onClick={() => setStatuses([])}>Todos</Chip>
        {EVENT_STATUSES.map((s) => (
          <Chip key={s} active={statuses.includes(s)} onClick={() => setStatuses([s])}>{EVENT_STATUS_LABELS[s].label}</Chip>
        ))}
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="text-emerald-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 text-xs text-slate-400">
            {loading ? 'Cargando…' : `${events.length} evento${events.length === 1 ? '' : 's'}`}
          </div>
          {error ? (
            <p className="p-4 text-sm text-rose-400">{error}</p>
          ) : loading ? (
            <div className="flex justify-center py-10 text-indigo-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-500 text-sm">
              <Inbox className="w-7 h-7 mb-2" />
              No hay eventos con estos filtros.
            </div>
          ) : (
            <ul className="max-h-[600px] overflow-y-auto divide-y divide-slate-800">
              {events.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => { setSelected(e); setNotice(null); }}
                    aria-current={selected?.id === e.id}
                    className={`w-full text-left px-4 py-3 transition-colors ${selected?.id === e.id ? 'bg-indigo-500/10' : 'hover:bg-slate-800/60'}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{e.title}</span>
                      <StatusPill {...EVENT_STATUS_LABELS[e.status]} />
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {formatDate(e.date)} · {e.organizer.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 lg:sticky lg:top-20">
          {!selected ? (
            <div className="flex flex-col items-center py-16 text-slate-500 text-sm text-center">
              <Inbox className="w-8 h-8 mb-2" />
              Selecciona un evento del listado para ver su detalle y cambiar su estado.
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-lg font-bold text-white">{selected.title}</h3>
                <StatusPill {...EVENT_STATUS_LABELS[selected.status]} />
              </div>
              {/* El equipo de UBIK no edita los datos del organizador: cambia el estado o deja una anotación */}
              <button
                onClick={() => onOpenEvent(selected.id)}
                className="mb-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-indigo-600 transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5" /> Ver detalle y publicar una anotación
              </button>
              {selected.description && <p className="text-xs text-slate-400 mb-4">{selected.description}</p>}

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-300 mb-5">
                <span className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-slate-500" /> {formatDate(selected.date, true)}</span>
                <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-500" /> {selected.address}</span>
                <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-slate-500" /> {selected.category.name} · {selected.price === 0 ? 'Gratis' : `$${selected.precioFinal.toLocaleString('es-CL')} (público)`}</span>
                <span className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500" /> {selected.organizer.name}
                  {selected.organizer.status !== 'ACTIVE' && <StatusPill {...ACCOUNT_STATUS_LABELS[selected.organizer.status]} />}
                </span>
              </div>

              {selected.statusReason && (
                <div className="mb-5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <p className="font-semibold text-slate-200 mb-1">Motivo del estado actual</p>
                  <p className="text-slate-300 whitespace-pre-line break-words">{selected.statusReason}</p>
                  <p className="text-slate-500 mt-1">
                    {formatDate(selected.statusChangedAt, true)}
                    {selected.statusChangedBy && ` · por ${selected.statusChangedBy.name}`}
                  </p>
                </div>
              )}

              {selected.price > 0 && (
                <div className="mb-5 pt-4 border-t border-slate-800">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Cargo por servicio</p>
                  <EventFeeForm
                    event={selected as unknown as EventoCargo}
                    onSaved={(updated) => {
                      const merged = { ...selected, porcentajeCargo: updated.porcentajeCargo ?? 0, precioFinal: updated.precioFinal ?? selected.price };
                      setSelected(merged);
                      setEvents((prev) => prev.map((e) => (e.id === merged.id ? merged : e)));
                      setNotice(`Fijaste el cargo de "${merged.title}" en ${merged.porcentajeCargo}%.`);
                      onChanged();
                    }}
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-800">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Cambiar estado del evento</p>
                {FINAL_STATUSES.includes(selected.status) ? (
                  <div className="flex gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <Lock className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
                    <span>
                      <strong className="text-slate-200">Estado bloqueado.</strong>{' '}
                      {selected.status === 'CANCELLED'
                        ? 'El evento fue cancelado, así que su estado ya no se puede modificar.'
                        : 'El evento ya finalizó, así que su estado ya no se puede modificar.'}{' '}
                      Puedes seguir publicando anotaciones en sus novedades.
                    </span>
                  </div>
                ) : (
                  <StatusChangeForm
                    current={selected.status}
                    options={EVENT_OPTIONS}
                    reasonPlaceholder="Ej. El organizador informó un cambio de fecha por lluvia."
                    confirmText={{ CANCELLED: 'Los asistentes verán el evento como cancelado y no podrá recibir reservas. ¿Confirmas la cancelación?' }}
                    onSubmit={updateStatus}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
