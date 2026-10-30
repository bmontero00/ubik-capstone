'use client';

import React from 'react';
import { ChartColumn } from 'lucide-react';

// Pestaña reservada para los reportes; la funcionalidad se implementará más adelante
export default function ReportsTab() {
  return (
    <section className="mb-8 bg-slate-900/80 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
      <span className="mx-auto mb-4 w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
        <ChartColumn className="w-6 h-6" />
      </span>
      <h3 className="text-lg font-bold text-white mb-1">Reportes</h3>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        Próximamente podrás revisar aquí los reportes de la plataforma. Esta sección aún está en desarrollo.
      </p>
    </section>
  );
}
