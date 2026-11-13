'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Loader2, Sun, X } from 'lucide-react';

// QR de una entrada a pantalla completa, para mostrarlo en el acceso desde el celular.
// Fondo blanco y QR grande para que el lector lo capture aunque haya poca luz.
export default function TicketQrModal({ codigo, titulo, detalle, color = '#0f172a', onDownload, onClose }: {
  codigo: string;
  titulo: string; // ej. nombre del evento
  detalle: string; // ej. titular y tipo de entrada
  color?: string;
  onDownload?: () => Promise<void>;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(codigo, { errorCorrectionLevel: 'M', margin: 1, width: 720, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setError('No se pudo generar el código QR'));
  }, [codigo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const descargar = async () => {
    if (!onDownload) return;
    setDescargando(true);
    setError(null);
    try {
      await onDownload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Código QR de la entrada ${codigo}`}>
      <div className="relative w-full max-w-sm rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <span className="block h-1.5" style={{ background: color }} />
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
        <div className="px-6 pt-6 pb-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Entrada electrónica</p>
          <h3 className="mt-1 font-extrabold text-lg leading-snug pr-6 pl-6">{titulo}</h3>
          <p className="text-sm text-slate-600 mt-0.5">{detalle}</p>

          <div className="mt-4 mx-auto aspect-square w-full max-w-[280px] flex items-center justify-center">
            {src ? <img src={src} alt={`Código QR ${codigo}`} className="w-full h-full [image-rendering:pixelated]" /> : <Loader2 className="w-8 h-8 animate-spin text-slate-400" />}
          </div>
          <p className="mt-3 font-mono text-xl font-extrabold tracking-[0.2em] text-slate-900 break-all">{codigo}</p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <Sun className="w-3.5 h-3.5" /> Sube el brillo de tu pantalla al mostrarlo en el acceso
          </p>
          <p className="mt-1 text-xs text-slate-500">Válido para un solo ingreso. No lo compartas.</p>

          {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
          {onDownload && (
            <button onClick={descargar} disabled={descargando} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60">
              {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
