'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ReasonField, { validateReason } from './ReasonField';

export interface StatusOption<S extends string> {
  value: S;
  label: string;
  description: string;
  className: string; // color de la etiqueta
}

interface StatusChangeFormProps<S extends string> {
  current: S;
  options: StatusOption<S>[];
  reasonPlaceholder: string;
  confirmText?: Partial<Record<S, string>>; // texto extra de confirmación para cambios delicados
  onSubmit: (status: S, reason: string) => Promise<void>;
}

// Selector de estado + motivo obligatorio, usado para cuentas y eventos
export default function StatusChangeForm<S extends string>({
  current, options, reasonPlaceholder, confirmText, onSubmit,
}: StatusChangeFormProps<S>) {
  const [status, setStatus] = useState<S>(current);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Al cambiar de usuario/evento seleccionado se reinicia el formulario
  useEffect(() => {
    setStatus(current);
    setReason('');
    setReasonTouched(false);
    setSubmitAttempted(false);
    setError(null);
    setConfirming(false);
  }, [current, options]);

  const reasonError = validateReason(reason);

  const save = async () => {
    setSubmitAttempted(true);
    if (reasonError) return;
    if (confirmText?.[status] && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(status, reason.normalize('NFC').trim());
      setReason('');
      setReasonTouched(false);
      setSubmitAttempted(false);
      setConfirming(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar el cambio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="grid gap-2 mb-3" role="radiogroup" aria-label="Nuevo estado">
        {options.map((opt) => {
          const selected = status === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => { setStatus(opt.value); setConfirming(false); }}
              className={`flex items-start gap-3 text-left p-3 rounded-xl border transition-colors ${
                selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'
              }`}
            >
              <span
                className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  selected ? 'border-indigo-400' : 'border-slate-600'
                }`}
              >
                {selected && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${opt.className}`}>
                    {opt.label}
                  </span>
                  {opt.value === current && <span className="text-[10px] text-slate-500">Estado actual</span>}
                </span>
                <span className="block text-xs text-slate-400 mt-1">{opt.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <ReasonField
        label="Motivo del cambio"
        value={reason}
        onChange={setReason}
        onBlur={() => setReasonTouched(true)}
        placeholder={reasonPlaceholder}
        showError={reasonTouched || submitAttempted}
      />
      <p className="text-[11px] text-slate-500 mt-1">Queda registrado junto al cambio y el usuario afectado podrá verlo.</p>

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

      {confirming && confirmText?.[status] && (
        <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
          {confirmText[status]}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        {confirming && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            confirming ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {confirming ? 'Sí, confirmar cambio' : 'Guardar cambio'}
        </button>
      </div>
    </div>
  );
}
