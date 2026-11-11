'use client';

import React from 'react';
import { ShieldAlert, Lock, TriangleAlert } from 'lucide-react';

// Restricción de edad del evento (14, 16 o 18): se elige al crearlo y no cambia después
export const EDADES_MINIMAS = [14, 16, 18] as const;

// Badge discreto para tarjetas y listados (ej. "+18")
export function AgeBadge({ edad, className = '' }: { edad?: number | null; className?: string }) {
  if (!edad) return null;
  return (
    <span
      title={`Evento para mayores de ${edad} años`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide text-rose-100 bg-rose-500/20 border border-rose-400/40 ${className}`}
    >
      +{edad}
    </span>
  );
}

// Aviso para el detalle del evento y el checkout
export function AgeNotice({ edad, compact = false }: { edad: number; compact?: boolean }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-xl border border-rose-400/35 bg-rose-500/10 text-sm" role="note">
      <ShieldAlert className="w-5 h-5 shrink-0 text-rose-300 mt-0.5" />
      <div>
        <p className="font-bold text-rose-100">Evento para mayores de {edad} años</p>
        <p className={`text-rose-100/80 mt-0.5 ${compact ? 'text-xs' : ''}`}>
          Se pedirá cédula de identidad en el acceso y no podrán ingresar menores de esa edad, aunque tengan entrada.
          Las entradas no se reembolsan por este motivo.
        </p>
      </div>
    </div>
  );
}

// Campo del formulario: interruptor, edad mínima y advertencia de que no se podrá cambiar
export function AgeRestrictionField({ activa, edad, bloqueada, onToggle, onEdad }: {
  activa: boolean;
  edad: number;
  bloqueada: boolean; // evento ya publicado: solo se muestra
  onToggle: (v: boolean) => void;
  onEdad: (e: number) => void;
}) {
  if (bloqueada) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
        <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-white">
            {activa ? <>Restricción de edad: <AgeBadge edad={edad} className="ml-1 align-middle" /></> : 'Evento para todo público'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">La restricción de edad no se puede modificar una vez publicado el evento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${activa ? 'border-rose-400/40 bg-rose-500/5' : 'border-slate-800 bg-slate-950/60'}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id="age-switch-label" className="text-sm font-semibold text-white">¿Tu evento tiene restricción de edad?</p>
          <p className="text-xs text-slate-400 mt-0.5">{activa ? 'Solo podrán ingresar personas desde la edad que elijas.' : 'Evento para todo público.'}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activa}
          aria-labelledby="age-switch-label"
          onClick={() => onToggle(!activa)}
          className={`relative w-12 h-7 rounded-full shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${activa ? 'bg-rose-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${activa ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {activa && (
        <>
          <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Edad mínima">
            {EDADES_MINIMAS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={edad === e}
                onClick={() => onEdad(e)}
                className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors ${
                  edad === e ? 'border-rose-400 bg-rose-500/20 text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                }`}
              >
                +{e}
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-200">
            <TriangleAlert className="w-4 h-4 shrink-0" />
            Importante: la restricción de edad no se podrá modificar una vez publicado el evento. Revísala antes de publicar.
          </p>
        </>
      )}
    </div>
  );
}
