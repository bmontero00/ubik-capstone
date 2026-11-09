'use client';

import React, { useState } from 'react';
import { Loader2, Percent } from 'lucide-react';
import { formatPercent, formatPrice, priceWithFee } from '../../services/events';
import { EventoCargo, updateEventFee } from '../../services/cargos';
import ReasonField, { validateReason } from './ReasonField';

export const FEE_MAX = 30;

// Valida un % escrito por el admin (admite decimales con coma o punto)
export function parsePercent(value: string): { value: number | null; error: string | null } {
  if (!value.trim()) return { value: null, error: 'Indica el porcentaje' };
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return { value: null, error: 'Indica un porcentaje válido' };
  if (n > FEE_MAX) return { value: null, error: `El porcentaje puede ser como máximo ${FEE_MAX}%` };
  return { value: Math.round(n * 100) / 100, error: null };
}

export function PercentInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <div>
      <div className="relative max-w-[140px]">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
          className={`w-full px-3 py-2 pr-8 text-sm bg-slate-950 border rounded-xl text-white focus:outline-none focus:border-indigo-500 ${error ? 'border-rose-500/70' : 'border-slate-700'}`}
        />
        <span className="absolute right-3 top-2 text-sm text-slate-500">%</span>
      </div>
      {error && <p className="text-[11px] text-rose-300 mt-1">{error}</p>}
    </div>
  );
}

// % especial de cargo para un evento. Bajarlo siempre se puede; subirlo, solo si aún no vende entradas.
export default function EventFeeForm({ event, onSaved }: { event: EventoCargo; onSaved: (event: EventoCargo) => void }) {
  const current = event.porcentajeCargo ?? 0;
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(String(current));
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parsePercent(pct);
  const pending = event.estadoCondicion === 'PENDIENTE';
  // Si ya tiene un % especial (condición aprobada o cambios anteriores) se ofrece modificarlo
  const hasSpecial = event.estadoCondicion === 'APROBADA' || (event.historialCargos?.length ?? 0) > 0;

  const submit = async () => {
    setTouched(true);
    if (parsed.error || validateReason(reason)) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateEventFee(event.id, parsed.value!, reason.normalize('NFC').trim()));
      setOpen(false);
      setReason('');
      setTouched(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-300">
          <span className="font-semibold text-white">{formatPercent(current)}</span> de cargo
          {event.price > 0 && (
            <span className="text-slate-500"> · organizador recibe {formatPrice(event.price)} · público paga {formatPrice(event.precioFinal ?? event.price)}</span>
          )}
        </p>
        {!open && !pending && (
          <button onClick={() => { setOpen(true); setPct(String(current)); setError(null); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-indigo-600 transition-colors">
            <Percent className="w-3.5 h-3.5" /> {hasSpecial ? 'Modificar %' : 'Fijar % especial'}
          </button>
        )}
      </div>
      {pending && <p className="text-[11px] text-amber-200 mt-1">Tiene una solicitud de condición especial pendiente: respóndela en la pestaña Cargos.</p>}

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nuevo porcentaje</label>
              <PercentInput value={pct} onChange={setPct} error={touched ? parsed.error : null} />
            </div>
            {parsed.value !== null && event.price > 0 && (
              <p className="text-xs text-slate-400 pb-2">El público pagará <span className="font-bold text-white">{formatPrice(priceWithFee(event.price, parsed.value))}</span></p>
            )}
          </div>
          {parsed.value !== null && parsed.value > current && (
            <p className="text-[11px] text-amber-200">Subir el cargo solo es posible si el evento aún no vende entradas.</p>
          )}
          <ReasonField
            label="Motivo del % especial"
            value={reason}
            onChange={setReason}
            onBlur={() => setTouched(true)}
            showError={touched}
            placeholder="Ej. Convenio comercial con el organizador por volumen de eventos."
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Cancelar</button>
            <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar %
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
