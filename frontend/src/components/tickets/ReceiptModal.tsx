'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CreditCard, FlaskConical, CalendarDays, MapPin, UserRound } from 'lucide-react';
import { Compra, PAYMENT_TYPES, PagoCompra } from '../../services/compras';
import { formatEventDate, formatPrice } from '../../services/events';
import { formatRut } from '../../utils/rut';
import UbikLogo from '../UbikLogo';

const formatDateTime = (value: string) => new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

// Datos del pago con Webpay que exige mostrar Transbank (también se usan al terminar la compra)
export function webpayRows(pago: PagoCompra): [string, string][] {
  return [
    ['Orden de compra', pago.ordenCompra],
    ['Monto', formatPrice(pago.monto)],
    ['Código de autorización', pago.codigoAutorizacion ?? '—'],
    ['Fecha', formatDateTime(pago.fecha)],
    ['Tipo de pago', (pago.tipoPago && PAYMENT_TYPES[pago.tipoPago]) || pago.tipoPago || '—'],
    ['Cuotas', pago.cuotas ? `${pago.cuotas}${pago.montoCuota ? ` de ${formatPrice(pago.montoCuota)}` : ''}` : 'Sin cuotas'],
    ['Tarjeta', pago.ultimosDigitos ? `**** ${pago.ultimosDigitos}` : '—'],
  ];
}

export function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-slate-200 text-right font-medium tabular-nums break-all">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// Comprobante de una compra (o de la confirmación de un evento gratuito), con opción de imprimirlo
// o guardarlo como PDF desde el diálogo de impresión del navegador
export default function ReceiptModal({ compra, onClose }: { compra: Compra; onClose: () => void }) {
  const free = compra.estado === 'CONFIRMADA';
  const e = compra.evento;
  const webpay = compra.pago?.estado === 'AUTORIZADA' ? compra.pago : null;
  const organizer = e.organizer.organizerProfile?.organizationName || e.organizer.name;

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="comprobante-imprimible fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto ubik-scroll bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <UbikLogo size={40} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">UBIK - Eventos y Comunidad</p>
                <h2 id="receipt-title" className="text-lg font-extrabold text-white">
                  {free ? 'Comprobante de confirmación' : 'Comprobante de compra'}
                </h2>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-white print:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <p className="text-[11px] text-slate-500">Código de {free ? 'confirmación' : 'compra'}</p>
              <p className="font-mono text-base font-extrabold text-white tracking-wider">{compra.codigo}</p>
            </div>
            <div className="text-right">
              <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300">
                {free ? 'Confirmada' : 'Pagada'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">{formatDateTime(compra.fechaPago ?? compra.fechaCreacion)}</p>
            </div>
          </div>

          <Section title="Evento">
            <p className="text-sm font-bold text-white break-words">{e.title}</p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 shrink-0" /> {formatEventDate(e.date)}</p>
            <p className="text-xs text-slate-400 mt-0.5 flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {e.address}</p>
            <p className="text-xs text-slate-500 mt-0.5">Organiza {organizer}</p>
          </Section>

          <Section title="Detalle">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-300">
                <dt>{compra.cantidad} × {free ? 'Entrada liberada' : 'Entrada general'}</dt>
                <dd className="tabular-nums">{free ? 'Gratis' : formatPrice(compra.precioUnitario)}</dd>
              </div>
              {!free && compra.cargoServicio > 0 && (
                <div className="flex justify-between text-xs text-slate-500">
                  <dt>Incluye cargo por servicio</dt>
                  <dd className="tabular-nums">{formatPrice(compra.cargoServicio)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-white pt-1.5 border-t border-slate-800">
                <dt>Total</dt>
                <dd className="tabular-nums">{free ? 'Gratis' : formatPrice(compra.total)}</dd>
              </div>
            </dl>
          </Section>

          {!free && (
            <Section title="Pago">
              {webpay ? (
                <>
                  <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2"><CreditCard className="w-3.5 h-3.5" /> Webpay · Transbank</p>
                  <Rows rows={webpayRows(webpay)} />
                </>
              ) : compra.medioPago === 'SIMULADO' ? (
                <p className="text-xs text-slate-400 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Pago de prueba (sin cobro real)</p>
              ) : (
                <p className="text-xs text-slate-400">Medio de pago: {compra.medioPago ?? '—'}</p>
              )}
            </Section>
          )}

          <Section title={`Entradas a nombre de (${compra.cantidad})`}>
            <ul className="space-y-1.5 text-sm">
              {compra.entradas.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="text-slate-200 truncate flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {t.nombre} {t.apellido}</span>
                  <span className="text-slate-500 text-xs tabular-nums">{formatRut(t.rut)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <p className="mt-5 text-[11px] text-slate-500">
            Comprobante informativo de tu {free ? 'confirmación' : 'compra'} en UBIK. Para entrar al evento presenta el código de
            cada entrada (en «Mis entradas») y tu cédula de identidad.
          </p>

          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 print:hidden">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700">Cerrar</button>
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500">
              <Printer className="w-4 h-4" /> Imprimir o guardar PDF
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</h3>
      {children}
    </section>
  );
}
