'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Building2, Loader2, TriangleAlert, Users, Pencil, Ban, GitMerge, Search, X } from 'lucide-react';
import { apiJson } from '../../services/auth';
import { formatRut, isValidRut } from '../../utils/rut';
import ReasonField, { validateReason } from './ReasonField';
import { Chip } from './UsersTab';

type EstadoOrg = 'PENDIENTE' | 'VERIFICADA' | 'RECHAZADA';
interface Organizacion {
  id: string;
  nombre: string;
  rut: string | null;
  estado: EstadoOrg;
  motivoRechazo: string | null;
  verificadaEn: string | null;
  verificadaPor: string | null;
  fechaCreacion: string;
  miembros: { perfilId: string; estado: 'PENDING' | 'APPROVED' | 'REJECTED'; nombre: string; email: string }[];
  parecidas: { id: string; nombre: string; rut: string | null; estado: EstadoOrg; coincidencia: 'igual' | 'parecido' }[];
}

type Filtro = 'alertas' | 'PENDIENTE' | 'VERIFICADA' | 'RECHAZADA' | 'todas';
type Accion = { id: string; tipo: 'verificar' | 'editar' | 'rechazar' | 'fusionar' } | null;

const ESTADO: Record<EstadoOrg, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Por verificar', clase: 'bg-amber-500/15 text-amber-200 border-amber-500/30' },
  VERIFICADA: { texto: 'Verificada', clase: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
  RECHAZADA: { texto: 'Rechazada', clase: 'bg-rose-500/15 text-rose-200 border-rose-500/30' },
};
const MIEMBRO: Record<string, string> = { PENDING: 'solicitud pendiente', APPROVED: 'aprobado', REJECTED: 'rechazado' };
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Organizaciones de la plataforma: el administrador las verifica (con su RUT), corrige sus datos,
// rechaza las que no corresponden y fusiona los duplicados (ej. dos "Duoc")
export default function OrganizationsTab() {
  const [orgs, setOrgs] = useState<Organizacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('alertas');
  const [q, setQ] = useState('');
  const [accion, setAccion] = useState<Accion>(null);
  const [form, setForm] = useState({ nombre: '', rut: '', motivo: '', destinoId: '' });
  const [intento, setIntento] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tono: 'ok' | 'error' } | null>(null);

  const cargar = useCallback(() => {
    apiJson<Organizacion[]>('/organizaciones').then(setOrgs).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(cargar, [cargar]);

  const conteo = useMemo(() => ({
    alertas: orgs?.filter((o) => o.estado !== 'RECHAZADA' && (o.parecidas.length > 0 || !o.rut)).length ?? 0,
    PENDIENTE: orgs?.filter((o) => o.estado === 'PENDIENTE').length ?? 0,
    VERIFICADA: orgs?.filter((o) => o.estado === 'VERIFICADA').length ?? 0,
    RECHAZADA: orgs?.filter((o) => o.estado === 'RECHAZADA').length ?? 0,
    todas: orgs?.length ?? 0,
  }), [orgs]);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return (orgs ?? [])
      .filter((o) => filtro === 'todas' || (filtro === 'alertas' ? o.estado !== 'RECHAZADA' && (o.parecidas.length > 0 || !o.rut) : o.estado === filtro))
      .filter((o) => !t || normalizar(o.nombre).includes(t) || (o.rut ?? '').replace(/[.-]/g, '').toLowerCase().includes(t.replace(/[.-]/g, '')));
  }, [orgs, filtro, q]);

  const abrir = (o: Organizacion, tipo: NonNullable<Accion>['tipo']) => {
    setAccion({ id: o.id, tipo });
    setForm({ nombre: o.nombre, rut: o.rut ? formatRut(o.rut) : '', motivo: '', destinoId: o.parecidas.find((x) => x.estado !== 'RECHAZADA')?.id ?? '' });
    setIntento(false);
    setAviso(null);
  };

  const ejecutar = async (o: Organizacion) => {
    if (!accion) return;
    setIntento(true);
    const rut = form.rut.trim();
    if ((accion.tipo === 'verificar' || accion.tipo === 'editar') && rut && !isValidRut(rut)) return;
    if (accion.tipo === 'verificar' && !rut) return;
    if ((accion.tipo === 'verificar' || accion.tipo === 'editar') && form.nombre.trim().length < 2) return;
    if (accion.tipo === 'rechazar' && validateReason(form.motivo)) return;
    if (accion.tipo === 'fusionar' && !form.destinoId) return;
    setBusy(true);
    try {
      if (accion.tipo === 'verificar') {
        await apiJson(`/organizaciones/${o.id}/verificar`, { method: 'PATCH', body: JSON.stringify({ rut, nombre: form.nombre.trim() }) });
        setAviso({ texto: `"${form.nombre.trim()}" quedó verificada. Sus organizadores ya muestran la insignia.`, tono: 'ok' });
      } else if (accion.tipo === 'editar') {
        await apiJson(`/organizaciones/${o.id}`, { method: 'PATCH', body: JSON.stringify({ nombre: form.nombre.trim(), rut: rut || null }) });
        setAviso({ texto: 'Datos actualizados.', tono: 'ok' });
      } else if (accion.tipo === 'rechazar') {
        await apiJson(`/organizaciones/${o.id}/rechazar`, { method: 'PATCH', body: JSON.stringify({ motivo: form.motivo.normalize('NFC').trim() }) });
        setAviso({ texto: `"${o.nombre}" fue rechazada: sus organizadores ahora aparecen a título personal.`, tono: 'ok' });
      } else {
        const r = await apiJson<{ movidos: number; destino: string }>(`/organizaciones/${o.id}/fusionar`, { method: 'POST', body: JSON.stringify({ destinoId: form.destinoId }) });
        setAviso({ texto: `Fusionada en "${r.destino}": ${r.movidos} ${r.movidos === 1 ? 'organizador pasó' : 'organizadores pasaron'} a esa organización.`, tono: 'ok' });
      }
      setAccion(null);
      cargar();
    } catch (e) {
      setAviso({ texto: (e as Error).message, tono: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500';

  return (
    <section className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {([['alertas', 'Con alertas'], ['PENDIENTE', 'Por verificar'], ['VERIFICADA', 'Verificadas'], ['RECHAZADA', 'Rechazadas'], ['todas', 'Todas']] as const).map(([id, label]) => (
            <Chip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{label} · {conteo[id]}</Chip>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o RUT" aria-label="Buscar organización" className={`${input} pl-9`} />
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        El RUT de cada organización es único. Verifica solo las que comprobaste en el SII; las organizaciones con nombre igual o parecido pueden ser duplicados (fusiónalas) o intentos de suplantación (recházalas).
      </p>

      {aviso && (
        <p className={`mb-4 p-3 rounded-lg border text-sm flex items-start justify-between gap-3 ${aviso.tono === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`} role="status">
          {aviso.texto}
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso"><X className="w-4 h-4" /></button>
        </p>
      )}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {!orgs && !error && <div className="flex justify-center py-10 text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}
      {orgs && visibles.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No hay organizaciones en este filtro.</p>}

      <ul className="space-y-3">
        {visibles.map((o) => {
          const abierta = accion?.id === o.id ? accion.tipo : null;
          const destinos = (orgs ?? []).filter((x) => x.id !== o.id && x.estado !== 'RECHAZADA');
          return (
            <li key={o.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-white">{o.nombre}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${ESTADO[o.estado].clase}`}>
                      {o.estado === 'VERIFICADA' && <BadgeCheck className="inline w-3 h-3 mr-0.5 -mt-px" />}{ESTADO[o.estado].texto}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    RUT {o.rut ? formatRut(o.rut) : <span className="text-amber-300">sin registrar</span>}
                    {o.verificadaEn && ` · verificada el ${new Date(o.verificadaEn).toLocaleDateString('es-CL')}${o.verificadaPor ? ` por ${o.verificadaPor}` : ''}`}
                  </p>
                  {o.motivoRechazo && <p className="text-xs text-rose-300 mt-1">Motivo del rechazo: {o.motivoRechazo}</p>}
                  <p className="text-xs text-slate-300 mt-2 flex items-start gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500 mt-px shrink-0" />
                    {o.miembros.length === 0 ? 'Sin organizadores' : o.miembros.map((m) => `${m.nombre} (${MIEMBRO[m.estado]})`).join(' · ')}
                  </p>
                  {o.parecidas.length > 0 && o.estado !== 'RECHAZADA' && (
                    <p className="mt-2 text-xs text-amber-200 flex items-start gap-1.5">
                      <TriangleAlert className="w-3.5 h-3.5 mt-px shrink-0" />
                      <span>Nombre {o.parecidas.some((x) => x.coincidencia === 'igual') ? 'igual' : 'parecido'} a: {o.parecidas.map((x) => `${x.nombre} (${x.rut ? formatRut(x.rut) : 'sin RUT'}, ${ESTADO[x.estado].texto.toLowerCase()})`).join(' · ')}</span>
                    </p>
                  )}
                </div>
                {!abierta && (
                  <div className="flex flex-wrap md:flex-col gap-2 shrink-0 md:w-40">
                    {o.estado !== 'VERIFICADA' && (
                      <button onClick={() => abrir(o, 'verificar')} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950"><BadgeCheck className="w-3.5 h-3.5" /> Verificar</button>
                    )}
                    <button onClick={() => abrir(o, 'editar')} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /> Editar datos</button>
                    {destinos.length > 0 && (
                      <button onClick={() => abrir(o, 'fusionar')} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700"><GitMerge className="w-3.5 h-3.5" /> Fusionar en otra</button>
                    )}
                    {o.estado !== 'RECHAZADA' && (
                      <button onClick={() => abrir(o, 'rechazar')} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-rose-600/80"><Ban className="w-3.5 h-3.5" /> Rechazar</button>
                    )}
                  </div>
                )}
              </div>

              {abierta && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                  {(abierta === 'verificar' || abierta === 'editar') && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">Nombre (como en el SII)</span>
                        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={120} className={`${input} mt-1`} />
                        {intento && form.nombre.trim().length < 2 && <span className="text-[11px] text-rose-300">Escribe el nombre</span>}
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">RUT de la organización</span>
                        <input value={form.rut} onChange={(e) => setForm({ ...form, rut: formatRut(e.target.value) })} placeholder="76.123.456-7" className={`${input} mt-1`} />
                        {intento && ((abierta === 'verificar' && !form.rut.trim()) || (form.rut.trim() && !isValidRut(form.rut)))
                          && <span className="text-[11px] text-rose-300">{form.rut.trim() ? 'RUT inválido' : 'Para verificarla necesitas su RUT'}</span>}
                      </label>
                      {abierta === 'verificar' && <p className="sm:col-span-2 text-[11px] text-slate-400">Al verificarla, el nombre se actualiza en los eventos y perfiles de todos sus organizadores, que mostrarán la insignia de organización verificada.</p>}
                    </div>
                  )}
                  {abierta === 'rechazar' && (
                    <ReasonField
                      label="Motivo del rechazo"
                      value={form.motivo}
                      onChange={(v) => setForm({ ...form, motivo: v })}
                      placeholder="Ej. El RUT no corresponde a esta organización según el SII."
                      hint="Sus organizadores pasarán a organizar a título personal: el público verá su nombre."
                      showError={intento}
                      tone="rose"
                      autoFocus
                    />
                  )}
                  {abierta === 'fusionar' && (
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-300">Fusionar "{o.nombre}" en…</span>
                      <select value={form.destinoId} onChange={(e) => setForm({ ...form, destinoId: e.target.value })} className={`${input} mt-1`}>
                        <option value="">Elige la organización que se mantiene</option>
                        {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre} · {d.rut ? formatRut(d.rut) : 'sin RUT'} · {ESTADO[d.estado].texto}</option>)}
                      </select>
                      {intento && !form.destinoId && <span className="text-[11px] text-rose-300">Elige una organización</span>}
                      <span className="block text-[11px] text-slate-400 mt-1">Sus organizadores pasan a la organización elegida y "{o.nombre}" se elimina.</span>
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setAccion(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Cancelar</button>
                    <button onClick={() => ejecutar(o)} disabled={busy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 ${abierta === 'rechazar' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'}`}>
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {abierta === 'verificar' ? 'Verificar organización' : abierta === 'editar' ? 'Guardar cambios' : abierta === 'rechazar' ? 'Confirmar rechazo' : 'Fusionar'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
