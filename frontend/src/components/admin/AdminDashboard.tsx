'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, ShieldCheck, Users, CalendarCog, ChartColumn, Compass } from 'lucide-react';
import { apiJson } from '../../services/auth';
import AdminPanel from '../AdminPanel';
import OverviewTab, { Overview } from './OverviewTab';
import UsersTab from './UsersTab';
import EventsTab from './EventsTab';
import ReportsTab from './ReportsTab';

export type AdminTab = 'overview' | 'requests' | 'users' | 'events' | 'reports' | 'explore';

const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'requests', label: 'Solicitudes', icon: ShieldCheck },
  { id: 'users', label: 'Gestión de usuarios', icon: Users },
  { id: 'events', label: 'Gestión de eventos', icon: CalendarCog },
  { id: 'reports', label: 'Reportes', icon: ChartColumn },
  { id: 'explore', label: 'Explorar', icon: Compass },
];

const TAB_STORAGE_KEY = 'ubik_admin_tab';

interface AdminDashboardProps {
  explore: React.ReactNode; // buscador, mapa y catálogo de la vista normal
  onEventsChanged: () => void;
}

export default function AdminDashboard({ explore, onEventsChanged }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);

  // Recuerda la última pestaña abierta en este navegador
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE_KEY) as AdminTab | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {}
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await apiJson<Overview>('/admin/overview'));
    } catch {
      setOverview(null);
    }
  }, []);

  // El resumen alimenta los contadores de las pestañas; se refresca al cambiar de pestaña
  useEffect(() => {
    loadOverview();
  }, [tab, loadOverview]);

  const selectTab = (next: AdminTab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {}
  };

  const flaggedUsers =
    overview?.users.filter((u) => u.status !== 'ACTIVE').reduce((sum, u) => sum + u.count, 0) ?? 0;
  const badges: Partial<Record<AdminTab, number>> = {
    requests: overview?.pendingOrganizers ?? 0,
    users: flaggedUsers,
  };

  return (
    <div>
      <nav
        className="mb-6 flex gap-1 overflow-x-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-1.5"
        role="tablist"
        aria-label="Secciones de administración"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => selectTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {!!badges[id] && (
              <span
                className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                  tab === id ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {badges[id]}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab overview={overview} onNavigate={selectTab} />}
      {tab === 'requests' && <AdminPanel />}
      {tab === 'users' && <UsersTab onChanged={loadOverview} />}
      {tab === 'events' && <EventsTab onChanged={() => { loadOverview(); onEventsChanged(); }} />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'explore' && explore}
    </div>
  );
}
