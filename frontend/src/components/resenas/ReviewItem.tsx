'use client';

import React, { useState } from 'react';
import { Loader2, Reply, BadgeCheck, Pencil, Trash2, Ticket } from 'lucide-react';
import StarRating from '../organizers/StarRating';
import Avatar from '../account/Avatar';
import { RESENA, Resena, fechaResena, quitarRespuesta, responderResena } from '../../services/resenas';

interface ReviewItemProps {
  resena: Resena;
  organizador: string; // nombre que se muestra en la respuesta
  canReply?: boolean; // el organizador viendo sus propias reseñas
  onOpenEvent?: (eventId: string) => void;
  onChange?: (resena: Resena) => void;
}

// Una reseña: autor, estrellas, evento al que asistió, comentario y la respuesta del organizador
export default function ReviewItem({ resena, organizador, canReply, onOpenEvent, onChange }: ReviewItemProps) {
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState(resena.respuesta?.texto ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const largo = texto.trim().length;
  const invalida = largo < RESENA.minRespuesta || largo > RESENA.maxRespuesta;

  const guardar = async () => {
    if (invalida) return;
    setBusy(true);
    setError(null);
    try {
      onChange?.(await responderResena(resena.id, texto.trim()));
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const quitar = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange?.(await quitarRespuesta(resena.id));
      setTexto('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar nombre={resena.autor} foto={resena.autorFoto} size={36} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              {resena.autor}
              {resena.propia && <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 rounded px-1.5 py-0.5">Tú</span>}
            </p>
            <p className="text-[11px] text-emerald-300/90 flex items-center gap-1"><Ticket className="w-3 h-3" /> Asistente verificado</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <StarRating value={resena.estrellas} size="sm" />
          <p className="text-[11px] text-slate-500 mt-0.5">{fechaResena(resena.fecha)}{resena.editada ? ' · editada' : ''}</p>
        </div>
      </div>

      <p className="text-sm text-slate-300 mt-3 whitespace-pre-line break-words leading-relaxed">{resena.comentario}</p>

      {onOpenEvent ? (
        <button onClick={() => onOpenEvent(resena.evento.id)} className="mt-2 text-[11px] text-slate-500 hover:text-indigo-300 text-left">
          Asistió a <span className="font-semibold underline decoration-slate-700 underline-offset-2">{resena.evento.title}</span>
        </button>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">Asistió a <span className="font-semibold">{resena.evento.title}</span></p>
      )}

      {/* Respuesta del organizador */}
      {resena.respuesta && !editing && (
        <div className="mt-3 ml-3 pl-3 border-l-2 border-indigo-500/40">
          <p className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" /> Respuesta de {organizador}
            <span className="font-normal text-slate-500">· {fechaResena(resena.respuesta.fecha)}</span>
          </p>
          <p className="text-sm text-slate-300 mt-1 whitespace-pre-line break-words">{resena.respuesta.texto}</p>
          {canReply && (
            <div className="mt-2 flex gap-3">
              <button onClick={() => { setTexto(resena.respuesta!.texto); setEditing(true); }} disabled={busy} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white">
                <Pencil className="w-3 h-3" /> Editar
              </button>
              <button onClick={quitar} disabled={busy} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-300">
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Quitar
              </button>
            </div>
          )}
        </div>
      )}

      {canReply && !resena.respuesta && !editing && (
        <button onClick={() => setEditing(true)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200">
          <Reply className="w-3.5 h-3.5" /> Responder públicamente
        </button>
      )}

      {canReply && editing && (
        <div className="mt-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, RESENA.maxRespuesta))}
            rows={3}
            autoFocus
            disabled={busy}
            placeholder="Agradece el comentario o explica qué harás para mejorar. Tu respuesta será pública."
            className="w-full px-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
            <span className={`text-[11px] tabular-nums ${largo && invalida ? 'text-amber-300' : 'text-slate-500'}`}>
              {largo < RESENA.minRespuesta ? `Mínimo ${RESENA.minRespuesta} caracteres · ` : ''}{largo}/{RESENA.maxRespuesta}
            </span>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setTexto(resena.respuesta?.texto ?? ''); setError(null); }} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={guardar} disabled={busy || invalida} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40">
                {busy && <Loader2 className="w-3 h-3 animate-spin" />} Publicar respuesta
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </li>
  );
}
