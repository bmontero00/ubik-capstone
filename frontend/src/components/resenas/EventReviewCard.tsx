'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquareQuote, Star, Pencil, Check } from 'lucide-react';
import StarRating from '../organizers/StarRating';
import ReviewFormModal from './ReviewFormModal';
import { EstadoResena, diasRestantes, fetchEstadoResena } from '../../services/resenas';

// En el detalle de un evento finalizado: invita al asistente a calificarlo o le muestra su reseña.
// Si no compró entradas o ya venció el plazo, no muestra nada.
export default function EventReviewCard({ evento, onOpenOrganizerReviews }: {
  evento: { id: string; title: string; date: string };
  onOpenOrganizerReviews?: () => void;
}) {
  const [estado, setEstado] = useState<EstadoResena | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchEstadoResena(evento.id).then((e) => active && setEstado(e)).catch(() => {});
    return () => { active = false; };
  }, [evento.id]);

  if (!estado || (!estado.resena && !estado.puedeResenar)) return null;
  const dias = diasRestantes(estado.cierre);

  return (
    <div className="mt-4">
      {notice && (
        <p className="mb-2 flex items-center gap-2 text-xs text-emerald-200" role="status"><Check className="w-4 h-4" /> {notice}</p>
      )}
      {estado.resena ? (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wider font-bold text-amber-300 flex items-center gap-1.5">
              <MessageSquareQuote className="w-3.5 h-3.5" /> Tu reseña
            </p>
            <div className="flex items-center gap-3">
              {onOpenOrganizerReviews && (
                <button onClick={onOpenOrganizerReviews} className="text-xs font-semibold text-slate-400 hover:text-white">Ver todas</button>
              )}
              {estado.puedeEditar && (
                <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              )}
            </div>
          </div>
          <div className="mt-2"><StarRating value={estado.resena.estrellas} size="sm" /></div>
          <p className="text-sm text-slate-300 mt-1.5 whitespace-pre-line break-words">{estado.resena.comentario}</p>
          {estado.resena.respuesta && (
            <div className="mt-3 pl-3 border-l-2 border-indigo-500/40">
              <p className="text-xs font-semibold text-indigo-200">Respuesta del organizador</p>
              <p className="text-sm text-slate-300 mt-0.5 whitespace-pre-line break-words">{estado.resena.respuesta.texto}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-950">
          <div className="flex gap-1 text-amber-400" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-5 h-5" />)}
          </div>
          <div className="flex-1">
            <p className="font-bold text-amber-100">Asististe a este evento. ¿Cómo te fue?</p>
            <p className="text-xs text-slate-400 mt-0.5">Califica al organizador y deja un comentario · {dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}</p>
          </div>
          <button onClick={() => setOpen(true)} className="self-start sm:self-auto px-4 py-2.5 text-sm font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950">
            Calificar evento
          </button>
        </div>
      )}

      {open && (
        <ReviewFormModal
          evento={evento}
          resena={estado.resena}
          cierre={estado.cierre}
          onClose={() => setOpen(false)}
          onSaved={(resena, mensaje) => {
            setEstado({ ...estado, resena, puedeResenar: !resena, puedeEditar: !!resena });
            setOpen(false);
            setNotice(mensaje);
          }}
        />
      )}
    </div>
  );
}
