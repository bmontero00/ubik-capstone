'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { AuthUser } from '../services/auth';
import { ReasonToggle } from './AuthModal';

// Aviso para cuentas que un administrador puso en revisión (por ejemplo, tras un reporte)
export default function AccountStatusBanner({ user }: { user: AuthUser }) {
  if (user.status !== 'UNDER_REVIEW') return null;

  return (
    <div className="mb-6 flex gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-100" role="alert">
      <TriangleAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
      <div className="flex-1">
        <strong className="text-amber-300">Tu cuenta se encuentra en revisión.</strong> Mientras dure la revisión solo
        puedes ver los eventos actuales: no podrás comprar ni reservar entradas
        {user.role === 'ORGANIZER' && ', ni crear o modificar eventos'}.
        <ReasonToggle reason={user.statusReason} dateLabel="En revisión desde el" date={user.statusChangedAt} tone="amber" compact />
      </div>
    </div>
  );
}
