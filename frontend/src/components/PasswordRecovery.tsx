'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, MailCheck, Lock, Eye, EyeOff, Loader2, ShieldCheck, RotateCcw } from 'lucide-react';
import { ApiError, requestPasswordCode, resetPassword, verifyPasswordCode } from '../services/auth';

type Step = 'email' | 'code' | 'password';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Recuperar la contraseña: se pide un código por correo, se ingresa y se elige la nueva
export default function PasswordRecovery({ initialEmail, onBack, onDone }: {
  initialEmail: string;
  onBack: () => void; // volver al inicio de sesión
  onDone: (email: string) => void; // contraseña cambiada: se vuelve al inicio de sesión con el correo
}) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail.trim());
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [resendIn, setResendIn] = useState(0);
  const [touched, setTouched] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');

  // Cuenta regresiva para poder reenviar el código
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const run = async (task: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      const e = err as ApiError;
      setError(e.message || 'Ocurrió un error, intenta nuevamente');
      // Código vencido o con los intentos agotados: hay que pedir otro
      if (e.code === 'CODIGO_INVALIDO' || e.code === 'CODIGO_AGOTADO') {
        setDigits(Array(CODE_LENGTH).fill(''));
        if (step === 'password') setStep('code');
      }
    } finally {
      setLoading(false);
    }
  };

  const sendCode = (resend = false) =>
    run(async () => {
      const res = await requestPasswordCode(email.trim());
      setMinutes(res.minutosVigencia);
      setDigits(Array(CODE_LENGTH).fill(''));
      setInfo(resend ? 'Te enviamos un código nuevo. El anterior ya no sirve.' : res.mensaje);
      setResendIn(RESEND_SECONDS);
      setStep('code');
      setTimeout(() => inputs.current[0]?.focus(), 50);
    });

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL.test(email.trim())) return;
    sendCode();
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < CODE_LENGTH) return setError('Ingresa los 6 dígitos del código');
    run(async () => {
      await verifyPasswordCode(email.trim(), code);
      setInfo(null);
      setTouched(false);
      setStep('password');
    });
  };

  const passwordError = !password
    ? 'Ingresa tu nueva contraseña'
    : password.length < 6
      ? 'La contraseña debe tener al menos 6 caracteres'
      : password.length > 72
        ? 'La contraseña puede tener como máximo 72 caracteres'
        : null;
  const confirmError = confirm !== password ? 'Las contraseñas no coinciden' : null;

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (passwordError || confirmError) return;
    run(async () => {
      await resetPassword(email.trim(), code, password);
      onDone(email.trim());
    });
  };

  // Ingreso del código: un dígito por casilla, avanza solo y acepta pegar el código completo
  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = clean.slice(0, CODE_LENGTH).split('');
      setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => next[i] ?? ''));
      inputs.current[Math.min(next.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((prev) => prev.map((d, i) => (i === index ? clean : d)));
    if (clean && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const onDigitKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const inputClass = (bad: boolean) =>
    `w-full bg-slate-950 border rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
      bad ? 'border-rose-500/70 focus:border-rose-500' : 'border-slate-800 focus:border-emerald-500'
    }`;
  const primary = 'w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2';

  const header = {
    email: { icon: KeyRound, title: '¿Olvidaste tu contraseña?', text: 'Ingresa el correo de tu cuenta y te enviaremos un código de verificación para crear una nueva.' },
    code: { icon: MailCheck, title: 'Revisa tu correo', text: `Ingresa el código de 6 dígitos que enviamos a ${email.trim()}. Vence en ${minutes} minutos.` },
    password: { icon: ShieldCheck, title: 'Crea tu nueva contraseña', text: 'Elige una contraseña que no hayas usado antes. Al guardarla, cerraremos tus sesiones abiertas en otros dispositivos.' },
  }[step];

  return (
    <div>
      <button
        type="button"
        onClick={() => (step === 'email' ? onBack() : (setStep('email'), setError(null), setInfo(null)))}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {step === 'email' ? 'Volver a iniciar sesión' : 'Cambiar correo'}
      </button>

      <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
        <header.icon className="w-7 h-7" />
      </div>
      <h2 className="text-2xl font-bold text-center tracking-tight mb-2">{header.title}</h2>
      <p className="text-sm text-slate-400 text-center mb-6 break-words">{header.text}</p>

      {info && !error && (
        <p className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs">{info}</p>
      )}
      {error && (
        <p className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm" role="alert">{error}</p>
      )}

      {step === 'email' && (
        <form onSubmit={submitEmail} noValidate className="space-y-4">
          <div>
            <label htmlFor="recovery-email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Correo electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.cl"
                className={inputClass(touched && !EMAIL.test(email.trim()))}
              />
            </div>
            {touched && !EMAIL.test(email.trim()) && <p className="text-[11px] text-rose-400 mt-1">Ingresa un correo electrónico válido</p>}
          </div>
          <button type="submit" disabled={loading} className={primary}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enviar código
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={submitCode} noValidate className="space-y-4">
          <div className="flex justify-center gap-2" role="group" aria-label="Código de verificación">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onDigitKey(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={CODE_LENGTH}
                aria-label={`Dígito ${i + 1}`}
                className="w-11 h-14 text-center text-2xl font-extrabold bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 tabular-nums"
              />
            ))}
          </div>
          <button type="submit" disabled={loading || code.length < CODE_LENGTH} className={primary}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Verificar código
          </button>
          <p className="text-center text-xs text-slate-400">
            ¿No te llegó? Revisa tu carpeta de spam o{' '}
            {resendIn > 0 ? (
              <span className="text-slate-500">pide otro en {resendIn} s</span>
            ) : (
              <button type="button" onClick={() => sendCode(true)} disabled={loading} className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-semibold">
                <RotateCcw className="w-3 h-3" /> reenvía el código
              </button>
            )}
          </p>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={submitPassword} noValidate className="space-y-4">
          <div>
            <label htmlFor="recovery-password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nueva contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                id="recovery-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClass(touched && !!passwordError)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className={`text-[11px] mt-1 ${touched && passwordError ? 'text-rose-400' : 'text-slate-500'}`}>
              {touched && passwordError ? passwordError : 'Mínimo 6 caracteres'}
            </p>
          </div>
          <div>
            <label htmlFor="recovery-confirm" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Repite la contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                id="recovery-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={inputClass(touched && !!confirmError)}
              />
            </div>
            {touched && confirmError && <p className="text-[11px] text-rose-400 mt-1">{confirmError}</p>}
          </div>
          <button type="submit" disabled={loading} className={primary}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Guardar nueva contraseña
          </button>
        </form>
      )}
    </div>
  );
}
