'use client';

import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X, Loader2, UserPlus, Users, KeyRound, Ban, Pencil, Copy, Check, Smartphone, DoorOpen, Car, Ticket, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import {
  AccesoValidador, CodigoVinculacion, DatosAcceso, EquipoAcceso, EstadoAcceso,
  actualizarAcceso, crearAcceso, fetchEquipoAcceso, regenerarCodigoAcceso, revocarAcceso,
} from '../../services/equipoAcceso';
import { formatEventDate, relativeTime } from '../../services/events';

const ESTADOS: Record<EstadoAcceso, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Sin vincular', clase: 'bg-amber-500/15 text-amber-200 border-amber-500/30' },
  ACTIVO: { texto: 'Activo', clase: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
  REVOCADO: { texto: 'Revocado', clase: 'bg-slate-700/40 text-slate-400 border-slate-600' },
  VENCIDO: { texto: 'Vencido', clase: 'bg-slate-700/40 text-slate-400 border-slate-600' },
};

const vacio = (): DatosAcceso => ({ nombre: '', puerta: '', tiposEntradaIds: [], permiteEstacionamiento: true });

// Equipo de acceso de un evento: quienes validan entradas desde su celular sin la contraseña del
// organizador. Cada acceso puede limitarse a ciertos tipos de entrada (ej. solo VIP).
export default function AccessTeamModal({ eventoId, onClose }: { eventoId: string; onClose: () => void }) {
  const [equipo, setEquipo] = useState<EquipoAcceso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string | null; datos: DatosAcceso } | null>(null);
  const [codigo, setCodigo] = useState<(CodigoVinculacion & { nombre: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(() => {
    fetchEquipoAcceso(eventoId).then(setEquipo).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el equipo'));
  }, [eventoId]);
  useEffect(cargar, [cargar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (codigo ? setCodigo(null) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, codigo]);

  const ejecutar = async (accion: () => Promise<unknown>, despues?: () => void) => {
    setBusy(true);
    setAviso(null);
    try {
      await accion();
      despues?.();
      cargar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const guardar = () => {
    if (!form) return;
    const datos = { ...form.datos, nombre: form.datos.nombre.trim(), puerta: form.datos.puerta?.trim() || null };
    if (datos.nombre.length < 2) return setAviso('Escribe el nombre de la persona o del puesto');
    if (form.id) {
      return ejecutar(() => actualizarAcceso(form.id!, datos), () => setForm(null));
    }
    ejecutar(async () => {
      const c = await crearAcceso(eventoId, datos);
      setCodigo({ ...c, nombre: datos.nombre });
    }, () => setForm(null));
  };

  const activos = equipo?.accesos.filter((a) => a.estado === 'ACTIVO' || a.estado === 'PENDIENTE') ?? [];
  const anteriores = equipo?.accesos.filter((a) => a.estado === 'REVOCADO' || a.estado === 'VENCIDO') ?? [];
  const terminado = equipo ? new Date(equipo.evento.venceEn) < new Date() || equipo.evento.estado === 'CANCELLED' : false;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="equipo-titulo">
      <div className="relative w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto ubik-scroll bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur px-5 sm:px-7 py-4 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="equipo-titulo" className="text-xl font-extrabold text-white flex items-center gap-2"><Users className="w-5 h-5 text-emerald-300" /> Equipo de acceso</h2>
            {equipo && <p className="text-xs text-slate-400 mt-0.5 truncate">{equipo.evento.titulo} · {formatEventDate(equipo.evento.fecha)}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 sm:px-7 py-5 space-y-5">
          <p className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-300 mt-px" />
            <span>
              Crea un acceso por persona o puerta y entrégale su código: lo ingresa en la app de validación y su celular queda
              vinculado. Solo puede validar entradas de este evento (no ve ventas ni datos completos) y puedes limitarlo a ciertos tipos de entrada.
              {equipo && <> Los accesos vencen solos {relativeTime(equipo.evento.venceEn)} (12 horas después del inicio).</>}
            </span>
          </p>

          {error && <p className="text-sm text-rose-300">{error}</p>}
          {!equipo && !error && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>}
          {aviso && <p className="text-sm text-rose-300 flex items-center gap-2" role="alert"><AlertTriangle className="w-4 h-4" /> {aviso}</p>}

          {equipo && !form && !terminado && (
            <button onClick={() => { setAviso(null); setForm({ id: null, datos: vacio() }); }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950">
              <UserPlus className="w-4 h-4" /> Agregar persona
            </button>
          )}
          {equipo && terminado && <p className="text-xs text-slate-400">El evento terminó o fue cancelado: ya no se pueden agregar accesos.</p>}

          {equipo && form && (
            <AccessForm
              equipo={equipo}
              datos={form.datos}
              editando={!!form.id}
              busy={busy}
              onChange={(datos) => setForm({ ...form, datos })}
              onCancel={() => setForm(null)}
              onSave={guardar}
            />
          )}

          {equipo && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Accesos ({activos.length})</h3>
              {activos.length === 0 && <p className="text-sm text-slate-500">Aún no agregas a nadie. Mientras tanto, solo tú puedes validar con tu cuenta.</p>}
              <ul className="space-y-2">
                {activos.map((a) => (
                  <AccessRow
                    key={a.id}
                    acceso={a}
                    estacionamiento={equipo.evento.tieneEstacionamiento}
                    busy={busy}
                    onEdit={() => {
                      setAviso(null);
                      setForm({ id: a.id, datos: { nombre: a.nombre, puerta: a.puerta ?? '', tiposEntradaIds: a.tiposEntradaIds, permiteEstacionamiento: a.permiteEstacionamiento } });
                    }}
                    onCode={() => {
                      if (a.estado === 'ACTIVO' && !window.confirm(`El celular vinculado de ${a.nombre} dejará de validar hasta que ingrese el nuevo código. ¿Continuar?`)) return;
                      ejecutar(async () => setCodigo({ ...(await regenerarCodigoAcceso(a.id)), nombre: a.nombre }));
                    }}
                    onRevoke={() => {
                      if (!window.confirm(`¿Revocar el acceso de ${a.nombre}? Su celular dejará de validar de inmediato.`)) return;
                      ejecutar(() => revocarAcceso(a.id));
                    }}
                  />
                ))}
              </ul>
            </section>
          )}

          {anteriores.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Revocados o vencidos</h3>
              <ul className="space-y-2 opacity-70">
                {anteriores.map((a) => <AccessRow key={a.id} acceso={a} estacionamiento={!!equipo?.evento.tieneEstacionamiento} busy />)}
              </ul>
            </section>
          )}
        </div>
      </div>

      {codigo && <CodePanel codigo={codigo} onClose={() => setCodigo(null)} />}
    </div>
  );
}

function AccessForm({ equipo, datos, editando, busy, onChange, onCancel, onSave }: {
  equipo: EquipoAcceso;
  datos: DatosAcceso;
  editando: boolean;
  busy: boolean;
  onChange: (d: DatosAcceso) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const todos = datos.tiposEntradaIds.length === 0;
  const alternar = (id: string) => {
    // Desde "todos", marcar uno deja solo ese; desmarcar el último vuelve a "todos"
    const actual = todos ? [] : datos.tiposEntradaIds;
    const siguiente = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id];
    onChange({ ...datos, tiposEntradaIds: siguiente.length === equipo.tiposEntrada.length ? [] : siguiente });
  };
  const input = 'w-full px-3 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4">
      <p className="text-sm font-bold text-white">{editando ? 'Editar acceso' : 'Nuevo acceso'}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-300">Nombre</span>
          <input value={datos.nombre} onChange={(e) => onChange({ ...datos, nombre: e.target.value })} maxLength={60} placeholder="Ej. Juan Pérez" className={`${input} mt-1`} autoFocus />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-300">Puerta o puesto <span className="font-normal text-slate-500">(opcional)</span></span>
          <input value={datos.puerta ?? ''} onChange={(e) => onChange({ ...datos, puerta: e.target.value })} maxLength={60} placeholder="Ej. Puerta norte" className={`${input} mt-1`} />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-slate-300">¿Qué entradas puede validar?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange({ ...datos, tiposEntradaIds: [] })} aria-pressed={todos}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${todos ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100' : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
            Todas
          </button>
          {equipo.tiposEntrada.map((t) => {
            const activo = !todos && datos.tiposEntradaIds.includes(t.id);
            return (
              <button type="button" key={t.id} onClick={() => alternar(t.id)} aria-pressed={activo}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border ${activo ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100' : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                <Ticket className="w-3.5 h-3.5" /> {t.nombre}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          {todos ? 'Puede validar cualquier tipo de entrada.' : 'Si escanea otro tipo, la app le avisa y la entrada no se marca, para que ingrese por su acceso.'}
        </p>
      </fieldset>

      {equipo.evento.tieneEstacionamiento && (
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={datos.permiteEstacionamiento} onChange={(e) => onChange({ ...datos, permiteEstacionamiento: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
          También valida códigos de estacionamiento
        </label>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white">Cancelar</button>
        <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {editando ? 'Guardar cambios' : 'Crear y ver código'}
        </button>
      </div>
    </form>
  );
}

function AccessRow({ acceso: a, estacionamiento, busy, onEdit, onCode, onRevoke }: {
  acceso: AccesoValidador;
  estacionamiento: boolean; // el evento vende estacionamiento
  busy: boolean;
  onEdit?: () => void;
  onCode?: () => void;
  onRevoke?: () => void;
}) {
  const estado = ESTADOS[a.estado];
  return (
    <li className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-white flex items-center gap-2 flex-wrap">
            {a.nombre}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${estado.clase}`}>{estado.texto}</span>
          </p>
          {a.puerta && <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5"><DoorOpen className="w-3.5 h-3.5" /> {a.puerta}</p>}
        </div>
        <p className="text-xs text-slate-400 tabular-nums"><span className="text-white font-bold">{a.ingresos}</span> ingresos · {a.escaneos} escaneos</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {a.tiposEntradaIds.length === 0
          ? <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">Todas las entradas</span>
          : a.tiposEntrada.map((t) => <span key={t.id} className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-200 flex items-center gap-1"><Ticket className="w-3 h-3" /> Solo {t.nombre}</span>)}
        {estacionamiento && a.permiteEstacionamiento && <span className="text-[11px] px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-200 flex items-center gap-1"><Car className="w-3 h-3" /> Estacionamiento</span>}
      </div>
      <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5" />
        {a.vinculadoEn ? `${a.dispositivo || 'Celular vinculado'}${a.ultimoUsoEn ? ` · último escaneo ${relativeTime(a.ultimoUsoEn)}` : ' · aún sin escanear'}` : 'Esperando que ingrese su código'}
      </p>
      {(onEdit || onCode || onRevoke) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onEdit && <button onClick={onEdit} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50"><Pencil className="w-3.5 h-3.5" /> Editar</button>}
          {onCode && <button onClick={onCode} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50"><KeyRound className="w-3.5 h-3.5" /> {a.estado === 'ACTIVO' ? 'Nuevo código' : 'Ver nuevo código'}</button>}
          {onRevoke && <button onClick={onRevoke} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 disabled:opacity-50"><Ban className="w-3.5 h-3.5" /> Revocar</button>}
        </div>
      )}
    </li>
  );
}

// Código de vinculación (se muestra una sola vez): QR para escanear desde la app o texto para escribirlo
function CodePanel({ codigo, onClose }: { codigo: CodigoVinculacion & { nombre: string }; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(codigo.codigo, { errorCorrectionLevel: 'M', margin: 1, width: 480, color: { dark: '#0f172a', light: '#ffffff' } }).then(setSrc).catch(() => setSrc(null));
  }, [codigo.codigo]);
  const copiar = async () => {
    await navigator.clipboard.writeText(codigo.codigo).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/85" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Código de vinculación de ${codigo.nombre}`}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Código de vinculación</p>
        <h3 className="mt-1 text-lg font-extrabold">{codigo.nombre}</h3>
        <p className="text-sm text-slate-600 mt-1">Pídele que lo escanee o lo escriba en la app de validación.</p>
        <div className="mt-4 mx-auto w-52 h-52 flex items-center justify-center">
          {src ? <img src={src} alt={`QR del código ${codigo.codigo}`} className="w-full h-full [image-rendering:pixelated]" /> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
        </div>
        <p className="mt-3 font-mono text-2xl font-extrabold tracking-[0.15em]">{codigo.codigo}</p>
        <button onClick={copiar} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
          {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copiado ? 'Copiado' : 'Copiar código'}
        </button>
        <ul className="mt-4 text-left text-xs text-slate-600 space-y-1 bg-slate-50 rounded-xl p-3">
          <li>• Sirve una sola vez: después de vincular el celular, deja de funcionar.</li>
          <li>• Solo se muestra ahora. Si se pierde, genera uno nuevo.</li>
          <li>• Si lo compartes por chat, bórralo después de que se vincule.</li>
        </ul>
        <button onClick={onClose} className="mt-4 w-full px-4 py-2.5 text-sm font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800">Listo</button>
      </div>
    </div>
  );
}
