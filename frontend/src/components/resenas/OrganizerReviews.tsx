'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Star, MessageSquareQuote, Inbox } from 'lucide-react';
import StarRating from '../organizers/StarRating';
import ReviewItem from './ReviewItem';
import AiReviewSummary from './AiReviewSummary';
import { Resena, ResenasOrganizador, fetchResenasOrganizador } from '../../services/resenas';

// Promedio grande con la distribución por estrellas. Las barras sirven de filtro si se pasa onFilter.
export function RatingSummary({ resumen, active, onFilter }: {
  resumen: ResenasOrganizador['resumen'];
  active?: number;
  onFilter?: (estrellas?: number) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-5 p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800">
      <div className="flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-1 sm:w-36 shrink-0">
        <p className="text-5xl font-extrabold text-white tabular-nums">{resumen.promedio?.toFixed(1) ?? '–'}</p>
        <div className="flex flex-col sm:items-center gap-1">
          <StarRating value={resumen.promedio} />
          <p className="text-xs text-slate-400">{resumen.total} {resumen.total === 1 ? 'reseña' : 'reseñas'}</p>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = resumen.distribucion[n] ?? 0;
          const pct = resumen.total ? Math.round((count / resumen.total) * 100) : 0;
          const selected = active === n;
          const content = (
            <>
              <span className="w-8 text-xs font-semibold text-slate-300 flex items-center gap-0.5">{n}<Star className="w-3 h-3 text-amber-400 fill-amber-400" /></span>
              <span className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                <span className={`block h-full rounded-full ${selected ? 'bg-amber-300' : 'bg-amber-400/80'}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 text-right text-xs text-slate-400 tabular-nums">{count}</span>
            </>
          );
          return (
            <li key={n}>
              {onFilter ? (
                <button
                  onClick={() => onFilter(selected ? undefined : n)}
                  disabled={!count && !selected}
                  aria-pressed={selected}
                  title={selected ? 'Quitar filtro' : `Ver solo reseñas de ${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
                  className={`w-full flex items-center gap-2 px-1.5 py-0.5 rounded-md transition-colors disabled:opacity-40 ${selected ? 'bg-amber-500/10 ring-1 ring-amber-500/40' : 'hover:bg-slate-900'}`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-1.5 py-0.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Todas las reseñas de un organizador: resumen, filtro por estrellas y "ver más". El organizador puede responder.
export default function OrganizerReviews({ organizadorId, organizador, onOpenEvent, onChanged }: {
  organizadorId: string;
  organizador: string;
  onOpenEvent?: (eventId: string) => void;
  onChanged?: () => void; // ej. para refrescar el perfil tras responder
}) {
  const [data, setData] = useState<ResenasOrganizador | null>(null);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [filtro, setFiltro] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    fetchResenasOrganizador(organizadorId, 1, filtro)
      .then((d) => {
        if (id !== request.current) return;
        setData(d);
        setResenas(d.resenas);
      })
      .catch((e) => id === request.current && setError(e.message))
      .finally(() => id === request.current && setLoading(false));
  }, [organizadorId, filtro]);

  const verMas = async () => {
    if (!data) return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const d = await fetchResenasOrganizador(organizadorId, data.pagina + 1, filtro);
      if (id !== request.current) return;
      setData(d);
      setResenas((prev) => [...prev, ...d.resenas.filter((r) => !prev.some((p) => p.id === r.id))]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!data) {
    return (
      <div className="py-12 flex justify-center text-indigo-400">
        {error ? <p className="text-sm text-rose-300">{error}</p> : <Loader2 className="w-6 h-6 animate-spin" />}
      </div>
    );
  }

  if (!data.resumen.total) {
    return (
      <div className="flex flex-col items-center text-center px-6 py-10 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50">
        <MessageSquareQuote className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm font-semibold text-slate-300">Aún no hay reseñas</p>
        <p className="text-xs text-slate-500 mt-1">Las reseñas aparecen cuando los asistentes califican eventos ya realizados.</p>
      </div>
    );
  }

  const sinResponder = data.esOrganizador ? data.sinResponder : 0;

  return (
    <div>
      <RatingSummary resumen={data.resumen} active={filtro} onFilter={setFiltro} />
      <div className="mt-4">
        <AiReviewSummary organizadorId={organizadorId} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-5 mb-3">
        <p className="text-sm text-slate-300">
          {filtro
            ? <>Reseñas de {filtro} {filtro === 1 ? 'estrella' : 'estrellas'} <span className="text-slate-500">({data.total})</span></>
            : <>Más recientes primero</>}
        </p>
        <div className="flex items-center gap-2">
          {data.esOrganizador && sinResponder > 0 && (
            <span className="text-[11px] font-semibold text-indigo-200 bg-indigo-500/15 rounded-lg px-2 py-1">{sinResponder} sin responder</span>
          )}
          {filtro && (
            <button onClick={() => setFiltro(undefined)} className="text-xs font-semibold text-amber-300 hover:text-amber-200">Ver todas</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center text-indigo-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : resenas.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 flex flex-col items-center gap-2"><Inbox className="w-6 h-6" /> No hay reseñas con este filtro.</p>
      ) : (
        <ul className="space-y-3">
          {resenas.map((r) => (
            <ReviewItem
              key={r.id}
              resena={r}
              organizador={organizador}
              canReply={data.esOrganizador}
              onOpenEvent={onOpenEvent}
              onChange={(u) => {
                const antes = resenas.find((p) => p.id === u.id);
                setResenas((prev) => prev.map((p) => (p.id === u.id ? u : p)));
                // Ajusta el contador de pendientes sin volver a pedir el listado
                const delta = antes && !antes.respuesta && u.respuesta ? -1 : antes?.respuesta && !u.respuesta ? 1 : 0;
                if (delta) setData((d) => d && { ...d, sinResponder: d.sinResponder + delta });
                onChanged?.();
              }}
            />
          ))}
        </ul>
      )}

      {!loading && data.pagina < data.totalPaginas && (
        <button onClick={verMas} disabled={loadingMore} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60">
          {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />} Ver más reseñas
        </button>
      )}
    </div>
  );
}
