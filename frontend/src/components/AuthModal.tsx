'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Loader2 } from 'lucide-react';
import { loginUser, registerUser, AuthResponse } from '../services/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: AuthResponse) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res: AuthResponse;
      if (isLogin) {
        res = await loginUser(email, password);
      } else {
        res = await registerUser(name, email, password);
      }
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error en la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-center tracking-tight mb-2">
          {isLogin ? 'Bienvenido a UBIK' : 'Crear cuenta en UBIK'}
        </h2>
        <p className="text-sm text-slate-400 text-center mb-6">
          {isLogin
            ? 'Accede para descubrir y gestionar eventos en tu zona'
            : 'Únete para encontrar eventos culturales y comunitarios'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Nombre Completo
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Juan Acevedo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.cl"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLogin ? 'Ingresar a la plataforma' : 'Completar registro'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          {isLogin ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta registrada?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-emerald-400 hover:underline font-semibold ml-1"
          >
            {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}