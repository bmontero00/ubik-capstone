'use client';

import React from 'react';
import { BadgePercent } from 'lucide-react';
import { OfferInfo, formatPrice, offerEndsLabel } from '../../services/events';

// Etiqueta "Oferta -20%" para las imágenes de las tarjetas
export function OfferBadge({ event, className = '' }: { event: OfferInfo; className?: string }) {
  if (!event.ofertaActiva) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md text-white bg-gradient-to-r from-rose-500 to-orange-400 shadow-lg shadow-rose-950/40 ${className}`}
      title={offerEndsLabel(event) ?? undefined}
    >
      <BadgePercent className="w-3.5 h-3.5" /> Oferta -{event.porcentajeDescuento}%
    </span>
  );
}

// Precio con oferta: el normal tachado y el rebajado destacado. Sin oferta, solo el precio.
// Con varios tipos de entrada a distinto precio se antepone "Desde".
export function OfferPrice({ event, price, compact = false }: { event: OfferInfo; price: number; compact?: boolean }) {
  const desde = event.variosPrecios ? <span className="text-[0.8em] font-semibold text-slate-400 mr-1">Desde</span> : null;
  if (!event.ofertaActiva || !event.precioSinOferta) return <>{desde}{formatPrice(price)}</>;
  return (
    <span className="inline-flex items-baseline gap-1.5 flex-wrap">
      {desde}
      <span className={`line-through decoration-slate-500 text-slate-500 font-semibold ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {formatPrice(event.precioSinOferta)}
      </span>
      <span className="text-rose-300">{formatPrice(price)}</span>
    </span>
  );
}
