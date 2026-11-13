import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileWarning } from 'lucide-react';
import UbikLogo from './UbikLogo';
import UbikWordmark from './UbikWordmark';
import Footer from './Footer';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

// Página de documento legal (términos, privacidad). El contenido es un borrador para revisión legal.
export default function LegalPage({ title, updated, intro, sections }: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <UbikLogo size={32} className="rounded-lg" />
            <UbikWordmark height={18} className="ml-0.5" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{title}</h1>
        <p className="text-sm text-slate-500 mt-2">Última actualización: {updated}</p>
        <p className="mt-6 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          <FileWarning className="w-4 h-4 shrink-0" />
          Borrador en revisión: este documento resume nuestras prácticas y será validado por asesoría legal antes del lanzamiento.
        </p>
        <p className="mt-6 text-slate-300 leading-relaxed">{intro}</p>
        {sections.map((s, i) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-lg font-bold text-white">{i + 1}. {s.title}</h2>
            {s.paragraphs.map((p, j) => <p key={j} className="mt-2 text-sm text-slate-300 leading-relaxed">{p}</p>)}
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
