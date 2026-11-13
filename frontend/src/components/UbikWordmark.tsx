'use client';

import React, { useId } from 'react';

// Palabra "UBIK" del imagotipo: letras dibujadas con trazos redondeados del mismo grosor que la U del
// ícono (no es una fuente). "degradado" para fondos oscuros; "oscuro" (tinta) o "claro" (blanco) para
// usos neutros. Mismo dibujo que mobile/src/componentes/Logo.tsx y el PDF de las entradas.
export const TRAZOS_UBIK = [
  'M3.5 6V30a10 10 0 0 0 20 0V6',
  'M35 6V40H45a9.5 9.5 0 0 0 0-19H35M35 6h8.5a7.5 7.5 0 0 1 0 15',
  'M66 6V40',
  'M80 6V40M99 6L82.5 24.5M89 17L100 40',
];

export default function UbikWordmark({ height = 24, variante = 'degradado', className = '' }: {
  height?: number;
  variante?: 'degradado' | 'oscuro' | 'claro';
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const trazo = variante === 'degradado' ? `url(#${id}-g)` : variante === 'oscuro' ? '#0f172a' : '#f8fafc';
  return (
    <svg height={height} width={(height * 104) / 46} viewBox="0 0 104 46" className={className} role="img" aria-label="UBIK">
      {variante === 'degradado' && (
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="104" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      )}
      <g fill="none" stroke={trazo} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
        {TRAZOS_UBIK.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}
