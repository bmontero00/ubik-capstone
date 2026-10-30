'use client';

import React, { useState } from 'react';
import {
  X, Lock, Mail, User as UserIcon, Loader2, Ticket, CalendarPlus, ArrowLeft, ShieldCheck,
  Phone, IdCard, Building2, Link2, Eye, EyeOff, Check, Hourglass, Info, Ban, CircleX, RotateCcw, FilePlus,
} from 'lucide-react';
import {
  ApiError, AuthResponse, RegisterPayload, RejectedInfo, SuspendedInfo,
  loginUser, reapplyOrganizer, registerUser,
} from '../services/auth';
import { formatRut, isValidRut, isValidChileanMobile } from '../utils/rut';
import { formatDate } from '../utils/labels';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: AuthResponse) => void;
  // Si la sesión se cerró porque la cuenta fue suspendida, se abre directo en ese aviso
  initialSuspended?: SuspendedInfo | null;
}

type View = 'login' | 'chooseType' | 'register' | 'submitted' | 'suspended' | 'rejected';
type AccountType = RegisterPayload['accountType'];
type ReapplyMode = 'resume' | 'fresh' | null;

const MIN_DESCRIPTION = 30;

const emptyForm = {
  name: '',
  email: '',
  password: '',
  rut: '',
  phone: '',
  organizationName: '',
  eventDescription: '',
  socialUrl: '',
  acceptsTerms: false,
};
type FormState = typeof emptyForm;
type FieldErrors = Partial<Record<keyof FormState, string>>;

