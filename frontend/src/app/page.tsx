'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import AuthModal from '../components/AuthModal';
import OrganizerStatusBanner from '../components/OrganizerStatusBanner';
import AccountStatusBanner from '../components/AccountStatusBanner';
import AdminDashboard from '../components/admin/AdminDashboard';
import EventCard from '../components/events/EventCard';
import EventFormModal from '../components/events/EventFormModal';
import MyEventsPanel from '../components/events/MyEventsPanel';
import EventDetailModal from '../components/events/EventDetailModal';
import OrganizerProfileModal from '../components/organizers/OrganizerProfileModal';
import CheckoutModal, { CheckoutEvent } from '../components/tickets/CheckoutModal';
import MyTicketsPanel from '../components/tickets/MyTicketsPanel';
import Landing from '../components/landing/Landing';
import Footer from '../components/Footer';
import { Compra, TicketSelection, compraValida, fetchCompra, fetchMisCompras, selectionCount } from '../services/compras';
import { CalendarPlus, Compass, LayoutList, CheckCircle2, X, ArrowRight, Ticket, Search, MapPin, ChartColumn } from 'lucide-react';
import {
  ApiError, AuthResponse, AuthUser, SuspendedInfo, canPublishEvents, clearSession,
  fetchCurrentUser, isAccountActive, loadStoredUser, markApprovalNoticeSeen, saveSession, saveToken, updateStoredUser,
} from '../services/auth';
import { Category, EventItem, fetchCategories as fetchCategoryList, publicPrice } from '../services/events';
import { registrarCategorias } from '../utils/categorias';
import SectorSearch from '../components/map/SectorSearch';
import AccountModal from '../components/account/AccountModal';
import OrganizerReports from '../components/reports/OrganizerReports';
import type { SectorMapa } from '../components/Map';
import { Ubicacion, contornoComuna } from '../services/ubicaciones';
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

// Opciones de radio de búsqueda; "Ciudad" trae todo lo que está a una distancia razonable de Santiago
const RADIOS = [2, 5, 10, 20];
const RADIO_CIUDAD = 60;

