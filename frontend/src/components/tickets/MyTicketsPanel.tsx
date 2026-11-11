'use client';

import React, { useEffect, useState } from 'react';
import {
  Ticket, CalendarDays, MapPin, Loader2, Inbox, Timer, ChevronDown, Compass, CalendarClock, Ban, Eye, Copy, Check, Receipt, Car,
  Star, Pencil, MessageSquareQuote,
} from 'lucide-react';
import { Compra, cancelCompra, compraValida } from '../../services/compras';
import { formatEventDate, formatPrice, imageSrc, relativeTime } from '../../services/events';
import { formatRut } from '../../utils/rut';
import { formatDate } from '../../utils/labels';
import { categoryColor } from '../../utils/mapTiles';
import ReceiptModal from './ReceiptModal';
import EventCover from '../events/EventCover';
import { AgeBadge } from '../events/AgeRestriction';
import ReviewFormModal from '../resenas/ReviewFormModal';
import StarRating from '../organizers/StarRating';
import { EstadoResena, diasRestantes, fetchMisResenas } from '../../services/resenas';

interface MyTicketsPanelProps {
  compras: Compra[];
  loading: boolean;
  error: string | null;
  onExplore: () => void;
  onOpenEvent: (eventId: string) => void;
  onResumePayment: (compra: Compra) => void;
  onChanged: () => void;
}

type Filter = 'upcoming' | 'past';

