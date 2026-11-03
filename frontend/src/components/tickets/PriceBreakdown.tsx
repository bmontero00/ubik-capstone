'use client';

import React from 'react';
import { formatPrice } from '../../services/events';

// Desglose de una compra: entradas a precio del organizador, cargo por servicio y total.
// El cargo se muestra siempre en las compras de pago, aunque sea $0 (eventos sin cargo).
export default function PriceBreakdown({ quantity, unitPrice, feeTotal, free, totalClassName = '' }: {
  quantity: number;
  unitPrice: number; // precio final por entrada (incluye el cargo)
  feeTotal: number; // cargo por servicio de toda la compra
  free: boolean;
  totalClassName?: string;
}) {
  if (free) {
    return (
      <dl className="space-y-1.5 text-sm">
        <Line label={`${quantity} × Entrada liberada`} value="Gratis" />
        <Total value="Gratis" className={totalClassName} />
      </dl>
    );
  }
  const feePerTicket = feeTotal / quantity;
  const basePerTicket = unitPrice - feePerTicket;
  return (
    <dl className="space-y-1.5 text-sm">
      <Line label={`Entrada general · ${quantity} × ${formatPrice(basePerTicket)}`} value={formatPrice(basePerTicket * quantity)} />
      <Line label="Cargo por servicio" value={feeTotal > 0 ? formatPrice(feeTotal) : '$0'} />
      <Total value={formatPrice(unitPrice * quantity)} className={totalClassName} />
    </dl>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-slate-300">
      <dt>{label}</dt>
      <dd className="tabular-nums shrink-0">{value}</dd>
    </div>
  );
}

function Total({ value, className }: { value: string; className: string }) {
  return (
    <div className={`flex justify-between text-base font-extrabold text-white pt-1.5 border-t border-slate-800 ${className}`}>
      <dt>Total</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
