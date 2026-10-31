'use client';

import React, { useState } from 'react';
import {
  Megaphone, Sparkles, Pencil, CalendarClock, Ban, CircleCheck, ShieldAlert, Flag, Trash2, Loader2, Send, EyeOff,
} from 'lucide-react';
import {
  CambioBitacora, EntradaBitacora, createAnnouncement, deleteAnnouncement, formatEventDate, formatPrice, relativeTime,
} from '../../services/events';
import { EventStatus } from '../../services/auth';
import { formatDate } from '../../utils/labels';

// Mismos límites que el backend (backend/src/events/dto/event.dto.ts)
export const ANNOUNCEMENT_LIMITS = { titleMin: 3, titleMax: 80, min: 10, max: 1000 };

const STATE_ENTRY: Record<EventStatus, { title: string; icon: React.ElementType; tone: string }> = {
  PUBLISHED: { title: 'El evento vuelve a estar publicado', icon: CircleCheck, tone: 'text-emerald-300 bg-emerald-500/15' },
  POSTPONED: { title: 'El evento se postergó', icon: CalendarClock, tone: 'text-sky-300 bg-sky-500/15' },
  CANCELLED: { title: 'El evento fue cancelado', icon: Ban, tone: 'text-rose-300 bg-rose-500/15' },
  UNDER_REVIEW: { title: 'El evento quedó en revisión', icon: ShieldAlert, tone: 'text-amber-300 bg-amber-500/15' },
  FINISHED: { title: 'El evento finalizó', icon: Flag, tone: 'text-slate-300 bg-slate-500/15' },
};

const FIELD_LABELS: Record<CambioBitacora['campo'], string> = {
  titulo: 'Título',
  fecha: 'Fecha',
  direccion: 'Lugar',
  precio: 'Entrada',
  categoria: 'Categoría',
  descripcion: 'Descripción',
  imagen: 'Imagen',
  estado: 'Estado',
};

const formatValue = (c: CambioBitacora, value: CambioBitacora['anterior']) => {
  if (value === null || value === undefined) return '—';
  if (c.campo === 'fecha') return formatEventDate(String(value));
  if (c.campo === 'precio') return formatPrice(Number(value));
  return String(value);
};

function ChangeList({ cambios }: { cambios: CambioBitacora[] }) {
  const visibles = cambios.filter((c) => c.campo !== 'estado');
  if (!visibles.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {visibles.map((c, i) =>
        c.campo === 'descripcion' || c.campo === 'imagen' ? (
          <li key={i} className="text-slate-400">Se actualizó la {FIELD_LABELS[c.campo].toLowerCase()}</li>
        ) : (
          <li key={i} className="text-slate-400 break-words">
            <span className="text-slate-500">{c.campo === 'fecha' ? 'Nueva fecha' : FIELD_LABELS[c.campo]}:</span>{' '}
            <span className="line-through decoration-slate-600">{formatValue(c, c.anterior)}</span>{' '}
            <span className="text-slate-500">→</span> <span className="text-slate-100 font-semibold">{formatValue(c, c.nuevo)}</span>
          </li>
        ),
      )}
    </ul>
  );
}

function entryHeader(entry: EntradaBitacora) {
  switch (entry.tipo) {
    case 'CREACION':
      return { title: 'Evento publicado en UBIK', icon: Sparkles, tone: 'text-indigo-300 bg-indigo-500/15' };
    case 'ANUNCIO':
      return { title: entry.titulo || 'Anuncio', icon: Megaphone, tone: 'text-amber-200 bg-amber-500/20' };
    case 'CAMBIO_DATOS':
      return { title: 'Se actualizaron los datos del evento', icon: Pencil, tone: 'text-slate-300 bg-slate-700/60' };
    case 'CAMBIO_ESTADO': {
      const nuevo = entry.cambios.find((c) => c.campo === 'estado')?.nuevo as EventStatus | undefined;
      return nuevo ? STATE_ENTRY[nuevo] : { title: 'Cambio de estado', icon: Flag, tone: 'text-slate-300 bg-slate-700/60' };
    }
  }
}

interface EventBitacoraProps {
  eventId: string;
  entries: EntradaBitacora[];
  canAnnounce: boolean;
  canManage: boolean;
  viewer: { id: string; isAdmin: boolean } | null;
  onEntriesChange: (entries: EntradaBitacora[]) => void;
}

