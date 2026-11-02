'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Percent, Hourglass, CircleCheck, CircleX, History, BadgePercent, CalendarDays, User as UserIcon, Inbox,
} from 'lucide-react';
import { formatEventDate, formatPercent, formatPrice, priceWithFee } from '../../services/events';
import { CargosResumen, EventoCargo, answerCondition, fetchCargos, updateGlobalFee } from '../../services/cargos';
import { formatDate } from '../../utils/labels';
import ReasonField, { validateReason } from './ReasonField';
import EventFeeForm, { PercentInput, parsePercent } from './EventFeeForm';

// Cargo por servicio: % de la plataforma, solicitudes de condición especial y eventos con % especial
export default function CargosTab({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<CargosResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchCargos());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const changed = (message: string) => {
    setNotice(message);
    load();
    onChanged();
  };

  if (error) return <p className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</p>;
  if (!data) return <div className="flex justify-center py-16 text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <section className="space-y-6">
      {notice && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm" role="status">{notice}</div>}

      <GlobalFee config={data.configuracion} onSaved={(n) => changed(`Desde ahora los eventos nuevos se crearán con ${formatPercent(n)} de cargo. Los eventos existentes mantienen su porcentaje.`)} />

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Hourglass className="w-4 h-4 text-amber-300" /> Solicitudes de condición especial
          {data.pendientes.length > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-200">{data.pendientes.length}</span>}
        </h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">Mientras no respondas, la venta de entradas de estos eventos está en pausa.</p>
        {data.pendientes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-500 py-4"><Inbox className="w-4 h-4" /> No hay solicitudes pendientes.</p>
        ) : (
          <ul className="space-y-3">
            {data.pendientes.map((e) => (
              <ConditionRequest key={e.id} event={e} onAnswered={(decision, title) => changed(
                decision === 'APROBADA'
                  ? `Aprobaste la condición especial de "${title}". La venta de entradas ya está habilitada.`
                  : `Rechazaste la condición especial de "${title}". El evento mantiene su cargo y la venta ya está habilitada.`,
              )} />
            ))}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4"><BadgePercent className="w-4 h-4 text-cyan-300" /> Eventos con % especial</h3>
          {data.especiales.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay eventos con un porcentaje especial.</p>
          ) : (
            <ul className="space-y-3">
              {data.especiales.map((e) => <SpecialEvent key={e.id} event={e} onSaved={() => changed(`Actualizaste el cargo de "${e.title}".`)} />)}
            </ul>
          )}
          <p className="text-[11px] text-slate-500 mt-4">Para fijar un % especial a otro evento, ábrelo en "Gestión de eventos".</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4"><History className="w-4 h-4 text-slate-400" /> Solicitudes resueltas</h3>
          {data.resueltas.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay solicitudes resueltas.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.resueltas.map((e) => (
                <li key={e.id} className="text-xs p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200 truncate">{e.title}</span>
                    {e.estadoCondicion === 'APROBADA'
                      ? <span className="flex items-center gap-1 text-emerald-300 shrink-0"><CircleCheck className="w-3.5 h-3.5" /> Aprobada · {formatPercent(e.porcentajeCargo ?? 0)}</span>
                      : <span className="flex items-center gap-1 text-rose-300 shrink-0"><CircleX className="w-3.5 h-3.5" /> Rechazada</span>}
                  </div>
                  <p className="text-slate-400 mt-1 line-clamp-2">{e.respuestaCondicion}</p>
                  <p className="text-slate-500 mt-1">{formatDate(e.condicionRevisadaEn, true)}{e.condicionRevisadaPor && ` · ${e.condicionRevisadaPor.name}`}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function GlobalFee({ config, onSaved }: { config: CargosResumen['configuracion']; onSaved: (pct: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(String(config.porcentaje));
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parsePercent(pct);

  const submit = async () => {
    setTouched(true);
    if (parsed.error || validateReason(reason)) return;
    setBusy(true);
    setError(null);
    try {
      await updateGlobalFee(parsed.value!, reason.normalize('NFC').trim());
      setEditing(false);
      setReason('');
      setTouched(false);
      onSaved(parsed.value!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-600/15 via-slate-900 to-slate-900 border border-indigo-500/25 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Cargo por servicio vigente</p>
          <p className="text-4xl font-extrabold text-white mt-1">{formatPercent(config.porcentaje)}</p>
          <p className="text-xs text-slate-400 mt-1">
            Se fija a cada evento nuevo al crearlo. Ejemplo: entrada de $10.000 → el público paga {formatPrice(priceWithFee(10000, config.porcentaje))}.
          </p>
          {config.actualizadoEn && config.actualizadoPor && (
            <p className="text-[11px] text-slate-500 mt-1">Último cambio: {formatDate(config.actualizadoEn, true)} · {config.actualizadoPor.name}</p>
          )}
        </div>
        {!editing && (
          <button onClick={() => { setEditing(true); setPct(String(config.porcentaje)); }} className="px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500">Cambiar porcentaje</button>
        )}
      </div>

      {editing && (
        <div className="mt-5 pt-5 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nuevo porcentaje</label>
              <PercentInput value={pct} onChange={setPct} error={touched ? parsed.error : null} />
            </div>
            {parsed.value !== null && (
              <p className="text-xs text-slate-400 pb-2">Entrada de $10.000 → el público pagará <span className="font-bold text-white">{formatPrice(priceWithFee(10000, parsed.value))}</span></p>
            )}
          </div>
          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
            Se aplicará solo a los eventos que se creen desde ahora. Los eventos ya creados mantienen su porcentaje y su precio.
          </p>
          <ReasonField label="Motivo del cambio" value={reason} onChange={setReason} onBlur={() => setTouched(true)} showError={touched} placeholder="Ej. Ajuste de tarifas aprobado para el primer semestre." />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Cancelar</button>
            <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar porcentaje
            </button>
          </div>
        </div>
      )}

      {config.historial.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-white">Historial de cambios ({config.historial.length})</summary>
          <ul className="mt-2 space-y-2">
            {config.historial.map((h) => (
              <li key={h.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-semibold text-slate-200">{h.valorAnterior ?? '—'}% → {h.valorNuevo}%</span>
                <span className="text-slate-500"> · {formatDate(h.fecha, true)} · {h.admin.name}</span>
                <p className="text-slate-400 mt-0.5">{h.motivo}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ConditionRequest({ event, onAnswered }: { event: EventoCargo; onAnswered: (decision: 'APROBADA' | 'RECHAZADA', title: string) => void }) {
  const [decision, setDecision] = useState<'APROBADA' | 'RECHAZADA' | null>(null);
  const [pct, setPct] = useState(String(event.porcentajeSolicitado ?? 0));
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parsePercent(pct);

  const submit = async () => {
    setTouched(true);
    if ((decision === 'APROBADA' && parsed.error) || validateReason(reason)) return;
    setBusy(true);
    setError(null);
    try {
      await answerCondition(event.id, decision!, reason.normalize('NFC').trim(), decision === 'APROBADA' ? parsed.value! : undefined);
      onAnswered(decision!, event.title);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const organizer = event.organizer.organizerProfile?.organizationName || event.organizer.name;
  return (
    <li className="p-4 rounded-2xl bg-slate-950 border border-amber-500/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-white break-words">{event.title}</p>
          <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
            <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> {organizer}</span>
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {formatEventDate(event.date)}</span>
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-slate-400">Entrada {formatPrice(event.price)} · cargo {formatPercent(event.porcentajeCargo ?? 0)}</p>
          <p className="text-amber-200 font-semibold">{event.porcentajeSolicitado !== null && event.porcentajeSolicitado !== undefined ? `Propone ${formatPercent(event.porcentajeSolicitado)}` : 'Sin % propuesto'}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-200 bg-slate-900 border border-slate-800 rounded-xl p-3 whitespace-pre-line break-words">{event.justificacionCondicion}</p>

      {!decision ? (
        <div className="mt-3 flex gap-2 justify-end">
          <button onClick={() => setDecision('RECHAZADA')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-rose-600/80"><CircleX className="w-3.5 h-3.5" /> Rechazar</button>
          <button onClick={() => setDecision('APROBADA')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500"><CircleCheck className="w-3.5 h-3.5" /> Aprobar</button>
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
          {decision === 'APROBADA' && (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Porcentaje que se aplicará</label>
                <PercentInput value={pct} onChange={setPct} error={touched ? parsed.error : null} />
              </div>
              {parsed.value !== null && (
                <p className="text-xs text-slate-400 pb-2">El público pagará <span className="font-bold text-white">{formatPrice(priceWithFee(event.price, parsed.value))}</span> por entrada</p>
              )}
            </div>
          )}
          {decision === 'RECHAZADA' && (
            <p className="text-xs text-slate-400">El evento mantendrá su cargo de {formatPercent(event.porcentajeCargo ?? 0)} y se habilitará la venta.</p>
          )}
          <ReasonField
            label={decision === 'APROBADA' ? 'Motivo de la aprobación (lo verá el organizador)' : 'Motivo del rechazo (lo verá el organizador)'}
            value={reason}
            onChange={setReason}
            onBlur={() => setTouched(true)}
            showError={touched}
            tone={decision === 'APROBADA' ? 'emerald' : 'rose'}
            placeholder={decision === 'APROBADA' ? 'Ej. Aprobado por tratarse de un evento benéfico.' : 'Ej. El evento no cumple los requisitos de una condición especial.'}
            autoFocus
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setDecision(null); setTouched(false); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">Volver</button>
            <button onClick={submit} disabled={busy} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 ${decision === 'APROBADA' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {decision === 'APROBADA' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function SpecialEvent({ event, onSaved }: { event: EventoCargo; onSaved: () => void }) {
  return (
    <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
      <p className="text-sm font-semibold text-white truncate">{event.title}</p>
      <div className="mt-2"><EventFeeForm event={event} onSaved={onSaved} /></div>
      {event.historialCargos && event.historialCargos.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
          {event.historialCargos.slice(0, 3).map((h) => (
            <li key={h.id}>{formatPercent(h.porcentajeAnterior)} → {formatPercent(h.porcentajeNuevo)} · {formatDate(h.fecha)} · {h.admin.name}: <span className="text-slate-400">{h.motivo}</span></li>
          ))}
        </ul>
      )}
    </li>
  );
}
