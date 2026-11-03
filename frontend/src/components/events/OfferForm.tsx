'use client';

import React, { useState } from 'react';
import { BadgePercent, Loader2, XCircle } from 'lucide-react';
import {
  EventItem, OFFER_LIMITS, discountPercent, endOffer, formatEventDate, formatPrice, offerEndsLabel, priceWithFee, setOffer,
} from '../../services/events';
import { ANNOUNCEMENT_LIMITS } from './EventBitacora';

const QUICK_DISCOUNTS = [10, 20, 30, 50];
const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Oferta del organizador: elige el nuevo precio (o un % rápido), hasta cuándo dura y un mensaje
// opcional para la comunidad. El descuento se calcula sobre lo que paga el público, igual que el backend.
export default function OfferForm({ event, onSaved, onCancel }: {
  event: EventItem;
  onSaved: (updated: EventItem, message: string) => void;
  onCancel: () => void;
}) {
  const fee = event.porcentajeCargo ?? 0;
  const normalPublic = priceWithFee(event.price, fee);
  const active = !!event.ofertaActiva;
  const eventDate = new Date(event.date);

  const [price, setPrice] = useState(active && event.precioOferta ? String(event.precioOferta) : '');
  const [untilEvent, setUntilEvent] = useState(!event.ofertaHasta);
  // Por defecto, una semana (o hasta el día anterior al evento si es antes)
  const defaultEnd = event.ofertaHasta
    ? new Date(event.ofertaHasta)
    : new Date(Math.min(Date.now() + 7 * 864e5, eventDate.getTime() - 864e5));
  const [endDate, setEndDate] = useState(toDateInput(defaultEnd));
  const [endTime, setEndTime] = useState(event.ofertaHasta ? toTimeInput(defaultEnd) : '23:59');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = Number(price) || 0;
  const offerPublic = priceWithFee(base, fee);
  const discount = base > 0 ? discountPercent(normalPublic, offerPublic) : 0;
  const end = untilEvent ? null : new Date(`${endDate}T${endTime}`);
  const text = message.normalize('NFC').trim();

  const priceError = !base
    ? 'Indica el precio de oferta'
    : base >= event.price
      ? `Debe ser menor a ${formatPrice(event.price)}`
      : discount < OFFER_LIMITS.discountMin || discount > OFFER_LIMITS.discountMax
        ? `El descuento debe estar entre ${OFFER_LIMITS.discountMin}% y ${OFFER_LIMITS.discountMax}% (hoy es ${discount}%)`
        : null;
  const endError = !end
    ? null
    : Number.isNaN(end.getTime())
      ? 'Indica la fecha y hora de término'
      : end.getTime() <= Date.now() + 60 * 60_000
        ? 'La oferta debe durar al menos una hora'
        : end.getTime() > eventDate.getTime()
          ? 'No puede terminar después del inicio del evento'
          : null;
  const messageError = text && (text.length < ANNOUNCEMENT_LIMITS.min || text.length > ANNOUNCEMENT_LIMITS.max)
    ? `El mensaje debe tener entre ${ANNOUNCEMENT_LIMITS.min} y ${ANNOUNCEMENT_LIMITS.max} caracteres`
    : null;

  const run = async (task: () => Promise<EventItem>, success: (u: EventItem) => string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await task();
      onSaved(updated, success(updated));
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar la oferta');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    setTouched(true);
    if (priceError || endError || messageError) return;
    run(
      () => setOffer(event.id, base, end?.toISOString(), text || undefined),
      (u) => `"${u.title}" está en oferta con ${u.porcentajeDescuento}% de descuento. Lo anunciamos en las novedades del evento.`,
    );
  };

  const inputClass = (bad: boolean) =>
    `px-3 py-2 text-sm bg-slate-950 border rounded-xl text-white focus:outline-none focus:border-rose-400 [color-scheme:dark] ${bad ? 'border-rose-500/70' : 'border-slate-700'}`;

  return (
    <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-white flex items-center gap-2">
          <BadgePercent className="w-4 h-4 text-rose-300" /> {active ? 'Editar la oferta' : 'Poner en oferta'}
        </p>
        {active && <p className="text-[11px] text-rose-200">{offerEndsLabel(event)}</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Nuevo precio para ti por entrada <span className="text-rose-400">*</span>
          </label>
          <div className="relative max-w-[200px]">
            <span className="absolute left-3 top-2 text-sm text-slate-400 pointer-events-none">$</span>
            <input
              inputMode="numeric"
              autoFocus
              value={price ? Number(price).toLocaleString('es-CL') : ''}
              onChange={(ev) => setPrice(ev.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 8))}
              placeholder={Math.round((event.price * 0.8) / 10) * 10 + ''}
              className={`${inputClass(touched && !!priceError)} w-full pl-7`}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_DISCOUNTS.map((pct) => {
              const value = String(Math.round((event.price * (1 - pct / 100)) / 10) * 10);
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPrice(value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    price === value ? 'border-rose-400/60 bg-rose-500/15 text-rose-200' : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  -{pct}%
                </button>
              );
            })}
          </div>
          {touched && priceError && <p className="text-[11px] text-rose-300 mt-1">{priceError}</p>}
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <p className="text-slate-500">El público verá</p>
          {base > 0 && !priceError ? (
            <>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="line-through text-slate-500">{formatPrice(normalPublic)}</span>
                <span className="text-lg font-extrabold text-rose-200">{formatPrice(offerPublic)}</span>
                <span className="text-[11px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-white bg-gradient-to-r from-rose-500 to-orange-400">
                  -{discount}%
                </span>
              </p>
              <p className="text-slate-500 mt-1">Recibirás {formatPrice(base)} por entrada (antes {formatPrice(event.price)}).</p>
            </>
          ) : (
            <p className="mt-1 text-lg font-extrabold text-white">{formatPrice(normalPublic)}</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-300 mb-1.5">¿Hasta cuándo?</p>
        <div className="flex flex-wrap gap-2">
          {([[true, 'Hasta el día del evento'], [false, 'Hasta una fecha']] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setUntilEvent(value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                untilEvent === value ? 'border-rose-400/60 bg-rose-500/15 text-rose-100' : 'border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!untilEvent && (
          <div className="flex flex-wrap gap-2 mt-2">
            <input type="date" value={endDate} max={toDateInput(eventDate)} onChange={(ev) => setEndDate(ev.target.value)} className={inputClass(touched && !!endError)} />
            <input type="time" value={endTime} onChange={(ev) => setEndTime(ev.target.value)} className={inputClass(touched && !!endError)} />
          </div>
        )}
        {touched && endError && <p className="text-[11px] text-rose-300 mt-1">{endError}</p>}
        {untilEvent && <p className="text-[11px] text-slate-500 mt-1">El evento es el {formatEventDate(event.date)}.</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Mensaje para la comunidad (opcional)</label>
        <textarea
          value={message}
          onChange={(ev) => setMessage(ev.target.value.slice(0, ANNOUNCEMENT_LIMITS.max))}
          rows={2}
          placeholder="Ej. ¡Preventa especial por el fin de semana largo! Aprovecha antes de que se acaben."
          className={`${inputClass(touched && !!messageError)} w-full resize-none`}
        />
        {touched && messageError && <p className="text-[11px] text-rose-300 mt-1">{messageError}</p>}
        <p className="text-[11px] text-slate-500 mt-1">La oferta se anuncia en las novedades del evento. Las compras ya hechas mantienen su precio.</p>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {active && (
          <button
            onClick={() => run(() => endOffer(event.id), (u) => `Terminaste la oferta de "${u.title}": vuelve a su precio normal.`)}
            disabled={busy}
            className="mr-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" /> Terminar oferta
          </button>
        )}
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Volver</button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-white bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {active ? 'Actualizar oferta' : 'Publicar oferta'}
        </button>
      </div>
    </div>
  );
}
