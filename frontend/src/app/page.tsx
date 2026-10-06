'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import AuthModal from '../components/AuthModal';
import { AuthResponse } from '../services/auth';
import { Compass, Sparkles, ShieldCheck, Map } from 'lucide-react';

export default function Home() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('ubik_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
    localStorage.setItem('ubik_token', data.accessToken);
    localStorage.setItem('ubik_user', JSON.stringify(data.user));
    setUser({ name: data.user.name, email: data.user.email });
  };

  const handleLogout = () => {
    localStorage.removeItem('ubik_token');
    localStorage.removeItem('ubik_user');
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Banner Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Descubrimiento Inteligente de Eventos
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Explora lo que pasa en tu comunidad en tiempo real.
            </h1>
            <p className="text-slate-400 text-base sm:text-lg">
              Conectamos asistentes con creadores locales mediante geolocalización de baja latencia y recomendaciones personalizadas.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm"
              >
                {user ? 'Explorar Eventos Cercanos' : 'Comenzar Ahora'}
              </button>
            </div>
          </div>
        </section>

        {/* Placeholder Visual del Mapa (Sprint 2) */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[380px] text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 mb-4 group-hover:scale-105 transition-transform duration-300">
            <Map className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Visor Geoespacial UBIK</h3>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Módulo interactivo con centrado GPS y filtro por radio de distancia. Diseñado para responder con latencia menor a 300 ms sobre PostgreSQL + PostGIS.
          </p>
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            Arquitectura Base Lista — Integración Cartográfica en Sprint 2
          </span>
        </section>

        {/* Pilares Técnicos */}
        <section className="grid sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-2">
            <Compass className="w-5 h-5 text-emerald-400" />
            <h4 className="font-bold text-white text-sm">Geolocalización Inmediata</h4>
            <p className="text-xs text-slate-400">
              Consultas espaciales optimizadas para responder en menos de 300 ms vía Supabase São Paulo.
            </p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h4 className="font-bold text-white text-sm">Motor de Recomendación</h4>
            <p className="text-xs text-slate-400">
              Sugerencias de actividades basadas en lenguaje natural y preferencias de estilo.
            </p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="font-bold text-white text-sm">Seguridad Transaccional</h4>
            <p className="text-xs text-slate-400">
              Códigos Únicos de Compra y tokens JWT sin almacenamiento de datos bancarios.
            </p>
          </div>
        </section>
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}