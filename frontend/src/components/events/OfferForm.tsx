'use client';

import React, { useState } from 'react';
import { BadgePercent, Loader2, XCircle } from 'lucide-react';
import {
  EventItem, OFFER_LIMITS, endOffer, formatEventDate, formatPrice, offerEndsLabel, priceWithFee, priceWithOffer, setOffer,
} from '../../services/events';
import { ANNOUNCEMENT_LIMITS } from './EventBitacora';

const QUICK_DISCOUNTS = [10, 15, 20, 30, 50];
const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Oferta del organizador: un % de descuento sobre todos los tipos de entrada, hasta cuándo dura y un
// mensaje opcional para la comunidad. Los precios se calculan igual que en el backend.
export default function OfferForm({ event, onSaved, onCancel }: {
  event: EventItem;
  onSaved: (updated: EventItem, message: string) => void;
  onCancel: () => void;
}) {
  const fee = event.porcentajeCargo ?? 0;
  const active = !!event.ofertaActiva;
  const eventDate = new Date(event.date);
  const tipos = event.tiposEntrada?.length
    ? event.tiposEntrada
    : [{ id: 'general', nombre: 'General', precio: event.price }];

  const [percent, setPercent] = useState(active && event.porcentajeOferta ? String(event.porcentajeOferta) : '');
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

  const pct = Number(percent) || 0;
  const end = untilEvent ? null : new Date(`${endDate}T${endTime}`);
  const text = message.normalize('NFC').trim();

  const percentError = !pct
    ? 'Indica el % de descuento'
    : pct < OFFER_LIMITS.discountMin || pct > OFFER_LIMITS.discountMax
      ? `El descuento debe estar entre ${OFFER_LIMITS.discountMin}% y ${OFFER_LIMITS.discountMax}%`
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
    if (percentError || endError || messageError) return;
    run(
      () => setOffer(event.id, pct, end?.toISOString(), text || undefined),
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
            Descuento en todas las entradas <span className="text-rose-400">*</span>
          </label>
          <div className="relative max-w-[140px]">
            <input
              inputMode="numeric"
              autoFocus
              value={percent}
              onChange={(ev) => setPercent(ev.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 2))}
              placeholder="20"
              className={`${inputClass(touched && !!percentError)} w-full pr-8`}
            />
            <span className="absolute right-3 top-2 text-sm text-slate-400">%</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_DISCOUNTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPercent(String(d))}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  pct === d ? 'border-rose-400/60 bg-rose-500/15 text-rose-200' : 'border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                -{d}%
              </button>
            ))}
          </div>
          {touched && percentError && <p className="text-[11px] text-rose-300 mt-1">{percentError}</p>}
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <p className="text-slate-500 mb-1.5">El público verá</p>
          <ul className="space-y-1">
            {tipos.slice(0, 5).map((t) => {
              const normal = priceWithFee(t.precio, fee);
              const offer = priceWithFee(priceWithOffer(t.precio, pct), fee);
              return (
                <li key={t.id} className="flex items-baseline justify-between gap-2">
                  <span className="text-slate-300 truncate">{t.nombre}</span>
                  <span className="shrink-0 tabular-nums">
                    {pct && !percentError ? (
                      <><span className="line-through text-slate-500 mr-1.5">{formatPrice(normal)}</span><span className="font-bold text-rose-200">{formatPrice(offer)}</span></>
                    ) : (
                      <span className="font-bold text-white">{formatPrice(normal)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {tipos.length > 5 && <p className="text-slate-500 mt-1">y {tipos.length - 5} tipos más</p>}
          <p className="text-slate-500 mt-2">El descuento se aplica a lo que recibes por cada entrada. El estacionamiento no tiene descuento.</p>
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
