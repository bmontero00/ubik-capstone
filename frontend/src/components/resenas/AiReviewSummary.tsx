'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, ThumbsUp, TrendingUp, Lightbulb, Loader2, Info } from 'lucide-react';
import { ResumenIa, fetchResumenIa, fechaResena } from '../../services/resenas';

// Resumen de las reseñas generado con IA. El público ve la impresión general, lo más valorado y lo que
// se puede mejorar; el organizador ve además sugerencias privadas. Si se está generando, vuelve a consultar.
export default function AiReviewSummary({ organizadorId, compact = false, refreshKey = 0 }: {
  organizadorId: string;
  compact?: boolean; // en el perfil: solo el párrafo y los puntos principales
  refreshKey?: number;
}) {
  const [data, setData] = useState<ResumenIa | null>(null);
  const [intentos, setIntentos] = useState(0);

  useEffect(() => {
    let active = true;
    fetchResumenIa(organizadorId).then((d) => active && setData(d)).catch(() => {});
    return () => { active = false; };
  }, [organizadorId, refreshKey, intentos]);

  // Mientras se genera o actualiza, consulta de nuevo unas pocas veces
  const esperando = !!data && (('generando' in data && data.generando) || (data.disponible && data.actualizando));
  useEffect(() => {
    if (!esperando || intentos >= 4) return;
    const t = setTimeout(() => setIntentos((n) => n + 1), 5000);
    return () => clearTimeout(t);
  }, [esperando, intentos]);

  if (!data) return null;
  if (!data.disponible) {
    if (!('generando' in data && data.generando)) return null; // con menos de 3 reseñas no se muestra
    return (
      <div className="flex items-center gap-2 p-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 text-sm text-violet-200">
        <Loader2 className="w-4 h-4 animate-spin" /> Generando el resumen de las reseñas…
      </div>
    );
  }

  const prueba = data.origen === 'PRUEBA';
  return (
    <section
      aria-label="Resumen de reseñas generado con IA"
      className="p-4 sm:p-5 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/15 via-slate-950 to-slate-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider font-bold text-violet-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Resumen de las reseñas
        </p>
        <span className="text-[10px] font-semibold text-violet-200/80 bg-violet-500/15 rounded-md px-2 py-0.5" title={prueba ? 'Generado con reglas simples mientras no hay una API key de Claude configurada' : 'Generado automáticamente con Claude (IA) a partir de las reseñas'}>
          {prueba ? 'Modo de prueba' : 'Generado con IA'}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-200 leading-relaxed">{data.resumen}</p>

      <div className={`mt-3 grid gap-3 ${data.aMejorar.length ? 'sm:grid-cols-2' : ''}`}>
        {data.destacados.length > 0 && (
          <div>
            <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 mb-1"><ThumbsUp className="w-3.5 h-3.5" /> Lo más valorado</p>
            <ul className="space-y-1">
              {data.destacados.slice(0, compact ? 3 : 4).map((d) => <li key={d} className="text-xs text-slate-300 flex gap-1.5"><span className="text-emerald-400">•</span>{d}</li>)}
            </ul>
          </div>
        )}
        {data.aMejorar.length > 0 && (
          <div>
            <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5" /> Lo que podría mejorar</p>
            <ul className="space-y-1">
              {data.aMejorar.slice(0, compact ? 3 : 4).map((d) => <li key={d} className="text-xs text-slate-300 flex gap-1.5"><span className="text-amber-400">•</span>{d}</li>)}
            </ul>
          </div>
        )}
      </div>

      {!compact && data.sugerencias && data.sugerencias.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-indigo-500/30">
          <p className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-300" /> Sugerencias para ti
            <span className="font-normal text-slate-500">· solo tú las ves</span>
          </p>
          <ul className="mt-1.5 space-y-1">
            {data.sugerencias.map((s) => <li key={s} className="text-xs text-slate-300 flex gap-1.5"><span className="text-indigo-400">→</span>{s}</li>)}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[10px] text-slate-500 flex items-start gap-1">
        <Info className="w-3 h-3 shrink-0 mt-px" />
        <span>
          {prueba ? 'Resumen automático de prueba' : 'Resumen generado con IA'} a partir de {data.totalResenas} {data.totalResenas === 1 ? 'reseña' : 'reseñas'}
          {' · '}actualizado el {fechaResena(data.fechaGeneracion)}{data.actualizando ? ' · actualizando…' : ''}.
          {!prueba && ' Puede contener imprecisiones: revisa las reseñas completas.'}
        </span>
      </p>
    </section>
  );
}
