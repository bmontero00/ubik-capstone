'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Inbox, IdCard, Phone, Building2, Link2, CalendarDays, Mail, X } from 'lucide-react';
import { AccountStatus, EventStatus, OrganizerStatus, UserRole, apiJson } from '../../services/auth';
import {
  ACCOUNT_STATUS_LABELS, ACCOUNT_STATUSES_WITH_REASON, EVENT_STATUS_LABELS, ORGANIZER_STATUS_LABELS,
  ROLE_LABELS, StatusPill, formatDate,
} from '../../utils/labels';
import { formatRut } from '../../utils/rut';
import StatusChangeForm, { StatusOption } from './StatusChangeForm';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  organizerProfile: { status: OrganizerStatus } | null;
  _count: { events: number };
}

interface UserDetail extends Omit<UserRow, 'organizerProfile'> {
  statusChangedBy: { id: string; name: string } | null;
  organizerProfile: {
    status: OrganizerStatus;
    rut: string;
    phone: string;
    organizationName: string | null;
    eventDescription: string;
    socialUrl: string | null;
    rejectionReason: string | null;
    reviewedAt: string | null;
    createdAt: string;
  } | null;
  events: { id: string; title: string; date: string; status: EventStatus }[];
}

type Group = 'active' | 'flagged';
type RoleFilter = 'ALL' | 'ATTENDEE' | 'ORGANIZER';
type FlaggedFilter = 'ALL' | 'UNDER_REVIEW' | 'SUSPENDED';

const ACCOUNT_OPTIONS: StatusOption<AccountStatus>[] = [
  { value: 'ACTIVE', description: 'Uso normal de la plataforma.', ...ACCOUNT_STATUS_LABELS.ACTIVE },
  {
    value: 'UNDER_REVIEW',
    description: 'Puede iniciar sesión y ver eventos, pero no comprar ni crear o modificar eventos.',
    ...ACCOUNT_STATUS_LABELS.UNDER_REVIEW,
  },
  { value: 'SUSPENDED', description: 'No puede iniciar sesión. Verá el motivo al intentarlo.', ...ACCOUNT_STATUS_LABELS.SUSPENDED },
];

