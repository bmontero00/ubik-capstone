'use client';

import React from 'react';
import { formatPrice } from '../../services/events';
import { Compra, TicketSelection } from '../../services/compras';

// Una línea del detalle: entradas de un mismo tipo y precio
export interface BreakdownItem {
  nombre: string;
  cantidad: number;
  precio: number; // lo que paga el público por entrada (incluye el cargo)
  cargo: number; // cargo por servicio incluido en cada entrada
}

// Agrupa las entradas de una compra por tipo y precio (una compra no cambia aunque se edite el evento)
export function itemsFromCompra(compra: Compra): BreakdownItem[] {
  const items: BreakdownItem[] = [];
  compra.entradas.forEach((e) => {
    const item = items.find((i) => i.nombre === e.tipo && i.precio === e.precio && i.cargo === e.cargo);
    if (item) item.cantidad += 1;
    else items.push({ nombre: e.tipo, cantidad: 1, precio: e.precio, cargo: e.cargo });
  });
  return items;
}

export const itemsFromSelection = (selection?: TicketSelection): BreakdownItem[] =>
  (selection?.tipos ?? []).map((t) => ({ nombre: t.nombre, cantidad: t.cantidad, precio: t.precioFinal, cargo: t.cargoPorEntrada }));

// Desglose: cada tipo de entrada a lo que recibe el organizador, el cargo por servicio (siempre en las
// compras de pago, aunque sea $0), el estacionamiento y el total
export default function PriceBreakdown({ items, parking, totalClassName = '' }: {
  items: BreakdownItem[];
  parking?: { cantidad: number; precio: number };
  totalClassName?: string;
}) {
  const ticketsFree = items.every((i) => i.precio === 0);
  const fee = items.reduce((n, i) => n + i.cargo * i.cantidad, 0);
  const parkingTotal = parking && parking.cantidad > 0 ? parking.cantidad * parking.precio : 0;
  const total = items.reduce((n, i) => n + i.precio * i.cantidad, 0) + parkingTotal;
  return (
    <dl className="space-y-1.5 text-sm">
      {items.map((i) => (
        <Line
          key={`${i.nombre}-${i.precio}`}
          label={ticketsFree ? `${i.cantidad} × ${i.nombre}` : `${i.nombre} · ${i.cantidad} × ${formatPrice(i.precio - i.cargo)}`}
          value={ticketsFree ? 'Gratis' : formatPrice((i.precio - i.cargo) * i.cantidad)}
        />
      ))}
      {!ticketsFree && <Line label="Cargo por servicio" value={fee > 0 ? formatPrice(fee) : '$0'} />}
      {parking && parking.cantidad > 0 && (
        <Line label={`Estacionamiento · ${parking.cantidad} × ${formatPrice(parking.precio)}`} value={formatPrice(parkingTotal)} />
      )}
      <div className={`flex justify-between text-base font-extrabold text-white pt-1.5 border-t border-slate-800 ${totalClassName}`}>
        <dt>Total</dt>
        <dd className="tabular-nums">{total === 0 ? 'Gratis' : formatPrice(total)}</dd>
      </div>
    </dl>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-slate-300">
      <dt className="min-w-0 truncate">{label}</dt>
      <dd className="tabular-nums shrink-0">{value}</dd>
    </div>
  );
}