// "Mis entradas" del asistente: compras pagadas o confirmadas y las que aún esperan el pago
export default function MyTicketsPanel({ compras, loading, error, onExplore, onOpenEvent, onResumePayment, onChanged }: MyTicketsPanelProps) {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [now, setNow] = useState(Date.now());
  // Reseñas: qué eventos finalizados se pueden calificar y las reseñas ya escritas
  const [reviews, setReviews] = useState<Map<string, EstadoResena>>(new Map());
  const [reviewing, setReviewing] = useState<Compra | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMisResenas()
      .then((list) => active && setReviews(new Map(list.map((r) => [r.eventoId, r]))))
      .catch(() => {});
    return () => { active = false; };
  }, [compras]);

  // Mantiene al día la cuenta regresiva de las compras pendientes
  const hasPending = compras.some((c) => c.estado === 'PENDIENTE_PAGO');
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasPending]);

  const pending = compras.filter((c) => c.estado === 'PENDIENTE_PAGO' && c.expiraEn && new Date(c.expiraEn).getTime() > now);
  const valid = compras.filter(compraValida);
  const isUpcoming = (c: Compra) => new Date(c.evento.date).getTime() >= now && c.evento.status !== 'FINISHED';
  const upcoming = valid.filter(isUpcoming).sort((a, b) => +new Date(a.evento.date) - +new Date(b.evento.date));
  const past = valid.filter((c) => !isUpcoming(c));
  const visible = filter === 'upcoming' ? upcoming : past;
  const totalTickets = upcoming.reduce((n, c) => n + c.cantidad, 0);
  const toReview = [...reviews.values()].filter((r) => r.puedeResenar).length;
  // Con varias compras del mismo evento, la invitación a reseñar va solo en la primera
  const firstOfEvent = new Set<string>();
  const reviewFor = (c: Compra) => {
    if (firstOfEvent.has(c.evento.id)) return undefined;
    firstOfEvent.add(c.evento.id);
    return reviews.get(c.evento.id);
  };

  if (loading) return <div className="flex justify-center py-16 text-indigo-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error) return <p className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</p>;

  return (
    <section className="mb-8">
      {pending.map((c) => (
        <PendingPayment key={c.id} compra={c} now={now} onResume={() => onResumePayment(c)} onChanged={onChanged} />
      ))}

      {reviewNotice && (
        <p className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-200" role="status">
          <Check className="w-4 h-4 shrink-0" /> {reviewNotice}
        </p>
      )}
      {toReview > 0 && filter === 'upcoming' && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <MessageSquareQuote className="w-5 h-5 text-amber-300 shrink-0" />
          <p className="flex-1 text-sm text-amber-100">
            <strong>{toReview === 1 ? 'Tienes 1 evento por calificar.' : `Tienes ${toReview} eventos por calificar.`}</strong>{' '}
            <span className="text-amber-100/80">Cuéntanos cómo te fue: tu reseña ayuda a otros asistentes.</span>
          </p>
          <button onClick={() => setFilter('past')} className="self-end sm:self-auto px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950">Calificar</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex gap-1 bg-slate-900/80 border border-slate-800 rounded-xl p-1 text-xs" role="tablist">
          {([['upcoming', `Próximas (${upcoming.length})`], ['past', `Pasadas (${past.length})`]] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-lg font-semibold ${filter === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {totalTickets > 0 && filter === 'upcoming' && (
          <p className="text-xs text-slate-400"><span className="font-bold text-white">{totalTickets}</span> {totalTickets === 1 ? 'entrada' : 'entradas'} para tus próximos eventos</p>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <Inbox className="w-9 h-9 text-slate-600 mb-3" />
          <p className="text-sm text-slate-300 font-semibold">
            {filter === 'upcoming' ? 'No tienes entradas para próximos eventos' : 'Aún no tienes eventos pasados'}
          </p>
          {filter === 'upcoming' && (
            <button onClick={onExplore} className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500">
              <Compass className="w-4 h-4" /> Explorar eventos
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((c) => (
            <PurchaseCard
              key={c.id}
              compra={c}
              past={filter === 'past'}
              review={filter === 'past' ? reviewFor(c) : undefined}
              onReview={() => { setReviewNotice(null); setReviewing(c); }}
              onOpenEvent={() => onOpenEvent(c.evento.id)}
            />
          ))}
        </ul>
      )}

      {reviewing && (
        <ReviewFormModal
          evento={reviewing.evento}
          resena={reviews.get(reviewing.evento.id)?.resena}
          cierre={reviews.get(reviewing.evento.id)?.cierre}
          onClose={() => setReviewing(null)}
          onSaved={(resena, mensaje) => {
            const id = reviewing.evento.id;
            setReviews((prev) => {
              const next = new Map(prev);
              const actual = prev.get(id);
              if (actual) next.set(id, { ...actual, resena, puedeResenar: !resena, puedeEditar: !!resena });
              return next;
            });
            setReviewing(null);
            setReviewNotice(mensaje);
          }}
        />
      )}
    </section>
  );
}

function PendingPayment({ compra, now, onResume, onChanged }: { compra: Compra; now: number; onResume: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const left = Math.max(0, new Date(compra.expiraEn!).getTime() - now);
  const s = Math.ceil(left / 1000);
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
      <Timer className="w-5 h-5 text-amber-300 shrink-0" />
      <div className="flex-1 text-sm text-amber-100">
        <strong className="text-amber-200">Tienes un pago pendiente:</strong> {compra.cantidad} {compra.cantidad === 1 ? 'entrada' : 'entradas'} para "{compra.evento.title}" ({formatPrice(compra.total)}).
        <span className="block text-xs text-amber-200/80 tabular-nums">Las reservamos por {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')} minutos más.</span>
      </div>
      <div className="flex gap-2 self-end sm:self-auto">
        <button
          onClick={async () => { setBusy(true); await cancelCompra(compra.id).catch(() => {}); onChanged(); }}
          disabled={busy}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
        >
          Anular
        </button>
        <button onClick={onResume} className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950">Completar pago</button>
      </div>
    </div>
  );
}

function PurchaseCard({ compra, past, review, onReview, onOpenEvent }: {
  compra: Compra;
  past: boolean;
  review?: EstadoResena;
  onReview: () => void;
  onOpenEvent: () => void;
}) {
  const [open, setOpen] = useState(false); // las entradas se muestran con "Ver entradas"
  const [receipt, setReceipt] = useState(false);
  const e = compra.evento;
  const src = imageSrc(e.imageUrl);
  const color = categoryColor(e.category.name);
  const notice =
    e.status === 'CANCELLED'
      ? { icon: Ban, text: 'El organizador canceló este evento', className: 'bg-rose-500/10 border-rose-500/30 text-rose-200' }
      : e.status === 'POSTPONED'
        ? { icon: CalendarClock, text: `Evento postergado: nueva fecha ${formatEventDate(e.date)}`, className: 'bg-sky-500/10 border-sky-500/30 text-sky-200' }
        : null;

  return (
    <li className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <button onClick={onOpenEvent} className="sm:w-48 h-32 sm:h-auto shrink-0 relative overflow-hidden" aria-label={`Ver ${e.title}`}>
          {src
            ? <img src={src} alt="" className={`absolute inset-0 w-full h-full object-cover ${past ? 'grayscale-[50%]' : ''}`} />
            : <EventCover portada={e.portadaIa} categoria={e.category.name} size="thumb" muted={past} />}
        </button>
        <div className="flex-1 p-4 sm:p-5 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color }}>{e.category.name}</span>
              <h4 className="font-bold text-white text-lg leading-snug break-words">{e.title}</h4>
            </div>
            {!past && e.status === 'PUBLISHED' && (
              <span className="text-xs font-bold text-indigo-200 bg-indigo-500/15 rounded-lg px-2.5 py-1 first-letter:uppercase">{relativeTime(e.date)}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {formatEventDate(e.date)}</p>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {e.address}</p>
          {e.edadMinima ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-200">
              <AgeBadge edad={e.edadMinima} /> Solo mayores de {e.edadMinima} años: lleva tu cédula de identidad
            </p>
          ) : null}
          {notice && (
            <p className={`mt-2 flex items-start gap-2 text-xs p-2.5 rounded-lg border ${notice.className}`}>
              <notice.icon className="w-4 h-4 shrink-0" />
              <span>{notice.text}{e.statusReason && <span className="block opacity-80 mt-0.5">{e.statusReason}</span>}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
            <span><span className="text-white font-semibold">{compra.cantidad}</span> {compra.cantidad === 1 ? 'entrada' : 'entradas'}</span>
            <span>{compra.estado === 'CONFIRMADA' ? 'Entrada liberada' : `Pagado ${formatPrice(compra.total)}`}</span>
            <span>Compra <span className="font-mono text-slate-300">{compra.codigo}</span> · {formatDate(compra.fechaPago ?? compra.fechaCreacion)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500">
              <Ticket className="w-3.5 h-3.5" /> {open ? 'Ocultar entradas' : 'Ver entradas'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={onOpenEvent} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
              <Eye className="w-3.5 h-3.5" /> Ver evento
            </button>
            <button onClick={() => setReceipt(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700">
              <Receipt className="w-3.5 h-3.5" /> Comprobante
            </button>
          </div>
          {review && <ReviewBox review={review} onReview={onReview} />}
        </div>
      </div>

      {open && (
        // Separadas del resumen por una línea, para que no queden pegadas a la imagen del evento
        <div className="border-t border-slate-800 p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {compra.entradas.map((t, i) => <TicketStub key={t.id} index={i + 1} total={compra.cantidad} entrada={t} color={color} />)}
          {compra.codigoEstacionamiento && <ParkingStub compra={compra} />}
        </div>
      )}
      {receipt && <ReceiptModal compra={compra} onClose={() => setReceipt(false)} />}
    </li>
  );
}

// Invitación a calificar un evento finalizado o la reseña ya escrita (editable mientras dure el plazo)
function ReviewBox({ review, onReview }: { review: EstadoResena; onReview: () => void }) {
  if (review.resena) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">Tu reseña <StarRating value={review.resena.estrellas} size="sm" /></span>
          {review.puedeEditar && (
            <button onClick={onReview} className="flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200">
              <Pencil className="w-3 h-3" /> Editar
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 break-words">{review.resena.comentario}</p>
        {review.resena.respuesta && <p className="text-[11px] text-emerald-300/90 mt-1.5">El organizador respondió tu reseña</p>}
      </div>
    );
  }
  if (!review.puedeResenar) return null;
  const dias = diasRestantes(review.cierre);
  return (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-slate-950 border border-amber-500/30">
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-100">¿Cómo estuvo el evento?</p>
        <p className="text-[11px] text-amber-100/70">Califica al organizador · {dias === 1 ? 'queda 1 día' : `quedan ${dias} días`} para reseñar</p>
      </div>
      <button onClick={onReview} className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950">
        <Star className="w-3.5 h-3.5" /> Calificar
      </button>
    </div>
  );
}

// Entrada con estilo de ticket: talón perforado con el código de acceso
function TicketStub({ index, total, entrada, color }: { index: number; total: number; entrada: Compra['entradas'][number]; color: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!entrada.codigo) return;
    await navigator.clipboard.writeText(entrada.codigo).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative flex rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
      <span className="w-1.5 shrink-0" style={{ background: color }} />
      <div className="flex-1 p-4 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 truncate">
          <span style={{ color }}>{entrada.tipo}</span> · Entrada {index} de {total}
        </p>
        <p className="text-sm font-bold text-white truncate mt-0.5">{entrada.nombre} {entrada.apellido}</p>
        <p className="text-xs text-slate-400">{formatRut(entrada.rut)}</p>
      </div>
      <div className="relative flex flex-col items-center justify-center px-4 border-l-2 border-dashed border-slate-700">
        <span className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-slate-900" />
        <span className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-slate-900" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Código</span>
        <span className="font-mono text-sm font-extrabold text-indigo-200 tracking-widest">{entrada.codigo}</span>
        <button onClick={copy} className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

// Talón del estacionamiento comprado junto a las entradas
function ParkingStub({ compra }: { compra: Compra }) {
  const n = compra.cantidadEstacionamiento;
  return (
    <div className="relative flex rounded-2xl bg-slate-950 border border-sky-500/25 overflow-hidden">
      <span className="w-1.5 shrink-0 bg-sky-400" />
      <div className="flex-1 p-4 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-sky-300 flex items-center gap-1"><Car className="w-3.5 h-3.5" /> Estacionamiento</p>
        <p className="text-sm font-bold text-white mt-0.5">{n} {n === 1 ? 'vehículo' : 'vehículos'}</p>
        {compra.evento.indicacionesEstacionamiento && <p className="text-[11px] text-slate-400 line-clamp-2">{compra.evento.indicacionesEstacionamiento}</p>}
      </div>
      <div className="relative flex flex-col items-center justify-center px-4 border-l-2 border-dashed border-slate-700">
        <span className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-slate-900" />
        <span className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-slate-900" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Código</span>
        <span className="font-mono text-sm font-extrabold text-sky-200 tracking-widest">{compra.codigoEstacionamiento}</span>
      </div>
    </div>
  );
}
