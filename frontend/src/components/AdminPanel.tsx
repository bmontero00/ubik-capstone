'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Check, X, Loader2, Link2, Phone, IdCard, Building2, Inbox } from 'lucide-react';
import { authFetch, OrganizerStatus } from '../services/auth';
import { formatRut } from '../utils/rut';
import ReasonField, { validateReason } from './admin/ReasonField';

interface OrganizerRequest {
  id: string;
  rut: string;
  phone: string;
  organizationName: string | null;
  eventDescription: string;
  socialUrl: string | null;
  status: OrganizerStatus;
  rejectionReason: string | null;
  approvalNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string } | null;
}

type ReviewAction = 'approve' | 'reject';

// Textos del cuadro de revisión según la acción
const REVIEW_COPY: Record<ReviewAction, { label: string; placeholder: string; hint: string; confirm: string }> = {
  approve: {
    label: 'Motivo de la aprobación',
    placeholder: 'Ej. Identidad verificada con el RUT y su Instagram muestra ferias realizadas en 2025.',
    hint: 'Deja registro de qué verificaste antes de aprobar',
    confirm: 'Confirmar aprobación',
  },
  reject: {
    label: 'Motivo del rechazo (lo verá el organizador)',
    placeholder: 'Ej. El RUT no coincide con el nombre ingresado. Revisa tus datos y vuelve a postular.',
    hint: 'Explica qué debe corregir para volver a postular',
    confirm: 'Confirmar rechazo',
  },
};

const TABS: { status: OrganizerStatus; label: string }[] = [
  { status: 'PENDING', label: 'Pendientes' },
  { status: 'APPROVED', label: 'Aprobados' },
  { status: 'REJECTED', label: 'Rechazados' },
];

// Panel para que el administrador apruebe o rechace solicitudes de organizadores
export default function AdminPanel() {
  const [tab, setTab] = useState<OrganizerStatus>('PENDING');
  const [requests, setRequests] = useState<OrganizerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Solicitud que se está revisando y con qué acción; el motivo es obligatorio en ambos casos
  const [reviewing, setReviewing] = useState<{ id: string; action: ReviewAction } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const startReview = (id: string, action: ReviewAction) => {
    setReviewing({ id, action });
    setReason('');
    setReasonTouched(false);
    setSubmitAttempted(false);
    setError(null);
  };

  const load = async (status: OrganizerStatus) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/admin/organizers?status=${status}`);
      if (!res.ok) throw new Error();
      setRequests(await res.json());
    } catch {
      setError('No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const submitReview = async () => {
    if (!reviewing) return;
    setSubmitAttempted(true);
    if (validateReason(reason)) return;

    const { id, action } = reviewing;
    setBusyId(id);
    setError(null);
    try {
      const res = await authFetch(`/admin/organizers/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.normalize('NFC').trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(Array.isArray(data.message) ? data.message[0] : data.message);
      }
      // Sale de la lista actual sin recargar todo
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setReviewing(null);
      setReason('');
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar la revisión.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-white">Solicitudes de organizadores</h3>
            <p className="text-xs text-slate-400">Verifica la identidad antes de permitir que publiquen eventos</p>
          </div>
        </div>
        <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
          {TABS.map((t) => (
            <button
              key={t.status}
              onClick={() => setTab(t.status)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${tab === t.status ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-slate-500 text-sm">
          <Inbox className="w-8 h-8 mb-2" />
          No hay solicitudes {TABS.find((t) => t.status === tab)?.label.toLowerCase()}.
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => (
            <li key={r.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white">{r.user.name}</p>
                  <p className="text-xs text-slate-400 mb-3">
                    {r.user.email} · solicitó el {new Date(r.createdAt).toLocaleDateString('es-CL')}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-300 mb-3">
                    <span className="flex items-center gap-2"><IdCard className="w-3.5 h-3.5 text-slate-500" /> {formatRut(r.rut)}</span>
                    <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-500" /> {r.phone}</span>
                    {r.organizationName && (
                      <span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-slate-500" /> {r.organizationName}</span>
                    )}
                    {r.socialUrl && (
                      <a href={r.socialUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-300 hover:underline truncate">
                        <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {r.socialUrl}
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg p-3 leading-relaxed">
                    {r.eventDescription}
                  </p>
                  {r.status === 'REJECTED' && r.rejectionReason && (
                    <p className="text-xs text-rose-300 mt-2 whitespace-pre-line break-words">Motivo del rechazo: {r.rejectionReason}</p>
                  )}
                  {r.status === 'APPROVED' && r.approvalNote && (
                    <p className="text-xs text-emerald-300 mt-2 whitespace-pre-line break-words">Motivo de la aprobación: {r.approvalNote}</p>
                  )}
                  {r.reviewedBy && r.reviewedAt && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Revisado por {r.reviewedBy.name} el {new Date(r.reviewedAt).toLocaleDateString('es-CL')}
                    </p>
                  )}
                </div>

                {r.status === 'PENDING' && reviewing?.id !== r.id && (
                  <div className="flex md:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => startReview(r.id, 'approve')}
                      disabled={busyId === r.id}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Aprobar
                    </button>
                    <button
                      onClick={() => startReview(r.id, 'reject')}
                      disabled={busyId === r.id}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-200 disabled:opacity-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Rechazar
                    </button>
                  </div>
                )}
              </div>

              {reviewing?.id === r.id && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <ReasonField
                    label={REVIEW_COPY[reviewing.action].label}
                    value={reason}
                    onChange={setReason}
                    onBlur={() => setReasonTouched(true)}
                    placeholder={REVIEW_COPY[reviewing.action].placeholder}
                    hint={REVIEW_COPY[reviewing.action].hint}
                    showError={reasonTouched || submitAttempted}
                    tone={reviewing.action === 'approve' ? 'emerald' : 'rose'}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setReviewing(null)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitReview}
                      disabled={busyId === r.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors ${
                        reviewing.action === 'approve'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      {busyId === r.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {REVIEW_COPY[reviewing.action].confirm}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
