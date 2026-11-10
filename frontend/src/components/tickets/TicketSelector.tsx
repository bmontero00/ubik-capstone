'use client';

import React, { useState } from 'react';
import { Minus, Plus, Ticket, ArrowRight, Info, TicketCheck, Hourglass, Car, Ban, CalendarClock } from 'lucide-react';
import { EventItem, TipoEntrada, formatPrice } from '../../services/events';
import { TicketSelection } from '../../services/compras';
import { TICKET_LIMITS } from './ticketRules';

interface TicketSelectorProps {
  event: EventItem;
  available: boolean; // el evento está publicado y es futuro
  blockedReason?: string; // ej. cuenta en revisión
  owned: number; // entradas vigentes que el asistente ya tiene para este evento
  onContinue: (selection: TicketSelection) => void;
  onViewTickets?: () => void;
}

// Pocas entradas disponibles (y ya se vendieron algunas): se avisa para que el asistente no lo deje para después
const LOW_STOCK = 10;

// Elección de entradas en el detalle del evento: cantidad por tipo y estacionamiento (como en las
// ticketeras: entradas → datos de los asistentes → pago)
export default function TicketSelector({ event, available, blockedReason, owned, onContinue, onViewTickets }: TicketSelectorProps) {
  const tipos: TipoEntrada[] = event.tiposEntrada?.length
    ? event.tiposEntrada
    : [{ id: '', nombre: 'General', descripcion: null, precio: event.price, cupo: null, precioFinal: event.precioFinal ?? event.price, precioSinOferta: event.precioSinOferta ?? event.price, cargoPorEntrada: event.cargoPorEntrada ?? 0 }];
  const maxTotal = Math.max(0, Math.min(TICKET_LIMITS.maxPorCompra, TICKET_LIMITS.maxPorEvento - owned));
  const agotada = (t: TipoEntrada) => t.disponibles === 0;
  // Con un solo tipo disponible se parte con 1 entrada elegida
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const disponibles = tipos.filter((t) => !agotada(t));
    return disponibles.length === 1 && tipos.length === 1 && maxTotal > 0 ? { [disponibles[0].id]: 1 } : {};
  });
  const [parking, setParking] = useState(0);

  const total = tipos.reduce((n, t) => n + (counts[t.id] ?? 0), 0);
  const paidParking = event.estacionamiento === 'PAGADO';
  const parkingLeft = event.estacionamientosDisponibles ?? event.cuposEstacionamiento ?? 0;
  const parkingMax = paidParking ? Math.min(total, parkingLeft) : 0;
  const parkingCount = Math.min(parking, parkingMax);
  const amount = tipos.reduce((n, t) => n + (counts[t.id] ?? 0) * t.precioFinal, 0) + parkingCount * (event.precioEstacionamiento ?? 0);
  const free = tipos.every((t) => t.precioFinal === 0);
  const soldOut = !!event.agotado;
  const disabled = !available || !!blockedReason || maxTotal === 0 || soldOut;

  const setCount = (t: TipoEntrada, value: number) => {
    const otros = total - (counts[t.id] ?? 0);
    const tope = Math.min(maxTotal - otros, t.disponibles ?? Infinity);
    setCounts((prev) => ({ ...prev, [t.id]: Math.max(0, Math.min(tope, value)) }));
  };

  if (event.ventaPausada) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 p-4 sm:p-5 flex gap-3">
        <Hourglass className="w-6 h-6 text-amber-300 shrink-0" />
        <div>
          <p className="font-bold text-amber-100">La venta de entradas se liberará muy pronto</p>
          <p className="text-sm text-slate-400 mt-1">
            Estamos terminando de preparar este evento. Vuelve en unos días o revisa sus novedades: te contaremos aquí apenas puedas comprar.
          </p>
          {!free && <p className="text-xs text-slate-500 mt-2">Entradas desde <span className="font-semibold text-slate-300">{formatPrice(Math.min(...tipos.map((t) => t.precioFinal)))}</span></p>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600/15 via-slate-950 to-slate-950 p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-wider font-bold text-indigo-300 flex items-center gap-1.5 mb-3">
        <Ticket className="w-3.5 h-3.5" /> {tipos.length > 1 ? 'Elige tus entradas' : free ? 'Entrada liberada' : 'Entrada'}
      </p>

      <ul className="divide-y divide-slate-800/80">
        {tipos.map((t) => {
          const count = counts[t.id] ?? 0;
          const out = agotada(t);
          const otros = total - count;
          const canAdd = !disabled && !out && otros + count < maxTotal && (t.disponibles == null || count < t.disponibles);
          return (
            <li key={t.id} className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 ${out ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{t.nombre}</p>
                {t.descripcion && <p className="text-[11px] text-slate-400 line-clamp-2">{t.descripcion}</p>}
                <p className="mt-0.5 text-sm">
                  {t.precioFinal === 0 ? (
                    <span className="font-extrabold text-emerald-300">Gratis</span>
                  ) : (
                    <>
                      {event.ofertaActiva && t.precioSinOferta > t.precioFinal && (
                        <span className="line-through text-slate-500 text-xs mr-1.5">{formatPrice(t.precioSinOferta)}</span>
                      )}
                      <span className={`font-extrabold ${event.ofertaActiva ? 'text-rose-300' : 'text-white'}`}>{formatPrice(t.precioFinal)}</span>
                    </>
                  )}
                  {out ? (
                    <span className="ml-2 text-[11px] font-bold text-rose-300">Agotada</span>
                  ) : t.disponibles != null && t.disponibles <= LOW_STOCK && t.cupo !== null && t.disponibles < t.cupo ? (
                    <span className="ml-2 text-[11px] font-bold text-amber-300">¡Últimas {t.disponibles}!</span>
                  ) : null}
                </p>
              </div>
              {!disabled && !out && (
                <Stepper
                  label={t.nombre}
                  value={count}
                  onMinus={() => setCount(t, count - 1)}
                  onPlus={() => setCount(t, count + 1)}
                  canMinus={count > 0}
                  canPlus={canAdd}
                />
              )}
            </li>
          );
        })}
      </ul>
      {!free && <p className="text-[11px] text-slate-500 mt-2">Precios por persona · incluyen cargo por servicio</p>}

      {/* Estacionamiento */}
      {event.estacionamiento && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-sky-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">
                Estacionamiento{' '}
                <span className="font-semibold text-slate-300">
                  {paidParking ? `· ${formatPrice(event.precioEstacionamiento ?? 0)} por vehículo` : '· Gratuito'}
                </span>
              </p>
              {event.indicacionesEstacionamiento && <p className="text-[11px] text-slate-400 line-clamp-2">{event.indicacionesEstacionamiento}</p>}
              {paidParking && parkingLeft === 0 && <p className="text-[11px] font-bold text-rose-300">Agotado</p>}
              {paidParking && parkingLeft > 0 && total === 0 && !disabled && <p className="text-[11px] text-slate-500">Elige tus entradas para agregarlo (uno por entrada)</p>}
            </div>
            {paidParking && !disabled && parkingLeft > 0 && (
              <Stepper
                label="estacionamientos"
                value={parkingCount}
                onMinus={() => setParking(parkingCount - 1)}
                onPlus={() => setParking(parkingCount + 1)}
                canMinus={parkingCount > 0}
                canPlus={parkingCount < parkingMax}
              />
            )}
          </div>
        </div>
      )}

      {owned > 0 && (
        <p className="mt-3 flex items-center justify-between gap-2 text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
          <span className="flex items-center gap-1.5"><TicketCheck className="w-4 h-4" /> Ya tienes {owned} {owned === 1 ? 'entrada' : 'entradas'} para este evento</span>
          {onViewTickets && <button onClick={onViewTickets} className="font-semibold underline underline-offset-2 hover:no-underline">Ver</button>}
        </p>
      )}

      {/* Postergado con entradas: la venta sigue y se recuerda que valen para la nueva fecha */}
      {event.status === 'POSTPONED' && !soldOut && (
        <p className="mt-3 flex items-start gap-2 text-xs text-sky-200 bg-sky-500/10 border border-sky-500/25 rounded-lg px-3 py-2">
          <CalendarClock className="w-4 h-4 shrink-0" />
          El evento se postergó: las entradas que compres son válidas para la nueva fecha.
        </p>
      )}

      {soldOut ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <Ban className="w-5 h-5 shrink-0 text-rose-300 mt-0.5" />
          <div>
            <p className="font-extrabold text-rose-100 uppercase tracking-wider text-sm">Sold Out</p>
            <p className="text-xs text-slate-300 mt-0.5">
              Se vendieron todas las entradas para este evento, así que ya no es posible comprar más.
              {event.status === 'POSTPONED' && ' Quienes ya compraron mantienen su entrada para la nueva fecha.'}
            </p>
          </div>
        </div>
      ) : disabled ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
          <Info className="w-4 h-4 shrink-0" />
          {blockedReason ??
            (!available
              ? 'Este evento no tiene entradas disponibles en este momento.'
              : `Llegaste al máximo de ${TICKET_LIMITS.maxPorEvento} entradas para este evento.`)}
        </p>
      ) : (
        <>
          <button
            onClick={() => onContinue({
              tipos: tipos.filter((t) => counts[t.id]).map((t) => ({
                id: t.id, nombre: t.nombre, precioFinal: t.precioFinal, cargoPorEntrada: t.cargoPorEntrada, cantidad: counts[t.id],
              })),
              estacionamientos: parkingCount,
              precioEstacionamiento: event.precioEstacionamiento ?? 0,
            })}
            disabled={total === 0}
            className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {total === 0
              ? 'Elige al menos una entrada'
              : amount === 0
                ? `Confirmar asistencia${total > 1 ? ` (${total})` : ''}`
                : `Continuar · ${formatPrice(amount)}`}
            {total > 0 && <ArrowRight className="w-4 h-4" />}
          </button>
          <p className="mt-2 text-[11px] text-slate-500 text-center">
            Las entradas son nominativas: en el siguiente paso indicarás quién usará cada una. Máximo {maxTotal} por compra.
          </p>
        </>
      )}
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus, canMinus, canPlus }: {
  label: string; value: number; onMinus: () => void; onPlus: () => void; canMinus: boolean; canPlus: boolean;
}) {
  return (
    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1 shrink-0" role="group" aria-label={`Cantidad de ${label}`}>
      <button onClick={onMinus} disabled={!canMinus} aria-label={`Quitar ${label}`} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 disabled:opacity-30">
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-7 text-center text-base font-bold text-white tabular-nums" aria-live="polite">{value}</span>
      <button onClick={onPlus} disabled={!canPlus} aria-label={`Agregar ${label}`} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 disabled:opacity-30">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
