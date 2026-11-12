'use client';

import React, { useState } from 'react';
import { imageSrc } from '../../services/events';

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

// Color estable a partir del nombre (cuando no hay foto)
export const colorAvatar = (nombre: string) => {
  const paleta = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#a855f7', '#f43f5e'];
  const hash = [...nombre].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return paleta[hash % paleta.length];
};

// Foto de perfil. "logo" (organizadores): la imagen completa, sin recortar, sobre un fondo claro para que
// se lean los logos con transparencia o texto oscuro. "persona" (asistentes): foto recortada en círculo.
export default function Avatar({ nombre, foto, tipo = 'persona', size = 40, className = '' }: {
  nombre: string;
  foto?: string | null;
  tipo?: 'logo' | 'persona';
  size?: number;
  className?: string;
}) {
  const [rota, setRota] = useState(false);
  const src = !rota ? imageSrc(foto) : null;
  const forma = tipo === 'logo' ? 'rounded-[22%]' : 'rounded-full';
  const estilo = { width: size, height: size };

  if (src) {
    return tipo === 'logo' ? (
      <span className={`inline-flex items-center justify-center shrink-0 overflow-hidden bg-white ${forma} ${className}`} style={{ ...estilo, padding: Math.round(size * 0.1) }}>
        <img src={src} alt={`Logo de ${nombre}`} onError={() => setRota(true)} className="max-w-full max-h-full object-contain" />
      </span>
    ) : (
      <img src={src} alt={`Foto de ${nombre}`} onError={() => setRota(true)} className={`shrink-0 object-cover ${forma} ${className}`} style={estilo} />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center shrink-0 font-extrabold text-white ${forma} ${className}`}
      style={{ ...estilo, background: colorAvatar(nombre), fontSize: Math.round(size * 0.38) }}
    >
      {iniciales(nombre)}
    </span>
  );
}
