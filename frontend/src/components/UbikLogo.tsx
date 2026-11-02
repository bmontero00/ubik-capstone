'use client';

import React, { useId } from 'react';

// Logo de UBIK: una U que acoge un pin de ubicación (la comunidad que se reúne en un lugar).
// Es el mismo dibujo del ícono de la pestaña (src/app/icon.svg); si cambia uno, cambiar el otro.
export default function UbikLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  // Ids únicos para los degradados: el logo puede aparecer más de una vez en la página
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="UBIK">
      <defs>
        <linearGradient id={`${id}-u`} x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#111a2e" />
          <stop offset="1" stopColor="#060b16" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />
      <path d="M15 12v20a17 17 0 0 0 34 0V12" fill="none" stroke={`url(#${id}-u)`} strokeWidth="9" strokeLinecap="round" />
      <path d="M32 41.5c-1.1-1.6-8-10.4-8-15.5a8 8 0 0 1 16 0c0 5.1-6.9 13.9-8 15.5z" fill="#f8fafc" />
      <circle cx="32" cy="26" r="3" fill="#0b1120" />
    </svg>
  );
}
