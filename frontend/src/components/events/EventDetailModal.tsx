'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  X, CalendarDays, MapPin, Ticket, Navigation, Share2, Check, Loader2, BadgeCheck, CalendarClock, Ban, ShieldAlert, Lock,
} from 'lucide-react';
import {
  EventDetail, EventItem, eventShareUrl, fetchEventDetail, formatEventDate, formatPrice, imageSrc, organizerName, relativeTime,
} from '../../services/events';
import { EVENT_STATUS_LABELS, StatusPill } from '../../utils/labels';
import { categoryColor } from '../../utils/mapTiles';
import EventBitacora from './EventBitacora';

const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">Cargando mapa…</div>,
});

interface EventDetailModalProps {
  eventId: string;
  // Datos del catálogo para mostrar algo de inmediato mientras carga el detalle
  preview?: EventItem;
  viewer: { id: string; isAdmin: boolean } | null;
  // Solo los asistentes ven el botón de reservar
  reserve?: { enabled: boolean; blockedReason?: string };
  onClose: () => void;
  onAnnouncementsChange?: () => void;
}

// Aviso destacado para los estados que afectan a los asistentes
const STATUS_BANNER: Partial<Record<EventDetail['status'], { icon: React.ElementType; title: string; className: string }>> = {
  POSTPONED: { icon: CalendarClock, title: 'Este evento se postergó', className: 'bg-sky-500/10 border-sky-500/30 text-sky-100' },
  CANCELLED: { icon: Ban, title: 'Este evento fue cancelado', className: 'bg-rose-500/10 border-rose-500/30 text-rose-100' },
  UNDER_REVIEW: { icon: ShieldAlert, title: 'Evento en revisión: no aparece en el catálogo', className: 'bg-amber-500/10 border-amber-500/30 text-amber-100' },
  FINISHED: { icon: Lock, title: 'Este evento ya finalizó', className: 'bg-slate-500/10 border-slate-500/30 text-slate-200' },
};

export default function EventDetailModal({ eventId, preview, viewer, reserve, onClose, onAnnouncementsChange }: EventDetailModalProps) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    fetchEventDetail(eventId)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setError(e.message || 'No se pudo cargar el evento'));
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Evita que la página de fondo se desplace mientras el modal está abierto
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // La distancia viene del catálogo (el detalle no la calcula)
  const event: EventItem | EventDetail | undefined = detail ? { ...detail, distanceKm: preview?.distanceKm } : preview;
  const share = async () => {
    try {
      await navigator.clipboard.writeText(eventShareUrl(eventId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copia el enlace del evento:', eventShareUrl(eventId));
    }
  };

  const src = event && imageSrc(event.imageUrl);
  const color = categoryColor(event?.category?.name);
  const banner = event && STATUS_BANNER[event.status];
  const upcoming = event && new Date(event.date).getTime() > Date.now();
  const directionsUrl = event && `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={event?.title ?? 'Detalle del evento'}
    >
      <div className="relative w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl">
        {/* Portada */}
        <div className="relative h-48 sm:h-64 shrink-0 overflow-hidden">
          {src ? (
            <img src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `radial-gradient(circle at 25% 30%, ${color}55, transparent 60%), linear-gradient(135deg, #1e1b4b, #0f172a)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white backdrop-blur"
          >
            <X className="w-5 h-5" />
          </button>
          {event && (
            <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md text-slate-950" style={{ background: color }}>
                {event.category?.name}
              </span>
              {event.status !== 'PUBLISHED' && <StatusPill {...EVENT_STATUS_LABELS[event.status]} />}
            </div>
          )}
        </div>

        {!event ? (
          <div className="p-10 flex justify-center text-indigo-400">
            {error ? <p className="text-sm text-rose-300">{error}</p> : <Loader2 className="w-6 h-6 animate-spin" />}
          </div>
        ) : (
          <div className="px-5 sm:px-8 pb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight break-words">{event.title}</h2>
            <p className="mt-2 text-sm text-slate-400 flex items-center gap-1.5">
              Organiza <span className="font-semibold text-slate-200">{organizerName(event)}</span>
              <BadgeCheck className="w-4 h-4 text-emerald-400" aria-label="Organizador verificado" />
            </p>

            {banner && (
              <div className={`mt-5 flex gap-3 p-4 rounded-2xl border ${banner.className}`}>
                <banner.icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold">{banner.title}</p>
                  {event.status === 'POSTPONED' && <p className="mt-0.5">Nueva fecha: <strong>{formatEventDate(event.date)}</strong></p>}
                  {event.statusReason && <p className="mt-1 opacity-80 whitespace-pre-line break-words">{event.statusReason}</p>}
                </div>
              </div>
            )}

            {/* Datos principales */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoTile icon={CalendarDays} label="Cuándo">
                <span className="block first-letter:uppercase">{formatEventDate(event.date)}</span>
                {upcoming && <span className="block text-xs text-indigo-300 mt-0.5">{relativeTime(event.date)}</span>}
              </InfoTile>
              <InfoTile icon={MapPin} label="Dónde">
                <span className="break-words">{event.address}</span>
                {event.distanceKm !== undefined && <span className="block text-xs text-slate-500 mt-0.5">A {event.distanceKm} km</span>}
              </InfoTile>
              <InfoTile icon={Ticket} label="Entrada">
                <span className={event.price === 0 ? 'text-emerald-300' : ''}>{event.price === 0 ? 'Liberada' : formatPrice(event.price)}</span>
              </InfoTile>
            </div>

            {event.description && (
              <div className="mt-6">
                <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Sobre el evento</h3>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line break-words">{event.description}</p>
              </div>
            )}

            <div className="mt-6 rounded-2xl overflow-hidden border border-slate-800">
              <div className="h-44">
                <LocationPicker lat={event.latitude} lng={event.longitude} />
              </div>
              <a
                href={directionsUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-indigo-300 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" /> Cómo llegar
              </a>
            </div>

            {/* Acciones */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              {reserve && event.price > 0 && (
                <button
                  disabled={!reserve.enabled || event.status !== 'PUBLISHED'}
                  title={reserve.blockedReason ?? (event.status !== 'PUBLISHED' ? 'Este evento no acepta reservas' : undefined)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                >
                  <Ticket className="w-4 h-4" /> Reservar entrada · {formatPrice(event.price)}
                </button>
              )}
              <button
                onClick={share}
                className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                {copied ? 'Enlace copiado' : 'Compartir'}
              </button>
            </div>

            <hr className="my-8 border-slate-800" />

            {detail ? (
              <EventBitacora
                eventId={detail.id}
                entries={detail.bitacora}
                canAnnounce={detail.canAnnounce}
                canManage={detail.canManage}
                viewer={viewer}
                onEntriesChange={(bitacora) => {
                  setDetail({ ...detail, bitacora });
                  onAnnouncementsChange?.();
                }}
              />
            ) : error ? (
              <p className="text-sm text-rose-300">{error}</p>
            ) : (
              <div className="flex justify-center py-6 text-indigo-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <div className="text-sm text-slate-100 font-medium">{children}</div>
    </div>
  );
}
