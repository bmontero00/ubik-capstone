'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { ETIQUETAS_ESTRELLAS } from '../../services/resenas';

// Selector de 1 a 5 estrellas: al pasar el mouse se previsualiza y se muestra qué significa cada nota.
// Se maneja con el teclado como un grupo de opciones (flechas para cambiar).
export default function StarInput({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div role="radiogroup" aria-label="Calificación" className="flex gap-1" onMouseLeave={() => setHover(0)} onKeyDown={onKey}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${ETIQUETAS_ESTRELLAS[n]}`}
            tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-1 rounded-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
          >
            <Star className={`w-9 h-9 transition-colors ${n <= shown ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
          </button>
        ))}
      </div>
      <p className={`text-sm font-semibold h-5 ${shown ? 'text-amber-200' : 'text-slate-500'}`}>
        {shown ? ETIQUETAS_ESTRELLAS[shown] : 'Toca una estrella para calificar'}
      </p>
    </div>
  );
}
