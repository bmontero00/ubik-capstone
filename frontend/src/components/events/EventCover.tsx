'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { PALETAS, PATRONES, PortadaIa, portadaPorCategoria } from '../../utils/portadas';

// Portada de un evento sin imagen: la diseñada con IA si la tiene, o una por defecto según su categoría.
// Llena el contenedor (que debe ser "relative" y tener alto definido).
export default function EventCover({ portada, categoria, size = 'card', muted = false }: {
  portada?: PortadaIa | null;
  categoria?: string;
  size?: 'thumb' | 'card' | 'hero'; // miniatura: solo el emoji; tarjeta y portada: también la frase
  muted?: boolean; // eventos pasados
}) {
  const p = portada ?? portadaPorCategoria(categoria);
  const [c1, c2, fondo] = PALETAS[p.paleta] ?? PALETAS.noche;
  const patron = PATRONES[p.patron] ?? PATRONES.puntos;
  const emojiSize = size === 'thumb' ? 'text-3xl' : size === 'hero' ? 'text-7xl sm:text-8xl' : 'text-5xl';

  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden ${muted ? 'grayscale-[45%]' : ''}`}
      style={{ background: `radial-gradient(circle at 20% 15%, ${c1}cc, transparent 60%), radial-gradient(circle at 90% 85%, ${c2}b3, transparent 55%), ${fondo}` }}
    >
      <div className="absolute inset-0" style={patron} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <div className={`absolute inset-0 flex ${size === 'hero' ? 'items-center justify-end pr-10 sm:pr-16' : 'items-center justify-center'}`}>
        <span className={`${emojiSize} drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)] select-none`}>{p.emoji}</span>
      </div>
      {size !== 'thumb' && p.frase && (
        <p className={`absolute left-4 font-extrabold text-white leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${
          size === 'hero' ? 'right-4 top-6 sm:top-8 max-w-[60%] text-xl sm:text-2xl' : `bottom-3 text-sm line-clamp-2 ${portada ? 'right-24' : 'right-4'}`
        }`}>
          {p.frase}
        </p>
      )}
      {portada && size !== 'thumb' && (
        <span className="absolute bottom-2 right-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white/80 bg-black/35 rounded px-1.5 py-0.5 backdrop-blur-sm">
          <Sparkles className="w-2.5 h-2.5" /> Portada IA
        </span>
      )}
    </div>
  );
}
