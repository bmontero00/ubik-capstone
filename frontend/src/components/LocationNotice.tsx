'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, LocateFixed, MapPinOff, MapPinned, X } from 'lucide-react';
import { LocationStatus } from '../utils/location';

interface LocationNoticeProps {
  status: LocationStatus;
  accuracy?: number;
  onRetry: () => void;
}

// Pide la ubicación una sola vez, cuando se muestra el mapa (no al cargar paneles que no lo usan)
export function RequestLocationOnMount({ status, request }: { status: LocationStatus; request: () => void }) {
  useEffect(() => {
    if (status === 'idle') request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// Explica de dónde salen los eventos recomendados según el estado de la ubicación
export default function LocationNotice({ status, accuracy, onRetry }: LocationNoticeProps) {
  const [dismissed, setDismissed] = useState<LocationStatus | null>(null);

  // Un aviso cerrado vuelve a mostrarse si cambia el estado
  useEffect(() => {
    if (dismissed && dismissed !== status) setDismissed(null);
  }, [status, dismissed]);

  if (status === 'idle' || dismissed === status) return null;

  if (status === 'granted') {
    return (
      <p className="mb-4 flex items-center gap-2 text-xs text-emerald-300/90" role="status">
        <MapPinned className="w-4 h-4" />
        Te recomendamos eventos cerca de tu ubicación actual
        {accuracy !== undefined && <span className="text-slate-500">(precisión aprox. {accuracy < 1000 ? `${accuracy} m` : `${(accuracy / 1000).toFixed(1)} km`})</span>}
      </p>
    );
  }

  if (status === 'locating') {
    return (
      <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-sm text-indigo-100" role="status">
        <Loader2 className="w-5 h-5 shrink-0 text-indigo-300 animate-spin" />
        <span>
          <strong className="text-indigo-200">Buscando tu ubicación…</strong> Si tu navegador te lo pregunta, permite el
          acceso para recomendarte eventos cerca de ti. Solo la usamos para ordenar los eventos por distancia.
        </span>
      </div>
    );
  }

  const content: Record<'denied' | 'unavailable' | 'unsupported' | 'outside', { title: string; text: string; retry: boolean }> = {
    denied: {
      title: 'No tenemos acceso a tu ubicación.',
      text: 'Te mostramos eventos cerca de Santiago centro. Para ver los que están cerca de ti, permite la ubicación desde el ícono junto a la dirección del sitio en tu navegador y presiona “Reintentar”.',
      retry: true,
    },
    unavailable: {
      title: 'No pudimos obtener tu ubicación.',
      text: 'Te mostramos eventos cerca de Santiago centro mientras tanto. Revisa que la ubicación de tu dispositivo esté activada.',
      retry: true,
    },
    unsupported: {
      title: 'Tu navegador no permite compartir la ubicación.',
      text: 'Te mostramos eventos cerca de Santiago centro.',
      retry: false,
    },
    outside: {
      title: 'Por ahora UBIK está disponible solo en Santiago.',
      text: 'Tu ubicación está fuera de la zona de cobertura, así que te mostramos los eventos de Santiago centro.',
      retry: false,
    },
  };
  const { title, text, retry } = content[status];
  const Icon = status === 'outside' ? MapPinned : MapPinOff;

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-100" role="status">
      <Icon className="w-5 h-5 shrink-0 text-amber-400" />
      <span className="flex-1">
        <strong className="text-amber-300">{title}</strong> {text}
      </span>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {retry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 transition-colors"
          >
            <LocateFixed className="w-3.5 h-3.5" /> Reintentar
          </button>
        )}
        <button onClick={() => setDismissed(status)} aria-label="Cerrar aviso" className="text-amber-300/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
