'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  X, Check, ChevronLeft, ChevronRight, Loader2, Search, MapPin, CalendarDays, Clock, Ticket, Gift,
  ImagePlus, Trash2, RefreshCw, Pencil, Eye, Sparkles,
} from 'lucide-react';
import EventCard from './EventCard';
import {
  EVENT_LIMITS, EventFormState, FieldErrors, STEPS, finalPrice, toDateTime, validateStep,
} from './eventRules';
import { Category, EventItem, EventPayload, createEvent, formatPrice, imageSrc, updateEvent } from '../../services/events';
import { PlaceResult, reverseGeocode, searchPlaces } from '../../utils/geocoding';

const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">Cargando mapa…</div>,
});

const DEFAULT_LOCATION = { lat: -33.4372, lng: -70.6506 }; // Santiago centro

interface EventFormModalProps {
  categories: Category[];
  event?: EventItem; // si viene, el formulario edita ese evento
  initialLocation?: { lat: number; lng: number } | null; // punto elegido con clic derecho en el mapa
  onClose: () => void;
  onSaved: (event: EventItem, created: boolean) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function initialState(event?: EventItem, location?: { lat: number; lng: number } | null): EventFormState {
  if (event) {
    const d = new Date(event.date);
    return {
      title: event.title,
      categoryId: event.category.id,
      description: event.description ?? '',
      date: toLocalDate(d),
      time: toLocalTime(d),
      address: event.address,
      latitude: event.latitude,
      longitude: event.longitude,
      isFree: event.price === 0,
      price: event.price === 0 ? '' : String(event.price),
      image: null,
      currentImageUrl: event.imageUrl ?? null,
      removeImage: false,
    };
  }
  const tomorrow = new Date(Date.now() + 864e5);
  return {
    title: '',
    categoryId: '',
    description: '',
    date: toLocalDate(tomorrow),
    time: '19:00',
    address: '',
    latitude: location?.lat ?? DEFAULT_LOCATION.lat,
    longitude: location?.lng ?? DEFAULT_LOCATION.lng,
    isFree: true,
    price: '',
    image: null,
    currentImageUrl: null,
    removeImage: false,
  };
}

// Atajos de fecha: hoy, mañana y el próximo sábado
function quickDates() {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 864e5);
  const saturday = new Date();
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7 || 7));
  return [
    { label: 'Hoy', value: toLocalDate(today) },
    { label: 'Mañana', value: toLocalDate(tomorrow) },
    { label: 'Este sábado', value: toLocalDate(saturday) },
  ];
}

