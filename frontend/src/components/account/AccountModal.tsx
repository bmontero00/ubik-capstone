'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Lock, Camera, Trash2, Check, Eye, EyeOff, UserRound, ShieldCheck, Info } from 'lucide-react';
import Avatar from './Avatar';
import { Cuenta, actualizarCuenta, cambiarContrasena, esFotoValida, obtenerCuenta, quitarFoto, subirFoto } from '../../services/cuenta';
import { formatRut, isValidRut } from '../../utils/rut';
import { PHONE_PREFIX, formatLocalPhone, isValidLocalPhone, toFullPhone } from '../../utils/phone';

interface AccountModalProps {
  onClose: () => void;
  onUpdated: () => void; // vuelve a cargar el usuario de la sesión (nombre, foto)
  onTokenChanged: (token: string) => void; // tras cambiar la contraseña llega un token nuevo
}

const input = 'w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60';
const aLocal = (completo?: string | null) => (completo ? formatLocalPhone(completo.replace(/^\+?56/, '')) : '');

// Mi cuenta: perfil (datos editables y foto) y seguridad (cambio de contraseña)
export default function AccountModal({ onClose, onUpdated, onTokenChanged }: AccountModalProps) {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [tab, setTab] = useState<'perfil' | 'seguridad'>('perfil');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerCuenta().then(setCuenta).catch((e) => setError((e as Error).message));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
    >
      <div className="relative w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur px-5 sm:px-7 pt-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 id="account-title" className="text-xl font-extrabold text-white">Mi cuenta</h2>
            <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-4 flex gap-1" role="tablist">
            {([['perfil', 'Perfil', UserRound], ['seguridad', 'Seguridad', ShieldCheck]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === id ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 sm:px-7 py-6">
          {!cuenta ? (
            <div className="py-12 flex justify-center text-indigo-400">
              {error ? <p className="text-sm text-rose-300">{error}</p> : <Loader2 className="w-6 h-6 animate-spin" />}
            </div>
          ) : tab === 'perfil' ? (
            <Perfil cuenta={cuenta} onChange={(c) => { setCuenta(c); onUpdated(); }} />
          ) : (
            <Seguridad onTokenChanged={onTokenChanged} />
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children, ayuda, error }: { label: string; children: React.ReactNode; ayuda?: React.ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</span>
      {children}
      {error ? <span className="block mt-1 text-xs text-rose-300">{error}</span> : ayuda ? <span className="block mt-1 text-[11px] text-slate-500">{ayuda}</span> : null}
    </label>
  );
}

// Dato que no se puede editar (identidad verificada)
function Bloqueado({ label, valor, motivo }: { label: string; valor: string; motivo: string }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</span>
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300" title={motivo}>
        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="truncate">{valor}</span>
      </div>
      <span className="block mt-1 text-[11px] text-slate-500">{motivo}</span>
    </div>
  );
}

function Perfil({ cuenta, onChange }: { cuenta: Cuenta; onChange: (c: Cuenta) => void }) {
  const esOrganizador = cuenta.role === 'ORGANIZER' && !!cuenta.organizerProfile;
  const perfil = cuenta.organizerProfile;
  const [name, setName] = useState(cuenta.name);
  const [telefono, setTelefono] = useState(aLocal(esOrganizador ? perfil?.phone : cuenta.telefono));
  const [rut, setRut] = useState(cuenta.rut ? formatRut(cuenta.rut) : '');
  const [descripcion, setDescripcion] = useState(perfil?.eventDescription ?? '');
  const [red, setRed] = useState(perfil?.socialUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const errores = {
    name: name.trim().length < 2 ? 'Ingresa tu nombre' : null,
    telefono: esOrganizador
      ? (!isValidLocalPhone(telefono) ? 'Ingresa los 9 dígitos, comenzando con 9' : null)
      : (telefono && !isValidLocalPhone(telefono) ? 'Ingresa los 9 dígitos, comenzando con 9' : null),
    rut: !esOrganizador && rut && !isValidRut(rut) ? 'RUT inválido, revisa el dígito verificador' : null,
    descripcion: esOrganizador && descripcion.trim().length < 30 ? 'Mínimo 30 caracteres' : null,
    red: esOrganizador && red.trim() && !/^https?:\/\/\S+\.\S+/.test(red.trim()) ? 'Debe comenzar con https://' : null,
  };
  const hayErrores = Object.values(errores).some(Boolean);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hayErrores) return;
    setBusy(true);
    setError(null);
    setAviso(null);
    try {
      const c = await actualizarCuenta(esOrganizador
        ? { name: name.trim(), phone: toFullPhone(telefono), eventDescription: descripcion.trim(), socialUrl: red.trim() || null }
        : { name: name.trim(), telefono: telefono ? toFullPhone(telefono) : null, rut: rut || null });
      onChange(c);
      setAviso('Guardamos tus datos.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const elegirFoto = async (f?: File) => {
    if (!f) return;
    if (!esFotoValida(f)) return setFotoError('Usa una imagen JPG, PNG o WebP de hasta 5 MB');
    setFotoBusy(true);
    setFotoError(null);
    try {
      onChange(await subirFoto(f));
    } catch (err) {
      setFotoError((err as Error).message);
    } finally {
      setFotoBusy(false);
      if (archivo.current) archivo.current.value = '';
    }
  };

  const borrarFoto = async () => {
    setFotoBusy(true);
    try {
      onChange(await quitarFoto());
    } catch (err) {
      setFotoError((err as Error).message);
    } finally {
      setFotoBusy(false);
    }
  };

  const nombreVisible = esOrganizador ? perfil?.organizationName || cuenta.name : cuenta.name;
  return (
    <form onSubmit={guardar} className="space-y-6">
      {/* Foto o logo */}
      <section className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
        <div className="relative self-start">
          <Avatar nombre={nombreVisible} foto={cuenta.fotoPerfil} tipo={esOrganizador ? 'logo' : 'persona'} size={88} />
          {fotoBusy && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50"><Loader2 className="w-6 h-6 animate-spin text-white" /></span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{esOrganizador ? 'Logo de tu organización' : 'Foto de perfil (opcional)'}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {esOrganizador
              ? 'Se muestra completo, sin recortar, en tu perfil y en tus eventos. Ideal: PNG con fondo transparente.'
              : 'Se ve en tu cuenta y junto a tus reseñas. Si no subes una, mostramos tus iniciales.'}
          </p>
          <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => elegirFoto(e.target.files?.[0])} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => archivo.current?.click()} disabled={fotoBusy} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">
              <Camera className="w-3.5 h-3.5" /> {cuenta.fotoPerfil ? 'Cambiar' : 'Subir'} {esOrganizador ? 'logo' : 'foto'}
            </button>
            {cuenta.fotoPerfil && (
              <button type="button" onClick={borrarFoto} disabled={fotoBusy} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Quitar
              </button>
            )}
          </div>
          {fotoError && <p className="mt-2 text-xs text-rose-300">{fotoError}</p>}
          <p className="mt-2 text-[10px] text-slate-500">JPG, PNG o WebP de hasta 5 MB. La revisamos automáticamente para cuidar a la comunidad.</p>
        </div>
      </section>

      {/* Datos */}
      <section className="grid sm:grid-cols-2 gap-4">
        {esOrganizador && (
          <Bloqueado label="Organización" valor={perfil?.organizationName || 'Sin nombre de organización'} motivo="Es parte de tu verificación: no se puede cambiar." />
        )}
        <Campo label={esOrganizador ? 'Nombre del responsable' : 'Nombre'} error={errores.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} autoComplete="name" />
        </Campo>
        <Bloqueado label="Correo" valor={cuenta.email} motivo="Lo usas para iniciar sesión y recuperar tu contraseña." />
        {esOrganizador && <Bloqueado label="RUT" valor={formatRut(perfil!.rut)} motivo="Verificado por UBIK: no se puede cambiar." />}

        <Campo label={esOrganizador ? 'Celular de contacto' : 'Celular (opcional)'} error={errores.telefono} ayuda={esOrganizador ? 'Solo lo ve el equipo de UBIK.' : undefined}>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sm text-slate-300 select-none pointer-events-none" aria-hidden>{PHONE_PREFIX}</span>
            <input value={telefono} onChange={(e) => setTelefono(formatLocalPhone(e.target.value))} inputMode="numeric" placeholder="9 1234 5678" className={`${input} pl-12`} autoComplete="tel-national" />
          </div>
        </Campo>
        {!esOrganizador && (
          <Campo label="RUT (opcional)" error={errores.rut}>
            <input value={rut} onChange={(e) => setRut(formatRut(e.target.value))} placeholder="12.345.678-5" className={input} />
          </Campo>
        )}
      </section>

      {!esOrganizador && (
        <p className="flex items-start gap-2 text-xs text-slate-400 -mt-2">
          <Info className="w-4 h-4 shrink-0 text-indigo-300" />
          Tu celular y RUT son opcionales: los usamos solo para completar tus entradas más rápido al comprar (botón "Usar mis datos"). No se muestran públicamente.
        </p>
      )}

      {esOrganizador && (
        <section className="space-y-4">
          <Campo label="Sobre tu organización" error={errores.descripcion} ayuda={`${descripcion.trim().length}/1000 · Se muestra en tu perfil público.`}>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={1000} rows={4} className={`${input} resize-y`} />
          </Campo>
          <Campo label="Red social o sitio web (opcional)" error={errores.red}>
            <input value={red} onChange={(e) => setRed(e.target.value)} placeholder="https://instagram.com/tu_organizacion" className={input} inputMode="url" />
          </Campo>
        </section>
      )}

      {error && <p className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {aviso && <span className="flex items-center gap-1.5 text-sm text-emerald-300" role="status"><Check className="w-4 h-4" /> {aviso}</span>}
        <button type="submit" disabled={busy || hayErrores} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar cambios
        </button>
      </div>
    </form>
  );
}

function Seguridad({ onTokenChanged }: { onTokenChanged: (token: string) => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const errorNueva = nueva && nueva.length < 6 ? 'Mínimo 6 caracteres' : nueva && nueva === actual ? 'Debe ser distinta de la actual' : null;
  const errorConfirmar = confirmar && confirmar !== nueva ? 'Las contraseñas no coinciden' : null;
  const puede = actual && nueva && confirmar && !errorNueva && !errorConfirmar;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puede) return;
    setBusy(true);
    setError(null);
    try {
      const r = await cambiarContrasena(actual, nueva);
      onTokenChanged(r.accessToken);
      setAviso(r.mensaje);
      setActual(''); setNueva(''); setConfirmar('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tipo = ver ? 'text' : 'password';
  return (
    <form onSubmit={guardar} className="space-y-4 max-w-md">
      <div>
        <h3 className="text-base font-bold text-white">Cambiar contraseña</h3>
        <p className="text-xs text-slate-400 mt-0.5">Por seguridad, cerraremos tu sesión en los demás dispositivos y te avisaremos por correo.</p>
      </div>
      <Campo label="Contraseña actual">
        <input type={tipo} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" className={input} />
      </Campo>
      <Campo label="Nueva contraseña" error={errorNueva} ayuda="Mínimo 6 caracteres. Mejor si combina letras, números y símbolos.">
        <input type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" maxLength={72} className={input} />
      </Campo>
      <Campo label="Confirmar nueva contraseña" error={errorConfirmar}>
        <input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" maxLength={72} className={input} />
      </Campo>
      <button type="button" onClick={() => setVer((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        {ver ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
      </button>
      {error && <p className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200">{error}</p>}
      {aviso && <p className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-200 flex items-center gap-2" role="status"><Check className="w-4 h-4" /> {aviso}</p>}
      <button type="submit" disabled={busy || !puede} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Actualizar contraseña
      </button>
    </form>
  );
}
