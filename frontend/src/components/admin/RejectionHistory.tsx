'use client';

import React, { useState } from 'react';
import { ChevronDown, CircleX, History } from 'lucide-react';
import { formatDate } from '../../utils/labels';
import { formatRut } from '../../utils/rut';
import { formatPhoneDisplay } from '../../utils/phone';

export interface RejectionEntry {
  id: string;
  reason: string;
  reviewedAt: string;
  reviewedBy: { id: string; name: string } | null;
  submittedAt: string;
  applicantName: string;
  rut: string;
  phone: string;
  organizationName: string | null;
  eventDescription: string;
  socialUrl: string | null;
}

type Field = 'applicantName' | 'rut' | 'phone' | 'organizationName' | 'socialUrl' | 'eventDescription';

const FIELDS: { key: Field; label: string; format?: (v: string) => string; wide?: boolean }[] = [
  { key: 'applicantName', label: 'Nombre' },
  { key: 'rut', label: 'RUT', format: formatRut },
  { key: 'phone', label: 'Celular', format: formatPhoneDisplay },
  { key: 'organizationName', label: 'Organización' },
  { key: 'socialUrl', label: 'Red social o sitio web', wide: true },
  { key: 'eventDescription', label: 'Tipo de eventos', wide: true },
];

// Historial de solicitudes rechazadas de un organizador, del rechazo más reciente al más antiguo.
// Cada rechazo muestra su motivo y la solicitud tal como se envió, marcando qué cambió
// respecto de la solicitud anterior.
export default function RejectionHistory({ entries }: { entries: RejectionEntry[] }) {
  // El rechazo más reciente parte abierto; el resto se despliega a pedido
  const [open, setOpen] = useState<Set<string>>(() => new Set(entries.slice(0, 1).map((e) => e.id)));

  if (entries.length === 0) return null;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="pt-4 border-t border-slate-800" aria-label="Historial de solicitudes rechazadas">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <History className="w-4 h-4 text-slate-500" /> Historial de solicitudes rechazadas
        </p>
        <span className="text-[11px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-full px-2 py-0.5">
          {entries.length} {entries.length === 1 ? 'rechazo' : 'rechazos'}
        </span>
      </div>

      <ol className="relative space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
        {entries.map((entry, index) => {
          const number = entries.length - index;
          const previous = entries[index + 1]; // solicitud rechazada anterior (más antigua)
          const isOpen = open.has(entry.id);

          return (
            <li key={entry.id} className="relative pl-8">
              <span className="absolute left-0 top-3 w-[23px] h-[23px] rounded-full bg-slate-900 border border-rose-500/40 flex items-center justify-center">
                <CircleX className="w-3.5 h-3.5 text-rose-400" />
              </span>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Rechazo {number}</span>
                    {index === 0 && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border bg-rose-500/10 text-rose-300 border-rose-500/30">
                        Más reciente
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400">{formatDate(entry.reviewedAt, true)}</span>
                </div>

                <p className="text-xs text-rose-100 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 whitespace-pre-line break-words">
                  {entry.reason}
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {entry.reviewedBy ? `Revisado por ${entry.reviewedBy.name}` : 'Revisor no registrado'} · solicitud enviada el{' '}
                  {formatDate(entry.submittedAt, true)}
                </p>

                <button
                  type="button"
                  onClick={() => toggle(entry.id)}
                  aria-expanded={isOpen}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  {isOpen ? 'Ocultar datos de la solicitud' : 'Ver datos de la solicitud'}
                </button>

                {isOpen && (
                  <dl className="mt-2 grid sm:grid-cols-2 gap-2">
                    {FIELDS.map(({ key, label, format, wide }) => {
                      const raw = entry[key];
                      const changed = !!previous && (previous[key] ?? '') !== (raw ?? '');
                      return (
                        <div
                          key={key}
                          className={`rounded-lg border px-2.5 py-2 ${wide ? 'sm:col-span-2' : ''} ${
                            changed ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-900'
                          }`}
                        >
                          <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                            {label}
                            {changed && (
                              <span className="normal-case tracking-normal text-[10px] font-semibold text-amber-300">
                                · modificado
                              </span>
                            )}
                          </dt>
                          <dd className="text-xs text-slate-200 mt-0.5 whitespace-pre-line break-words">
                            {raw ? (format ? format(raw) : raw) : <span className="text-slate-500">Sin información</span>}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {entries.length > 1 && (
        <p className="text-[11px] text-slate-500 mt-2">
          Los campos marcados como “modificado” cambiaron respecto de la solicitud rechazada anterior.
        </p>
      )}
    </section>
  );
}
