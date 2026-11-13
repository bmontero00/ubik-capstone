import React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import UbikLogo from './UbikLogo';
import UbikWordmark from './UbikWordmark';

export const SUPPORT_EMAIL = 'soporte@ubik.cl';

// Pie de página común: identidad, accesos rápidos, contacto y documentos legales
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <UbikLogo size={32} className="rounded-lg" />
            <UbikWordmark height={18} className="ml-0.5" />
          </div>
          <p className="text-sm text-slate-400 mt-3 max-w-xs leading-relaxed">
            Eventos y comunidad cerca de ti. Disponible por ahora en Santiago de Chile.
          </p>
        </div>
        <nav aria-label="Explorar">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Explorar</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/#explorar" className="text-slate-300 hover:text-white">Eventos cerca de ti</Link></li>
            <li><Link href="/#organizadores" className="text-slate-300 hover:text-white">Para organizadores</Link></li>
          </ul>
        </nav>
        <nav aria-label="Ayuda y legal">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Ayuda</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">
                <Mail className="w-3.5 h-3.5" /> {SUPPORT_EMAIL}
              </a>
            </li>
            <li><Link href="/terminos" className="text-slate-300 hover:text-white">Términos y condiciones</Link></li>
            <li><Link href="/privacidad" className="text-slate-300 hover:text-white">Política de privacidad</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-slate-900">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500">
          © {new Date().getFullYear()} UBIK · Eventos y Comunidad
        </p>
      </div>
    </footer>
  );
}
