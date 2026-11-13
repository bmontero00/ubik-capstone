'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound, ChevronDown } from 'lucide-react';
import Avatar from './account/Avatar';
import UbikLogo from './UbikLogo';
import UbikWordmark from './UbikWordmark';
import { ROLE_LABELS } from '../utils/labels';
import type { UserRole } from '../services/auth';

interface NavbarProps {
  user: { name: string; email: string; role?: UserRole; fotoPerfil?: string | null; organizationName?: string | null } | null;
  onLogout: () => void;
  onOpenAuth: () => void;
  onOpenAccount?: () => void;
}

export default function Navbar({ user, onLogout, onOpenAuth, onOpenAccount }: NavbarProps) {
  const [abierto, setAbierto] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', cerrar); document.removeEventListener('keydown', esc); };
  }, []);
  const esOrganizador = user?.role === 'ORGANIZER';
  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer">
          <UbikLogo size={36} className="rounded-xl shadow-lg shadow-emerald-500/10 ring-1 ring-slate-700/60" />
          <UbikWordmark height={22} className="ml-0.5" />
          <span className="hidden sm:inline-block text-xs uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-2">
            Eventos & Comunidad
          </span>
        </div>

        <nav className="flex items-center gap-4">
          {user ? (
            <div ref={menu} className="relative">
              <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={abierto}
                className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 hover:border-slate-600 pl-1.5 pr-3 py-1.5 rounded-full text-sm transition-colors"
              >
                <Avatar nombre={(esOrganizador && user.organizationName) || user.name} foto={user.fotoPerfil} tipo={esOrganizador ? 'logo' : 'persona'} size={28} />
                <span className="font-medium text-slate-200 max-w-[10rem] truncate">{user.name}</span>
                {user.role && ROLE_LABELS[user.role] && (
                  <span className={`hidden sm:inline text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${ROLE_LABELS[user.role].className}`}>
                    {ROLE_LABELS[user.role].label}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
              </button>
              {abierto && (
                <div role="menu" className="absolute right-0 mt-2 w-60 py-2 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
                  <div className="px-4 pb-2 mb-1 border-b border-slate-800">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                  {onOpenAccount && (
                    <button role="menuitem" type="button" onClick={() => { setAbierto(false); onOpenAccount(); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
                      <UserRound className="w-4 h-4 text-indigo-300" /> Mi cuenta
                    </button>
                  )}
                  <button role="menuitem" type="button" onClick={() => { setAbierto(false); onLogout(); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
                    <LogOut className="w-4 h-4 text-rose-300" /> Cerrar sesión
                  </button>
                </div>
              )}
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