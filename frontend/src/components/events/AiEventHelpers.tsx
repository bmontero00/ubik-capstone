'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, Check, X, Lightbulb, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import EventCover from './EventCover';
import { DatosEventoIa, disenarPortada, mejorarDescripcion } from '../../services/ia';
import type { PortadaIa } from '../../utils/portadas';

// Sugerencias para una descripción más completa (sin IA) y botón para mejorarla con IA.
// La propuesta nunca reemplaza el texto sola: el organizador decide si la usa.
export function DescriptionAssistant({ datos, onUse }: { datos: DatosEventoIa; onUse: (texto: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<{ descripcion: string; consejos: string[] } | null>(null);
  const largo = datos.descripcion.trim().length;

  // Pistas rápidas mientras escribe (no usan IA)
  const pista =
    largo === 0 ? null
      : largo < 120 ? 'Tu descripción es breve: cuenta qué harán los asistentes, para quién es y qué deben llevar.'
        : largo < 250 ? 'Vas bien. Puedes sumar detalles como duración, si es apto para niños o mascotas, o qué incluye la entrada.'
          : null;

  const mejorar = async () => {
    setBusy(true);
    setError(null);
    try {
      setPropuesta(await mejorarDescripcion(datos));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const puede = datos.titulo.trim().length >= 3 && largo >= 10;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {pista ? <p className="flex-1 min-w-[12rem] text-[11px] text-amber-200/90 flex items-start gap-1.5"><Lightbulb className="w-3.5 h-3.5 shrink-0 mt-px" /> {pista}</p> : <span />}
        <button
          type="button"
          onClick={mejorar}
          disabled={!puede || busy}
          title={puede ? 'Claude propone una versión más clara y atractiva de tu texto' : 'Escribe el título y al menos una idea del evento'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-violet-600/20 border border-violet-500/40 text-violet-100 hover:bg-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {busy ? 'Mejorando…' : 'Mejorar con IA'}
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}

      {propuesta && (
        <div className="p-3 rounded-xl border border-violet-500/35 bg-violet-500/10">
          <p className="text-[11px] uppercase tracking-wider font-bold text-violet-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Propuesta de la IA
          </p>
          <p className="mt-1.5 text-sm text-slate-200 whitespace-pre-line leading-relaxed">{propuesta.descripcion}</p>
          {propuesta.consejos.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-amber-200">Podrías agregar:</p>
              <ul className="mt-0.5 space-y-0.5">
                {propuesta.consejos.map((c) => <li key={c} className="text-[11px] text-slate-300 flex gap-1.5"><span className="text-amber-300">•</span>{c}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { onUse(propuesta.descripcion); setPropuesta(null); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-violet-600 hover:bg-violet-500">
              <Check className="w-3.5 h-3.5" /> Usar esta versión
            </button>
            <button type="button" onClick={() => setPropuesta(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
              <X className="w-3.5 h-3.5" /> Descartar
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Revisa que todo sea correcto antes de publicar: puedes editarla después de usarla.</p>
        </div>
      )}
    </div>
  );
}

// Portada diseñada con IA para eventos sin imagen: vista previa, regenerar o quitar
export function AiCoverPicker({ datos, portada, onChange }: {
  datos: DatosEventoIa;
  portada: PortadaIa | null;
  onChange: (p: PortadaIa | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generar = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange(await disenarPortada(datos));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-2xl border border-violet-500/30 bg-violet-500/5">
      <p className="text-sm font-semibold text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-300" /> ¿No tienes imagen?</p>
      <p className="text-xs text-slate-400 mt-0.5">
        Tu evento tendrá una portada con los colores de su categoría. También puedes pedirle a la IA una diseñada a partir del título y la descripción.
      </p>
      {portada && (
        <div className="relative mt-3 h-40 rounded-xl overflow-hidden border border-slate-800">
          <EventCover portada={portada} categoria={datos.categoria} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generar}
          disabled={busy || datos.titulo.trim().length < 3}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : portada ? <RefreshCw className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
          {busy ? 'Diseñando…' : portada ? 'Generar otra' : 'Diseñar portada con IA'}
        </button>
        {portada && (
          <button type="button" onClick={() => onChange(null)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
            <Trash2 className="w-3.5 h-3.5" /> Usar la de la categoría
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
