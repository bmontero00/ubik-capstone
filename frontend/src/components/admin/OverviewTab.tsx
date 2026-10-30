'use client';

import React from 'react';
import { Loader2, ShieldCheck, Users, UserX, TriangleAlert, CalendarCheck, CalendarX2, ChevronRight } from 'lucide-react';
import type { AccountStatus, EventStatus, UserRole } from '../../services/auth';
import type { AdminTab } from './AdminDashboard';

export interface Overview {
  users: { role: UserRole; status: AccountStatus; count: number }[];
  pendingOrganizers: number;
  rejectedOrganizers: number;
  events: { status: EventStatus; count: number }[];
  upcomingEvents: number;
}

interface OverviewTabProps {
  overview: Overview | null;
  onNavigate: (tab: AdminTab) => void;
}

export default function OverviewTab({ overview, onNavigate }: OverviewTabProps) {
  if (!overview) {
    return (
      <div className="flex justify-center py-16 text-indigo-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const countUsers = (filter: (u: Overview['users'][number]) => boolean) =>
    overview.users.filter(filter).reduce((sum, u) => sum + u.count, 0);
  const countEvents = (...statuses: EventStatus[]) =>
    overview.events.filter((e) => statuses.includes(e.status)).reduce((sum, e) => sum + e.count, 0);

  const cards: {
    label: string;
    value: number;
    hint: string;
    icon: React.ElementType;
    tone: string;
    tab: AdminTab;
    highlight?: boolean;
  }[] = [
    {
      label: 'Solicitudes pendientes',
      value: overview.pendingOrganizers,
      hint: 'Organizadores esperando verificación',
      icon: ShieldCheck,
      tone: 'text-amber-300 bg-amber-500/15',
      tab: 'requests',
      highlight: overview.pendingOrganizers > 0,
    },
    {
      label: 'Asistentes activos',
      value: countUsers((u) => u.role === 'ATTENDEE' && u.status === 'ACTIVE'),
      hint: 'Cuentas de asistente habilitadas',
      icon: Users,
      tone: 'text-emerald-300 bg-emerald-500/15',
      tab: 'users',
    },
    {
      label: 'Organizadores activos',
      value: countUsers((u) => u.role === 'ORGANIZER' && u.status === 'ACTIVE'),
      hint: `Verificados y pendientes · ${overview.rejectedOrganizers} rechazados aparte`,
      icon: Users,
      tone: 'text-indigo-300 bg-indigo-500/15',
      tab: 'users',
    },
    {
      label: 'Cuentas en revisión',
      value: countUsers((u) => u.role !== 'ADMIN' && u.status === 'UNDER_REVIEW'),
      hint: 'Usuarios reportados bajo revisión',
      icon: TriangleAlert,
      tone: 'text-amber-300 bg-amber-500/15',
      tab: 'users',
    },
    {
      label: 'Cuentas suspendidas',
      value: countUsers((u) => u.role !== 'ADMIN' && u.status === 'SUSPENDED'),
      hint: 'Sin acceso a la plataforma',
      icon: UserX,
      tone: 'text-rose-300 bg-rose-500/15',
      tab: 'users',
    },
    {
      label: 'Próximos eventos publicados',
      value: overview.upcomingEvents,
      hint: `${countEvents('PUBLISHED')} publicados en total`,
      icon: CalendarCheck,
      tone: 'text-emerald-300 bg-emerald-500/15',
      tab: 'events',
    },
    {
      label: 'Eventos en revisión',
      value: countEvents('UNDER_REVIEW'),
      hint: 'Ocultos del catálogo',
      icon: TriangleAlert,
      tone: 'text-amber-300 bg-amber-500/15',
      tab: 'events',
    },
    {
      label: 'Cancelados o postergados',
      value: countEvents('CANCELLED', 'POSTPONED'),
      hint: 'Visibles con aviso para asistentes',
      icon: CalendarX2,
      tone: 'text-rose-300 bg-rose-500/15',
      tab: 'events',
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {cards.map(({ label, value, hint, icon: Icon, tone, tab, highlight }) => (
        <button
          key={label}
          onClick={() => onNavigate(tab)}
          className={`group text-left bg-slate-900/80 border rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-slate-600 ${
            highlight ? 'border-amber-500/50' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
              <Icon className="w-5 h-5" />
            </span>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
          </div>
          <p className="text-3xl font-extrabold text-white tabular-nums">{value}</p>
          <p className="text-sm font-semibold text-slate-200 mt-1">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </button>
      ))}
    </div>
  );
}
