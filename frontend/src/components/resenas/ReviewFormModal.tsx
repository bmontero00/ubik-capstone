'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Trash2, MessageSquareQuote, CalendarDays } from 'lucide-react';
import StarInput from './StarInput';
import { RESENA, Resena, crearResena, editarResena, eliminarResena, diasRestantes } from '../../services/resenas';
import { formatEventDate } from '../../services/events';

interface ReviewFormModalProps {
  evento: { id: string; title: string; date: string };
  resena?: Resena | null; // si viene, se edita
  cierre?: string; // fin del plazo para reseñar
  onClose: () => void;
  onSaved: (resena: Resena | null, mensaje: string) => void; // null = eliminada
}

// Formulario para calificar un evento al que se asistió: estrellas + comentario de 20 a 500 caracteres
export default function ReviewFormModal({ evento, resena, cierre, onClose, onSaved }: ReviewFormModalProps) {
  const [estrellas, setEstrellas] = useState(resena?.estrellas ?? 0);
  const [comentario, setComentario] = useState(resena?.comentario ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const largo = comentario.trim().length;
  const faltan = RESENA.minComentario - largo;
  const errorEstrellas = !estrellas ? 'Elige de 1 a 5 estrellas' : null;
  const errorComentario = largo < RESENA.minComentario
    ? `Escribe al menos ${RESENA.minComentario} caracteres (te faltan ${faltan})`
    : largo > RESENA.maxComentario ? `Máximo ${RESENA.maxComentario} caracteres` : null;
  const sinCambios = !!resena && resena.estrellas === estrellas && resena.comentario === comentario.trim();
  const dias = cierre ? diasRestantes(cierre) : null;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errorEstrellas || errorComentario || sinCambios) return;
    setBusy(true);
    setError(null);
    try {
      const guardada = resena
        ? await editarResena(resena.id, estrellas, comentario.trim())
        : await crearResena(evento.id, estrellas, comentario.trim());
      onSaved(guardada, resena ? 'Actualizamos tu reseña.' : '¡Gracias por tu reseña! Ya es visible en el perfil del organizador.');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const eliminar = async () => {
    if (!resena) return;
    setBusy(true);
    setError(null);
    try {
      await eliminarResena(resena.id);
      onSaved(null, 'Eliminamos tu reseña.');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-form-title"
    >
      <form onSubmit={guardar} className="relative w-full sm:max-w-lg max-h-[94vh] overflow-y-auto ubik-scroll bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-7">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white">
          <X className="w-5 h-5" />
        </button>

        <p className="text-[11px] uppercase tracking-wider font-bold text-amber-300 flex items-center gap-1.5">
          <MessageSquareQuote className="w-3.5 h-3.5" /> {resena ? 'Editar tu reseña' : 'Califica tu experiencia'}
        </p>
        <h2 id="review-form-title" className="mt-1.5 pr-10 text-xl font-extrabold text-white leading-snug break-words">{evento.title}</h2>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {formatEventDate(evento.date)}</p>

        <div className="mt-6">
          <StarInput value={estrellas} onChange={setEstrellas} disabled={busy} />
          {touched && errorEstrellas && <p className="text-xs text-rose-300 text-center mt-1">{errorEstrellas}</p>}
        </div>

        <label htmlFor="review-comment" className="block mt-6 text-sm font-semibold text-slate-200">Cuéntanos cómo te fue</label>
        <p className="text-[11px] text-slate-500 mt-0.5">¿Qué te gustó? ¿Qué podría mejorar? Tu comentario ayuda a otros asistentes y al organizador.</p>
        <textarea
          id="review-comment"
          value={comentario}
          onChange={(e) => setComentario(e.target.value.slice(0, RESENA.maxComentario))}
          onBlur={() => setTouched(true)}
          rows={5}
          maxLength={RESENA.maxComentario}
          disabled={busy}
          placeholder="Ej. La organización fue muy buena y el lugar era cómodo. Mejoraría la señalética para llegar."
          className={`mt-2 w-full px-3.5 py-3 text-sm rounded-xl bg-slate-950 border text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 resize-none ${
            touched && errorComentario ? 'border-rose-500/60 focus:ring-rose-500/40' : 'border-slate-700 focus:ring-indigo-500/50'
          }`}
        />
        <div className="flex justify-between gap-3 text-[11px] mt-1">
          <span className={touched && errorComentario ? 'text-rose-300' : 'text-slate-500'}>
            {touched && errorComentario ? errorComentario : faltan > 0 ? `Mínimo ${RESENA.minComentario} caracteres` : 'Se publicará con tu nombre y la inicial de tu apellido'}
          </span>
          <span className={`tabular-nums shrink-0 ${largo > RESENA.maxComentario - 50 ? 'text-amber-300' : largo >= RESENA.minComentario ? 'text-emerald-300' : 'text-slate-500'}`}>
            {largo}/{RESENA.maxComentario}
          </span>
        </div>

        {error && <p className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">{error}</p>}

        <button
          type="submit"
          disabled={busy || sinCambios}
          className="mt-5 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {resena ? (sinCambios ? 'Sin cambios' : 'Guardar cambios') : 'Publicar reseña'}
        </button>
        {dias !== null && (
          <p className="mt-2 text-[11px] text-slate-500 text-center">
            {resena ? 'Puedes editarla' : 'Puedes reseñar'} durante {dias === 1 ? '1 día más' : `${dias} días más`}.
          </p>
        )}

        {resena && (
          <div className="mt-5 pt-4 border-t border-slate-800">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-rose-200">¿Eliminar tu reseña? Esta acción no se puede deshacer.</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Cancelar</button>
                  <button type="button" onClick={eliminar} disabled={busy} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white">Eliminar</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-300">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar reseña
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
