'use client';

import React, { useState } from 'react';
import { CalendarDays, MapPin, Hourglass, Ban } from 'lucide-react';
import EventCover from './EventCover';
import { AgeBadge } from './AgeRestriction';
import { categoryColor } from '../../utils/mapTiles';
import { mezclar } from '../../utils/categorias';
import type { PortadaIa } from '../../utils/portadas';
import { EventStatus } from '../../services/auth';
import { OfferInfo, formatEventDate, imageSrc } from '../../services/events';
import { OfferBadge, OfferPrice } from './OfferBadge';
import { EVENT_STATUS_LABELS, StatusPill } from '../../utils/labels';

export interface EventCardData extends OfferInfo {
  title: string;
  description: string;
  price: number;
  date: string;
  address: string;
  categoryName?: string;
  imageUrl?: string | null; // ruta guardada en el backend
  imagePreview?: string | null; // vista previa local (formulario)
  distanceKm?: number;
  distanceFrom?: string; // ej. "Santiago centro" cuando no hay ubicación del usuario
  status?: EventStatus;
  statusReason?: string | null;
  ventaPausada?: boolean; // condición especial en revisión: la venta se libera pronto
  agotado?: boolean; // todos los tipos de entrada sin cupo
  portadaIa?: PortadaIa | null; // portada diseñada con IA cuando no hay imagen
  edadMinima?: number | null; // restricción de edad (ej. 18)
}

// Badge de categoría con su color (definido por el admin)
export const categoryBadgeStyle = (categoryName?: string): React.CSSProperties => {
  const color = categoryColor(categoryName);
  return { color: mezclar(color, '#ffffff', 0.55), background: `${color}26`, borderColor: `${color}66` };
};

// Aviso de entradas agotadas: se mantiene visible hasta que el evento se finaliza solo
export function SoldOutBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg shadow-rose-950/50 ${className}`}>
      <Ban className="w-3.5 h-3.5" /> Sold Out
    </span>
  );
}

// Tarjeta del catálogo; también se usa como vista previa en el formulario de eventos
export default function EventCard({ event, footerAction, onOpen }: {
  event: EventCardData;
  footerAction?: React.ReactNode;
  onOpen?: () => void; // abre el detalle al hacer clic en la imagen o el título
}) {
  // Si la imagen no carga (ej. el archivo no existe en este servidor), se muestra la portada de reemplazo
  const [broken, setBroken] = useState(false);
  const src = broken ? null : event.imagePreview ?? imageSrc(event.imageUrl);
  const isFree = event.price === 0;

  return (
    <article className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all h-full">
      {src ? (
        <div className={`relative w-full h-40 bg-slate-950 overflow-hidden ${onOpen ? 'cursor-pointer' : ''}`} onClick={onOpen}>
          <img src={src} alt={event.title} onError={() => setBroken(true)} className={`w-full h-full object-cover ${onOpen ? 'hover:scale-105 transition-transform duration-300' : ''} ${event.agotado ? 'opacity-60' : ''}`} />
          <OfferBadge event={event} className="absolute top-3 left-3" />
          {event.agotado && <SoldOutBadge className="absolute top-3 right-3" />}
        </div>
      ) : (
        // Sin imagen: portada diseñada (con IA o según la categoría)
        <div className={`relative w-full h-40 overflow-hidden ${onOpen ? 'cursor-pointer' : ''}`} onClick={onOpen}>
          <EventCover portada={event.portadaIa} categoria={event.categoryName} />
          <OfferBadge event={event} className="absolute top-3 left-3" />
          {event.agotado && <SoldOutBadge className="absolute top-3 right-3" />}
        </div>
      )}
      <div className="p-6 flex-1">
        <div className="flex justify-between items-center mb-3 gap-2">
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold px-2 py-1 rounded border" style={categoryBadgeStyle(event.categoryName)}>
              {event.categoryName || 'Categoría'}
            </span>
            <AgeBadge edad={event.edadMinima} />
          </span>
          {event.distanceKm !== undefined && (
            <span className="text-xs text-indigo-400 text-right">
              A {event.distanceKm} km{event.distanceFrom ? ` de ${event.distanceFrom}` : ''}
            </span>
          )}
        </div>
        <h4 className="text-lg font-bold text-white mb-2 break-words">
          {onOpen ? (
            <button type="button" onClick={onOpen} className="text-left hover:text-indigo-300 transition-colors">{event.title}</button>
          ) : (
            event.title || 'Título del evento'
          )}
        </h4>
        {event.status && event.status !== 'PUBLISHED' && (
          <div className="mb-3">
            <StatusPill {...EVENT_STATUS_LABELS[event.status]} />
            {event.statusReason && <p className="text-[11px] text-slate-400 mt-1 break-words">{event.statusReason}</p>}
          </div>
        )}
        {event.ventaPausada && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2 py-1">
            <Hourglass className="w-3.5 h-3.5" /> Venta de entradas próximamente
          </p>
        )}
        {event.agotado && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-200 bg-rose-500/10 border border-rose-500/25 rounded-lg px-2 py-1">
            <Ban className="w-3.5 h-3.5" /> Sold Out · Se vendieron todas las entradas
          </p>
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
          {isFree ? <span className="text-emerald-400">Entrada Liberada</span> : <OfferPrice event={event} price={event.price} />}
        </span>
        {footerAction}
      </div>
    </article>
  );
}