// Se monta solo mientras está abierto, así cada apertura parte con el formulario vacío
export default function AuthModal({ isOpen, onClose, onSuccess, initialSuspended = null }: AuthModalProps) {
  const [view, setView] = useState<View>(initialSuspended ? 'suspended' : 'login');
  const [accountType, setAccountType] = useState<AccountType>('ATTENDEE');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailConflict, setEmailConflict] = useState(false);
  const [suspended, setSuspended] = useState<SuspendedInfo | null>(initialSuspended);
  const [rejected, setRejected] = useState<RejectedInfo | null>(null);
  const [reapplyMode, setReapplyMode] = useState<ReapplyMode>(null);

  if (!isOpen) return null;

  const isOrganizer = view === 'register' && accountType === 'ORGANIZER';
  const isReapply = view === 'register' && reapplyMode !== null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const markTouched = (key: keyof FormState) => setTouched((prev) => ({ ...prev, [key]: true }));

  const goTo = (next: View) => {
    setView(next);
    setError(null);
    setEmailConflict(false);
    setSubmitAttempted(false);
    setTouched({});
  };

  const chooseType = (type: AccountType) => {
    setAccountType(type);
    setReapplyMode(null);
    goTo('register');
  };

  // Re-postulación: retoma los datos rechazados o parte de cero (el correo se mantiene)
  const startReapply = (mode: Exclude<ReapplyMode, null>) => {
    if (!rejected) return;
    const app = rejected.application;
    setForm(
      mode === 'resume'
        ? {
            ...emptyForm,
            name: app.name,
            email: app.email,
            rut: formatRut(app.rut),
            phone: app.phone,
            organizationName: app.organizationName ?? '',
            eventDescription: app.eventDescription,
            socialUrl: app.socialUrl ?? '',
          }
        : { ...emptyForm, email: app.email },
    );
    setAccountType('ORGANIZER');
    setReapplyMode(mode);
    goTo('register');
  };

  // Validación en el cliente para dar feedback inmediato (el backend vuelve a validar)
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (view === 'register' && !form.name.trim()) errors.name = 'Ingresa tu nombre completo';
    if (!isReapply) {
      if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Ingresa un correo válido';
      if (form.password.length < 6) errors.password = 'Mínimo 6 caracteres';
    }

    if (isOrganizer) {
      if (!isValidRut(form.rut)) errors.rut = 'RUT inválido, revisa el dígito verificador';
      if (!isValidChileanMobile(form.phone)) errors.phone = 'Usa un celular chileno, ej: +56 9 1234 5678';
      if (form.eventDescription.trim().length < MIN_DESCRIPTION) {
        errors.eventDescription = `Cuéntanos un poco más (mínimo ${MIN_DESCRIPTION} caracteres)`;
      }
      if (form.socialUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(form.socialUrl.trim())) {
        errors.socialUrl = 'El enlace debe comenzar con https://';
      }
      if (!form.acceptsTerms) errors.acceptsTerms = 'Debes confirmar que tus datos son verídicos';
    }
    return errors;
  };

  const errors = validate();
  const visibleError = (key: keyof FormState) => ((touched[key] || submitAttempted) ? errors[key] : undefined);

  const organizerFields = () => ({
    rut: form.rut,
    phone: form.phone.trim(),
    eventDescription: form.eventDescription.trim(),
    organizationName: form.organizationName.trim() || undefined,
    socialUrl: form.socialUrl.trim() || undefined,
    acceptsTerms: form.acceptsTerms,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setError(null);
    setEmailConflict(false);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      if (view === 'login') {
        onSuccess(await loginUser(form.email, form.password));
        onClose();
        return;
      }

      if (isReapply && rejected) {
        onSuccess(await reapplyOrganizer({ reapplyToken: rejected.reapplyToken, name: form.name.trim(), ...organizerFields() }));
        setView('submitted');
        return;
      }

      const payload: RegisterPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        accountType,
        ...(accountType === 'ORGANIZER' ? organizerFields() : {}),
      };
      onSuccess(await registerUser(payload));
      // Al organizador le explicamos qué pasa con su solicitud antes de cerrar
      if (accountType === 'ORGANIZER') setView('submitted');
      else onClose();
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_SUSPENDED') {
        setSuspended(err.data);
        goTo('suspended');
      } else if (err instanceof ApiError && err.code === 'ORGANIZER_REJECTED') {
        setRejected(err.data);
        goTo('rejected');
      } else {
        setError(err.message || 'Error en la solicitud');
        setEmailConflict(err instanceof ApiError && err.code === 'EMAIL_IN_USE');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (key: keyof FormState) =>
    `w-full bg-slate-950 border rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
      visibleError(key) ? 'border-rose-500/70 focus:border-rose-500' : 'border-slate-800 focus:border-emerald-500'
    }`;

  const renderField = (
    key: keyof FormState,
    label: string,
    icon: React.ReactNode,
    input: React.ReactNode,
    hint?: string,
  ) => (
    <div>
      <label htmlFor={`auth-${key}`} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-3 text-slate-500">{icon}</span>
        {input}
      </div>
      {visibleError(key) ? (
        <p className="text-[11px] text-rose-400 mt-1">{visibleError(key)}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-500 mt-1">{hint}</p>
      ) : null}
    </div>
  );

  const iconClass = 'w-4 h-4';
  const isWide = view === 'chooseType' || isOrganizer;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full ${isWide ? 'max-w-xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-white transition-[max-width]`}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {view === 'suspended' && suspended && (
          <div className="text-center py-2">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-300">
              <Ban className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Cuenta suspendida</h2>
            <p className="text-sm text-slate-400 mb-1">Tu cuenta se encuentra suspendida y no puedes iniciar sesión.</p>
            <p className="text-sm text-slate-400 mb-4">
              Para dudas o consultas envía un correo a{' '}
              <a href={`mailto:${suspended.supportEmail}`} className="text-emerald-400 hover:underline font-semibold">
                {suspended.supportEmail}
              </a>
              .
            </p>
            <ReasonToggle
              reason={suspended.reason}
              dateLabel="Suspendida el"
              date={suspended.suspendedAt}
              tone="rose"
            />
            <button
              onClick={() => goTo('login')}
              className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}

        {view === 'rejected' && rejected && (
          <div className="py-2">
            <h2 className="text-2xl font-bold text-center tracking-tight mb-2">Cuenta de organizador</h2>
            <p className="text-sm text-slate-400 text-center mb-5">Revisa el estado de tu solicitud para continuar</p>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 mb-5">
              <div className="flex gap-3">
                <CircleX className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1 text-sm text-rose-100">
                  <p className="font-semibold text-rose-200">
                    La creación de tu cuenta de organizador fue rechazada por un administrador.
                  </p>
                  <ReasonToggle reason={rejected.reason} dateLabel="Revisada el" date={rejected.reviewedAt} tone="rose" compact />
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              Puedes volver a postular corrigiendo tu información. ¿Cómo quieres continuar?
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={() => startReapply('resume')}
                className="flex flex-col items-start text-left gap-1 p-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold"><RotateCcw className="w-4 h-4" /> Retomar última solicitud</span>
                <span className="text-xs text-slate-900/80">Tus datos anteriores quedan cargados para corregir lo necesario</span>
              </button>
              <button
                onClick={() => startReapply('fresh')}
                className="flex flex-col items-start text-left gap-1 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold"><FilePlus className="w-4 h-4" /> Crear desde cero</span>
                <span className="text-xs text-slate-400">Comienza con el formulario vacío</span>
              </button>
            </div>

            <div className="mt-6 text-center text-xs text-slate-400">
              <button type="button" onClick={() => goTo('login')} className="text-emerald-400 hover:underline font-semibold">
                Volver al inicio de sesión
              </button>
            </div>
          </div>
        )}

        {view === 'chooseType' && (
          <>
            <h2 className="text-2xl font-bold text-center tracking-tight mb-2">¿Cómo quieres usar UBIK?</h2>
            <p className="text-sm text-slate-400 text-center mb-6">Elige el tipo de cuenta que mejor te represente</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <AccountTypeCard
                icon={<Ticket className="w-6 h-6" />}
                accent="emerald"
                title="Quiero asistir"
                subtitle="Cuenta de asistente"
                features={['Descubre eventos cerca de ti', 'Compra o reserva entradas', 'Revisa tu historial de eventos']}
                footer="Acceso inmediato"
                onClick={() => chooseType('ATTENDEE')}
              />
              <AccountTypeCard
                icon={<CalendarPlus className="w-6 h-6" />}
                accent="indigo"
                title="Quiero organizar"
                subtitle="Cuenta de organizador"
                features={['Publica tus propios eventos', 'Modifica o cancela tus eventos', 'Revisa reportes de asistencia']}
                footer="Requiere verificación"
                onClick={() => chooseType('ORGANIZER')}
              />
            </div>

            <div className="mt-6 text-center text-xs text-slate-400">
              ¿Ya tienes una cuenta?{' '}
              <button type="button" onClick={() => goTo('login')} className="text-emerald-400 hover:underline font-semibold ml-1">
                Inicia sesión
              </button>
            </div>
          </>
        )}

        {view === 'submitted' && (
          <div className="text-center py-2">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Hourglass className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">
              {reapplyMode ? '¡Nueva solicitud enviada!' : '¡Solicitud enviada!'}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              {reapplyMode
                ? 'Un administrador revisará nuevamente tus datos antes de que puedas publicar eventos.'
                : 'Tu cuenta ya está creada. Un administrador revisará tus datos antes de que puedas publicar eventos.'}
            </p>

            <ol className="text-left space-y-3 bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6">
              <Step state="done" title={reapplyMode ? 'Solicitud corregida' : 'Cuenta creada'} text="Ya puedes iniciar sesión con tu correo." />
              <Step state="current" title="Revisión del administrador" text="Validamos tu identidad para evitar eventos falsos." />
              <Step state="next" title="Publica tus eventos" text="Te mostraremos el aviso en tu panel cuando seas aprobado." />
            </ol>

            <button
              onClick={onClose}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl transition-all"
            >
              Entendido, explorar eventos
            </button>
          </div>
        )}

        {(view === 'login' || view === 'register') && (
          <>
            {view === 'register' && (
              <button
                type="button"
                onClick={() => goTo(isReapply ? 'rejected' : 'chooseType')}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {isReapply ? 'Volver' : 'Cambiar tipo de cuenta'}
              </button>
            )}

            <h2 className="text-2xl font-bold text-center tracking-tight mb-2">
              {view === 'login'
                ? 'Bienvenido a UBIK'
                : isReapply
                  ? 'Nueva solicitud de organizador'
                  : isOrganizer
                    ? 'Cuenta de organizador'
                    : 'Crear cuenta en UBIK'}
            </h2>
            <p className="text-sm text-slate-400 text-center mb-6">
              {view === 'login'
                ? 'Accede para descubrir y gestionar eventos en tu zona'
                : isReapply
                  ? reapplyMode === 'resume'
                    ? 'Revisa y corrige los datos de tu última solicitud'
                    : 'Completa nuevamente tus datos de verificación'
                  : isOrganizer
                    ? 'Completa tus datos y los de verificación para publicar eventos'
                    : 'Únete para encontrar eventos culturales y comunitarios'}
            </p>

            {isReapply && rejected && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-100">
                Tu solicitud anterior fue rechazada.
                <ReasonToggle reason={rejected.reason} dateLabel="Revisada el" date={rejected.reviewedAt} tone="rose" compact />
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
                {error}
                {emailConflict && (
                  <button
                    type="button"
                    onClick={() => { setForm((prev) => ({ ...emptyForm, email: prev.email })); goTo('login'); }}
                    className="block mt-2 text-emerald-400 hover:underline font-semibold text-xs"
                  >
                    Iniciar sesión con este correo
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {isOrganizer && (
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Tus datos</p>
              )}

              {view === 'register' &&
                renderField('name', 'Nombre completo', <UserIcon className={iconClass} />,
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    onBlur={() => markTouched('name')}
                    placeholder="Ej. Juan Acevedo"
                    className={inputClass('name')}
                  />,
                  isOrganizer ? 'Debe coincidir con el de tu cédula de identidad' : undefined,
                )}

              {renderField('email', 'Correo electrónico', <Mail className={iconClass} />,
                <input
                  id="auth-email"
                  type="email"
                  autoComplete={view === 'login' ? 'username' : 'email'}
                  value={form.email}
                  disabled={isReapply}
                  onChange={(e) => setField('email', e.target.value)}
                  onBlur={() => markTouched('email')}
                  placeholder="tu@correo.cl"
                  className={inputClass('email')}
                />,
                isReapply ? 'La solicitud se asocia a tu cuenta existente' : undefined,
              )}

              {!isReapply &&
                renderField('password', 'Contraseña', <Lock className={iconClass} />,
                  <>
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                      onBlur={() => markTouched('password')}
                      placeholder="••••••••"
                      className={`${inputClass('password')} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className={iconClass} /> : <Eye className={iconClass} />}
                    </button>
                  </>,
                  view === 'register' ? 'Mínimo 6 caracteres' : undefined,
                )}

              {isOrganizer && (
                <>
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-3 mb-3">2. Verificación de organizador</p>
                    <div className="flex gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-200 leading-relaxed">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-300" />
                      <span>
                        Para mantener la comunidad segura, un administrador revisa a cada organizador antes de que pueda
                        publicar eventos. Estos datos solo los ve el equipo de UBIK.
                      </span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {renderField('rut', 'RUT', <IdCard className={iconClass} />,
                      <input
                        id="auth-rut"
                        type="text"
                        inputMode="text"
                        value={form.rut}
                        onChange={(e) => setField('rut', formatRut(e.target.value))}
                        onBlur={() => markTouched('rut')}
                        placeholder="12.345.678-5"
                        className={inputClass('rut')}
                      />,
                    )}
                    {renderField('phone', 'Celular', <Phone className={iconClass} />,
                      <input
                        id="auth-phone"
                        type="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        onBlur={() => markTouched('phone')}
                        placeholder="+56 9 1234 5678"
                        className={inputClass('phone')}
                      />,
                    )}
                  </div>

                  {renderField('organizationName', 'Organización o colectivo (opcional)', <Building2 className={iconClass} />,
                    <input
                      id="auth-organizationName"
                      type="text"
                      autoComplete="organization"
                      value={form.organizationName}
                      onChange={(e) => setField('organizationName', e.target.value)}
                      placeholder="Ej. Junta de Vecinos Barrio Yungay"
                      className={inputClass('organizationName')}
                    />,
                    'Si organizas a título personal, déjalo en blanco',
                  )}

                  <div>
                    <label htmlFor="auth-eventDescription" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      ¿Qué tipo de eventos organizarás?
                    </label>
                    <textarea
                      id="auth-eventDescription"
                      rows={3}
                      value={form.eventDescription}
                      onChange={(e) => setField('eventDescription', e.target.value)}
                      onBlur={() => markTouched('eventDescription')}
                      placeholder="Ej. Ferias costumbristas mensuales en la plaza del barrio, con artesanos y comida local."
                      className={`${inputClass('eventDescription')} pl-3 resize-none`}
                    />
                    <div className="flex justify-between mt-1 text-[11px]">
                      <span className={visibleError('eventDescription') ? 'text-rose-400' : 'text-slate-500'}>
                        {visibleError('eventDescription') ?? 'Nos ayuda a validar que eres un organizador real'}
                      </span>
                      <span className={form.eventDescription.trim().length >= MIN_DESCRIPTION ? 'text-emerald-400' : 'text-slate-500'}>
                        {form.eventDescription.trim().length}/{MIN_DESCRIPTION}
                      </span>
                    </div>
                  </div>

                  {renderField('socialUrl', 'Red social o sitio web (opcional)', <Link2 className={iconClass} />,
                    <input
                      id="auth-socialUrl"
                      type="url"
                      value={form.socialUrl}
                      onChange={(e) => setField('socialUrl', e.target.value)}
                      onBlur={() => markTouched('socialUrl')}
                      placeholder="https://instagram.com/tu_colectivo"
                      className={inputClass('socialUrl')}
                    />,
                    'Acelera la revisión si muestra eventos que ya hayas realizado',
                  )}

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.acceptsTerms}
                      onChange={(e) => setField('acceptsTerms', e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 leading-relaxed">
                      Declaro que la información entregada es verídica y entiendo que publicar eventos falsos
                      implica la suspensión de mi cuenta.
                      {visibleError('acceptsTerms') && (
                        <span className="block text-rose-400 mt-1">{visibleError('acceptsTerms')}</span>
                      )}
                    </span>
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {view === 'login'
                  ? 'Ingresar a la plataforma'
                  : isReapply
                    ? 'Enviar nueva solicitud'
                    : isOrganizer
                      ? 'Enviar solicitud'
                      : 'Crear mi cuenta'}
              </button>

              {isOrganizer && (
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                  <Info className="w-3.5 h-3.5" /> Podrás explorar eventos mientras revisamos tu solicitud
                </p>
              )}
            </form>

            {!isReapply && (
              <div className="mt-6 text-center text-xs text-slate-400">
                {view === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta registrada?'}{' '}
                <button
                  type="button"
                  onClick={() => goTo(view === 'login' ? 'chooseType' : 'login')}
                  className="text-emerald-400 hover:underline font-semibold ml-1"
                >
                  {view === 'login' ? 'Regístrate aquí' : 'Inicia sesión'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Botón de texto "Ver motivo" que despliega el motivo que dejó el administrador
export function ReasonToggle({
  reason, date, dateLabel, tone = 'rose', compact = false,
}: {
  reason: string | null;
  date?: string | null;
  dateLabel: string;
  tone?: 'rose' | 'amber';
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const color = tone === 'rose' ? 'text-rose-300' : 'text-amber-300';
  const box = tone === 'rose' ? 'bg-rose-950/40 border-rose-500/25' : 'bg-amber-950/30 border-amber-500/25';

  return (
    <div className={compact ? 'mt-1' : 'text-left'}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`text-xs font-semibold underline underline-offset-2 hover:no-underline ${color}`}
      >
        {open ? 'Ocultar motivo' : 'Ver motivo'}
      </button>
      {open && (
        <div className={`mt-2 p-3 rounded-lg border text-xs leading-relaxed text-slate-200 ${box}`}>
          <p>{reason || 'El administrador no dejó un motivo detallado.'}</p>
          {date && <p className="mt-1 text-slate-400">{dateLabel} {formatDate(date, true)}</p>}
        </div>
      )}
    </div>
  );
}

function AccountTypeCard({
  icon, accent, title, subtitle, features, footer, onClick,
}: {
  icon: React.ReactNode;
  accent: 'emerald' | 'indigo';
  title: string;
  subtitle: string;
  features: string[];
  footer: string;
  onClick: () => void;
}) {
  const styles = accent === 'emerald'
    ? { ring: 'hover:border-emerald-500/60 focus-visible:border-emerald-500', icon: 'bg-emerald-500/15 text-emerald-300', check: 'text-emerald-400', footer: 'text-emerald-300 bg-emerald-500/10' }
    : { ring: 'hover:border-indigo-500/60 focus-visible:border-indigo-500', icon: 'bg-indigo-500/15 text-indigo-300', check: 'text-indigo-400', footer: 'text-indigo-200 bg-indigo-500/10' };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col text-left bg-slate-950 border border-slate-800 rounded-2xl p-5 transition-all hover:-translate-y-0.5 focus:outline-none ${styles.ring}`}
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${styles.icon}`}>{icon}</span>
      <span className="font-bold text-white text-lg leading-tight">{title}</span>
      <span className="text-xs text-slate-400 mb-3">{subtitle}</span>
      <ul className="space-y-1.5 mb-4 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
            <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${styles.check}`} /> {f}
          </li>
        ))}
      </ul>
      <span className={`self-start text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${styles.footer}`}>{footer}</span>
    </button>
  );
}

function Step({ state, title, text }: { state: 'done' | 'current' | 'next'; title: string; text: string }) {
  const dot =
    state === 'done'
      ? 'bg-emerald-500 text-slate-950'
      : state === 'current'
        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400 animate-pulse'
        : 'bg-slate-800 text-slate-500';
  return (
    <li className="flex gap-3">
      <span className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${dot}`}>
        {state === 'done' ? <Check className="w-3.5 h-3.5" /> : state === 'current' ? '•' : ''}
      </span>
      <span>
        <span className={`block text-sm font-semibold ${state === 'next' ? 'text-slate-400' : 'text-white'}`}>{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </li>
  );
}
