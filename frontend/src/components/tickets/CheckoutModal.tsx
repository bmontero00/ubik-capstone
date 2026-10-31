'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Check, ChevronDown, Loader2, CalendarDays, MapPin, Timer, CreditCard, ShieldCheck, PartyPopper, UserRound,
  Copy, AlertTriangle, Ticket, ArrowLeft, Lock,
} from 'lucide-react';
import { ApiError } from '../../services/auth';
import { Compra, cancelCompra, createCompra, payCompra } from '../../services/compras';
import { formatEventDate, formatPrice, imageSrc } from '../../services/events';
import { formatRut } from '../../utils/rut';
import { PHONE_PREFIX, formatLocalPhone, formatPhoneDisplay, toFullPhone } from '../../utils/phone';
import { categoryColor } from '../../utils/mapTiles';
import {
  AttendeeErrors, AttendeeForm, backendRutKey, emptyAttendee, rutKey, validateAttendee,
} from './ticketRules';

export interface CheckoutEvent {
  id: string;
  title: string;
  date: string;
  address: string;
  imageUrl?: string | null;
  price: number;
  category?: { name: string };
}

interface CheckoutModalProps {
  event: CheckoutEvent;
  quantity: number;
  buyer: { name: string; email: string };
  resume?: Compra; // compra pendiente de pago que se retoma desde "Mis entradas"
  onClose: () => void;
  onChanged: () => void; // se creó, pagó o anuló una compra
  onViewTickets: () => void;
}

type Step = 'attendees' | 'payment' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'attendees', label: 'Asistentes' },
  { id: 'payment', label: 'Pago' },
  { id: 'done', label: 'Listo' },
];

// Separa "María José Pérez Soto" en nombre y apellido para precargar la primera entrada
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { nombre: parts[0] ?? '', apellido: '' };
  const half = parts.length >= 4 ? 2 : 1;
  return { nombre: parts.slice(0, half).join(' '), apellido: parts.slice(half).join(' ') };
};

