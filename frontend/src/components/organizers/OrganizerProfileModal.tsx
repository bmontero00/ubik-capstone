'use client';

import React, { useEffect, useState } from 'react';
import {
  X, BadgeCheck, ArrowLeft, Loader2, ExternalLink, CalendarDays, CalendarCheck2, CalendarClock, Ban, Sparkles,
  MessageSquareQuote, ImageIcon, MapPin, Star,
} from 'lucide-react';
import { OrganizerEvent, OrganizerProfile, fetchOrganizerProfile } from '../../services/organizers';
import { formatEventDate, formatPrice, imageSrc } from '../../services/events';
import { EVENT_STATUS_LABELS, StatusPill } from '../../utils/labels';
import { categoryColor } from '../../utils/mapTiles';
import StarRating from './StarRating';

interface OrganizerProfileModalProps {
  organizerId: string;
  onClose: () => void;
  onOpenEvent: (eventId: string) => void;
  back?: { label: string; onBack: () => void }; // ej. volver al evento desde el que se abrió
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

// Color estable del avatar a partir del nombre
const avatarColor = (name: string) => {
  const palette = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#a855f7', '#f43f5e'];
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return palette[hash % palette.length];
};

const monthYear = (value: string) => new Date(value).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

// Perfil público del organizador: quién es, su trayectoria en UBIK, sus eventos y lo que opinan los asistentes
export default function OrganizerProfileModal({ organizerId, onClose, onOpenEvent, back }: OrganizerProfileModalProps) {
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    let active = true;
    fetchOrganizerProfile(organizerId)
      .then((p) => {
        if (!active) return;
        setProfile(p);
        // Sin eventos próximos, se parte mostrando los realizados
        if (!p.proximosEventos.length && p.eventosRealizados.length) setTab('past');
      })
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [organizerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const stats = profile?.estadisticas;
  const events = tab === 'upcoming' ? profile?.proximosEventos : profile?.eventosRealizados;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={profile ? `Perfil de ${profile.nombre}` : 'Perfil del organizador'}
    >
      <div className="relative w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl">
        {/* Portada */}
        <div
          className="h-28 sm:h-32"
          style={{
            background: profile
              ? `radial-gradient(circle at 20% 20%, ${avatarColor(profile.nombre)}66, transparent 55%), radial-gradient(circle at 85% 0%, #6366f155, transparent 50%), linear-gradient(135deg, #1e1b4b, #0f172a)`
              : 'linear-gradient(135deg, #1e1b4b, #0f172a)',
          }}
        />
        <div className="absolute top-3 left-3 right-3 flex justify-between">
          {back ? (
            <button onClick={back.onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-950/70 hover:bg-slate-950 text-xs font-semibold text-white backdrop-blur">
              <ArrowLeft className="w-4 h-4" /> {back.label}
            </button>
          ) : <span />}
          <button onClick={onClose} aria-label="Cerrar" className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white backdrop-blur">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!profile ? (
          <div className="p-12 flex justify-center text-indigo-400">
            {error ? <p className="text-sm text-rose-300">{error}</p> : <Loader2 className="w-6 h-6 animate-spin" />}
          </div>
        ) : (
          <div className="px-5 sm:px-8 pb-8">
            {/* Identidad */}
            <div className="-mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-extrabold text-white ring-4 ring-slate-900 shadow-xl shrink-0"
                style={{ background: avatarColor(profile.nombre) }}
                aria-hidden
              >
                {initials(profile.nombre)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight break-words flex flex-wrap items-center gap-2">
                  {profile.nombre}
                  <BadgeCheck className="w-6 h-6 text-emerald-400 shrink-0" aria-label="Organizador verificado" />
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-2">
                    <StarRating value={profile.calificacion.promedio} />
                    <span className="text-sm text-slate-400">
                      {profile.calificacion.promedio === null
                        ? 'Sin calificaciones aún'
                        : `${profile.calificacion.promedio.toFixed(1)} · ${profile.calificacion.total} ${profile.calificacion.total === 1 ? 'calificación' : 'calificaciones'}`}
                    </span>
                  </span>
                </div>
              </div>
              {profile.redSocial && (
                <a
                  href={profile.redSocial}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="self-start sm:self-end flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Redes del organizador
                </a>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-emerald-300/90">Verificado por UBIK desde {monthYear(profile.verificadoDesde)}</span>
              {profile.responsable && <span>Responsable: {profile.responsable}</span>}
            </p>

            {/* Sobre el organizador */}
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Sobre el organizador</h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line break-words">{profile.descripcion}</p>
              {profile.categoriasFrecuentes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.categoriasFrecuentes.map((c) => (
                    <span key={c.id} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border" style={{ color: categoryColor(c.name), borderColor: `${categoryColor(c.name)}55`, background: `${categoryColor(c.name)}14` }}>
                      {c.name} · {c.eventos}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Trayectoria */}
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Trayectoria en UBIK</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat icon={Sparkles} label="Eventos publicados" value={stats!.eventosPublicados} tone="text-indigo-300" />
                <Stat icon={CalendarCheck2} label="Realizados" value={stats!.realizados} tone="text-emerald-300" />
                <Stat icon={CalendarClock} label="Postergados" value={stats!.postergados} tone="text-sky-300" />
                <Stat icon={Ban} label="Cancelados" value={stats!.cancelados} tone="text-rose-300" />
              </div>
              {stats!.cumplimiento !== null && (
                <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">Eventos que se realizaron según lo programado</span>
                    <span className={`font-bold ${stats!.cumplimiento >= 80 ? 'text-emerald-300' : stats!.cumplimiento >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
                      {stats!.cumplimiento}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stats!.cumplimiento >= 80 ? 'bg-emerald-400' : stats!.cumplimiento >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                      style={{ width: `${stats!.cumplimiento}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Eventos */}
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-base font-bold text-white">Eventos</h3>
                <div className="flex gap-1 text-xs bg-slate-950 border border-slate-800 rounded-lg p-0.5" role="tablist">
                  {([['upcoming', `Próximos (${stats!.proximos})`], ['past', `Realizados (${stats!.realizados})`]] as const).map(([id, label]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={`px-3 py-1.5 rounded-md font-semibold ${tab === id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {events!.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center bg-slate-950/60 rounded-2xl border border-slate-800">
                  {tab === 'upcoming' ? 'Este organizador no tiene eventos próximos por ahora.' : 'Aún no tiene eventos realizados.'}
                </p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {events!.map((e) => <EventRow key={e.id} event={e} past={tab === 'past'} onOpen={() => onOpenEvent(e.id)} />)}
                </ul>
              )}
            </div>

            {/* Reseñas */}
            <div className="mt-8">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3">
                <MessageSquareQuote className="w-4 h-4 text-amber-300" /> Reseñas de asistentes
              </h3>
              {profile.resenas.length === 0 ? (
                <div className="flex flex-col items-center text-center px-6 py-8 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50">
                  <div className="flex gap-1 mb-3 text-slate-700" aria-hidden>
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-6 h-6" />)}
                  </div>
                  <p className="text-sm font-semibold text-slate-300">Aún no hay reseñas</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Muy pronto quienes asistan a sus eventos podrán calificar su experiencia y dejar un comentario.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {profile.resenas.map((r) => (
                    <li key={r.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-200">{r.autor}</span>
                        <StarRating value={r.estrellas} size="sm" />
                      </div>
                      <p className="text-sm text-slate-300 mt-2 whitespace-pre-line break-words">{r.comentario}</p>
                      <p className="text-[11px] text-slate-500 mt-2">{new Date(r.fecha).toLocaleDateString('es-CL', { dateStyle: 'medium' })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: string }) {
  return (
    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
      <Icon className={`w-4 h-4 ${tone}`} />
      <p className="text-2xl font-extrabold text-white mt-1.5">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function EventRow({ event, past, onOpen }: { event: OrganizerEvent; past: boolean; onOpen: () => void }) {
  const src = imageSrc(event.imageUrl);
  return (
    <li>
      <button onClick={onOpen} className="w-full flex gap-3 p-2.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-600 text-left transition-colors">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
          {src ? <img src={src} alt="" className={`w-full h-full object-cover ${past ? 'grayscale-[40%]' : ''}`} /> : <ImageIcon className="w-5 h-5 text-slate-700" />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: categoryColor(event.category.name) }}>{event.category.name}</span>
          <p className="text-sm font-bold text-white truncate">{event.title}</p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5"><CalendarDays className="w-3 h-3" /> {formatEventDate(event.date)}</p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{event.address}</span></p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-200">{formatPrice(event.price)}</span>
            {event.status === 'POSTPONED' && <StatusPill {...EVENT_STATUS_LABELS.POSTPONED} />}
          </div>
        </div>
      </button>
    </li>
  );
}