export default function EventFormModal({ categories, event, initialLocation, onClose, onSaved }: EventFormModalProps) {
  const isEdit = !!event;
  const initial = useMemo(() => initialState(event, initialLocation), [event, initialLocation]);
  const [form, setForm] = useState<EventFormState>(initial);
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(isEdit ? STEPS.length - 1 : 0);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const set = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const dirty = JSON.stringify({ ...form, image: form.image?.name }) !== JSON.stringify({ ...initial, image: undefined });

  // Al editar, una fecha que no cambió puede quedar en el pasado (la corrige un admin, por ejemplo)
  const dateUnchanged = isEdit && form.date === initial.date && form.time === initial.time;
  const errorsFor = (s: number): FieldErrors => {
    const e = validateStep(s, form);
    if (s === 1 && dateUnchanged && e.date === 'La fecha y hora deben ser futuras') delete e.date;
    return e;
  };
  const errors = errorsFor(step);
  const err = (key: keyof EventFormState) => (showErrors ? errors[key] : undefined);

  // Vista previa local de la imagen elegida
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!form.image) return setPreview(null);
    const url = URL.createObjectURL(form.image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.image]);

  const requestClose = () => (dirty && !saving ? setConfirmDiscard(true) : onClose());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const goTo = (target: number) => {
    // Hacia atrás siempre se puede; hacia adelante, solo si los pasos intermedios están completos
    if (target > step) {
      for (let s = step; s < target; s++) {
        if (Object.keys(errorsFor(s)).length) {
          setStep(s);
          setShowErrors(true);
          return;
        }
      }
    }
    setShowErrors(false);
    setStep(target);
    setMaxVisited((m) => Math.max(m, target));
  };

  const submit = async () => {
    for (let s = 0; s < STEPS.length - 1; s++) {
      if (Object.keys(errorsFor(s)).length) {
        setStep(s);
        setShowErrors(true);
        return;
      }
    }
    setSaving(true);
    setSubmitError(null);
    const payload: EventPayload = {
      title: form.title.normalize('NFC').trim(),
      description: form.description.normalize('NFC').trim(),
      categoryId: form.categoryId,
      date: toDateTime(form.date, form.time)!.toISOString(),
      address: form.address.normalize('NFC').trim(),
      latitude: Number(form.latitude.toFixed(6)),
      longitude: Number(form.longitude.toFixed(6)),
      price: finalPrice(form),
      image: form.image,
      ...(isEdit && form.removeImage && !form.image ? { removeImage: true } : {}),
    };
    try {
      const saved = isEdit ? await updateEvent(event!.id, payload) : await createEvent(payload);
      onSaved(saved, !isEdit);
    } catch (e: any) {
      setSubmitError(e.message || 'No se pudo guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  const category = categories.find((c) => c.id === form.categoryId);
  const when = toDateTime(form.date, form.time);
  const shownImage = preview ?? (form.removeImage ? null : imageSrc(form.currentImageUrl));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="event-form-title">
      <div className="relative w-full max-w-5xl max-h-[95vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white overflow-hidden">
        {/* Encabezado y pasos */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 id="event-form-title" className="text-xl font-bold tracking-tight flex items-center gap-2">
                {isEdit ? <Pencil className="w-5 h-5 text-indigo-300" /> : <Sparkles className="w-5 h-5 text-emerald-300" />}
                {isEdit ? 'Editar evento' : 'Crear un evento'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{STEPS[step].subtitle}</p>
            </div>
            <button onClick={requestClose} aria-label="Cerrar" className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <ol className="grid grid-cols-4 gap-2" aria-label="Pasos">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              const reachable = i <= maxVisited || i === step + 1;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => reachable && goTo(i)}
                    disabled={!reachable}
                    aria-current={current ? 'step' : undefined}
                    className="w-full text-left group disabled:cursor-not-allowed"
                  >
                    <span className={`block h-1 rounded-full mb-2 transition-colors ${current ? 'bg-indigo-500' : done ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                          done ? 'bg-emerald-500 text-slate-950' : current ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {done ? <Check className="w-3 h-3" /> : i + 1}
                      </span>
                      <span className={`text-xs font-semibold truncate hidden sm:inline ${current ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {s.title}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Contenido + vista previa */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-5 gap-6 p-5 sm:p-6">
            <div className="lg:col-span-3 space-y-5">
              {step === 0 && (
                <>
                  <Field label="Título del evento" error={err('title')} counter={`${form.title.trim().length}/${EVENT_LIMITS.titleMax}`}>
                    <input
                      autoFocus
                      value={form.title}
                      maxLength={EVENT_LIMITS.titleMax}
                      onChange={(e) => set('title', e.target.value)}
                      placeholder="Ej. Feria costumbrista de primavera"
                      className={inputClass(!!err('title'))}
                    />
                  </Field>

                  <Field label="Categoría" error={err('categoryId')}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Categoría">
                      {categories.map((c) => {
                        const selected = form.categoryId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => set('categoryId', c.id)}
                            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                              selected ? 'border-indigo-500 bg-indigo-500/15 text-white' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span className="truncate">{c.name}</span>
                            {selected && <Check className="w-4 h-4 text-indigo-300 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field
                    label="Descripción"
                    error={err('description')}
                    hint="Qué harán los asistentes, para quién es y qué deben llevar"
                    counter={`${form.description.trim().length}/${EVENT_LIMITS.descriptionMax}`}
                    counterOk={form.description.trim().length >= EVENT_LIMITS.descriptionMin}
                  >
                    <textarea
                      rows={5}
                      value={form.description}
                      maxLength={EVENT_LIMITS.descriptionMax}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="Ej. Feria con artesanos locales, música en vivo y comida típica. Entrada apta para toda la familia y mascotas."
                      className={`${inputClass(!!err('description'))} resize-y min-h-[120px]`}
                    />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Fecha" error={err('date')}>
                      <div className="relative">
                        <CalendarDays className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
                        <input
                          type="date"
                          value={form.date}
                          min={dateUnchanged ? undefined : toLocalDate(new Date())}
                          onChange={(e) => set('date', e.target.value)}
                          className={`${inputClass(!!err('date'))} pl-9 [color-scheme:dark]`}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {quickDates().map((q) => (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => set('date', q.value)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                              form.date === q.value ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200' : 'border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Hora de inicio" error={err('time')}>
                      <div className="relative">
                        <Clock className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
                        <input
                          type="time"
                          value={form.time}
                          step={300}
                          onChange={(e) => set('time', e.target.value)}
                          className={`${inputClass(!!err('time'))} pl-9 [color-scheme:dark]`}
                        />
                      </div>
                    </Field>
                  </div>

                  <LocationField form={form} set={set} setForm={setForm} error={err('address')} />
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Entrada">
                    <div className="grid grid-cols-2 gap-3">
                      <ChoiceCard
                        selected={form.isFree}
                        onClick={() => set('isFree', true)}
                        icon={<Gift className="w-5 h-5" />}
                        title="Gratis"
                        text="Entrada liberada, sin reserva de pago"
                      />
                      <ChoiceCard
                        selected={!form.isFree}
                        onClick={() => set('isFree', false)}
                        icon={<Ticket className="w-5 h-5" />}
                        title="Con valor"
                        text="Los asistentes reservan su entrada"
                      />
                    </div>
                  </Field>

                  {!form.isFree && (
                    <Field label="Valor de la entrada (CLP)" error={err('price')}>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm text-slate-400 pointer-events-none">$</span>
                        <input
                          inputMode="numeric"
                          autoFocus
                          value={form.price ? Number(form.price).toLocaleString('es-CL') : ''}
                          onChange={(e) => set('price', e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 8))}
                          placeholder="5.000"
                          className={`${inputClass(!!err('price'))} pl-7`}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[2000, 5000, 10000, 15000].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => set('price', String(v))}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                              Number(form.price) === v ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200' : 'border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            ${v.toLocaleString('es-CL')}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}

                  <ImageField form={form} set={set} shownImage={shownImage} />
                </>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <SummaryRow label="Título y categoría" onEdit={() => goTo(0)}>
                    <span className="font-semibold text-white">{form.title.trim()}</span> · {category?.name}
                  </SummaryRow>
                  <SummaryRow label="Descripción" onEdit={() => goTo(0)}>
                    <span className="line-clamp-3 whitespace-pre-line">{form.description.trim()}</span>
                  </SummaryRow>
                  <SummaryRow label="Fecha y hora" onEdit={() => goTo(1)}>
                    {when?.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short' })}
                  </SummaryRow>
                  <SummaryRow label="Ubicación" onEdit={() => goTo(1)}>
                    {form.address.trim()}
                  </SummaryRow>
                  <SummaryRow label="Entrada" onEdit={() => goTo(2)}>
                    {formatPrice(finalPrice(form))}
                  </SummaryRow>
                  <SummaryRow label="Imagen de portada" onEdit={() => goTo(2)}>
                    {form.image ? form.image.name : shownImage ? 'Imagen actual' : 'Sin imagen (opcional)'}
                  </SummaryRow>
                  <p className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <Eye className="w-4 h-4 shrink-0 text-slate-500" />
                    {isEdit
                      ? 'Los cambios se verán de inmediato en el catálogo.'
                      : 'Tu evento se publicará de inmediato en el catálogo y en el mapa.'}
                  </p>
                </div>
              )}
            </div>

            {/* Vista previa en vivo */}
            <aside className="lg:col-span-2">
              <div className="lg:sticky lg:top-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Vista previa
                </p>
                <EventCard
                  placeholderImage
                  event={{
                    title: form.title.trim(),
                    description: form.description.trim(),
                    price: finalPrice(form),
                    date: when && !Number.isNaN(when.getTime()) ? when.toISOString() : '',
                    address: form.address.trim(),
                    categoryName: category?.name,
                    imagePreview: shownImage,
                    status: event?.status,
                    statusReason: event?.statusReason,
                  }}
                />
                <p className="text-[11px] text-slate-500 mt-2">Así verán los asistentes tu evento en el catálogo.</p>
              </div>
            </aside>
          </div>
        </div>

        {/* Pie con navegación */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-900">
          {confirmDiscard ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-amber-200">¿Salir sin guardar? Se perderán los cambios.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmDiscard(false)} className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
                  Seguir editando
                </button>
                <button onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500">
                  Salir sin guardar
                </button>
              </div>
            </div>
          ) : (
            <>
              {submitError && (
                <p className="mb-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{submitError}</p>
              )}
              {showErrors && Object.keys(errors).length > 0 && (
                <p className="mb-3 text-xs text-amber-200">Revisa los campos marcados para continuar.</p>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => (step === 0 ? requestClose() : goTo(step - 1))}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  {step === 0 ? 'Cancelar' : <><ChevronLeft className="w-4 h-4" /> Atrás</>}
                </button>
                <span className="text-xs text-slate-500 hidden sm:inline">Paso {step + 1} de {STEPS.length}</span>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goTo(step + 1)}
                    className="flex items-center gap-1 px-5 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-60 transition-colors"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isEdit ? 'Guardar cambios' : 'Publicar evento'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
    hasError ? 'border-rose-500/70 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
  }`;

function Field({
  label, error, hint, counter, counterOk, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  counter?: string;
  counterOk?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {(error || hint || counter) && (
        <div className="flex justify-between gap-3 mt-1 text-[11px]">
          <span className={error ? 'text-rose-400' : 'text-slate-500'}>{error ?? hint}</span>
          {counter && <span className={`shrink-0 tabular-nums ${counterOk ? 'text-emerald-400' : 'text-slate-500'}`}>{counter}</span>}
        </div>
      )}
    </div>
  );
}

function ChoiceCard({ selected, onClick, icon, title, text }: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-start gap-3 text-left p-3.5 rounded-xl border transition-colors ${
        selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'
      }`}
    >
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-indigo-500/20 text-indigo-200' : 'bg-slate-800 text-slate-400'}`}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="block text-xs text-slate-400">{text}</span>
      </span>
    </button>
  );
}

function SummaryRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
        <div className="text-sm text-slate-300 mt-0.5 break-words">{children}</div>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-xs font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1">
        <Pencil className="w-3.5 h-3.5" /> Editar
      </button>
    </div>
  );
}

// Dirección con búsqueda y mapa: buscar mueve el pin; mover el pin completa la dirección
function LocationField({ form, set, setForm, error }: {
  form: EventFormState;
  set: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const reverseAbort = useRef<AbortController | null>(null);

  // Búsqueda con espera mientras se escribe
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query.trim(), controller.signal));
        setGeoError(null);
      } catch (e: any) {
        if (e.name !== 'AbortError') setGeoError('No pudimos buscar direcciones ahora. Puedes escribirla a mano y ubicar el pin en el mapa.');
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const moveTo = async (lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    reverseAbort.current?.abort();
    const controller = new AbortController();
    reverseAbort.current = controller;
    setResolving(true);
    try {
      const label = await reverseGeocode(lat, lng, controller.signal);
      if (label) set('address', label);
    } catch {
      // Sin conexión con el servicio: se mantiene la dirección escrita
    } finally {
      if (reverseAbort.current === controller) setResolving(false);
    }
  };

  const pick = (place: PlaceResult) => {
    setForm((prev) => ({ ...prev, latitude: place.lat, longitude: place.lng, address: place.label }));
    setQuery('');
    setResults([]);
  };

  return (
    <div className="space-y-3">
      <Field label="Ubicación" error={error ?? geoError ?? undefined} hint="Busca la dirección o haz clic en el mapa; puedes arrastrar el pin para ajustarlo">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar dirección o lugar (ej. Parque Quinta Normal)"
            className={`${inputClass(false)} pl-9`}
            aria-autocomplete="list"
          />
          {searching && <Loader2 className="w-4 h-4 absolute right-3 top-3 text-slate-500 animate-spin" />}
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden" role="listbox">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-start gap-2"
                  >
                    <MapPin className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" /> {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <div className="h-64 rounded-xl overflow-hidden border border-slate-800 relative">
        <LocationPicker lat={form.latitude} lng={form.longitude} onChange={moveTo} />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
          Dirección que verán los asistentes
          {resolving && <span className="flex items-center gap-1 text-slate-500 font-normal"><Loader2 className="w-3 h-3 animate-spin" /> buscando dirección…</span>}
        </label>
        <div className="relative">
          <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
          <input
            value={form.address}
            maxLength={EVENT_LIMITS.addressMax}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Ej. Av. Matucana 520, Santiago"
            className={`${inputClass(!!error)} pl-9`}
          />
        </div>
      </div>
    </div>
  );
}

// Imagen de portada: arrastrar o elegir, con vista previa y validación de tipo y tamaño
function ImageField({ form, set, shownImage }: {
  form: EventFormState;
  set: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;
  shownImage: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (file?: File | null) => {
    if (!file) return;
    if (!/\.(jpe?g|png)$/i.test(file.name)) return setError('Usa una imagen .jpg o .png');
    if (file.size > EVENT_LIMITS.imageMaxBytes) return setError('La imagen supera los 5 MB');
    setError(null);
    set('image', file);
    set('removeImage', false);
  };

  return (
    <Field label="Imagen de portada (opcional)" error={error ?? undefined} hint="JPG o PNG de hasta 5 MB. Ideal horizontal (16:9)">
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
      {shownImage ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-800 group">
          <img src={shownImage} alt="Portada del evento" className="w-full h-48 object-cover" />
          <div className="absolute inset-x-0 bottom-0 p-2 flex justify-end gap-2 bg-gradient-to-t from-black/80 to-transparent">
            <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900/90 hover:bg-slate-800">
              <RefreshCw className="w-3.5 h-3.5" /> Cambiar
            </button>
            <button
              type="button"
              onClick={() => { set('image', null); set('removeImage', true); if (inputRef.current) inputRef.current.value = ''; }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900/90 hover:bg-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" /> Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files?.[0]); }}
          className={`w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-sm transition-colors ${
            dragging ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500'
          }`}
        >
          <ImagePlus className="w-7 h-7" />
          <span><strong className="text-slate-200">Elige una imagen</strong> o arrástrala aquí</span>
        </button>
      )}
    </Field>
  );
}
