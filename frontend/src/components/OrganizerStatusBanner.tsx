'use client';

import React from 'react';
import { Hourglass, CircleX, CircleCheck, RefreshCw, X } from 'lucide-react';
import { AuthUser } from '../services/auth';

interface OrganizerStatusBannerProps {
  user: AuthUser;
  onRefresh: () => void;
  refreshing: boolean;
  // El aviso de cuenta verificada se muestra solo en el primer ingreso tras la aprobación
  showApprovedNotice: boolean;
  onDismissApproved: () => void;
}

// Le muestra al organizador en qué estado está su solicitud de verificación
export default function OrganizerStatusBanner({
  user, onRefresh, refreshing, showApprovedNotice, onDismissApproved,
}: OrganizerStatusBannerProps) {
  if (user.role !== 'ORGANIZER' || !user.organizerStatus) return null;

  if (user.organizerStatus === 'APPROVED') {
    if (!showApprovedNotice) return null;
    return (
      <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-200" role="status">
        <CircleCheck className="w-5 h-5 shrink-0 text-emerald-400" />
        <span className="flex-1">
          <strong className="text-emerald-300">Cuenta de organizador verificada.</strong> Haz clic derecho en el mapa
          para publicar un evento en ese punto.
        </span>
        <button
          onClick={onDismissApproved}
          aria-label="Cerrar aviso"
          className="shrink-0 text-emerald-300/70 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isPending = user.organizerStatus === 'PENDING';

  return (
    <div
      className={`mb-6 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border text-sm ${
        isPending ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' : 'bg-rose-500/10 border-rose-500/30 text-rose-100'
      }`}
    >
      {isPending ? (
        <Hourglass className="w-5 h-5 shrink-0 text-amber-400" />
      ) : (
        <CircleX className="w-5 h-5 shrink-0 text-rose-400" />
      )}
      <div className="flex-1">
        {isPending ? (
          <>
            <strong className="text-amber-300">Tu solicitud de organizador está en revisión.</strong> Mientras tanto
            puedes explorar eventos; podrás publicar los tuyos apenas un administrador te apruebe.
          </>
        ) : (
          <>
            <strong className="text-rose-300">Tu solicitud de organizador fue rechazada.</strong>
            {user.rejectionReason && <> Motivo: “{user.rejectionReason}”.</>} Si crees que es un error, contacta al
            equipo de UBIK.
          </>
        )}
      </div>
      {isPending && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Revisar estado
        </button>
      )}
    </div>
  );
}
