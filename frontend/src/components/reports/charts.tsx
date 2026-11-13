'use client';

import React, { useMemo, useRef, useState } from 'react';

// Gráficos livianos en SVG con las reglas de visualización del sitio: una sola serie por gráfico (sin dos ejes),
// marcas delgadas con bordes redondeados, cuadrícula discreta, tooltip al pasar el mouse y texto en tinta neutra.
const SERIE = '#818cf8'; // índigo de la marca
const SERIE_HOVER = '#a5b4fc';
const GRILLA = 'rgba(148,163,184,0.14)';
const TEXTO = '#94a3b8';

// Escala "bonita" para el eje Y (0, 5, 10… o 0, 50.000, 100.000…)
function escala(max: number, marcas = 4) {
  if (max <= 0) return { tope: 1, pasos: [0, 1] };
  const bruto = max / marcas;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag;
  const tope = Math.ceil(max / paso) * paso;
  return { tope, pasos: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) };
}

const abreviar = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} mil` : `${n}`);

function Tooltip({ x, y, ancho, children }: { x: number; y: number; ancho: number; children: React.ReactNode }) {
  // Se mantiene dentro del gráfico
  const izquierda = Math.min(Math.max(x, 70), ancho - 70);
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-lg bg-slate-950/95 border border-slate-700 shadow-xl text-xs text-slate-100 whitespace-nowrap"
      style={{ left: izquierda, top: y - 8 }}
    >
      {children}
    </div>
  );
}

// Barras verticales (ej. entradas por día). etiquetaX formatea el eje; formato, el valor del tooltip.
export function BarChart({ datos, formato, etiquetaX, alto = 220, descripcion }: {
  datos: { clave: string; valor: number }[];
  formato: (v: number) => string;
  etiquetaX: (clave: string) => string;
  alto?: number;
  descripcion: string; // para lectores de pantalla
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const ancho = 720;
  const m = { izq: 48, der: 8, arr: 12, aba: 26 };
  const { tope, pasos } = escala(Math.max(...datos.map((d) => d.valor), 0));
  const w = ancho - m.izq - m.der;
  const h = alto - m.arr - m.aba;
  const banda = w / Math.max(1, datos.length);
  const barra = Math.max(2, Math.min(28, banda - 2)); // 2 px de separación entre barras
  const y = (v: number) => m.arr + h - (v / tope) * h;
  // Etiquetas del eje X sin chocar: unas 8 como máximo
  const cada = Math.max(1, Math.ceil(datos.length / 8));

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-auto" role="img" aria-label={descripcion}>
        {pasos.map((p) => (
          <g key={p}>
            <line x1={m.izq} x2={ancho - m.der} y1={y(p)} y2={y(p)} stroke={GRILLA} strokeWidth={1} />
            <text x={m.izq - 6} y={y(p) + 3.5} textAnchor="end" fontSize={10} fill={TEXTO}>{abreviar(p)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = m.izq + i * banda + (banda - barra) / 2;
          const alturaBarra = Math.max(0, m.arr + h - y(d.valor));
          return (
            <g key={d.clave}>
              {d.valor > 0 && (
                // Borde superior redondeado (4 px), anclado a la base
                <path
                  d={`M${x},${m.arr + h} v${-Math.max(0, alturaBarra - 4)} q0,-4 4,-4 h${barra - 8} q4,0 4,4 v${Math.max(0, alturaBarra - 4)} z`}
                  fill={hover === i ? SERIE_HOVER : SERIE}
                />
              )}
              {/* Zona de hover más grande que la barra */}
              <rect x={m.izq + i * banda} y={m.arr} width={banda} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />
              {i % cada === 0 && (
                <text x={m.izq + i * banda + banda / 2} y={alto - 8} textAnchor="middle" fontSize={10} fill={TEXTO}>{etiquetaX(d.clave)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && ref.current && (
        <Tooltip x={((m.izq + hover * banda + banda / 2) / ancho) * ref.current.clientWidth} y={(y(datos[hover].valor) / alto) * ref.current.clientHeight} ancho={ref.current.clientWidth}>
          <span className="text-slate-400">{etiquetaX(datos[hover].clave)}</span> · <strong>{formato(datos[hover].valor)}</strong>
        </Tooltip>
      )}
    </div>
  );
}

// Línea con área (ej. venta acumulada hasta el evento), con línea guía y tooltip
export function AreaChart({ datos, formato, etiquetaX, alto = 200, descripcion, marcas = [] }: {
  datos: { x: number; valor: number; etiqueta: string }[];
  formato: (v: number) => string;
  etiquetaX: (x: number) => string;
  alto?: number;
  descripcion: string;
  marcas?: { x: number; texto: string }[]; // ej. inicio de una oferta
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const ancho = 720;
  const m = { izq: 40, der: 12, arr: 14, aba: 26 };
  const { tope, pasos } = escala(Math.max(...datos.map((d) => d.valor), 0));
  const w = ancho - m.izq - m.der;
  const h = alto - m.arr - m.aba;
  const n = Math.max(1, datos.length - 1);
  const px = (i: number) => m.izq + (i / n) * w;
  const py = (v: number) => m.arr + h - (v / tope) * h;
  const linea = useMemo(() => datos.map((d, i) => `${i ? 'L' : 'M'}${px(i)},${py(d.valor)}`).join(' '), [datos, tope]); // eslint-disable-line react-hooks/exhaustive-deps
  const cada = Math.max(1, Math.ceil(datos.length / 7));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * n);
    setHover(Math.max(0, Math.min(datos.length - 1, i)));
  };

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-auto" role="img" aria-label={descripcion}>
        <defs>
          <linearGradient id="area-relleno" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={SERIE} stopOpacity={0.28} />
            <stop offset="1" stopColor={SERIE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {pasos.map((p) => (
          <g key={p}>
            <line x1={m.izq} x2={ancho - m.der} y1={py(p)} y2={py(p)} stroke={GRILLA} strokeWidth={1} />
            <text x={m.izq - 6} y={py(p) + 3.5} textAnchor="end" fontSize={10} fill={TEXTO}>{abreviar(p)}</text>
          </g>
        ))}
        {marcas.map((mk) => {
          const i = datos.findIndex((d) => d.x === mk.x);
          if (i < 0) return null;
          return (
            <g key={mk.texto}>
              <line x1={px(i)} x2={px(i)} y1={m.arr} y2={m.arr + h} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 4" />
              <text x={px(i) + 4} y={m.arr + 10} fontSize={10} fill="#fcd34d">{mk.texto}</text>
            </g>
          );
        })}
        {datos.length > 1 && <path d={`${linea} L${px(datos.length - 1)},${m.arr + h} L${px(0)},${m.arr + h} Z`} fill="url(#area-relleno)" />}
        <path d={linea} fill="none" stroke={SERIE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {datos.map((d, i) => i % cada === 0 || i === datos.length - 1 ? (
          <text key={d.x} x={px(i)} y={alto - 8} textAnchor="middle" fontSize={10} fill={TEXTO}>{etiquetaX(d.x)}</text>
        ) : null)}
        {hover !== null && (
          <g>
            <line x1={px(hover)} x2={px(hover)} y1={m.arr} y2={m.arr + h} stroke="rgba(226,232,240,0.35)" strokeWidth={1} />
            <circle cx={px(hover)} cy={py(datos[hover].valor)} r={4.5} fill={SERIE} stroke="#0f172a" strokeWidth={2} />
          </g>
        )}
        <rect x={m.izq} y={m.arr} width={w} height={h} fill="transparent" onMouseMove={onMove} />
      </svg>
      {hover !== null && ref.current && (
        <Tooltip x={(px(hover) / ancho) * ref.current.clientWidth} y={(py(datos[hover].valor) / alto) * ref.current.clientHeight} ancho={ref.current.clientWidth}>
          <span className="text-slate-400">{datos[hover].etiqueta}</span> · <strong>{formato(datos[hover].valor)}</strong>
        </Tooltip>
      )}
    </div>
  );
}

// Barras horizontales de avance (ej. ocupación por tipo de entrada). El texto va en tinta neutra.
export function ProgressBars({ filas }: { filas: { etiqueta: string; valor: number; total: number | null; detalle: string }[] }) {
  return (
    <ul className="space-y-3">
      {filas.map((f) => {
        const p = f.total ? Math.min(100, (f.valor / f.total) * 100) : null;
        return (
          <li key={f.etiqueta}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-200 truncate">{f.etiqueta}</span>
              <span className="text-xs text-slate-400 tabular-nums shrink-0">{f.detalle}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={p ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label={f.etiqueta}>
              {p !== null && <div className="h-full rounded-full" style={{ width: `${p}%`, background: SERIE }} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