export default function UsersTab({ onChanged }: { onChanged: () => void }) {
  const [group, setGroup] = useState<Group>('active');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [flaggedStatus, setFlaggedStatus] = useState<FlaggedFilter>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Espera a que el admin termine de escribir antes de buscar
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ group });
    if (role !== 'ALL') params.set('role', role);
    if (group === 'flagged' && flaggedStatus !== 'ALL') params.set('status', flaggedStatus);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    return params.toString();
  }, [group, role, flaggedStatus, debouncedSearch]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await apiJson<UserRow[]>(`/admin/users?${query}`));
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    apiJson<UserDetail>(`/admin/users/${selectedId}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const changeGroup = (next: Group) => {
    setGroup(next);
    setFlaggedStatus('ALL');
    setSelectedId(null);
  };

  const updateStatus = async (status: AccountStatus, reason: string) => {
    if (!detail) return;
    const updated = await apiJson<UserDetail>(`/admin/users/${detail.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason: reason || undefined }),
    });
    setDetail(updated);
    setNotice(`Estado de ${updated.name} actualizado a "${ACCOUNT_STATUS_LABELS[updated.status].label}".`);
    // El usuario puede salir de la lista actual (ej. de activos a suspendidos)
    loadUsers();
    onChanged();
  };

  return (
    <section className="mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-semibold" role="tablist">
          <SegmentButton active={group === 'active'} onClick={() => changeGroup('active')}>Usuarios activos</SegmentButton>
          <SegmentButton active={group === 'flagged'} onClick={() => changeGroup('flagged')}>Suspendidos y en revisión</SegmentButton>
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className="text-slate-500 font-semibold mr-1">Tipo:</span>
        {(['ALL', 'ATTENDEE', 'ORGANIZER'] as RoleFilter[]).map((r) => (
          <Chip key={r} active={role === r} onClick={() => setRole(r)}>
            {r === 'ALL' ? 'Todos' : r === 'ATTENDEE' ? 'Asistentes' : 'Organizadores'}
          </Chip>
        ))}
        {group === 'flagged' && (
          <>
            <span className="text-slate-500 font-semibold ml-3 mr-1">Estado:</span>
            {(['ALL', 'UNDER_REVIEW', 'SUSPENDED'] as FlaggedFilter[]).map((s) => (
              <Chip key={s} active={flaggedStatus === s} onClick={() => setFlaggedStatus(s)}>
                {s === 'ALL' ? 'Todos' : ACCOUNT_STATUS_LABELS[s].label}
              </Chip>
            ))}
          </>
        )}
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="text-emerald-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 text-xs text-slate-400">
            {loading ? 'Cargando…' : `${users.length} usuario${users.length === 1 ? '' : 's'}`}
          </div>
          {error ? (
            <p className="p-4 text-sm text-rose-400">{error}</p>
          ) : loading ? (
            <div className="flex justify-center py-10 text-indigo-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-500 text-sm">
              <Inbox className="w-7 h-7 mb-2" />
              {group === 'active' ? 'No hay usuarios activos con estos filtros.' : 'No hay cuentas suspendidas ni en revisión.'}
            </div>
          ) : (
            <ul className="max-h-[600px] overflow-y-auto divide-y divide-slate-800">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => { setSelectedId(u.id); setNotice(null); }}
                    aria-current={selectedId === u.id}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                      selectedId === u.id ? 'bg-indigo-500/10' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <Avatar name={u.name} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-white truncate">{u.name}</span>
                      <span className="block text-xs text-slate-400 truncate">{u.email}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <StatusPill {...ROLE_LABELS[u.role]} />
                      {u.status !== 'ACTIVE' && <StatusPill {...ACCOUNT_STATUS_LABELS[u.status]} />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 lg:sticky lg:top-20">
          {!selectedId ? (
            <div className="flex flex-col items-center py-16 text-slate-500 text-sm text-center">
              <Inbox className="w-8 h-8 mb-2" />
              Selecciona un usuario del listado para ver su información y cambiar su estado.
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex justify-center py-16 text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <UserDetailPanel detail={detail} onUpdateStatus={updateStatus} />
          )}
        </div>
      </div>
    </section>
  );
}

function UserDetailPanel({
  detail, onUpdateStatus,
}: {
  detail: UserDetail;
  onUpdateStatus: (status: AccountStatus, reason: string) => Promise<void>;
}) {
  const profile = detail.organizerProfile;

  return (
    <div>
      <div className="flex items-start gap-4 mb-5">
        <Avatar name={detail.name} large />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white truncate">{detail.name}</h3>
          <p className="flex items-center gap-1.5 text-xs text-slate-400 truncate"><Mail className="w-3.5 h-3.5" /> {detail.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <StatusPill {...ROLE_LABELS[detail.role]} />
            <StatusPill {...ACCOUNT_STATUS_LABELS[detail.status]} />
            {profile && <StatusPill {...ORGANIZER_STATUS_LABELS[profile.status]} />}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs mb-5">
        <Info label="Registrado el" value={formatDate(detail.createdAt)} />
        <Info label="Eventos creados" value={String(detail._count.events)} />
      </dl>

      {detail.status !== 'ACTIVE' && (
        <div className={`mb-5 p-3 rounded-xl border text-xs ${detail.status === 'SUSPENDED' ? 'bg-rose-500/10 border-rose-500/25' : 'bg-amber-500/10 border-amber-500/25'}`}>
          <p className="font-semibold text-slate-200 mb-1">Motivo del estado actual</p>
          <p className="text-slate-300">{detail.statusReason || 'Sin motivo registrado.'}</p>
          <p className="text-slate-500 mt-1">
            {formatDate(detail.statusChangedAt, true)}
            {detail.statusChangedBy && ` · por ${detail.statusChangedBy.name}`}
          </p>
        </div>
      )}

      {profile && (
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Datos de verificación</p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-300 mb-2">
            <span className="flex items-center gap-2"><IdCard className="w-3.5 h-3.5 text-slate-500" /> {formatRut(profile.rut)}</span>
            <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-500" /> {profile.phone}</span>
            {profile.organizationName && (
              <span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-slate-500" /> {profile.organizationName}</span>
            )}
            {profile.socialUrl && (
              <a href={profile.socialUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-300 hover:underline truncate">
                <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {profile.socialUrl}
              </a>
            )}
          </div>
          <p className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3">{profile.eventDescription}</p>
        </div>
      )}

      {detail.events.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Últimos eventos</p>
          <ul className="space-y-1.5">
            {detail.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                <span className="flex items-center gap-2 text-slate-300 truncate">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {e.title}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500">{formatDate(e.date)}</span>
                  <StatusPill {...EVENT_STATUS_LABELS[e.status]} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-4 border-t border-slate-800">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Cambiar estado de la cuenta</p>
        <StatusChangeForm
          current={detail.status}
          options={ACCOUNT_OPTIONS}
          statusesWithReason={ACCOUNT_STATUSES_WITH_REASON}
          reasonPlaceholder="Ej. Recibimos reportes por publicar eventos falsos."
          confirmText={{ SUSPENDED: `${detail.name} no podrá volver a iniciar sesión hasta que reactives su cuenta. ¿Confirmas la suspensión?` }}
          onSubmit={onUpdateStatus}
        />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 font-semibold">{value}</dd>
    </div>
  );
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      className={`${large ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'} rounded-full bg-slate-800 text-slate-200 font-bold flex items-center justify-center shrink-0`}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full border font-semibold transition-colors ${
        active ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-200' : 'border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
