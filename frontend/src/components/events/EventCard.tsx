'use client';

import React from 'react';
import { CalendarDays, MapPin, ImageIcon } from 'lucide-react';
import { EventStatus } from '../../services/auth';
import { formatEventDate, imageSrc } from '../../services/events';
import { EVENT_STATUS_LABELS, StatusPill } from '../../utils/labels';

export interface EventCardData {
  title: string;
  description: string;
  price: number;
  date: string;
  address: string;
  categoryName?: string;
  imageUrl?: string | null; // ruta guardada en el backend
  imagePreview?: string | null; // vista previa local (formulario)
  distanceKm?: number;
  status?: EventStatus;
  statusReason?: string | null;
}

export const categoryBadge = (categoryName?: string) => {
  switch (categoryName?.toLowerCase()) {
    case 'vehículos': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'diversión': return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'videojuegos': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'deporte': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default: return 'bg-blue-100 text-blue-700 border-blue-200';
  }
};

// Tarjeta del catálogo; también se usa como vista previa en el formulario de eventos
export default function EventCard({ event, footerAction, placeholderImage = false }: {
  event: EventCardData;
  footerAction?: React.ReactNode;
  placeholderImage?: boolean; // muestra un espacio para la imagen aunque no haya
}) {
  const src = event.imagePreview ?? imageSrc(event.imageUrl);
  const isFree = event.price === 0;

  return (
    <article className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all h-full">
      {src ? (
        <div className="w-full h-40 bg-slate-950 overflow-hidden">
          <img src={src} alt={event.title} className="w-full h-full object-cover" />
        </div>
      ) : placeholderImage ? (
        <div className="w-full h-40 bg-slate-950 flex flex-col items-center justify-center text-slate-600 text-xs gap-1">
          <ImageIcon className="w-6 h-6" /> Sin imagen de portada
        </div>
      ) : null}
      <div className="p-6 flex-1">
        <div className="flex justify-between items-center mb-3 gap-2">
          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${categoryBadge(event.categoryName)}`}>
            {event.categoryName || 'Categoría'}
          </span>
          {event.distanceKm !== undefined && <span className="text-xs text-indigo-400">A {event.distanceKm} km</span>}
        </div>
        <h4 className="text-lg font-bold text-white mb-2 break-words">{event.title || 'Título del evento'}</h4>
        {event.status && event.status !== 'PUBLISHED' && (
          <div className="mb-3">
            <StatusPill {...EVENT_STATUS_LABELS[event.status]} />
            {event.statusReason && <p className="text-[11px] text-slate-400 mt-1 break-words">{event.statusReason}</p>}
          </div>
        )}
        <p className="text-xs text-slate-400 line-clamp-2 mb-4 break-words">
          {event.description || 'La descripción aparecerá aquí.'}
        </p>
        <div className="text-xs text-slate-500 space-y-1.5">
          <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {event.address || 'Dirección por definir'}</p>
          <p className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" /> {event.date ? formatEventDate(event.date) : 'Fecha por definir'}
          </p>
        </div>
      </div>
      <div className="bg-slate-950 px-6 py-4 flex justify-between items-center border-t border-slate-800 gap-3">
        <span className="font-extrabold text-white">
          {isFree ? <span className="text-emerald-400">Entrada Liberada</span> : `$${event.price.toLocaleString('es-CL')}`}
        </span>
        {footerAction}
      </div>
    </article>
  );
}
