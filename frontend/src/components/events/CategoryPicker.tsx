'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2, Search, Sparkles, X } from 'lucide-react';
import type { Category } from '../../services/events';
import { sugerirCategoria } from '../../services/ia';
import { CATEGORIA_OTRA } from '../../utils/categorias';

const DESTACADAS = 8; // cuántas se muestran antes de "Ver todas"
const CON_BUSCADOR = 12; // desde cuántas categorías aparece el buscador
const MIN_DESCRIPCION_IA = 40; // la IA sugiere solo con una descripción que diga algo

type Sugerencia = { categoryId: string; nombre: string; sugerenciaNueva: string | null };

interface CategoryPickerProps {
  categorias: Category[];
  value: string;
  onChange: (categoryId: string, sugerenciaNueva?: string | null) => void;
  datos: { titulo: string; descripcion: string };
  autoSugerir: boolean; // al crear: la IA propone la categoría sola cuando hay título y descripción
  categoriaActualId?: string; // al editar: se muestra aunque esté oculta
}

// Selector de categoría: chips compactos, primero la sugerida por IA y las más usadas, buscador y "Otra" aparte.
// Los emojis de las categorías se usan solo en las portadas por defecto, no aquí.
export default function CategoryPicker({ categorias, value, onChange, datos, autoSugerir, categoriaActualId }: CategoryPickerProps) {
  const [expandido, setExpandido] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [sugerida, setSugerida] = useState<Sugerencia | null>(null);
  const [descartada, setDescartada] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pedida = useRef(false); // la sugerencia automática se pide una sola vez

  const disponibles = useMemo(
    () => categorias.filter((c) => (c.activa !== false || c.id === categoriaActualId) && c.name !== CATEGORIA_OTRA),
    [categorias, categoriaActualId],
  );
  const otra = categorias.find((c) => c.name === CATEGORIA_OTRA);

  const pedir = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await sugerirCategoria(datos);
      setSugerida(s);
      setDescartada(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Sugerencia automática: cuando el organizador deja de escribir y aún no eligió categoría
  const listoParaIa = datos.titulo.trim().length >= 3 && datos.descripcion.trim().length >= MIN_DESCRIPCION_IA;
  useEffect(() => {
    if (!autoSugerir || pedida.current || value || !listoParaIa) return;
    const t = setTimeout(() => { pedida.current = true; pedir(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSugerir, value, listoParaIa, datos.titulo, datos.descripcion]);

  // Destacadas: la sugerida, la elegida y las más usadas
  const q = busqueda.trim().toLowerCase();
  const visibles = useMemo(() => {
    if (q) return disponibles.filter((c) => c.name.toLowerCase().includes(q));
    if (expandido) return disponibles;
    const porUso = [...disponibles].sort((a, b) => (b.eventos ?? 0) - (a.eventos ?? 0) || a.name.localeCompare(b.name));
    const fijas = [value, sugerida?.categoryId].filter(Boolean) as string[];
    const primeras = porUso.filter((c) => fijas.includes(c.id));
    const resto = porUso.filter((c) => !fijas.includes(c.id)).slice(0, Math.max(0, DESTACADAS - primeras.length));
    return [...primeras, ...resto];
  }, [disponibles, expandido, q, value, sugerida]);
  const ocultas = disponibles.length - visibles.length;

  const elegir = (c: Category, sugerenciaNueva?: string | null) => {
    onChange(c.id, sugerenciaNueva);
    setBusqueda('');
  };

  const Chip = ({ c }: { c: Category }) => {
    const selected = value === c.id;
    const esSugerida = sugerida?.categoryId === c.id && !descartada;
    const color = c.color ?? '#818cf8';
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => elegir(c)}
        className={`inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
          selected ? 'text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white'
        }`}
        style={selected ? { borderColor: color, background: `${color}26` } : undefined}
      >
        <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        {c.name}
        {esSugerida && !selected && <Sparkles className="w-3.5 h-3.5 text-violet-300" aria-label="Sugerida por IA" />}
        {selected && <Check className="w-3.5 h-3.5" style={{ color }} />}
      </button>
    );
  };

  const sugerenciaVisible = sugerida && !descartada && sugerida.categoryId !== value;
  return (
    <div>
      {/* Sugerencia de la IA */}
      {busy ? (
        <p className="mb-2.5 flex items-center gap-1.5 text-xs text-violet-200"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando la categoría que mejor calza…</p>
      ) : sugerenciaVisible ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-violet-500/35 bg-violet-500/10 text-sm">
          <Sparkles className="w-4 h-4 text-violet-300 shrink-0" />
          <span className="flex-1 min-w-0 text-slate-200">
            Sugerida por IA: <strong className="text-white">{sugerida.nombre}</strong>
            {sugerida.sugerenciaNueva && <span className="text-slate-400"> · faltaría una categoría como «{sugerida.sugerenciaNueva}»</span>}
          </span>
          <button
            type="button"
            onClick={() => { const c = categorias.find((x) => x.id === sugerida.categoryId); if (c) elegir(c, sugerida.sugerenciaNueva); }}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-violet-600 hover:bg-violet-500"
          >
            Usar
          </button>
          <button type="button" onClick={() => setDescartada(true)} aria-label="Descartar sugerencia" className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pedir}
          disabled={datos.titulo.trim().length < 3 || datos.descripcion.trim().length < 10}
          title="Claude propone la categoría según el título y la descripción"
          className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-violet-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3.5 h-3.5" /> {sugerida ? 'Volver a sugerir con IA' : '¿No sabes cuál elegir? Sugerir con IA'}
        </button>
      )}
      {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}

      {/* Buscador (solo con muchas categorías) */}
      {disponibles.length > CON_BUSCADOR && (
        <div className="relative mb-2.5">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar categoría…"
            aria-label="Buscar categoría"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
        {visibles.map((c) => <Chip key={c.id} c={c} />)}
        {!q && (ocultas > 0 || expandido) && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            aria-expanded={expandido}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold text-indigo-300 hover:text-indigo-200"
          >
            {expandido ? <>Ver menos <ChevronUp className="w-4 h-4" /></> : <>Ver todas ({disponibles.length}) <ChevronDown className="w-4 h-4" /></>}
          </button>
        )}
      </div>
      {q && visibles.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">No encontramos «{busqueda.trim()}» entre las categorías.</p>
      )}

      {/* "Otra": la última opción, aparte del resto */}
      {otra && (
        <p className="mt-3 text-xs text-slate-400">
          ¿No encuentras la tuya?{' '}
          {value === otra.id ? (
            <span className="font-semibold text-white">Elegiste «Otra»: cuéntanos abajo cuál faltaría.</span>
          ) : (
            <button
              type="button"
              onClick={() => elegir(otra, q && visibles.length === 0 ? busqueda.trim() : undefined)}
              className="font-semibold text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
            >
              Elegir «Otra»{q && visibles.length === 0 ? ` y proponer «${busqueda.trim()}»` : ' y proponerla'}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