// "Novedades del evento": anuncios del organizador y el registro de cambios, del más reciente al más antiguo
export default function EventBitacora({ eventId, entries, canAnnounce, canManage, viewer, onEntriesChange }: EventBitacoraProps) {
  const [filter, setFilter] = useState<'all' | 'announcements'>('all');
  const announcements = entries.filter((e) => e.tipo === 'ANUNCIO').length;
  const visible = filter === 'all' ? entries : entries.filter((e) => e.tipo === 'ANUNCIO');

  return (
    <section aria-labelledby="bitacora-title">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 id="bitacora-title" className="text-base font-bold text-white flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-300" /> Novedades del evento
        </h3>
        {announcements > 0 && entries.length > announcements && (
          <div className="flex gap-1 text-[11px] bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {([['all', 'Todo'], ['announcements', `Solo anuncios (${announcements})`]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-2.5 py-1 rounded-md font-semibold ${filter === id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {canAnnounce && (
        <AnnouncementComposer eventId={eventId} onCreated={(entry) => onEntriesChange([entry, ...entries])} />
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">Aún no hay novedades. Aquí verás los anuncios del organizador y los cambios del evento.</p>
      ) : (
        <ol className="relative ml-3 border-l border-slate-800 space-y-5">
          {visible.map((entry) => (
            <TimelineEntry
              key={entry.id}
              eventId={eventId}
              entry={entry}
              canDelete={
                entry.tipo === 'ANUNCIO' && canManage && !!viewer && (viewer.isAdmin || viewer.id === entry.autor.id)
              }
              onDeleted={() => onEntriesChange(entries.filter((e) => e.id !== entry.id))}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function TimelineEntry({ eventId, entry, canDelete, onDeleted }: {
  eventId: string;
  entry: EntradaBitacora;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { title, icon: Icon, tone } = entryHeader(entry);
  const isAnnouncement = entry.tipo === 'ANUNCIO';

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAnnouncement(eventId, entry.id);
      onDeleted();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <li className="ml-6">
      <span className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-slate-900 ${tone}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className={isAnnouncement ? 'p-4 rounded-2xl bg-amber-500/[0.07] border border-amber-500/25' : 'pt-1'}>
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm font-semibold break-words ${isAnnouncement ? 'text-amber-100' : 'text-slate-200'}`}>{title}</p>
          {canDelete && !confirming && (
            <button onClick={() => setConfirming(true)} aria-label="Eliminar anuncio" title="Eliminar anuncio" className="text-slate-500 hover:text-rose-300 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5" title={formatDate(entry.fechaCreacion, true)}>
          {entry.autor.esEquipoUbik ? <span className="text-indigo-300 font-semibold">Equipo UBIK</span> : entry.autor.nombre} ·{' '}
          {relativeTime(entry.fechaCreacion)}
          {entry.interna && (
            <span className="inline-flex items-center gap-1 ml-2 text-amber-400/80">
              <EyeOff className="w-3 h-3" /> Solo lo ven tú y el equipo UBIK
            </span>
          )}
        </p>
        {entry.mensaje && (
          <p className={`text-sm mt-2 whitespace-pre-line break-words ${isAnnouncement ? 'text-slate-200' : 'text-slate-400 italic'}`}>
            {isAnnouncement ? entry.mensaje : `“${entry.mensaje}”`}
          </p>
        )}
        <ChangeList cambios={entry.cambios} />

        {confirming && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-300">¿Eliminar este anuncio? Dejará de verse para todos.</span>
            <button onClick={() => setConfirming(false)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700">Volver</button>
            <button onClick={remove} disabled={busy} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 font-bold disabled:opacity-50">
              {busy && <Loader2 className="w-3 h-3 animate-spin" />} Eliminar
            </button>
            {error && <span className="text-rose-300 w-full">{error}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

// Formulario para que el organizador avise algo a la comunidad del evento
function AnnouncementComposer({ eventId, onCreated }: { eventId: string; onCreated: (entry: EntradaBitacora) => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const t = titulo.normalize('NFC').trim();
  const m = mensaje.normalize('NFC').trim();
  const titleError = t && (t.length < ANNOUNCEMENT_LIMITS.titleMin || t.length > ANNOUNCEMENT_LIMITS.titleMax)
    ? `El título debe tener entre ${ANNOUNCEMENT_LIMITS.titleMin} y ${ANNOUNCEMENT_LIMITS.titleMax} caracteres`
    : null;
  const messageError = m.length < ANNOUNCEMENT_LIMITS.min
    ? `Escribe al menos ${ANNOUNCEMENT_LIMITS.min} caracteres`
    : m.length > ANNOUNCEMENT_LIMITS.max
      ? `Máximo ${ANNOUNCEMENT_LIMITS.max} caracteres`
      : !/\p{L}/u.test(m) ? 'El anuncio debe contener texto' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (titleError || messageError) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await createAnnouncement(eventId, m, t || undefined));
      setTitulo('');
      setMensaje('');
      setTouched(false);
      setOpen(false);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="mb-5">
        <button
          onClick={() => { setOpen(true); setSent(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-left transition-colors"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 text-amber-200"><Megaphone className="w-4 h-4" /></span>
          <span>
            <span className="block text-sm font-semibold text-amber-100">Publicar un anuncio</span>
            <span className="block text-xs text-slate-400">Avisa a los asistentes: horarios, accesos, invitados, recomendaciones…</span>
          </span>
        </button>
        {sent && <p className="text-xs text-emerald-300 mt-2" role="status">Tu anuncio ya está visible en las novedades del evento.</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
      <div>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={ANNOUNCEMENT_LIMITS.titleMax}
          placeholder="Título (opcional) · Ej. Cambio en el acceso"
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
        />
        {touched && titleError && <p className="text-[11px] text-rose-300 mt-1">{titleError}</p>}
      </div>
      <div>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onBlur={() => m && setTouched(true)}
          rows={4}
          autoFocus
          maxLength={ANNOUNCEMENT_LIMITS.max + 50}
          placeholder="Ej. ¡Hola a todos! El ingreso será por la puerta norte desde las 18:00. Recuerden traer su entrada en el celular."
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 resize-y"
        />
        <div className="flex justify-between text-[11px] mt-1">
          <span className="text-rose-300">{touched && messageError}</span>
          <span className={m.length > ANNOUNCEMENT_LIMITS.max ? 'text-rose-300' : 'text-slate-500'}>
            {m.length}/{ANNOUNCEMENT_LIMITS.max}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">Lo verá cualquier persona que abra este evento.</p>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
          Cancelar
        </button>
        <button type="submit" disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Publicar anuncio
        </button>
      </div>
    </form>
  );
}

