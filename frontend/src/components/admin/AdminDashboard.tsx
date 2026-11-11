'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, ShieldCheck, Users, CalendarCog, ChartColumn, Compass, Percent, Tags } from 'lucide-react';
import CategoriesTab from './CategoriesTab';
import { EventStatus, apiJson } from '../../services/auth';
import AdminPanel from '../AdminPanel';
import OverviewTab, { Overview } from './OverviewTab';
import UsersTab, { FlaggedStatusFilter, UserGroup, UserRoleFilter } from './UsersTab';
import EventsTab from './EventsTab';
import ReportsTab from './ReportsTab';
import CargosTab from './CargosTab';

export type AdminTab = 'overview' | 'requests' | 'users' | 'events' | 'categories' | 'cargos' | 'reports' | 'explore';

// Filtro con el que se abre una pestaña desde una tarjeta del resumen
export type AdminFilter =
  | { events: EventStatus[] }
  | { users: { group: UserGroup; role?: UserRoleFilter; status?: FlaggedStatusFilter } };

const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'requests', label: 'Solicitudes', icon: ShieldCheck },
  { id: 'users', label: 'Gestión de usuarios', icon: Users },
  { id: 'events', label: 'Gestión de eventos', icon: CalendarCog },
  { id: 'categories', label: 'Categorías', icon: Tags },
  { id: 'cargos', label: 'Cargos', icon: Percent },
  { id: 'reports', label: 'Reportes', icon: ChartColumn },
  { id: 'explore', label: 'Explorar', icon: Compass },
];

const TAB_STORAGE_KEY = 'ubik_admin_tab';

interface AdminDashboardProps {
  explore: React.ReactNode; // buscador, mapa y catálogo de la vista normal
  onEventsChanged: () => void;
  onOpenEvent: (id: string) => void; // detalle del evento, donde el equipo publica anotaciones
  onCategoriesChanged: () => void; // vuelve a cargar las categorías del sitio (colores, emojis, disponibles)
}

export default function AdminDashboard({ explore, onEventsChanged, onOpenEvent, onCategoriesChanged }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  // Filtro elegido desde el resumen; "visit" vuelve a montar la pestaña para aplicarlo
  const [filter, setFilter] = useState<{ value?: AdminFilter; visit: number }>({ visit: 0 });
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

  const selectTab = (next: AdminTab, value?: AdminFilter) => {
    setFilter((prev) => ({ value, visit: prev.visit + 1 }));
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
    cargos: overview?.pendingConditions ?? 0,
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
      {tab === 'users' && (
        <UsersTab
          key={filter.visit}
          initialFilter={filter.value && 'users' in filter.value ? filter.value.users : undefined}
          onChanged={loadOverview}
        />
      )}
      {tab === 'events' && (
        <EventsTab
          key={filter.visit}
          initialStatuses={filter.value && 'events' in filter.value ? filter.value.events : undefined}
          onChanged={() => { loadOverview(); onEventsChanged(); }}
          onOpenEvent={onOpenEvent}
        />
      )}
      {tab === 'categories' && <CategoriesTab onChanged={() => { onCategoriesChanged(); onEventsChanged(); }} />}
      {tab === 'cargos' && <CargosTab onChanged={() => { loadOverview(); onEventsChanged(); }} />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'explore' && explore}
    </div>
  );
}
