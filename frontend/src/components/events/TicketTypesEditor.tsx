'use client';

import React from 'react';
import { Plus, Trash2, Users, Car, CircleSlash, Gift, Ticket, Info } from 'lucide-react';
import { formatPrice, priceWithFee } from '../../services/events';
import {
  EventFormState, FieldErrors, ParkingOption, TicketTypeErrors, TicketTypeForm, assignedSeats, newTicketType,
} from './eventRules';
import { TICKET_TYPE_LIMITS, TICKET_TYPE_SUGGESTIONS, nameKey, normalizeTypeName } from './ticketTypeRules';

type Setter = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;

const digits = (v: string, max = 8) => v.replace(/\D/g, '').replace(/^0+/, '').slice(0, max);
const inputClass = (bad: boolean) =>
  `w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
    bad ? 'border-rose-500/70 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
  }`;

// Tipos de entrada del evento, aforo y reparto de cupos
export function TicketTypesEditor({ form, set, errors, typeErrors, showErrors, feePct }: {
  form: EventFormState;
  set: Setter;
  errors: FieldErrors;
  typeErrors: TicketTypeErrors[];
  showErrors: boolean;
  feePct: number | null;
}) {
  const aforo = Number(form.aforo) || 0;
  const asignado = assignedSeats(form);
  const usados = new Set(form.tipos.map((t) => nameKey(t.nombre)));
  const sugerencias = TICKET_TYPE_SUGGESTIONS.filter((s) => !usados.has(nameKey(s)));
  const lleno = form.tipos.length >= TICKET_TYPE_LIMITS.maxTipos;

  const updateType = (key: string, patch: Partial<TicketTypeForm>) =>
    set('tipos', form.tipos.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const addType = (nombre = '') => {
    if (lleno) return;
    // Con un solo tipo, el cupo sigue al aforo; al agregar otro, el nuevo parte vacío para repartir
    set('tipos', [...form.tipos, newTicketType(nombre)]);
  };
  const removeType = (key: string) => set('tipos', form.tipos.filter((t) => t.key !== key));
  const changeAforo = (value: string) => {
    set('aforo', value);
    if (form.tipos.length === 1 && form.tipos[0].vendidas <= (Number(value) || 0)) updateType(form.tipos[0].key, { cupo: value });
  };

  return (
    <div className="space-y-4">
      {/* Aforo total y reparto */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Aforo total</label>
            <div className="relative">
              <Users className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                inputMode="numeric"
                value={form.aforo ? Number(form.aforo).toLocaleString('es-CL') : ''}
                onChange={(e) => changeAforo(digits(e.target.value, 6))}
                placeholder="Ej. 300"
                className={`${inputClass(showErrors && !!errors.aforo)} pl-9`}
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Repartidas entre los tipos</span>
              <span className={`font-bold tabular-nums ${aforo && asignado === aforo ? 'text-emerald-300' : asignado > aforo ? 'text-rose-300' : 'text-slate-300'}`}>
                {asignado.toLocaleString('es-CL')} de {aforo.toLocaleString('es-CL')}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all ${asignado > aforo ? 'bg-rose-500' : asignado === aforo && aforo ? 'bg-emerald-400' : 'bg-indigo-500'}`}
                style={{ width: `${aforo ? Math.min(100, (asignado / aforo) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
        {errors.aforo && (showErrors || (aforo > 0 && asignado > 0)) ? (
          <p className={`text-[11px] mt-2 ${showErrors ? 'text-rose-400' : 'text-amber-200'}`}>{errors.aforo}</p>
        ) : (
          <p className="text-[11px] text-slate-500 mt-2">Las entradas se descuentan de cada tipo a medida que se compran. Cuando un tipo se agota, se muestra como agotado.</p>
        )}
      </div>

      {/* Tipos de entrada */}
      <ul className="space-y-3">
        {form.tipos.map((t, i) => {
          const e = showErrors ? typeErrors[i] ?? {} : {};
          const price = Number(t.precio) || 0;
          return (
            <li key={t.key} className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-start gap-3">
                <span className="mt-2 w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-200 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0 grid sm:grid-cols-[1fr_120px_110px] gap-3">
                  <div className="min-w-0">
                    <input
                      value={t.nombre}
                      maxLength={TICKET_TYPE_LIMITS.nombreMax + 5}
                      onChange={(ev) => updateType(t.key, { nombre: ev.target.value })}
                      onBlur={() => t.nombre.trim() && updateType(t.key, { nombre: normalizeTypeName(t.nombre) })}
                      placeholder="Nombre (ej. General, VIP)"
                      aria-label={`Nombre de la entrada ${i + 1}`}
                      className={inputClass(!!e.nombre)}
                    />
                    {e.nombre && <p className="text-[11px] text-rose-400 mt-1">{e.nombre}</p>}
                  </div>
                  {!form.isFree ? (
                    <div>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-slate-500 pointer-events-none">$</span>
                        <input
                          inputMode="numeric"
                          value={t.precio ? Number(t.precio).toLocaleString('es-CL') : ''}
                          onChange={(ev) => updateType(t.key, { precio: digits(ev.target.value) })}
                          placeholder="Valor"
                          aria-label={`Valor de la entrada ${i + 1}`}
                          className={`${inputClass(!!e.precio)} pl-6`}
                        />
                      </div>
                      {e.precio ? (
                        <p className="text-[11px] text-rose-400 mt-1">{e.precio}</p>
                      ) : price > 0 && feePct !== null ? (
                        <p className="text-[11px] text-emerald-300/80 mt-1">Público: {formatPrice(priceWithFee(price, feePct))}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-emerald-300 pt-2">Gratis</p>
                  )}
                  <div>
                    <input
                      inputMode="numeric"
                      value={t.cupo ? Number(t.cupo).toLocaleString('es-CL') : ''}
                      onChange={(ev) => updateType(t.key, { cupo: digits(ev.target.value, 6) })}
                      placeholder="Cupo"
                      aria-label={`Cupo de la entrada ${i + 1}`}
                      className={inputClass(!!e.cupo)}
                    />
                    {e.cupo ? (
                      <p className="text-[11px] text-rose-400 mt-1">{e.cupo}</p>
                    ) : t.vendidas > 0 ? (
                      <p className="text-[11px] text-amber-200/80 mt-1">{t.vendidas} {t.vendidas === 1 ? 'vendida' : 'vendidas'}</p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      value={t.descripcion}
                      maxLength={TICKET_TYPE_LIMITS.descripcionMax}
                      onChange={(ev) => updateType(t.key, { descripcion: ev.target.value })}
                      placeholder="Qué incluye (opcional). Ej. Acceso preferente y foto con el artista"
                      aria-label={`Descripción de la entrada ${i + 1}`}
                      className={`${inputClass(!!e.descripcion)} text-xs`}
                    />
                    {e.descripcion && <p className="text-[11px] text-rose-400 mt-1">{e.descripcion}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeType(t.key)}
                  disabled={form.tipos.length === 1 || t.vendidas > 0}
                  title={t.vendidas > 0 ? 'Ya tiene entradas vendidas: no se puede quitar' : form.tipos.length === 1 ? 'El evento necesita al menos un tipo de entrada' : 'Quitar'}
                  aria-label={`Quitar la entrada ${i + 1}`}
                  className="mt-1.5 p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {!lleno ? (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Agrega otro tipo de entrada:</p>
          <div className="flex flex-wrap gap-1.5">
            {sugerencias.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addType(s)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-800 text-slate-300 hover:border-indigo-500/60 hover:text-white transition-colors"
              >
                + {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addType()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-indigo-500/50 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20"
            >
              <Plus className="w-3 h-3" /> Otro nombre
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Llegaste al máximo de {TICKET_TYPE_LIMITS.maxTipos} tipos de entrada.</p>
      )}
    </div>
  );
}

// Estacionamiento: no tiene, gratuito (solo informativo) o pagado (se vende con cupos)
export function ParkingEditor({ form, set, errors, showErrors }: {
  form: EventFormState;
  set: Setter;
  errors: FieldErrors;
  showErrors: boolean;
}) {
  const options: { id: ParkingOption; title: string; text: string; icon: React.ElementType }[] = [
    { id: 'NINGUNO', title: 'No tiene', text: 'Sin estacionamiento', icon: CircleSlash },
    { id: 'GRATUITO', title: 'Gratuito', text: 'Se informa en el evento', icon: Gift },
    { id: 'PAGADO', title: 'Con costo', text: 'Se compra con las entradas', icon: Ticket },
  ];
  const err = (k: keyof EventFormState) => (showErrors ? errors[k] : undefined);
  const lockedPaid = form.estacionamientosVendidos > 0;
  return (
    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
        <Car className="w-4 h-4 text-slate-400" /> ¿El evento tiene estacionamiento?
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Estacionamiento">
        {options.map((o) => {
          const selected = form.estacionamiento === o.id;
          const disabled = lockedPaid && o.id !== 'PAGADO';
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => set('estacionamiento', o.id)}
              className={`text-left p-2.5 rounded-xl border transition-colors disabled:opacity-40 ${
                selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-600'
              }`}
            >
              <o.icon className={`w-4 h-4 ${selected ? 'text-indigo-200' : 'text-slate-500'}`} />
              <span className="block text-xs font-bold text-white mt-1">{o.title}</span>
              <span className="block text-[11px] text-slate-500 leading-tight">{o.text}</span>
            </button>
          );
        })}
      </div>
      {lockedPaid && (
        <p className="text-[11px] text-amber-200/80 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Ya vendiste {form.estacionamientosVendidos}{' '}
          {form.estacionamientosVendidos === 1 ? 'estacionamiento' : 'estacionamientos'}: se mantiene con costo.
        </p>
      )}

      {form.estacionamiento === 'PAGADO' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Valor por vehículo</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-slate-500 pointer-events-none">$</span>
              <input
                inputMode="numeric"
                value={form.precioEstacionamiento ? Number(form.precioEstacionamiento).toLocaleString('es-CL') : ''}
                onChange={(e) => set('precioEstacionamiento', digits(e.target.value))}
                placeholder="3.000"
                className={`${inputClass(!!err('precioEstacionamiento'))} pl-6`}
              />
            </div>
            {err('precioEstacionamiento') && <p className="text-[11px] text-rose-400 mt-1">{err('precioEstacionamiento')}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Estacionamientos disponibles</label>
            <input
              inputMode="numeric"
              value={form.cuposEstacionamiento ? Number(form.cuposEstacionamiento).toLocaleString('es-CL') : ''}
              onChange={(e) => set('cuposEstacionamiento', digits(e.target.value, 5))}
              placeholder="50"
              className={inputClass(!!err('cuposEstacionamiento'))}
            />
            {err('cuposEstacionamiento') ? (
              <p className="text-[11px] text-rose-400 mt-1">{err('cuposEstacionamiento')}</p>
            ) : form.estacionamientosVendidos > 0 ? (
              <p className="text-[11px] text-amber-200/80 mt-1">{form.estacionamientosVendidos} {form.estacionamientosVendidos === 1 ? 'vendido' : 'vendidos'}</p>
            ) : null}
          </div>
          <p className="col-span-2 text-[11px] text-slate-500">
            Los asistentes lo agregan al comprar (uno por entrada como máximo). No lleva cargo por servicio ni descuento de ofertas.
          </p>
        </div>
      )}

      {form.estacionamiento !== 'NINGUNO' && (
        <div>
          <input
            value={form.indicacionesEstacionamiento}
            maxLength={TICKET_TYPE_LIMITS.indicacionesMax}
            onChange={(e) => set('indicacionesEstacionamiento', e.target.value)}
            placeholder="Indicaciones (opcional). Ej. Acceso por calle Moneda, a 50 m de la entrada"
            className={`${inputClass(!!err('indicacionesEstacionamiento'))} text-xs`}
          />
          {err('indicacionesEstacionamiento') && <p className="text-[11px] text-rose-400 mt-1">{err('indicacionesEstacionamiento')}</p>}
        </div>
      )}
    </div>
  );
}
