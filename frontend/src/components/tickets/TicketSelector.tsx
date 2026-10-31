'use client';

import React, { useState } from 'react';
import { Minus, Plus, Ticket, ArrowRight, Info, TicketCheck } from 'lucide-react';
import { formatPrice } from '../../services/events';
import { TICKET_LIMITS } from './ticketRules';

interface TicketSelectorProps {
  price: number;
  available: boolean; // el evento está publicado y es futuro
  blockedReason?: string; // ej. cuenta en revisión
  owned: number; // entradas vigentes que el asistente ya tiene para este evento
  onContinue: (quantity: number) => void;
  onViewTickets?: () => void;
}

// Elección de la cantidad de entradas en el detalle del evento (como en las ticketeras: cantidad → datos → pago)
export default function TicketSelector({ price, available, blockedReason, owned, onContinue, onViewTickets }: TicketSelectorProps) {
  const max = Math.max(0, Math.min(TICKET_LIMITS.maxPorCompra, TICKET_LIMITS.maxPorEvento - owned));
  const [quantity, setQuantity] = useState(1);
  const free = price === 0;
  const disabled = !available || !!blockedReason || max === 0;

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600/15 via-slate-950 to-slate-950 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-bold text-indigo-300 flex items-center gap-1.5">
            <Ticket className="w-3.5 h-3.5" /> {free ? 'Entrada liberada' : 'Entrada general'}
          </p>
          <p className="text-xl font-extrabold text-white mt-0.5">{free ? 'Gratis' : formatPrice(price)}</p>
          {!free && <p className="text-[11px] text-slate-500">por persona</p>}
        </div>

        {!disabled && (
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1" role="group" aria-label="Cantidad de entradas">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Quitar una entrada"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-800 disabled:opacity-30"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-lg font-bold text-white tabular-nums" aria-live="polite">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(max, q + 1))}
              disabled={quantity >= max}
              aria-label="Agregar una entrada"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-800 disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {owned > 0 && (
        <p className="mt-3 flex items-center justify-between gap-2 text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
          <span className="flex items-center gap-1.5"><TicketCheck className="w-4 h-4" /> Ya tienes {owned} {owned === 1 ? 'entrada' : 'entradas'} para este evento</span>
          {onViewTickets && <button onClick={onViewTickets} className="font-semibold underline underline-offset-2 hover:no-underline">Ver</button>}
        </p>
      )}

      {disabled ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
          <Info className="w-4 h-4 shrink-0" />
          {blockedReason ?? (!available ? 'Este evento no tiene entradas disponibles en este momento.' : `Llegaste al máximo de ${TICKET_LIMITS.maxPorEvento} entradas para este evento.`)}
        </p>
      ) : (
        <>
          <button
            onClick={() => onContinue(quantity)}
            className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-900/40 transition-colors"
          >
            {free
              ? `Confirmar asistencia${quantity > 1 ? ` (${quantity})` : ''}`
              : `Continuar · ${formatPrice(price * quantity)}`}
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="mt-2 text-[11px] text-slate-500 text-center">
            Las entradas son nominativas: en el siguiente paso indicarás quién usará cada una. Máximo {max} por compra.
          </p>
        </>
      )}
    </div>
  );
}
