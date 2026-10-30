'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import AuthModal from '../components/AuthModal';
import OrganizerStatusBanner from '../components/OrganizerStatusBanner';
import AdminPanel from '../components/AdminPanel';
import {
  AuthResponse, AuthUser, authFetch, canPublishEvents, clearSession, fetchCurrentUser,
  loadStoredUser, saveSession, updateStoredUser,
} from '../services/auth';
import dynamic from 'next/dynamic';

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
  imageUrl?: string; distanceKm?: number; category: Category; organizer: Organizer;
}

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [refreshingUser, setRefreshingUser] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [radius, setRadius] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>(''); 
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // 🚀 Estado para categorías dinámicas
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Estados para el Modal de Creación de Eventos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priceInput: '',
    categoryId: '', // 🚀 ID de la categoría seleccionada en el form
    date: new Date().toISOString().split('T')[0],
    address: 'Santiago, Chile',
    imageFile: null as File | null
  });

  const defaultLat = -33.4372;
  const defaultLng = -70.6506;

  useEffect(() => {
    setIsClient(true);
    const savedUser = loadStoredUser();
    if (savedUser) {
      setUser(savedUser);
      refreshUser(); // Trae el estado actualizado (ej. si un admin aprobó la solicitud)
    }
    fetchCategories();
  }, []);

  const refreshUser = async () => {
    setRefreshingUser(true);
    try {
      const fresh = await fetchCurrentUser();
      setUser(fresh);
      updateStoredUser(fresh);
    } catch {
      // Token vencido o inválido: se cierra la sesión local
      clearSession();
      setUser(null);
    } finally {
      setRefreshingUser(false);
    }
  };

  // 🚀 Función para obtener categorías desde el backend (o usar respaldo predefinido)
  const fetchCategories = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/events/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, categoryId: data[0].id }));
        }
      }
    } catch (err) {
      console.error('Error al cargar categorías:', err);
    }
  };

  const fetchEvents = async () => {
    if (!isClient) return;
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

  useEffect(() => {
    fetchEvents();
  }, [radius, isClient]);

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  const handleAuthSuccess = (data: AuthResponse) => {
    saveSession(data);
    setUser(data.user);
  };

  const canPublish = canPublishEvents(user);

  const handleSelectLocationForNewEvent = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    setIsModalOpen(true);
  };

  // Enviar nuevo evento a Supabase a través del backend NestJS
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoords) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const finalPrice = formData.priceInput.trim() === '' ? 0 : Math.max(0, Number(formData.priceInput));

      const dataPayload = new FormData();
      dataPayload.append('title', formData.title);
      dataPayload.append('description', formData.description);
      dataPayload.append('price', String(finalPrice));
      dataPayload.append('date', formData.date);
      dataPayload.append('address', formData.address);
      dataPayload.append('latitude', String(selectedCoords.lat));
      dataPayload.append('longitude', String(selectedCoords.lng));
      dataPayload.append('categoryId', formData.categoryId); // 🚀 Enviar la categoría seleccionada

      if (formData.imageFile) {
        dataPayload.append('image', formData.imageFile);
      }

      const response = await authFetch('/events', {
        method: 'POST',
        body: dataPayload,
      });

      if (response.ok) {
        alert('¡Evento registrado exitosamente en Supabase!');
        setIsModalOpen(false);
        setFormData(prev => ({ 
          ...prev, 
          title: '', 
          description: '', 
          priceInput: '', 
          imageFile: null 
        }));
        fetchEvents();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.message || 'Error al registrar el evento en el servidor.');
      }
    } catch (error) {
      console.error('Error de red al crear evento:', error);
      alert('Error de conexión con el backend.');
    }
  };

  const filteredEvents = events.filter((evt) => 
    evt.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    evt.category?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryBadge = (categoryName: string) => {
    switch (categoryName?.toLowerCase()) {
      case 'vehículos': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'diversión': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'videojuegos': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'deporte': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getFirstName = (fullName?: string, email?: string) => {
    if (fullName?.trim()) return fullName.trim().split(' ')[0];
    if (email?.trim()) return email.split('@')[0];
    return 'Explorador';
  };

  if (!isClient) {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
    );
  }

  const isFreeEvent = formData.priceInput.trim() === '' || Number(formData.priceInput) === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar user={user} onOpenAuth={() => setIsAuthOpen(true)} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!user ? (
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
            </p>
            <button 
              onClick={() => setIsAuthOpen(true)}
              className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95 text-lg flex items-center gap-3 mx-auto"
            >
              Comenzar a Explorar
            </button>
          </section>
        ) : (
          <div className="animate-fade-in">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white">
                  ¡Hola, {getFirstName(user?.name, user?.email)}! 👋
                </h2>
                <p className="text-slate-400 mt-1">
                  Aquí tienes las actividades cerca de ti.
                  {/* El organizador ya ve este tip en su aviso de estado */}
                  {user.role === 'ADMIN' && <span className="text-emerald-400 text-xs font-semibold"> (Tip: Haz clic derecho en el mapa para crear un evento)</span>}
                </p>
              </div>
            </header>

            <OrganizerStatusBanner user={user} onRefresh={refreshUser} refreshing={refreshingUser} />
            {user.role === 'ADMIN' && <AdminPanel />}

            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl backdrop-blur-sm flex flex-col lg:flex-row gap-6 items-center">
              <div className="relative w-full lg:w-1/2">
                <input
                  type="text"
                  placeholder="Buscar por título, categoría (ej: Deporte, Vehículos)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="w-full lg:w-1/2 flex items-center gap-4 bg-slate-950 px-4 py-3 rounded-xl border border-slate-700">
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="font-semibold text-indigo-300 min-w-[50px] text-right">{radius} km</span>
              </div>
            </section>

            <section className="mb-8 w-full h-[450px] bg-slate-800 rounded-2xl border border-slate-700 relative overflow-hidden shadow-2xl z-0">
              <InteractiveMap 
                events={filteredEvents} 
                centerLat={defaultLat} 
                centerLng={defaultLng} 
                radiusKm={radius} 
                onSelectLocationForNewEvent={canPublish ? handleSelectLocationForNewEvent : undefined}
              />
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-6">
                Catálogo de Eventos ({filteredEvents.length} resultados)
              </h3>
              {isLoading ? (
                <div className="text-center py-10"><span className="text-indigo-400">Cargando actividades...</span></div>
              ) : error ? (
                <div className="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-xl">{error}</div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
                  No hay coincidencias para tu búsqueda en este radio.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEvents.map((evt) => {
                    const isFree = evt.price === 0;
                    return (
                      <article key={evt.id} className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all">
                        {evt.imageUrl && (
                          <div className="w-full h-40 bg-slate-950 overflow-hidden">
                            <img 
                              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${evt.imageUrl}`} 
                              alt={evt.title} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        )}
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
                            {isFree ? <span className="text-emerald-400">Entrada Liberada</span> : `$${evt.price.toLocaleString('es-CL')}`}
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

      {/* 🚀 MODAL DE REGISTRO DE EVENTOS ACTUALIZADO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-emerald-400">📍 Registrar Nuevo Evento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <p className="text-xs text-slate-400 mb-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
              Coordenadas de ubicación: <span className="text-indigo-400">Lat: {selectedCoords?.lat.toFixed(5)}, Lng: {selectedCoords?.lng.toFixed(5)}</span>
            </p>

            <form onSubmit={handleCreateEventSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título del Evento</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Expo Tunning o Junta Pokémon" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción</label>
                <textarea 
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve detalle de las actividades..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* 🚀 NUEVO: Selector de Categoría (Vehículos, Diversión, Videojuegos, Deporte) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría del Evento</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-white cursor-pointer"
                  required
                >
                  {categories.length > 0 ? (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="">Cargando categorías...</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Precio (CLP)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.priceInput}
                    onChange={(e) => setFormData({ ...formData, priceInput: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="Ej: 5000 (Vacio = Gratis)"
                  />
                  {isFreeEvent ? (
                    <span className="text-[10px] text-emerald-400 mt-1 block font-medium">
                      ✨ Detectado: Entrada Liberada (Gratis)
                    </span>
                  ) : (
                    <span className="text-[10px] text-indigo-400 mt-1 block">
                      Monto: ${Number(formData.priceInput).toLocaleString('es-CL')} CLP
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Foto de Perfil del Evento</label>
                  <input 
                    type="file" 
                    accept=".jpg, .jpeg, .png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFormData({ ...formData, imageFile: e.target.files[0] });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-slate-950 hover:file:bg-emerald-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Formatos: .jpg, .png</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha del Evento</label>
                  {/* 🚀 CORRECCIÓN ICONO FECHA: [color-scheme:dark] fuerza el calendario nativo a modo oscuro (letras/íconos blancos) */}
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Dirección Referencial</label>
                  <input 
                    type="text" 
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                >
                  Guardar evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Se monta solo al abrirse para que cada apertura parta con el formulario vacío */}
      {isAuthOpen && (
        <AuthModal isOpen onClose={() => setIsAuthOpen(false)} onSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}