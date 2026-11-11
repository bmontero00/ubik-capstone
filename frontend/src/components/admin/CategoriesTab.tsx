'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Eye, EyeOff, Check, X, Lightbulb, ArrowRight, Tags } from 'lucide-react';
import { apiJson } from '../../services/auth';

interface CategoriaAdmin {
  id: string;
  name: string;
  color: string;
  emoji: string;
  activa: boolean;
  orden: number;
  eventos: number;
  esOtra: boolean;
}

interface Sugerencia {
  clave: string;
  sugerencia: string;
  cantidad: number;
  eventos: { id: string; title: string }[];
}

interface Formulario {
  name: string;
  color: string;
  emoji: string;
}

const VACIO: Formulario = { name: '', color: '#818cf8', emoji: '✨' };

// Mantenedor de categorías: crear, editar, ocultar y atender lo que sugieren los organizadores en "Otra"
export default function CategoriesTab({ onChanged }: { onChanged: () => void }) {
  const [categorias, setCategorias] = useState<CategoriaAdmin[] | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | 'nueva' | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [busy, setBusy] = useState(false);
  // Al crear desde una sugerencia, después se mueven sus eventos a la categoría nueva
  const [desdeSugerencia, setDesdeSugerencia] = useState<Sugerencia | null>(null);
  const [destinos, setDestinos] = useState<Record<string, string>>({});

  const cargar = async () => {
    try {
      const data = await apiJson<{ categorias: CategoriaAdmin[]; sugerencias: Sugerencia[] }>('/admin/categorias');
      setCategorias(data.categorias);
      setSugerencias(data.sugerencias);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => { cargar(); }, []);

  const abrir = (c?: CategoriaAdmin, sugerencia?: Sugerencia) => {
    setError(null);
    setAviso(null);
    setDesdeSugerencia(sugerencia ?? null);
    setEditando(c ? c.id : 'nueva');
    setForm(c ? { name: c.name, color: c.color, emoji: c.emoji } : { ...VACIO, name: sugerencia?.sugerencia ?? '' });
  };

  const guardar = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editando === 'nueva') {
        const creada = await apiJson<CategoriaAdmin>('/admin/categorias', { method: 'POST', body: JSON.stringify(form) });
        let texto = `Creamos la categoría ${creada.emoji} ${creada.name}.`;
        if (desdeSugerencia) {
          const r = await apiJson<{ movidos: number }>(`/admin/categorias/${creada.id}/mover`, { method: 'POST', body: JSON.stringify({ sugerencia: desdeSugerencia.clave }) });
          texto += ` Movimos ${r.movidos} ${r.movidos === 1 ? 'evento' : 'eventos'} desde "Otra".`;
        }
        setAviso(texto);
      } else if (editando) {
        await apiJson(`/admin/categorias/${editando}`, { method: 'PATCH', body: JSON.stringify(form) });
        setAviso('Guardamos los cambios de la categoría.');
      }
      setEditando(null);
      setDesdeSugerencia(null);
      await cargar();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const alternar = async (c: CategoriaAdmin) => {
    setError(null);
    setAviso(null);
    try {
      await apiJson(`/admin/categorias/${c.id}`, { method: 'PATCH', body: JSON.stringify({ activa: !c.activa }) });
      setAviso(c.activa
        ? `Ocultamos ${c.name}: ya no se ofrece para eventos nuevos, pero sus ${c.eventos} eventos la conservan.`
        : `${c.name} vuelve a estar disponible para eventos nuevos.`);
      await cargar();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const mover = async (s: Sugerencia) => {
    const destino = destinos[s.clave];
    if (!destino) return;
    setError(null);
    try {
      const r = await apiJson<{ movidos: number; categoria: string }>(`/admin/categorias/${destino}/mover`, { method: 'POST', body: JSON.stringify({ sugerencia: s.clave }) });
      setAviso(`Movimos ${r.movidos} ${r.movidos === 1 ? 'evento' : 'eventos'} a ${r.categoria}.`);
      await cargar();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!categorias) {
    return <div className="py-16 flex justify-center text-indigo-400">{error ? <p className="text-sm text-rose-300">{error}</p> : <Loader2 className="w-6 h-6 animate-spin" />}</div>;
  }

  const editor = (
    <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 space-y-3">
      <p className="text-sm font-bold text-white">
        {editando === 'nueva' ? (desdeSugerencia ? `Crear categoría desde la sugerencia "${desdeSugerencia.sugerencia}"` : 'Nueva categoría') : 'Editar categoría'}
      </p>
      <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <label className="text-xs text-slate-400">
          Nombre
          <input value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={categorias.find((c) => c.id === editando)?.esOtra}
            className="mt-1 w-full px-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50" />
        </label>
        <label className="text-xs text-slate-400">
          Emoji
          <input value={form.emoji} maxLength={8} onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            className="mt-1 w-20 px-3 py-2 text-lg text-center rounded-xl bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </label>
        <label className="text-xs text-slate-400">
          Color
          <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="mt-1 block w-20 h-[42px] rounded-xl bg-slate-900 border border-slate-700 cursor-pointer" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Vista previa:</span>
        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded border" style={{ color: form.color, background: `${form.color}26`, borderColor: `${form.color}66` }}>
          {form.emoji} {form.name || 'Categoría'}
        </span>
      </div>
      <div className="flex gap-2">
        <button onClick={guardar} disabled={busy || form.name.trim().length < 3} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {editando === 'nueva' ? (desdeSugerencia ? `Crear y mover ${desdeSugerencia.cantidad} ${desdeSugerencia.cantidad === 1 ? 'evento' : 'eventos'}` : 'Crear categoría') : 'Guardar'}
        </button>
        <button onClick={() => { setEditando(null); setDesdeSugerencia(null); }} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );

  const disponibles = categorias.filter((c) => !c.esOtra && c.activa);

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <section className="lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2"><Tags className="w-4 h-4 text-indigo-300" /> Categorías ({categorias.length})</h3>
          {editando !== 'nueva' && (
            <button onClick={() => abrir()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950">
              <Plus className="w-3.5 h-3.5" /> Nueva categoría
            </button>
          )}
        </div>
        {aviso && <p className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-200" role="status">{aviso}</p>}
        {error && <p className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200">{error}</p>}
        {editando === 'nueva' && <div className="mb-3">{editor}</div>}

        <ul className="space-y-2">
          {categorias.map((c) => (
            <li key={c.id}>
              {editando === c.id ? editor : (
                <div className={`flex items-center gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 ${c.activa ? '' : 'opacity-60'}`}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${c.color}26`, border: `1px solid ${c.color}66` }} aria-hidden>
                    {c.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      {c.name}
                      {!c.activa && <span className="text-[10px] font-bold text-slate-400 bg-slate-800 rounded px-1.5 py-0.5">Oculta</span>}
                      {c.esOtra && <span className="text-[10px] font-bold text-slate-300 bg-slate-800 rounded px-1.5 py-0.5">Comodín</span>}
                    </p>
                    <p className="text-[11px] text-slate-500">{c.eventos} {c.eventos === 1 ? 'evento' : 'eventos'} · <span style={{ color: c.color }}>{c.color}</span></p>
                  </div>
                  <button onClick={() => abrir(c)} title="Editar" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                  {!c.esOtra && (
                    <button onClick={() => alternar(c)} title={c.activa ? 'Ocultar para eventos nuevos' : 'Volver a mostrar'} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                      {c.activa ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">Ocultar una categoría no afecta a sus eventos: solo deja de ofrecerse al crear eventos nuevos.</p>
      </section>

      <aside className="lg:col-span-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1"><Lightbulb className="w-4 h-4 text-amber-300" /> Lo que sugieren los organizadores</h3>
        <p className="text-xs text-slate-400 mb-3">Eventos publicados en "Otra", agrupados por la categoría que propusieron. Crea la que falte o muévelos a una existente.</p>
        {sugerencias.length === 0 ? (
          <p className="p-4 rounded-2xl border border-dashed border-slate-700 text-sm text-slate-500 text-center">Aún no hay sugerencias.</p>
        ) : (
          <ul className="space-y-3">
            {sugerencias.map((s) => (
              <li key={s.clave} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <p className="text-sm font-semibold text-white">«{s.sugerencia}» <span className="text-xs font-normal text-slate-400">· {s.cantidad} {s.cantidad === 1 ? 'evento' : 'eventos'}</span></p>
                <ul className="mt-1 text-[11px] text-slate-500 list-disc list-inside">
                  {s.eventos.map((e) => <li key={e.id} className="truncate">{e.title}</li>)}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => abrir(undefined, s)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500">
                    <Plus className="w-3.5 h-3.5" /> Crear categoría
                  </button>
                  <div className="flex items-center gap-1">
                    <select
                      value={destinos[s.clave] ?? ''}
                      onChange={(e) => setDestinos({ ...destinos, [s.clave]: e.target.value })}
                      aria-label={`Mover los eventos de «${s.sugerencia}» a una categoría existente`}
                      className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200"
                    >
                      <option value="">Mover a…</option>
                      {disponibles.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                    <button onClick={() => mover(s)} disabled={!destinos[s.clave]} aria-label="Mover" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
