'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ArrowRight, CalendarDays, MapPin, Compass, Ticket, PartyPopper, BadgeCheck, Megaphone, ChevronRight,
  ChevronLeft, ImageIcon, X, SearchX,
} from 'lucide-react';
import UbikLogo from '../UbikLogo';
import { API_URL } from '../../services/auth';
import { Category, EventItem, formatEventDate, formatPrice, imageSrc, publicPrice, relativeTime } from '../../services/events';
import { categoryColor } from '../../utils/mapTiles';
import { OfferBadge, OfferPrice } from '../events/OfferBadge';

interface LandingProps {
  categories: Category[];
  explore: React.ReactNode; // mapa, visible sin iniciar sesión
  activeQuery: string; // búsqueda vigente (filtra el carrusel y el mapa)
  onSearch: (query: string) => void;
  onOpenEvent: (event: EventItem) => void;
  onBecomeOrganizer: () => void;
  onLogin: () => void;
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// Portada para quien aún no inicia sesión: muestra el producto de inmediato (eventos reales, mapa
// y catálogo) y solo pide cuenta al comprar entradas o al querer publicar
export default function Landing({ categories, explore, activeQuery, onSearch, onOpenEvent, onBecomeOrganizer, onLogin }: LandingProps) {
  const [query, setQuery] = useState('');
  // Todos los eventos públicos (sin filtro de distancia) para los datos y los próximos eventos
  const [all, setAll] = useState<EventItem[] | null>(null);
  useEffect(() => {
    fetch(`${API_URL}/events`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAll)
      .catch(() => setAll([]));
  }, []);

  const upcoming = useMemo(
    () => (all ?? [])
      .filter((e) => (e.status === 'PUBLISHED' || e.status === 'POSTPONED') && new Date(e.date).getTime() > Date.now())
      .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [all],
  );
  const stats = useMemo(() => {
    const week = Date.now() + 7 * 864e5;
    return {
      thisWeek: upcoming.filter((e) => new Date(e.date).getTime() <= week).length,
      upcoming: upcoming.length,
      free: upcoming.filter((e) => e.price === 0).length,
      organizers: new Set(upcoming.map((e) => e.organizer.id)).size,
    };
  }, [upcoming]);
  // Categorías con eventos próximos primero
  const quickCategories = useMemo(() => {
    const count = (c: Category) => upcoming.filter((e) => e.category?.id === c.id).length;
    return [...categories].sort((a, b) => count(b) - count(a)).slice(0, 6);
  }, [categories, upcoming]);

  // El carrusel muestra los próximos eventos o, si hay búsqueda, sus resultados (el mapa se filtra igual)
  const q = activeQuery.trim().toLowerCase();
  const results = q
    ? upcoming.filter((e) => e.title.toLowerCase().includes(q) || e.category?.name.toLowerCase().includes(q))
    : upcoming.slice(0, 10);

  const search = (value: string) => {
    setQuery(value);
    onSearch(value);
    scrollTo('proximos');
  };
  const clearSearch = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative pt-6 pb-14 sm:pt-12 sm:pb-20 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-80 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),transparent_65%)]" />
        <div className="relative flex flex-col items-center">
          <UbikLogo size={72} className="rounded-2xl shadow-2xl shadow-emerald-500/20 ring-1 ring-slate-700/60 mb-6" />
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold mb-5 tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Ya disponible en Santiago
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.08] max-w-3xl">
            Descubre lo que pasa{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">cerca de ti</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mt-5 leading-relaxed">
            Ferias, conciertos, talleres y encuentros de tu comunidad en un solo mapa. Elige, reserva tu entrada y asiste.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); search(query.trim()); }}
            className="mt-8 w-full max-w-2xl flex items-center gap-2 p-2 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-2xl focus-within:border-emerald-500/60 transition-colors"
            role="search"
          >
            <Search className="w-5 h-5 text-slate-500 ml-2 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué quieres hacer? Ej. música, feria, deporte…"
              aria-label="Buscar eventos"
              className="flex-1 min-w-0 bg-transparent px-1 py-2.5 text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button type="submit" className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-colors">
              Buscar <span className="hidden sm:inline">eventos</span>
            </button>
          </form>

          {quickCategories.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-2xl">
              {quickCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => search(c.name)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:brightness-125"
                  style={{ color: categoryColor(c.name), borderColor: `${categoryColor(c.name)}55`, background: `${categoryColor(c.name)}14` }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <dl className="mt-10 grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-xl">
            <Stat value={all ? stats.thisWeek : null} label="eventos esta semana" />
            <Stat value={all ? stats.free : null} label="con entrada liberada" />
            <Stat value={all ? stats.organizers : null} label="organizadores activos" />
          </dl>
        </div>
      </section>

      {/* Próximos eventos (o resultados de la búsqueda) */}
      {all && (upcoming.length > 0 || q) && (
        <section id="proximos" className="scroll-mt-24 mb-16" aria-labelledby="proximos-title">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <h2 id="proximos-title" className="text-2xl font-bold text-white">
                {q ? <>Resultados para “{activeQuery.trim()}”</> : 'Próximos eventos en Santiago'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {q
                  ? `${results.length} ${results.length === 1 ? 'evento próximo' : 'eventos próximos'} · también los marcamos en el mapa`
                  : 'Lo que viene en los próximos días.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {q && (
                <button onClick={clearSearch} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200">
                  <X className="w-3.5 h-3.5" /> Limpiar búsqueda
                </button>
              )}
              <button onClick={() => scrollTo('explorar')} className="flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                Ver en el mapa <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {results.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40">
              <SearchX className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No encontramos eventos próximos para esa búsqueda</p>
              <button onClick={clearSearch} className="mt-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200">Ver todos los eventos</button>
            </div>
          ) : (
            <Carousel>
              {results.map((e) => <UpcomingCard key={e.id} event={e} onOpen={() => onOpenEvent(e)} />)}
            </Carousel>
          )}
        </section>
      )}

      {/* Mapa, abierto a todos */}
      <section id="explorar" className="scroll-mt-24 mb-20" aria-labelledby="explorar-title">
        <h2 id="explorar-title" className="text-2xl font-bold text-white mb-1">Explora el mapa</h2>
        <p className="text-sm text-slate-400 mb-6">Toca un punto para ver el evento. No necesitas una cuenta para mirar.</p>
        {explore}
      </section>

      {/* Cómo funciona */}
      <section className="mb-20" aria-labelledby="como-title">
        <h2 id="como-title" className="text-2xl font-bold text-white text-center">Así de simple</h2>
        <p className="text-sm text-slate-400 text-center mt-1 mb-8">De descubrir a estar ahí, en tres pasos.</p>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HowStep n={1} icon={Compass} title="Descubre" text="Encuentra eventos en el mapa según tu ubicación, la categoría o lo que te guste." />
          <HowStep n={2} icon={Ticket} title="Reserva tu entrada" text="Elige cuántas entradas necesitas e indica quién asistirá. Los eventos gratuitos solo se confirman." />
          <HowStep n={3} icon={PartyPopper} title="Asiste" text="Presenta el código de tu entrada y tu cédula en el acceso. Así de fácil." />
        </ol>
      </section>

      {/* Organizadores */}
      <section id="organizadores" className="scroll-mt-24 mb-16 relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 p-6 sm:p-10" aria-labelledby="org-title">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Para organizadores</p>
            <h2 id="org-title" className="text-3xl font-extrabold text-white mt-2 leading-tight">¿Organizas eventos? Llega a tu comunidad</h2>
            <p className="text-slate-300 mt-3 leading-relaxed">
              Publica gratis, vende o confirma entradas y mantén informados a tus asistentes. Verificamos a cada organizador para que la comunidad confíe en lo que encuentra.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button onClick={onBecomeOrganizer} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300">
                Quiero ser organizador <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={onLogin} className="px-6 py-3 rounded-xl text-sm font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-100">
                Ya tengo cuenta
              </button>
            </div>
          </div>
          <ul className="grid gap-3">
            <Benefit icon={MapPin} title="Tu evento en el mapa" text="Aparece a quienes están cerca, con fecha, lugar y cómo llegar." />
            <Benefit icon={Megaphone} title="Anuncios a tus asistentes" text="Avisa cambios de horario, accesos o invitados desde la bitácora del evento." />
            <Benefit icon={BadgeCheck} title="Perfil verificado" text="Tu trayectoria y tus eventos en un perfil público que genera confianza." />
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex flex-col-reverse items-center">
      <dt className="text-[11px] sm:text-xs text-slate-400">{label}</dt>
      <dd className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
        {value === null ? <span className="inline-block w-8 h-7 rounded bg-slate-800 animate-pulse align-middle" /> : value}
      </dd>
    </div>
  );
}

