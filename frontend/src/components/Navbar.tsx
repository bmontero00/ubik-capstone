'use client';

import React from 'react';
import { MapPin, User, LogOut } from 'lucide-react';

interface NavbarProps {
  user: { name: string; email: string } | null;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export default function Navbar({ user, onLogout, onOpenAuth }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="bg-emerald-500 p-2 rounded-xl text-slate-950">
            <MapPin className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            UBIK
          </span>
          <span className="hidden sm:inline-block text-xs uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-2">
            Eventos & Comunidad
          </span>
        </div>

        <nav className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-sm">
              <User className="w-4 h-4 text-emerald-400" />
              <span className="font-medium text-slate-200">{user.name}</span>
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="text-slate-400 hover:text-rose-400 transition-colors p-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
            >
              Iniciar Sesión
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}