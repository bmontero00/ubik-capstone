'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import AuthModal from '../components/AuthModal';
import dynamic from 'next/dynamic';

// Importación dinámica para evitar el error SSR con Leaflet
const InteractiveMap = dynamic(() => import('../components/Map'), { 
  ssr: false, 
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-indigo-400">
      <svg className="animate-spin h-8 w-8 mb-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Cargando Motor Geoespacial...
    </div>
  ) 
});

interface Category { id: string; name: string; }
interface Organizer { id: string; name: string; email: string; }
interface EventItem {
  id: string; title: string; description: string; price: number;
  date: string; address: string; latitude: number; longitude: number;
  distanceKm?: number; category: Category; organizer: Organizer;
}

export default function HomePage() {
  // 1. ESTADOS (Hooks siempre en el mismo orden)
  const [user, setUser] = useState<{ name?: string; email: string } | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [radius, setRadius] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>(''); 
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false); // Para asegurar hidratación limpia

  const defaultLat = -33.4372;
  const defaultLng = -70.6506;

  // 2. EFECTOS (Siempre se ejecutan)
  
  // Efecto para marcar que estamos en el cliente y cargar la sesión
  useEffect(() => {
    setIsClient(true);
    const savedUser = localStorage.getItem('ubik_user');
    if (savedUser) {
      try { 
        const parsed = JSON.parse(savedUser);
        const realUser = parsed.user ? parsed.user : parsed;
        setUser(realUser); 
      } catch (err) { 
        console.error('Error al recuperar sesión local', err); 
      }
    }
  }, []); // Dependencia vacía CONSTANTE

  // Efecto para cargar eventos (depende SOLO de radius)
  useEffect(() => {
    // Si no estamos en el cliente aún, no hacemos fetch
    if (!isClient) return;

    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/events?lat=${defaultLat}&lng=${defaultLng}&radius=${radius}`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data: EventItem[] = await res.json();
        setEvents(data);
      } catch (err: any) {
        setError('No fue posible conectar con el servidor de UBIK. Verifica que el backend esté corriendo.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, [radius, isClient]); // Array de dependencias ESTABLE

  // 3. HANDLERS
  const handleLogout = () => {
    localStorage.removeItem('ubik_token');
    localStorage.removeItem('ubik_user');
    setUser(null);
  };

  const handleAuthSuccess = (userData: any) => {
    const realUser = userData.user ? userData.user : userData;
    setUser(realUser);
    setIsAuthOpen(false);
  };

  // 4. DERIVACIÓN DE DATOS
  const filteredEvents = events.filter((evt) => 
    evt.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    evt.category?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryBadge = (categoryName: string) => {
    switch (categoryName?.toLowerCase()) {
      case 'cultural': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'música': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'talleres': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getFirstName = (fullName?: string, email?: string) => {
    if (fullName && fullName.trim() !== '') {
      const first = fullName.trim().split(' ')[0];
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
    if (email && email.trim() !== '') {
      const first = email.split('@')[0];
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
    return 'Explorador';
  };

  // 5. RENDERIZADO CONDICIONAL SEGURO (Prevenir discrepancias de hidratación)
  if (!isClient) {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar user={user} onOpenAuth={() => setIsAuthOpen(true)} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!user ? (
          // --- VISTA PÚBLICA ---
          <section className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800 text-indigo-300 text-xs font-semibold mb-6 tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              LA CONEXIÓN AL ALCANCE DE TODOS
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Descubre tu entorno con <br/>
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                UBIK
              </span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mb-12 leading-relaxed">
              Explora, filtra y asiste a eventos sociales y comunitarios según tu ubicación exacta. 
              Sin algoritmos opacos, sin comisiones abusivas. Conecta directamente con la cultura local.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full max-w-4xl text-left">
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 transition-colors hover:border-slate-700">
                <div className="w-10 h-10 bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-400 mb-4">📍</div>
                <h3 className="text-white font-bold mb-2">Mapa Interactivo</h3>
                <p className="text-sm text-slate-400">Busca eventos en un radio específico desde donde te encuentras.</p>
              </div>
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 transition-colors hover:border-slate-700">
                <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center text-purple-400 mb-4">🎟️</div>
                <h3 className="text-white font-bold mb-2">Reserva Segura</h3>
                <p className="text-sm text-slate-400">Compra entradas o descubre eventos comunitarios 100% gratuitos.</p>
              </div>
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 transition-colors hover:border-slate-700">
                <div className="w-10 h-10 bg-pink-900/50 rounded-lg flex items-center justify-center text-pink-400 mb-4">🤖</div>
                <h3 className="text-white font-bold mb-2">IA Integrada</h3>
                <p className="text-sm text-slate-400">Recomendaciones personalizadas basadas en tus gustos y preferencias.</p>
              </div>
            </div>

            <button 
              onClick={() => setIsAuthOpen(true)}
              className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95 text-lg flex items-center gap-3 mx-auto"
            >
              Comenzar a Explorar
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </button>
          </section>
        ) : (
          // --- VISTA PRIVADA ---
          <div className="animate-fade-in">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white">
                  ¡Hola, {getFirstName(user?.name, user?.email)}! 👋
                </h2>
                <p className="text-slate-400 mt-1">Aquí tienes las actividades ocurriendo cerca de ti.</p>
              </div>
            </header>

            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl backdrop-blur-sm flex flex-col lg:flex-row gap-6 items-center">
              <div className="relative w-full lg:w-1/2">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar lugares, actividades o categorías..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="w-full lg:w-1/2 flex items-center gap-4 bg-slate-950 px-4 py-3 rounded-xl border border-slate-700">
                <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <div className="flex-1">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <span className="font-semibold text-indigo-300 min-w-[50px] text-right">{radius} km</span>
              </div>
            </section>

            {/* MAPA INTERACTIVO */}
            <section className="mb-8 w-full h-[450px] bg-slate-800 rounded-2xl border border-slate-700 relative overflow-hidden shadow-2xl z-0">
              <InteractiveMap 
                events={filteredEvents} 
                centerLat={defaultLat} 
                centerLng={defaultLng} 
                radiusKm={radius} 
              />
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                Catálogo de Eventos
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {filteredEvents.length} resultados
                </span>
              </h3>

              {isLoading ? (
                <div className="text-center py-10"><span className="text-indigo-400">Cargando actividades...</span></div>
              ) : error ? (
                <div className="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-xl">{error}</div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800">
                  <p className="text-slate-400">No hay coincidencias para tu búsqueda en este radio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEvents.map((evt) => {
                    const isFree = evt.price === 0;
                    return (
                      <article key={evt.id} className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 hover:shadow-xl transition-all group">
                        <div className="p-6 flex-1">
                          <div className="flex justify-between items-center mb-3">
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${getCategoryBadge(evt.category?.name)}`}>
                              {evt.category?.name || 'General'}
                            </span>
                            {evt.distanceKm && <span className="text-xs text-indigo-400">A {evt.distanceKm} km</span>}
                          </div>
                          <h4 className="text-lg font-bold text-white mb-2">{evt.title}</h4>
                          <p className="text-xs text-slate-400 line-clamp-2 mb-4">{evt.description}</p>
                          <div className="text-xs text-slate-500 space-y-1">
                            <p>📍 {evt.address}</p>
                            <p>📅 {new Date(evt.date).toLocaleDateString('es-CL')}</p>
                          </div>
                        </div>
                        <div className="bg-slate-950 px-6 py-4 flex justify-between items-center border-t border-slate-800">
                          <span className="font-extrabold text-white">
                            {isFree ? <span className="text-emerald-400">Gratis</span> : `$${evt.price.toLocaleString('es-CL')}`}
                          </span>
                          {!isFree && (
                            <button className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition">
                              Reservar
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onSuccess={handleAuthSuccess} onAuthSuccess={handleAuthSuccess} />
    </div>
  );
}