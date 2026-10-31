'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import AuthModal from '../components/AuthModal';
import OrganizerStatusBanner from '../components/OrganizerStatusBanner';
import AccountStatusBanner from '../components/AccountStatusBanner';
import AdminDashboard from '../components/admin/AdminDashboard';
import EventCard from '../components/events/EventCard';
import EventFormModal from '../components/events/EventFormModal';
import MyEventsPanel from '../components/events/MyEventsPanel';
import EventDetailModal from '../components/events/EventDetailModal';
import { CalendarPlus, Compass, LayoutList, CheckCircle2, X, ArrowRight } from 'lucide-react';
import {
  ApiError, AuthResponse, AuthUser, SuspendedInfo, canPublishEvents, clearSession,
  fetchCurrentUser, isAccountActive, loadStoredUser, markApprovalNoticeSeen, saveSession, updateStoredUser,
} from '../services/auth';
import { Category, EventItem, fetchCategories as fetchCategoryList } from '../services/events';
import { useUserLocation } from '../utils/location';
import LocationNotice, { RequestLocationOnMount } from '../components/LocationNotice';
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

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [refreshingUser, setRefreshingUser] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // Si la cuenta se suspende con la sesión abierta, se cierra y se muestra el aviso
  const [suspendedNotice, setSuspendedNotice] = useState<SuspendedInfo | null>(null);
  const [radius, setRadius] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>(''); 
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Formulario de eventos: sin "event" crea uno nuevo; con "event" lo edita
  const [eventForm, setEventForm] = useState<{ event?: EventItem; duplicateFrom?: EventItem; location?: { lat: number; lng: number } } | null>(null);
  // Detalle del evento ("Ver más"); se puede abrir con un enlace compartido (?evento=<id>)
  const [detail, setDetail] = useState<{ id: string; preview?: EventItem } | null>(null);
  // Vista del organizador: explorar el catálogo o administrar sus eventos
  const [organizerView, setOrganizerView] = useState<'explore' | 'mine'>('explore');
  const [myEventsKey, setMyEventsKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Ubicación del usuario (con permiso). Sin permiso o fuera de Santiago, el centro es Santiago centro
  const location = useUserLocation();
  const { lat: centerLat, lng: centerLng } = location.center;

  useEffect(() => {
    setIsClient(true);
    const savedUser = loadStoredUser();
    if (savedUser) {
      setUser(savedUser);
      refreshUser(); // Trae el estado actualizado (ej. si un admin aprobó la solicitud)
    }
    fetchCategories();
    const shared = new URLSearchParams(window.location.search).get('evento');
    if (shared) setDetail({ id: shared });
  }, []);

  const refreshUser = async () => {
    setRefreshingUser(true);
    try {
      const fresh = await fetchCurrentUser();
      setUser(fresh);
      updateStoredUser(fresh);
    } catch (err) {
      // Sin conexión o consulta interrumpida (ej. al recargar): se mantiene la sesión guardada
      if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) return;
      // Token vencido, inválido o cuenta suspendida: se cierra la sesión local
      clearSession();
      setUser(null);
      if (err instanceof ApiError && err.code === 'ACCOUNT_SUSPENDED') {
        setSuspendedNotice(err.data);
        setIsAuthOpen(true);
      }
    } finally {
      setRefreshingUser(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setCategories(await fetchCategoryList());
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
      const res = await fetch(`${apiUrl}/events?lat=${centerLat}&lng=${centerLng}&radius=${radius}`);
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
  }, [radius, isClient, centerLat, centerLng]);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setShowApprovedNotice(false);
  };

  const handleAuthSuccess = (data: AuthResponse) => {
    saveSession(data);
    setUser(data.user);
  };

  const canPublish = canPublishEvents(user);

  // Aviso de cuenta verificada: se muestra en el primer ingreso tras la aprobación y se
  // marca como visto de inmediato, así no vuelve a aparecer en los siguientes ingresos
  const [showApprovedNotice, setShowApprovedNotice] = useState(false);
  useEffect(() => {
    if (!user?.approvalNoticePending) return;
    setShowApprovedNotice(true);
    const seen = { ...user, approvalNoticePending: false };
    setUser(seen);
    updateStoredUser(seen);
    markApprovalNoticeSeen().catch(() => {});
  }, [user?.approvalNoticePending]);
  const canReserve = isAccountActive(user);
  // Reservar es solo para asistentes: organizadores y administradores no ven el botón
  const isAttendee = user?.role === 'ATTENDEE';
  const reserveOptions = isAttendee
    ? { enabled: canReserve, blockedReason: canReserve ? undefined : 'Tu cuenta está en revisión: no puedes reservar entradas' }
    : undefined;

  const openDetail = (evt: EventItem) => setDetail({ id: evt.id, preview: evt });
  const openDetailById = (id: string) => setDetail({ id, preview: events.find((e) => e.id === id) });
  const closeDetail = () => {
    setDetail(null);
    // Quita el ?evento= del enlace compartido para que no se vuelva a abrir al recargar
    if (window.location.search.includes('evento=')) window.history.replaceState(null, '', window.location.pathname);
  };
  const isApprovedOrganizer = user?.role === 'ORGANIZER' && user.organizerStatus === 'APPROVED';

  // Crear evento: el formulario parte desde la ubicación del usuario, o Santiago centro
  const openNewEventForm = () => setEventForm({ location: location.coords ?? undefined });

  // Clic derecho en el mapa: abre el formulario con esa ubicación
  const handleSelectLocationForNewEvent = (lat: number, lng: number) => setEventForm({ location: { lat, lng } });

  const handleEventSaved = (saved: EventItem, created: boolean) => {
    setEventForm(null);
    setToast(created ? `¡"${saved.title}" ya está publicado!` : `Guardamos los cambios de "${saved.title}".`);
    setMyEventsKey((k) => k + 1);
    fetchEvents();
  };

  // El aviso de confirmación se oculta solo
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const filteredEvents = events.filter((evt) => 
    evt.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    evt.category?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );


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

  // Buscador, mapa y catálogo. El admin lo ve dentro de la pestaña "Explorar"
  const exploreContent = (
    <>
      <RequestLocationOnMount status={location.status} request={location.request} />
      <LocationNotice status={location.status} accuracy={location.coords?.accuracy} onRetry={location.request} />
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
          <span className="hidden sm:inline text-[11px] text-slate-500 whitespace-nowrap">
            {location.coords ? 'desde tu ubicación' : 'desde Santiago centro'}
          </span>
        </div>
      </section>

      <section className="mb-8 w-full h-[450px] bg-slate-800 rounded-2xl border border-slate-700 relative overflow-hidden shadow-2xl z-0">
        <InteractiveMap
          events={filteredEvents}
          centerLat={centerLat}
          centerLng={centerLng}
          radiusKm={radius}
          userLocation={location.coords}
          locating={location.status === 'locating'}
          onLocate={location.request}
          onSelectLocationForNewEvent={canPublish ? handleSelectLocationForNewEvent : undefined}
          onOpenEvent={openDetailById}
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
            {filteredEvents.map((evt) => (
              <EventCard
                key={evt.id}
                event={{ ...evt, categoryName: evt.category?.name, distanceFrom: location.coords ? undefined : 'Santiago centro' }}
                onOpen={() => openDetail(evt)}
                footerAction={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDetail(evt)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
                    >
                      Ver más <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {isAttendee && evt.price > 0 && (
                      <button
                        disabled={!canReserve || evt.status !== 'PUBLISHED'}
                        title={
                          !canReserve
                            ? 'Tu cuenta está en revisión: no puedes reservar entradas'
                            : evt.status !== 'PUBLISHED'
                              ? 'Este evento no acepta reservas'
                              : undefined
                        }
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition"
                      >
                        Reservar
                      </button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );

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
                  {user.role === 'ADMIN' ? 'Panel de administración de UBIK.' : 'Aquí tienes las actividades cerca de ti.'}
                  {/* Tip permanente para quien puede publicar (el aviso de verificación solo sale una vez) */}
                  {canPublish && !showApprovedNotice && user.role !== 'ORGANIZER' && (
                    <span className="text-emerald-400 text-xs font-semibold"> (Tip: Haz clic derecho en el mapa para crear un evento)</span>
                  )}
                </p>
              </div>
              {canPublish && user.role === 'ORGANIZER' && (
                <button
                  onClick={() => openNewEventForm()}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  <CalendarPlus className="w-4 h-4" /> Crear evento
                </button>
              )}
            </header>

            <AccountStatusBanner user={user} />
            {/* Con la cuenta en revisión prima ese aviso sobre el de verificación */}
            {isAccountActive(user) && (
              <OrganizerStatusBanner
                user={user}
                onRefresh={refreshUser}
                refreshing={refreshingUser}
                showApprovedNotice={showApprovedNotice}
                onDismissApproved={() => setShowApprovedNotice(false)}
              />
            )}

            {user.role === 'ADMIN' ? (
              <AdminDashboard explore={exploreContent} onEventsChanged={fetchEvents} />
            ) : isApprovedOrganizer ? (
              <>
                <nav className="mb-6 inline-flex bg-slate-900/80 border border-slate-800 rounded-2xl p-1.5 gap-1" role="tablist">
                  {([
                    { id: 'explore', label: 'Explorar', icon: Compass },
                    { id: 'mine', label: 'Mis eventos', icon: LayoutList },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={organizerView === id}
                      onClick={() => setOrganizerView(id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        organizerView === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </nav>
                {organizerView === 'explore' ? (
                  <>
                    {/* El aviso de cuenta verificada ya da esta indicación */}
                    {canPublish && !showApprovedNotice && (
                      <p className="-mt-3 mb-4 text-xs text-slate-500">
                        Tip: haz clic derecho en el mapa para crear un evento en ese punto.
                      </p>
                    )}
                    {exploreContent}
                  </>
                ) : (
                  <MyEventsPanel
                    canManage={canPublish}
                    refreshKey={myEventsKey}
                    onCreate={() => openNewEventForm()}
                    onEdit={(event) => setEventForm({ event })}
                    onDuplicate={(event) => setEventForm({ duplicateFrom: event })}
                    onOpen={openDetail}
                    onChanged={fetchEvents}
                  />
                )}
              </>
            ) : (
              exploreContent
            )}
          </div>
        )}
      </main>

      {eventForm && (
        <EventFormModal
          categories={categories}
          event={eventForm.event}
          initialLocation={eventForm.location}
          duplicateFrom={eventForm.duplicateFrom}
          onClose={() => setEventForm(null)}
          onSaved={handleEventSaved}
        />
      )}

      {detail && (
        <EventDetailModal
          key={detail.id}
          eventId={detail.id}
          preview={detail.preview}
          viewer={user ? { id: user.id, isAdmin: user.role === 'ADMIN' } : null}
          reserve={reserveOptions}
          onClose={closeDetail}
          onAnnouncementsChange={() => setMyEventsKey((k) => k + 1)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-2xl" role="status">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {toast}
          <button onClick={() => setToast(null)} aria-label="Cerrar aviso" className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Se monta solo al abrirse para que cada apertura parta con el formulario vacío */}
      {isAuthOpen && (
        <AuthModal
          isOpen
          initialSuspended={suspendedNotice}
          onClose={() => { setIsAuthOpen(false); setSuspendedNotice(null); }}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}