// Carrusel horizontal: flechas en escritorio, deslizamiento en celular y barra con la estética del sitio
function Carousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [children]);
  const move = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <div className="relative">
      <ul ref={ref} onScroll={update} className="ubik-scroll flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {children}
      </ul>
      {/* Degradados que indican que hay más contenido a los lados */}
      <div aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-slate-950 to-transparent transition-opacity ${edges.start ? 'opacity-0' : 'opacity-100'}`} />
      <div aria-hidden className={`pointer-events-none absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-slate-950 to-transparent transition-opacity ${edges.end ? 'opacity-0' : 'opacity-100'}`} />
      {!edges.start && <CarouselArrow side="left" onClick={() => move(-1)} />}
      {!edges.end && <CarouselArrow side="right" onClick={() => move(1)} />}
    </div>
  );
}

function CarouselArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Ver eventos anteriores' : 'Ver más eventos'}
      className={`hidden sm:flex absolute top-[calc(50%-8px)] -translate-y-1/2 ${side === 'left' ? '-left-4' : '-right-4'} w-10 h-10 items-center justify-center rounded-full bg-slate-900/95 border border-slate-700 text-white shadow-xl hover:border-emerald-400/60 hover:text-emerald-300 transition-colors`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

function UpcomingCard({ event, onOpen }: { event: EventItem; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : imageSrc(event.imageUrl);
  const color = categoryColor(event.category?.name);
  return (
    <li className="snap-start shrink-0 w-64">
      <button onClick={onOpen} className="group w-full text-left rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors">
        <div className="relative h-32" style={{ background: `linear-gradient(135deg, ${color}55, #0f172a)` }}>
          {src ? (
            <img src={src} alt="" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <ImageIcon className="absolute inset-0 m-auto w-6 h-6 text-white/30" />
          )}
          <span className="absolute top-2 left-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md text-slate-950" style={{ background: color }}>
            {event.category?.name}
          </span>
          <OfferBadge event={event} className="absolute top-2 right-2" />
          <span className="absolute bottom-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-950/80 text-white backdrop-blur first-letter:uppercase">
            {relativeTime(event.date)}
          </span>
        </div>
        <div className="p-3.5">
          <p className="font-bold text-white truncate">{event.title}</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 shrink-0" /> {formatEventDate(event.date)}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{event.address}</span></p>
          <p className={`text-sm font-bold mt-2 ${event.price === 0 ? 'text-emerald-300' : 'text-white'}`}>
            {event.price === 0 ? 'Entrada liberada' : <OfferPrice event={event} price={publicPrice(event)} />}
            {event.ventaPausada && <span className="ml-2 text-[11px] font-semibold text-amber-200">· Venta próximamente</span>}
          </p>
        </div>
      </button>
    </li>
  );
}

function HowStep({ n, icon: Icon, title, text }: { n: number; icon: React.ElementType; title: string; text: string }) {
  return (
    <li className="relative p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
      <span className="absolute top-5 right-5 text-5xl font-extrabold text-slate-800 select-none" aria-hidden>{n}</span>
      <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 text-emerald-300">
        <Icon className="w-5 h-5" />
      </span>
      <h3 className="mt-4 font-bold text-white text-lg">{title}</h3>
      <p className="mt-1 text-sm text-slate-400 leading-relaxed">{text}</p>
    </li>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <li className="flex gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
      <Icon className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="block text-xs text-slate-400 mt-0.5">{text}</span>
      </span>
    </li>
  );
}