// Mientras se escribe solo se avisa lo que ya está mal (caracteres inválidos, RUT o celular completos
// pero incorrectos); los campos vacíos o a medio escribir se marcan al avanzar o confirmar
const filledOnly = (errors: AttendeeErrors, value: AttendeeForm): AttendeeErrors => {
  const shown: AttendeeErrors = {};
  (['nombre', 'apellido'] as const).forEach((k) => {
    if (errors[k]?.includes('letras')) shown[k] = errors[k];
  });
  if (errors.rut && value.rut.length >= 11) shown.rut = errors.rut;
  if (errors.telefono && value.telefono.length >= 11) shown.telefono = errors.telefono;
  return shown;
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Compra de entradas: datos de cada asistente → pago → entradas listas
export default function CheckoutModal({ event, quantity, buyer, resume, onClose, onChanged, onViewTickets }: CheckoutModalProps) {
  const free = event.price === 0;
  const [step, setStep] = useState<Step>(resume ? 'payment' : 'attendees');
  const [attendees, setAttendees] = useState<AttendeeForm[]>(() =>
    resume
      ? resume.entradas.map((e) => ({ nombre: e.nombre, apellido: e.apellido, rut: formatRut(e.rut), telefono: formatLocalPhone(e.telefono), correo: e.correo }))
      : Array.from({ length: quantity }, emptyAttendee),
  );
  const [open, setOpen] = useState(0);
  const [touched, setTouched] = useState<boolean[]>(() => Array(quantity).fill(false));
  const [serverRutErrors, setServerRutErrors] = useState<Record<string, string>>({});
  const [compra, setCompra] = useState<Compra | null>(resume ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(Date.now());

  const count = attendees.length;
  const total = event.price * count;

  // Errores de cada entrada, incluidos los RUT repetidos dentro de la misma compra
  const errors: AttendeeErrors[] = useMemo(() => attendees.map((a, i) => {
    const e = validateAttendee(a);
    const key = rutKey(a.rut);
    if (!e.rut && key && attendees.findIndex((o) => rutKey(o.rut) === key) !== i) {
      e.rut = 'Este RUT ya está en otra entrada: cada entrada es para una persona distinta';
    }
    if (!e.rut && serverRutErrors[key]) e.rut = serverRutErrors[key];
    return e;
  }), [attendees, serverRutErrors]);
  const completeCount = errors.filter((e) => !Object.keys(e).length).length;

  // Cuenta regresiva para pagar
  const remaining = compra?.expiraEn ? new Date(compra.expiraEn).getTime() - now : null;
  const expired = step === 'payment' && remaining !== null && remaining <= 0;
  useEffect(() => {
    if (step !== 'payment') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  const requestClose = () => {
    if (busy) return;
    if (step === 'payment' && compra && !expired) return setConfirmLeave(true);
    if (step === 'attendees' && attendees.some((a) => Object.values(a).some(Boolean))) return setConfirmLeave(true);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (confirmLeave ? setConfirmLeave(false) : requestClose());
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  });

  const update = (i: number, field: keyof AttendeeForm, value: string) => {
    setAttendees((prev) => prev.map((a, j) => (j === i ? { ...a, [field]: value } : a)));
    if (field === 'rut') setServerRutErrors({});
  };

  const touch = (i: number) => setTouched((prev) => prev.map((t, j) => (j === i ? true : t)));

  const fillWithMyData = (i: number) => {
    const { nombre, apellido } = splitName(buyer.name);
    setAttendees((prev) => prev.map((a, j) => (j === i ? { ...a, nombre: a.nombre || nombre, apellido: a.apellido || apellido, correo: a.correo || buyer.email } : a)));
  };

  const copyContact = (i: number) =>
    setAttendees((prev) => prev.map((a, j) => (j === i ? { ...a, telefono: prev[0].telefono, correo: prev[0].correo } : a)));

  const next = (i: number) => {
    touch(i);
    if (Object.keys(errors[i]).length) return;
    const pending = errors.findIndex((e, j) => j !== i && Object.keys(e).length);
    setOpen(pending === -1 ? -1 : pending);
  };

  const submitAttendees = async () => {
    setTouched(Array(count).fill(true));
    const firstInvalid = errors.findIndex((e) => Object.keys(e).length);
    if (firstInvalid !== -1) {
      setOpen(firstInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createCompra(event.id, attendees.map((a) => ({
        nombre: a.nombre.normalize('NFC').trim(),
        apellido: a.apellido.normalize('NFC').trim(),
        rut: a.rut,
        telefono: toFullPhone(a.telefono),
        correo: a.correo.trim(),
      })));
      setCompra(created);
      setNow(Date.now());
      setStep(created.estado === 'CONFIRMADA' ? 'done' : 'payment');
      onChanged();
    } catch (e) {
      // RUT que ya tienen entrada para este evento: se marcan en su entrada
      if (e instanceof ApiError && Array.isArray(e.data?.ruts)) {
        const map: Record<string, string> = {};
        (e.data.ruts as string[]).forEach((rut) => {
          map[backendRutKey(rut)] = e.data.code === 'RUT_CON_ENTRADA' ? 'Esta persona ya tiene una entrada para este evento' : 'RUT repetido';
        });
        setServerRutErrors(map);
        const idx = attendees.findIndex((a) => map[rutKey(a.rut)]);
        if (idx !== -1) setOpen(idx);
      }
      setError((e as Error).message || 'No pudimos reservar tus entradas');
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!compra) return;
    setBusy(true);
    setError(null);
    try {
      setCompra(await payCompra(compra.id));
      setStep('done');
      onChanged();
    } catch (e) {
      setError((e as Error).message || 'No se pudo procesar el pago');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (step === 'payment' && compra && !expired) {
      setBusy(true);
      await cancelCompra(compra.id).catch(() => {});
      onChanged();
    }
    onClose();
  };

  const restart = () => {
    setCompra(null);
    setError(null);
    setStep('attendees');
  };

  const src = imageSrc(event.imageUrl);
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const visibleSteps = free ? STEPS.filter((s) => s.id !== 'payment') : STEPS;

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="relative w-full sm:max-w-5xl max-h-[96vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Encabezado con pasos */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h2 id="checkout-title" className="text-lg font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-300" /> {free ? 'Confirmar asistencia' : 'Comprar entradas'}
            </h2>
            <ol className="mt-2 flex items-center gap-2 text-[11px] font-semibold" aria-label="Pasos de la compra">
              {visibleSteps.map((s, i) => {
                const idx = STEPS.findIndex((x) => x.id === s.id);
                const done = idx < stepIndex;
                const current = idx === stepIndex;
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    {i > 0 && <span className="w-6 h-px bg-slate-700" />}
                    <span className={`flex items-center gap-1.5 ${current ? 'text-white' : done ? 'text-emerald-300' : 'text-slate-500'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${current ? 'bg-indigo-600' : done ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                        {done ? <Check className="w-3 h-3" /> : i + 1}
                      </span>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          {step === 'payment' && remaining !== null && !expired && (
            <span className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold tabular-nums ${remaining < 120_000 ? 'bg-rose-500/15 text-rose-200' : 'bg-amber-500/10 text-amber-200'}`}>
              <Timer className="w-4 h-4" /> {mmss(remaining)}
            </span>
          )}
          <button onClick={step === 'done' ? onClose : requestClose} aria-label="Cerrar" className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[1fr_320px]">
            {/* Contenido del paso */}
            <div className="p-5 sm:p-6 order-2 lg:order-1">
              {step === 'attendees' && (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-white">¿Quiénes asistirán?</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Cada entrada queda a nombre de una persona y se valida con su RUT en el acceso.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">
                      <span className={completeCount === count ? 'text-emerald-300' : 'text-indigo-300'}>{completeCount}</span> de {count} completas
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-5">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all" style={{ width: `${(completeCount / count) * 100}%` }} />
                  </div>

                  <ul className="space-y-3">
                    {attendees.map((a, i) => (
                      <AttendeeCard
                        key={i}
                        index={i}
                        value={a}
                        errors={touched[i] ? errors[i] : filledOnly(errors[i], a)}
                        complete={!Object.keys(errors[i]).length}
                        open={open === i}
                        last={i === count - 1}
                        onToggle={() => setOpen(open === i ? -1 : i)}
                        onChange={(field, value) => update(i, field, value)}
                        onNext={() => next(i)}
                        onFillMine={i === 0 ? () => fillWithMyData(0) : undefined}
                        onCopyContact={i > 0 && attendees[0].correo && attendees[0].telefono ? () => copyContact(i) : undefined}
                      />
                    ))}
                  </ul>
                </>
              )}

              {step === 'payment' && compra && (
                expired ? (
                  <div className="flex flex-col items-center text-center py-10">
                    <Timer className="w-10 h-10 text-rose-300 mb-3" />
                    <h3 className="text-lg font-bold text-white">Se acabó el tiempo para pagar</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm">
                      Liberamos tus entradas reservadas. Tus datos siguen guardados: puedes volver a intentarlo.
                    </p>
                    <button onClick={restart} className="mt-5 flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500">
                      <ArrowLeft className="w-4 h-4" /> Volver a intentarlo
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-base font-bold text-white">Elige cómo pagar</h3>
                    <p className="text-xs text-slate-400 mt-0.5 mb-4">
                      Reservamos tus {compra.cantidad} {compra.cantidad === 1 ? 'entrada' : 'entradas'} por {mmss(remaining ?? 0)} minutos.
                    </p>
                    <div className="space-y-2">
                      <PaymentOption selected title="Pago de prueba" subtitle="Modo de desarrollo: el pago se aprueba sin cobro real" icon={ShieldCheck} />
                      <PaymentOption title="Webpay" subtitle="Tarjetas de crédito, débito y prepago · Próximamente" icon={CreditCard} disabled />
                      <PaymentOption title="Mercado Pago" subtitle="Saldo, tarjetas y cuotas · Próximamente" icon={CreditCard} disabled />
                    </div>

                    <div className="mt-5 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                      <p className="text-xs font-semibold text-slate-400 mb-2">Entradas a nombre de</p>
                      <ul className="space-y-1.5 text-sm">
                        {compra.entradas.map((e) => (
                          <li key={e.id} className="flex justify-between gap-2">
                            <span className="text-slate-200 truncate">{e.nombre} {e.apellido}</span>
                            <span className="text-slate-500 text-xs tabular-nums">{formatRut(e.rut)}</span>
                          </li>
                        ))}
                      </ul>
                      {!resume && (
                        <button onClick={restart} className="mt-3 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Corregir datos</button>
                      )}
                    </div>
                  </>
                )
              )}

              {step === 'done' && compra && <Success compra={compra} free={free} onViewTickets={onViewTickets} onClose={onClose} />}

              {error && step !== 'done' && (
                <p className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </p>
              )}
            </div>

            {/* Resumen del pedido */}
            <aside className="order-1 lg:order-2 p-5 sm:p-6 lg:border-l border-b lg:border-b-0 border-slate-800 bg-slate-950/40">
              <div className="flex lg:block gap-3">
                <div className="w-20 h-20 lg:w-full lg:h-36 rounded-xl overflow-hidden shrink-0" style={{ background: `linear-gradient(135deg, ${categoryColor(event.category?.name)}55, #0f172a)` }}>
                  {src && <img src={src} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 lg:mt-3">
                  <p className="font-bold text-white leading-snug break-words">{event.title}</p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 shrink-0" /> {formatEventDate(event.date)}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {event.address}</p>
                </div>
              </div>
              <dl className="mt-4 pt-4 border-t border-slate-800 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-300">
                  <dt>{count} × {free ? 'Entrada liberada' : 'Entrada general'}</dt>
                  <dd className="tabular-nums">{free ? 'Gratis' : formatPrice(event.price)}</dd>
                </div>
                <div className="flex justify-between text-base font-extrabold text-white pt-2">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{free ? 'Gratis' : formatPrice(total)}</dd>
                </div>
              </dl>
              {step === 'payment' && remaining !== null && !expired && (
                <p className={`sm:hidden mt-3 flex items-center gap-1.5 text-xs font-bold ${remaining < 120_000 ? 'text-rose-200' : 'text-amber-200'}`}>
                  <Timer className="w-4 h-4" /> Tiempo para pagar: {mmss(remaining)}
                </p>
              )}
            </aside>
          </div>
        </div>

        {/* Acciones */}
        {step !== 'done' && !expired && (
          <div className="px-5 sm:px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900">
            <p className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500"><Lock className="w-3.5 h-3.5" /> Tus datos solo se usan para emitir las entradas.</p>
            {step === 'attendees' ? (
              <button
                onClick={submitAttendees}
                disabled={busy}
                className="ml-auto flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {free ? 'Confirmar asistencia' : 'Continuar al pago'}
              </button>
            ) : (
              <button
                onClick={pay}
                disabled={busy}
                className="ml-auto flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Pagar {formatPrice(compra?.total ?? total)}
              </button>
            )}
          </div>
        )}

        {confirmLeave && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="max-w-sm w-full p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
              <p className="font-bold text-white">{step === 'payment' ? '¿Abandonar la compra?' : '¿Salir sin terminar?'}</p>
              <p className="text-sm text-slate-400 mt-1">
                {step === 'payment' ? 'Liberaremos las entradas que reservamos para ti.' : 'Perderás los datos de los asistentes que ingresaste.'}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setConfirmLeave(false)} className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Seguir comprando</button>
                <button onClick={leave} disabled={busy} className="px-3 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50">Salir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface AttendeeCardProps {
  index: number;
  value: AttendeeForm;
  errors: AttendeeErrors;
  complete: boolean;
  open: boolean;
  last: boolean;
  onToggle: () => void;
  onChange: (field: keyof AttendeeForm, value: string) => void;
  onNext: () => void;
  onFillMine?: () => void;
  onCopyContact?: () => void;
}

// Una entrada del formulario: se colapsa al completarse para avanzar a la siguiente
function AttendeeCard({ index, value, errors, complete, open, last, onToggle, onChange, onNext, onFillMine, onCopyContact }: AttendeeCardProps) {
  const name = `${value.nombre} ${value.apellido}`.trim();
  const hasErrors = Object.keys(errors).length > 0;
  const id = (f: string) => `att-${index}-${f}`;

  return (
    <li className={`rounded-2xl border transition-colors ${open ? 'border-indigo-500/50 bg-slate-950' : hasErrors ? 'border-rose-500/40 bg-slate-950/60' : 'border-slate-800 bg-slate-950/60'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${complete ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
          {complete ? <Check className="w-4 h-4" /> : index + 1}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-white truncate">Entrada {index + 1}{name && ` · ${name}`}</span>
          <span className={`block text-[11px] ${complete ? 'text-emerald-300/80' : hasErrors ? 'text-rose-300' : 'text-slate-500'}`}>
            {complete ? `${formatRut(value.rut)} · ${formatPhoneDisplay(PHONE_PREFIX + value.telefono)}` : hasErrors ? 'Revisa los datos marcados' : 'Completa los datos del asistente'}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          {(onFillMine || onCopyContact) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {onFillMine && (
                <button type="button" onClick={onFillMine} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20">
                  <UserRound className="w-3.5 h-3.5" /> Usar mis datos
                </button>
              )}
              {onCopyContact && (
                <button type="button" onClick={onCopyContact} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">
                  <Copy className="w-3.5 h-3.5" /> Mismo celular y correo de la entrada 1
                </button>
              )}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field id={id('nombre')} label="Nombre" error={errors.nombre}>
              <input id={id('nombre')} value={value.nombre} onChange={(e) => onChange('nombre', e.target.value)} maxLength={50} autoComplete="given-name" placeholder="Ej. María José" className={inputClass(errors.nombre)} />
            </Field>
            <Field id={id('apellido')} label="Apellido" error={errors.apellido}>
              <input id={id('apellido')} value={value.apellido} onChange={(e) => onChange('apellido', e.target.value)} maxLength={50} autoComplete="family-name" placeholder="Ej. Pérez Soto" className={inputClass(errors.apellido)} />
            </Field>
            <Field id={id('rut')} label="RUT" error={errors.rut}>
              <input id={id('rut')} value={value.rut} onChange={(e) => onChange('rut', formatRut(e.target.value))} inputMode="text" placeholder="12.345.678-5" className={inputClass(errors.rut)} />
            </Field>
            <Field id={id('telefono')} label="Celular" error={errors.telefono}>
              <div className={`flex items-center ${inputClass(errors.telefono)} p-0`}>
                <span className="pl-3 pr-2 text-sm text-slate-400 border-r border-slate-700 select-none">{PHONE_PREFIX}</span>
                <input id={id('telefono')} value={value.telefono} onChange={(e) => onChange('telefono', formatLocalPhone(e.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="9 1234 5678" className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none" />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field id={id('correo')} label="Correo" error={errors.correo} hint="Aquí enviaremos la entrada">
                <input id={id('correo')} type="email" value={value.correo} onChange={(e) => onChange('correo', e.target.value)} maxLength={120} autoComplete="email" placeholder="nombre@correo.cl" className={inputClass(errors.correo)} />
              </Field>
            </div>
          </div>
          {!last && (
            <div className="flex justify-end mt-3">
              <button type="button" onClick={onNext} className="px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500">Listo, siguiente entrada</button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const inputClass = (error?: string) =>
  `w-full px-3 py-2.5 text-sm bg-slate-900 border rounded-xl text-white focus-within:border-indigo-500 focus:outline-none focus:border-indigo-500 ${error ? 'border-rose-500/70' : 'border-slate-700'}`;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-1">{label} <span className="text-rose-400">*</span></label>
      {children}
      {error ? <p className="text-[11px] text-rose-300 mt-1">{error}</p> : hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function PaymentOption({ title, subtitle, icon: Icon, selected, disabled }: {
  title: string; subtitle: string; icon: React.ElementType; selected?: boolean; disabled?: boolean;
}) {
  return (
    <div
      aria-disabled={disabled}
      className={`flex items-center gap-3 p-3.5 rounded-2xl border ${selected ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/60'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-emerald-400' : 'border-slate-600'}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
      </span>
      <Icon className={`w-5 h-5 ${selected ? 'text-emerald-300' : 'text-slate-500'}`} />
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="block text-[11px] text-slate-400">{subtitle}</span>
      </span>
    </div>
  );
}

function Success({ compra, free, onViewTickets, onClose }: { compra: Compra; free: boolean; onViewTickets: () => void; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <span className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
        <PartyPopper className="w-8 h-8 text-emerald-300" />
      </span>
      <h3 className="text-xl font-extrabold text-white">{free ? '¡Asistencia confirmada!' : '¡Compra exitosa!'}</h3>
      <p className="text-sm text-slate-400 mt-1">
        Código de {free ? 'confirmación' : 'compra'} <span className="font-mono font-bold text-slate-200">{compra.codigo}</span>
      </p>
      <ul className="mt-5 w-full space-y-2 text-left">
        {compra.entradas.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white truncate">{e.nombre} {e.apellido}</span>
              <span className="block text-[11px] text-slate-500">{formatRut(e.rut)}</span>
            </span>
            <span className="font-mono text-sm font-bold text-indigo-200 tracking-wider">{e.codigo}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500 mt-3">Presenta el código de cada entrada y la cédula de identidad en el acceso.</p>
      <div className="mt-5 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button onClick={onViewTickets} className="px-5 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500">Ver mis entradas</button>
        <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700">Seguir explorando</button>
      </div>
    </div>
  );
}
