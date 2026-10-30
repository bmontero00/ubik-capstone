import type { AccountStatus, EventStatus, OrganizerStatus, UserRole } from '../services/auth';

interface Label {
  label: string;
  className: string; // clases de Tailwind para la etiqueta
}

export const ROLE_LABELS: Record<UserRole, Label> = {
  ATTENDEE: { label: 'Asistente', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  ORGANIZER: { label: 'Organizador', className: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25' },
  ADMIN: { label: 'Admin', className: 'bg-amber-500/10 text-amber-300 border-amber-500/25' },
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, Label> = {
  ACTIVE: { label: 'Activa', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' },
  UNDER_REVIEW: { label: 'En revisión', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  SUSPENDED: { label: 'Suspendida', className: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
};

export const ORGANIZER_STATUS_LABELS: Record<OrganizerStatus, Label> = {
  PENDING: { label: 'Verificación pendiente', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  APPROVED: { label: 'Verificado', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' },
  REJECTED: { label: 'Solicitud rechazada', className: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
};

export const EVENT_STATUS_LABELS: Record<EventStatus, Label & { description: string }> = {
  PUBLISHED: {
    label: 'Publicado',
    description: 'Visible en el catálogo y disponible para reservas',
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  },
  UNDER_REVIEW: {
    label: 'En revisión',
    description: 'Oculto del catálogo mientras se revisa (ej. por reportes)',
    className: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  POSTPONED: {
    label: 'Postergado',
    description: 'Visible con aviso; no acepta reservas hasta nueva fecha',
    className: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  },
  CANCELLED: {
    label: 'Cancelado',
    description: 'Visible con aviso de cancelación; no acepta reservas',
    className: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
  FINISHED: {
    label: 'Finalizado',
    description: 'Ya se realizó; sale del catálogo',
    className: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  },
};

// Estados que exigen motivo (mismas reglas que el backend)
export const ACCOUNT_STATUSES_WITH_REASON: AccountStatus[] = ['UNDER_REVIEW', 'SUSPENDED'];
export const EVENT_STATUSES_WITH_REASON: EventStatus[] = ['UNDER_REVIEW', 'POSTPONED', 'CANCELLED'];

export const formatDate = (value: string | null | undefined, withTime = false) =>
  value
    ? new Date(value).toLocaleString('es-CL', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
    : '—';

export const StatusPill = ({ label, className }: Label) => (
  <span className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border whitespace-nowrap ${className}`}>
    {label}
  </span>
);
