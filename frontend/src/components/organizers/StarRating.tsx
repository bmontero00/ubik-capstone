'use client';

import React from 'react';
import { Star } from 'lucide-react';

// Estrellas de 1 a 5 (admite medias estrellas). Sin valor se muestran vacías.
// Cuando se habilite el calificador, este mismo componente servirá para mostrar los promedios.
export default function StarRating({ value, size = 'md' }: { value: number | null; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value === null ? 'Sin calificaciones' : `${value.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value === null ? 0 : Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className={`relative ${px}`}>
            <Star className={`${px} text-slate-600`} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${px} text-amber-400 fill-amber-400`} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
