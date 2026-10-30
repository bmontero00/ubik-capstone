'use client';

import React from 'react';

// Mismas reglas que el backend (backend/src/common/reason.validator.ts)
export const REASON_MIN = 10;
export const REASON_MAX = 500;

// Devuelve el error del motivo o null si es válido. Acepta tildes, ñ, signos y saltos de línea.
export function validateReason(value: string): string | null {
  const text = value.normalize('NFC').trim();
  if (!text) return 'El motivo es obligatorio';
  if (text.length < REASON_MIN) return `Escribe al menos ${REASON_MIN} caracteres (llevas ${text.length})`;
  if (text.length > REASON_MAX) return `Superaste el máximo de ${REASON_MAX} caracteres (llevas ${text.length})`;
  if (!/\p{L}/u.test(text)) return 'El motivo debe contener texto';
  return null;
}

interface ReasonFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  hint?: string;
  showError: boolean; // mostrar el error solo tras interactuar o intentar guardar
  onBlur?: () => void;
  autoFocus?: boolean;
  tone?: 'indigo' | 'rose' | 'emerald';
}

// Campo de motivo obligatorio con contador de caracteres
export default function ReasonField({
  value, onChange, label, placeholder, hint, showError, onBlur, autoFocus, tone = 'indigo',
}: ReasonFieldProps) {
  const length = value.normalize('NFC').trim().length;
  // Pasarse del máximo se avisa de inmediato, sin esperar a que se intente guardar
  const error = showError || length > REASON_MAX ? validateReason(value) : null;
  const atLimit = length === REASON_MAX;
  const focus = { indigo: 'focus:border-indigo-500', rose: 'focus:border-rose-500', emerald: 'focus:border-emerald-500' }[tone];
  const counterColor = error || atLimit ? 'text-rose-400' : length >= REASON_MIN ? 'text-emerald-400' : 'text-slate-500';

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1">
        {label} <span className="text-rose-400">*</span>
      </label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoFocus={autoFocus}
        maxLength={REASON_MAX}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none resize-y min-h-[76px] ${
          error ? 'border-rose-500/70' : 'border-slate-800'
        } ${focus}`}
      />
      <div className="flex justify-between gap-3 mt-1 text-[11px]">
        <span className={error ? 'text-rose-400' : 'text-slate-500'}>
          {error ?? (atLimit ? `Llegaste al máximo de ${REASON_MAX} caracteres` : hint ?? `Mínimo ${REASON_MIN} y máximo ${REASON_MAX} caracteres`)}
        </span>
        <span className={`shrink-0 tabular-nums ${counterColor}`}>
          {length}/{REASON_MAX}
        </span>
      </div>
    </div>
  );
}