const SECTOR_KEY = 'ubik_sector';
const leerSector = (): SectorMapa | null => {
  try {
    const raw = sessionStorage.getItem(SECTOR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const guardarSector = (sector: SectorMapa | null) => {
  try {
    if (sector) sessionStorage.setItem(SECTOR_KEY, JSON.stringify(sector));
    else sessionStorage.removeItem(SECTOR_KEY);
  } catch {}
};

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [refreshingUser, setRefreshingUser] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // Cómo se abre el modal de sesión: vista inicial y el motivo por el que se pide
  const [authOptions, setAuthOptions] = useState<{ view: 'login' | 'registerOrganizer'; reason: string | null }>({ view: 'login', reason: null });
  // Compra iniciada sin sesión: se retoma apenas la persona inicia sesión o crea su cuenta
  const [pendingPurchase, setPendingPurchase] = useState<{ event: EventItem; selection: TicketSelection } | null>(null);
  // Si la cuenta se suspende con la sesión abierta, se cierra y se muestra el aviso
  const [suspendedNotice, setSuspendedNotice] = useState<SuspendedInfo | null>(null);
  const [radius, setRadius] = useState<number>(10);
  // Hasta que el usuario elige un radio, se ajusta al contexto: 5 km con ubicación real o sector, 10 km desde Santiago centro
  const radioElegido = useRef(false);
  const elegirRadio = (r: number) => { radioElegido.current = true; setRadius(r); };
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
  // Perfil público del organizador; recuerda el evento desde el que se abrió para poder volver
  const [organizerProfile, setOrganizerProfile] = useState<{
    id: string;
    fromEvent?: { id: string; preview?: EventItem };
    view?: 'profile' | 'reviews'; // abrir directo en las reseñas
  } | null>(null);
  // Vista del organizador: explorar el catálogo o administrar sus eventos
  const [organizerView, setOrganizerView] = useState<'explore' | 'mine' | 'reportes'>('explore');
  // Vista del asistente: explorar o sus entradas
  const [attendeeView, setAttendeeView] = useState<'explore' | 'tickets'>('explore');
  const [compras, setCompras] = useState<Compra[]>([]);
  const [comprasState, setComprasState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  // Compra en curso: cantidad elegida en el detalle, o una compra pendiente que se retoma
  const [checkout, setCheckout] = useState<{ event: CheckoutEvent; selection?: TicketSelection; resume?: Compra; notice?: string } | null>(null);
  const [myEventsKey, setMyEventsKey] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Ubicación del usuario (con permiso). Sin permiso o fuera de Santiago, el centro es Santiago centro
  const location = useUserLocation();
  // Sector elegido en "¿Dónde?": reemplaza a la ubicación o a Santiago centro como centro de la búsqueda
  const [sector, setSector] = useState<SectorMapa | null>(null);
  const { lat: centerLat, lng: centerLng } = sector ?? location.center;
  const origen = sector?.nombre ?? (location.coords ? null : 'Santiago centro'); // null = tu ubicación

  const elegirSector = async (u: Ubicacion) => {
    const nuevo: SectorMapa = { nombre: u.nombre, lat: u.lat, lng: u.lng, bbox: u.bbox };
    setSector(nuevo);
    guardarSector(nuevo);
    // Comunas: se dibuja su contorno y se encuadra completa
    if (u.tipo === 'comuna') {
      const c = await contornoComuna(u.nombre);
      if (c) {
        setSector((actual) => {
          if (actual?.nombre !== u.nombre) return actual;
          const conContorno = { ...actual, contorno: c.geojson, bbox: c.bbox };
          guardarSector(conContorno);
          return conContorno;
        });
      }
    }
  };
  const quitarSector = () => {
    // El radio de una zona del mapa se calculó para esa vista: al volver, se usa el del contexto
    if (sector?.zona) radioElegido.current = false;
    setSector(null);
    guardarSector(null);
  };
  // "Buscar en esta zona": el centro del mapa pasa a ser el punto de búsqueda y el radio cubre lo que se ve
  const buscarEnZona = (lat: number, lng: number, radioVisibleKm: number) => {
    const zona: SectorMapa = { nombre: 'la zona del mapa', lat, lng, zona: true };
    setSector(zona);
    guardarSector(zona);
    radioElegido.current = true;
    setRadius(RADIOS.find((r) => r >= radioVisibleKm * 0.9) ?? RADIO_CIUDAD);
  };

  useEffect(() => {
    setIsClient(true);
    const savedUser = loadStoredUser();
    if (savedUser) {
      setUser(savedUser);
      refreshUser(); // Trae el estado actualizado (ej. si un admin aprobó la solicitud)
    }
    fetchCategories();
    setSector(leerSector()); // el último sector elegido en esta sesión
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('evento');
    if (shared) setDetail({ id: shared });
    // Vuelta desde Webpay: ?pago=<resultado>&compra=<id>
    const pago = params.get('pago');
    // Los parámetros se quitan de la URL recién después de mostrar el resultado: si la página se
    // recarga antes (ej. el modo de desarrollo de Next tras un error), el resultado no se pierde
    if (pago) showPaymentResult(pago, params.get('compra'), savedUser).finally(() => {
      window.history.replaceState(null, '', window.location.pathname);
    });
  }, []);

  // Muestra el resultado del pago en Webpay: el comprobante si se aprobó, o la compra pendiente
  // con el motivo para que pueda reintentar mientras dure la reserva
  const showPaymentResult = async (result: string, compraId: string | null, savedUser: AuthUser | null) => {
    if (result === 'reversado') {
      return setToast('Tu reserva venció antes de confirmar el pago, así que anulamos el cargo en tu tarjeta. Vuelve a elegir tus entradas.');
    }
    if (!compraId || savedUser?.role !== 'ATTENDEE') {
      return setToast('Inicia sesión con tu cuenta de asistente para ver el resultado de tu pago.');
    }
    try {
      const compra = await fetchCompra(compraId);
      if (compra.estado === 'PAGADA') {
        setCheckout({ event: compra.evento, resume: compra });
        return;
      }
      if (compra.estado !== 'PENDIENTE_PAGO') {
        return setToast('Tu reserva de entradas venció o fue anulada. Vuelve a elegir tus entradas para intentarlo de nuevo.');
      }
      const notices: Record<string, string> = {
        rechazado: 'El banco rechazó el pago. Puedes intentarlo de nuevo, por ejemplo con otra tarjeta.',
        anulado: 'Cancelaste el pago en Webpay. Tus entradas siguen reservadas: puedes volver a intentarlo.',
        error: 'No pudimos confirmar el pago con Webpay. Intenta nuevamente; si ves un cargo en tu tarjeta, escríbenos a soporte@ubik.cl.',
      };
      setCheckout({ event: compra.evento, resume: compra, notice: notices[result] ?? notices.error });
    } catch (err) {
      setToast((err as Error).message || 'No pudimos obtener el resultado de tu pago. Revisa "Mis entradas".');
    }
  };

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
      const lista = await fetchCategoryList();
      registrarCategorias(lista);
      setCategories(lista);
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
      const res = await fetch(`${apiUrl}/events?lat=${centerLat}&lng=${centerLng}&radius=${RADIO_CIUDAD}`);
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
  }, [isClient, centerLat, centerLng]);

  useEffect(() => {
    if (!radioElegido.current) setRadius(sector || location.coords ? 5 : 10);
  }, [sector, location.coords]);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setShowApprovedNotice(false);
  };

  const openAuth = (view: 'login' | 'registerOrganizer' = 'login', reason: string | null = null) => {
    setAuthOptions({ view, reason });
    setIsAuthOpen(true);
  };

  const handleAuthSuccess = (data: AuthResponse) => {
    saveSession(data);
    setUser(data.user);
    if (!pendingPurchase) return;
    // Retoma la compra que la persona empezó antes de iniciar sesión
    const { role, status } = data.user;
    if (role === 'ATTENDEE' && status === 'ACTIVE') setCheckout(pendingPurchase);
    else if (role === 'ATTENDEE') setToast('Tu cuenta está en revisión: por ahora no puedes comprar entradas.');
    else setToast('Las entradas se compran con una cuenta de asistente.');
    setPendingPurchase(null);
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
  // Comprar entradas es solo para asistentes: organizadores y administradores no ven esa opción
  const isAttendee = user?.role === 'ATTENDEE';
  const canBuy = isAccountActive(user);

  const loadCompras = async () => {
    setComprasState((s) => ({ ...s, loading: compras.length === 0, error: null }));
    try {
      setCompras(await fetchMisCompras());
      setComprasState({ loading: false, error: null });
    } catch (err) {
      setComprasState({ loading: false, error: (err as Error).message || 'No se pudieron cargar tus entradas' });
    }
  };
  useEffect(() => {
    if (isAttendee) loadCompras();
    else setCompras([]);
  }, [isAttendee, user?.id]);

  // Entradas válidas por evento (una compra pendiente no cuenta: un nuevo intento la reemplaza)
  const ownedTickets = (eventId: string) =>
    compras.filter((c) => c.evento.id === eventId && compraValida(c)).reduce((n, c) => n + c.cantidad, 0);
  const upcomingTickets = compras
    .filter((c) => compraValida(c) && new Date(c.evento.date).getTime() >= Date.now())
    .reduce((n, c) => n + c.cantidad, 0);

  // Sin sesión también se puede elegir entradas: al continuar se pide iniciar sesión y luego se retoma
  const guestTicketOptions = !user
    ? {
        owned: () => 0,
        onContinue: (event: EventItem, selection: TicketSelection) => {
          closeDetail();
          setPendingPurchase({ event, selection });
          const n = selectionCount(selection);
          openAuth('login', `Inicia sesión o crea tu cuenta de asistente para comprar ${n === 1 ? 'tu entrada' : `tus ${n} entradas`} de "${event.title}".`);
        },
        onViewTickets: () => {},
      }
    : undefined;

  const ticketOptions = isAttendee
    ? {
        blockedReason: canBuy ? undefined : 'Tu cuenta está en revisión: por ahora no puedes comprar entradas.',
        owned: ownedTickets,
        onContinue: (event: EventItem, selection: TicketSelection) => {
          closeDetail();
          setCheckout({ event, selection });
        },
        onViewTickets: () => {
          closeDetail();
          setAttendeeView('tickets');
        },
      }
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
    setToast(
      !created
        ? `Guardamos los cambios de "${saved.title}".`
        : saved.estadoCondicion === 'PENDIENTE'
          ? `"${saved.title}" ya está publicado. Habilitaremos la venta de entradas cuando revisemos tu solicitud.`
          : `¡"${saved.title}" ya está publicado!`,
    );
    setMyEventsKey((k) => k + 1);
    fetchEvents();
  };

  // El aviso de confirmación se oculta solo
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // Eventos que calzan con "¿Qué?" (en toda la ciudad) y los que además están dentro del radio
  const conTexto = events.filter((evt) =>
    evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    evt.category?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const dentroDe = (r: number) => (evt: EventItem) => r >= RADIO_CIUDAD || (evt.distanceKm ?? 0) <= r;
  const filteredEvents = conTexto.filter(dentroDe(radius));
  // Sin resultados: el radio más chico que sí tiene eventos (sin otra consulta al backend)
  const ampliarA = filteredEvents.length === 0
    ? [...RADIOS, RADIO_CIUDAD].find((r) => r > radius && conTexto.some(dentroDe(r)))
    : undefined;
  const cantidadEn = (r: number) => conTexto.filter(dentroDe(r)).length;
  const textoRadio = (r: number) => (r >= RADIO_CIUDAD ? 'toda la ciudad' : `${r} km`);


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
      {/* Con sesión se pide la ubicación al mostrar el mapa; sin sesión, solo si la persona la pide */}
      {user && <RequestLocationOnMount status={location.status} request={location.request} />}
      <LocationNotice status={location.status} accuracy={location.coords?.accuracy} onRetry={location.request} />
      <section className="relative z-10 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl backdrop-blur-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            aria-label="Buscar eventos por título o categoría"
            placeholder="¿Qué? Título o categoría (ej: Deporte)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <SectorSearch onSelect={elegirSector} />
        <div className="w-full" role="radiogroup" aria-label="Radio de búsqueda">
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 gap-1">
            {[...RADIOS, RADIO_CIUDAD].map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={radius === r}
                onClick={() => elegirRadio(r)}
                title={`${cantidadEn(r)} ${cantidadEn(r) === 1 ? 'evento' : 'eventos'} en ${textoRadio(r)}`}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  radius === r ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {r >= RADIO_CIUDAD ? 'Ciudad' : `${r} km`}
              </button>
            ))}
          </div>
        </div>
        </div>

        {/* Resumen: cuántos eventos hay y desde dónde se busca */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" aria-live="polite">
          {sector ? (
            <span className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-indigo-100">
              <MapPin className="w-4 h-4 text-indigo-300" /> Cerca de <strong className="text-white">{sector.nombre}</strong>
              <button type="button" onClick={quitarSector} aria-label={`Dejar de buscar cerca de ${sector.nombre}`} className="p-1 rounded-full hover:bg-indigo-500/30">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ) : null}
          <span className="text-slate-300">
            <strong className="text-white">{filteredEvents.length}</strong> {filteredEvents.length === 1 ? 'evento' : 'eventos'}
            {radius >= RADIO_CIUDAD ? ' en toda la ciudad' : <> a {radius} km de {origen ?? 'tu ubicación'}</>}
          </span>
          {ampliarA !== undefined && !isLoading && (
            <button type="button" onClick={() => elegirRadio(ampliarA)} className="text-xs font-bold text-indigo-300 hover:text-indigo-200 underline underline-offset-2">
              Ampliar a {textoRadio(ampliarA)} ({cantidadEn(ampliarA)} {cantidadEn(ampliarA) === 1 ? 'evento' : 'eventos'})
            </button>
          )}
          {sector && (
            <button type="button" onClick={quitarSector} className="text-xs font-semibold text-slate-400 hover:text-white">
              {location.coords ? 'Volver a tu ubicación' : 'Volver a Santiago centro'}
            </button>
          )}
        </div>
      </section>

      <section className="w-full h-[450px] bg-slate-800 rounded-2xl border border-slate-700 relative overflow-hidden shadow-2xl z-0">
        <InteractiveMap
          events={filteredEvents}
          centerLat={centerLat}
          centerLng={centerLng}
          radiusKm={radius >= RADIO_CIUDAD ? 0 : radius}
          userLocation={location.coords}
          locating={location.status === 'locating'}
          onLocate={() => { quitarSector(); location.request(); }}
          sector={sector}
          onBuscarZona={buscarEnZona}
          onQuitarSector={quitarSector}
          onSelectLocationForNewEvent={canPublish ? handleSelectLocationForNewEvent : undefined}
          onOpenEvent={openDetailById}
        />
      </section>

      {/* Con sesión, el listado va bajo el mapa (también sirve para recorrer los eventos con teclado
          o lector de pantalla). En la portada lo reemplaza el carrusel de próximos eventos. */}
      {user && (
        <section className="mt-8" aria-labelledby="catalogo-title">
          <h3 id="catalogo-title" className="text-xl font-bold text-white mb-5">
            Eventos en este radio <span className="text-slate-500 font-semibold">({filteredEvents.length})</span>
          </h3>
          {isLoading ? (
            <div className="text-center py-10"><span className="text-indigo-400">Cargando actividades...</span></div>
          ) : error ? (
            <div className="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-xl">{error}</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
              {ampliarA !== undefined
                ? <>No hay eventos a {radius} km de {origen ?? 'tu ubicación'}.</>
                : 'No hay coincidencias para tu búsqueda en este radio.'}
              {ampliarA !== undefined && (
                <button type="button" onClick={() => elegirRadio(ampliarA)} className="block mx-auto mt-3 px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
                  Ampliar a {textoRadio(ampliarA)} ({cantidadEn(ampliarA)} {cantidadEn(ampliarA) === 1 ? 'evento' : 'eventos'})
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((evt) => (
                <EventCard
                  key={evt.id}
                  event={{ ...evt, price: publicPrice(evt), categoryName: evt.category?.name, distanceFrom: origen ?? undefined }}
                  onOpen={() => openDetail(evt)}
                  footerAction={
                    <button
                      onClick={() => openDetail(evt)}
                      className="group flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-lg shadow-emerald-900/30 transition-all"
                    >
                      Ver más <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <Navbar user={user} onOpenAuth={() => openAuth()} onLogout={handleLogout} onOpenAccount={() => setAccountOpen(true)} />
      {accountOpen && user && (
        <AccountModal
          onClose={() => setAccountOpen(false)}
          onUpdated={refreshUser}
          onTokenChanged={(token) => saveToken(token)}
        />
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!user ? (
          <Landing
            categories={categories}
            explore={exploreContent}
            activeQuery={searchQuery}
            onSearch={setSearchQuery}
            onOpenEvent={openDetail}
            onBecomeOrganizer={() => openAuth('registerOrganizer')}
            onLogin={() => openAuth()}
          />
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
              <AdminDashboard explore={exploreContent} onEventsChanged={fetchEvents} onOpenEvent={openDetailById} onCategoriesChanged={fetchCategories} />
            ) : isApprovedOrganizer ? (
              <>
                <nav className="mb-6 inline-flex bg-slate-900/80 border border-slate-800 rounded-2xl p-1.5 gap-1" role="tablist">
                  {([
                    { id: 'explore', label: 'Explorar', icon: Compass },
                    { id: 'mine', label: 'Mis eventos', icon: LayoutList },
                    { id: 'reportes', label: 'Reportes', icon: ChartColumn },
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
                ) : organizerView === 'reportes' ? (
                  <OrganizerReports />
                ) : (
                  <MyEventsPanel
                    canManage={canPublish}
                    refreshKey={myEventsKey}
                    onCreate={() => openNewEventForm()}
                    onEdit={(event) => setEventForm({ event })}
                    onDuplicate={(event) => setEventForm({ duplicateFrom: event })}
                    onOpen={openDetail}
                    onChanged={fetchEvents}
                    organizerId={user!.id}
                    onOpenReviews={() => setOrganizerProfile({ id: user!.id, view: 'reviews' })}
                  />
                )}
              </>
            ) : isAttendee ? (
              <>
                <nav className="mb-6 inline-flex bg-slate-900/80 border border-slate-800 rounded-2xl p-1.5 gap-1" role="tablist">
                  {([
                    { id: 'explore', label: 'Explorar', icon: Compass },
                    { id: 'tickets', label: 'Mis entradas', icon: Ticket },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={attendeeView === id}
                      onClick={() => {
                        setAttendeeView(id);
                        if (id === 'tickets') loadCompras();
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        attendeeView === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {label}
                      {id === 'tickets' && upcomingTickets > 0 && (
                        <span className="min-w-[20px] px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950">{upcomingTickets}</span>
                      )}
                    </button>
                  ))}
                </nav>
                {attendeeView === 'explore' ? (
                  exploreContent
                ) : (
                  <MyTicketsPanel
                    compras={compras}
                    loading={comprasState.loading}
                    error={comprasState.error}
                    onExplore={() => setAttendeeView('explore')}
                    onOpenEvent={(id) => setDetail({ id, preview: events.find((e) => e.id === id) })}
                    onResumePayment={(c) => setCheckout({ event: c.evento, resume: c })}
                    onChanged={loadCompras}
                  />
                )}
              </>
            ) : (
              exploreContent
            )}
          </div>
        )}
      </main>

      <Footer />

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
          tickets={ticketOptions ?? guestTicketOptions}
          onClose={closeDetail}
          onAnnouncementsChange={() => setMyEventsKey((k) => k + 1)}
          onOpenOrganizer={(id, view) => {
            setOrganizerProfile({ id, fromEvent: detail, view });
            closeDetail();
          }}
        />
      )}

      {checkout && user && (
        <CheckoutModal
          event={checkout.event}
          selection={checkout.selection}
          resume={checkout.resume}
          notice={checkout.notice}
          buyer={{ name: user.name, email: user.email, rut: user.rut, telefono: user.telefono }}
          onClose={() => setCheckout(null)}
          onChanged={loadCompras}
          onViewTickets={() => {
            setCheckout(null);
            setAttendeeView('tickets');
          }}
        />
      )}

      {organizerProfile && (
        <OrganizerProfileModal
          key={`${organizerProfile.id}-${organizerProfile.view ?? 'profile'}`}
          organizerId={organizerProfile.id}
          initialView={organizerProfile.view}
          onClose={() => {
            // Si respondió reseñas desde su panel, se actualiza el contador de pendientes
            if (organizerProfile.id === user?.id) setMyEventsKey((k) => k + 1);
            setOrganizerProfile(null);
          }}
          back={
            organizerProfile.fromEvent && {
              label: 'Volver al evento',
              onBack: () => {
                setDetail(organizerProfile.fromEvent!);
                setOrganizerProfile(null);
              },
            }
          }
          onOpenEvent={(id) => {
            setOrganizerProfile(null);
            setDetail({ id, preview: events.find((e) => e.id === id) });
          }}
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
          initialView={authOptions.view}
          reason={authOptions.reason}
          onClose={() => { setIsAuthOpen(false); setSuspendedNotice(null); setPendingPurchase(null); }}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}