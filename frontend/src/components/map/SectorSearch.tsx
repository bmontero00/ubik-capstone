'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { MapPin, Loader2, Search, Building2, X } from 'lucide-react';
import { Ubicacion, buscarUbicaciones } from '../../services/ubicaciones';

// Buscador "¿Dónde?": sugiere comunas y lugares mientras se escribe (como un buscador de mapas).
// Flechas para recorrer, Enter para elegir, Esc para cerrar.
export default function SectorSearch({ onSelect }: { onSelect: (u: Ubicacion) => void }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Ubicacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listaId = useId();
  const contenedor = useRef<HTMLDivElement>(null);

  // Espera a que se deje de escribir (300 ms) y cancela la búsqueda anterior
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setResultados([]);
      setCargando(false);
      setError(null);
      return;
    }
    const control = new AbortController();
    setCargando(true);
    const t = setTimeout(() => {
      buscarUbicaciones(q, control.signal)
        .then((r) => { setResultados(r); setActivo(r.length ? 0 : -1); setError(null); })
        .catch((e) => { if ((e as Error).name !== 'AbortError') setError((e as Error).message); })
        .finally(() => { if (!control.signal.aborted) setCargando(false); });
    }, 300);
    return () => { clearTimeout(t); control.abort(); };
  }, [texto]);

  // Cierra la lista al hacer clic fuera
  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (!contenedor.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const elegir = (u: Ubicacion) => {
    onSelect(u);
    setTexto('');
    setResultados([]);
    setAbierto(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((i) => Math.min(resultados.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && abierto && resultados[activo]) { e.preventDefault(); elegir(resultados[activo]); }
    else if (e.key === 'Escape') setAbierto(false);
  };

  const q = texto.trim();
  const mostrarLista = abierto && q.length >= 2;
  return (
    <div ref={contenedor} className="relative w-full">
      <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none" />
      <input
        type="text"
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={activo >= 0 ? `${listaId}-${activo}` : undefined}
        aria-label="Buscar un sector, comuna o lugar"
        placeholder="¿Dónde? Comuna, barrio o lugar"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        className="w-full pl-10 pr-9 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
      />
      {cargando ? (
        <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />
      ) : texto && (
        <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      )}

      {mostrarLista && (
        <ul id={listaId} role="listbox" className="absolute z-[500] left-0 right-0 mt-2 py-1.5 max-h-80 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl">
          {error ? (
            <li className="px-4 py-3 text-sm text-rose-300">{error}</li>
          ) : resultados.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
              {cargando ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</> : <><Search className="w-4 h-4" /> No encontramos «{q}» en Chile</>}
            </li>
          ) : (
            resultados.map((u, i) => (
              <li
                key={u.id}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === activo}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(e) => { e.preventDefault(); elegir(u); }}
                className={`px-3 py-2.5 mx-1.5 rounded-lg flex items-start gap-3 cursor-pointer ${i === activo ? 'bg-indigo-500/15' : ''}`}
              >
                <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${u.tipo === 'comuna' ? 'bg-indigo-500/20 text-indigo-200' : 'bg-slate-800 text-slate-300'}`}>
                  {u.tipo === 'comuna' ? <Building2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">{u.nombre}</span>
                  <span className="block text-xs text-slate-400 truncate">{u.detalle}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
