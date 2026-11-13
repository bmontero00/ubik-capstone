import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import sharp from 'sharp';

// Entrada electrónica en PDF (una página por entrada y otra para el estacionamiento), con el QR del
// código de acceso. El QR lleva solo el código: la validez se decide siempre en el servidor al escanear.

export interface DatosPdf {
  compra: {
    codigo: string;
    cantidad: number;
    fechaPago: Date | null;
    fechaCreacion: Date;
    cantidadEstacionamiento: number;
    codigoEstacionamiento: string | null;
  };
  evento: {
    title: string;
    date: Date;
    address: string;
    imageUrl: string | null;
    edadMinima: number | null;
    status: string;
    indicacionesEstacionamiento: string | null;
    categoria: string;
    organizador: string;
  };
  entradas: { codigo: string; nombre: string; apellido: string; rut: string; tipo: string; precio: number; indice: number }[];
  incluirEstacionamiento: boolean;
}

// Colores de UBIK (impreso sobre fondo blanco)
const TINTA = '#0f172a';
const TEXTO = '#334155';
const SUAVE = '#64748b';
const LINEA = '#cbd5e1';
const INDIGO = '#4f46e5';
const CIELO = '#0284c7';

const ZONA = 'America/Santiago';
const fechaLarga = (d: Date) => {
  const s = d.toLocaleDateString('es-CL', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const hora = (d: Date) => d.toLocaleTimeString('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
const fechaCorta = (d: Date) => d.toLocaleDateString('es-CL', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' });
const precio = (n: number) => (n > 0 ? `$${Math.round(n).toLocaleString('es-CL')}` : 'Gratis');

// RUT parcial: solo los últimos dígitos, por si la entrada se imprime o se comparte por error
function rutParcial(rut: string) {
  const [cuerpo, dv] = rut.split('-');
  if (!cuerpo || !dv) return '***';
  return `**.***.${cuerpo.slice(-3)}-${dv}`;
}

// Imagen del evento como JPEG recortado al ancho del encabezado (pdfkit no lee WebP).
// Si no se puede leer, el encabezado usa el degradado de la marca.
async function imagenEvento(url: string | null, ancho: number, alto: number): Promise<Buffer | null> {
  if (!url) return null;
  try {
    let original: Buffer;
    if (url.startsWith('/uploads/')) {
      original = await readFile(join(process.cwd(), 'uploads', basename(url)));
    } else if (/^https?:\/\//.test(url)) {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      original = Buffer.from(await r.arrayBuffer());
    } else {
      return null;
    }
    return await sharp(original).resize(ancho * 2, alto * 2, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

const qr = (codigo: string) => QRCode.toBuffer(codigo, { errorCorrectionLevel: 'M', margin: 1, width: 600, color: { dark: TINTA, light: '#ffffff' } });

export async function generarPdfEntradas(d: DatosPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    autoFirstPage: false,
    info: { Title: `Entradas · ${d.evento.title}`, Author: 'UBIK', Subject: `Compra ${d.compra.codigo}` },
  });
  const partes: Buffer[] = [];
  doc.on('data', (c: Buffer) => partes.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))));

  const W = 595.28;
  const M = 40;
  const ANCHO = W - M * 2;
  const ALTO_IMG = 170;
  const imagen = await imagenEvento(d.evento.imageUrl, Math.round(ANCHO), ALTO_IMG);
  const fechaCompra = d.compra.fechaPago ?? d.compra.fechaCreacion;

  // Logo de UBIK en vectores (el mismo dibujo de frontend/src/app/icon.svg, en una grilla de 64)
  const logo = (x: number, y: number, lado: number) => {
    doc.save();
    doc.translate(x, y).scale(lado / 64);
    const fondo = doc.linearGradient(0, 0, 64, 64);
    fondo.stop(0, '#111a2e').stop(1, '#060b16');
    doc.roundedRect(0, 0, 64, 64, 16).fill(fondo);
    const u = doc.linearGradient(10, 8, 54, 56);
    u.stop(0, '#34d399').stop(1, '#22d3ee');
    doc.path('M15 12v20a17 17 0 0 0 34 0V12').lineWidth(9).lineCap('round').stroke(u);
    doc.path('M32 41.5c-1.1-1.6-8-10.4-8-15.5a8 8 0 0 1 16 0c0 5.1-6.9 13.9-8 15.5z').fill('#f8fafc');
    doc.circle(32, 26, 3).fill('#0b1120');
    doc.restore();
  };

  // Cabecera común: marca, imagen o degradado, y datos del evento
  const cabecera = (etiqueta: string) => {
    doc.addPage();
    logo(M, M - 2, 36);
    const marca = doc.linearGradient(M + 46, 0, M + 104, 0);
    marca.stop(0, '#10b981').stop(1, '#06b6d4');
    doc.font('Helvetica-Bold').fontSize(20).fillColor(marca).text('UBIK', M + 46, M, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(SUAVE).text('Eventos & Comunidad', M + 46, M + 22, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(TINTA).text(etiqueta.toUpperCase(), M, M + 4, { width: ANCHO, align: 'right', characterSpacing: 1 });
    doc.font('Helvetica').fontSize(9).fillColor(SUAVE).text(`Compra ${d.compra.codigo}`, M, M + 20, { width: ANCHO, align: 'right' });

    const y = M + 48;
    doc.save();
    doc.roundedRect(M, y, ANCHO, ALTO_IMG, 14).clip();
    if (imagen) {
      doc.image(imagen, M, y, { width: ANCHO, height: ALTO_IMG });
    } else {
      const g = doc.linearGradient(M, y, M + ANCHO, y + ALTO_IMG);
      g.stop(0, '#064e3b').stop(0.55, '#0f172a').stop(1, '#155e75');
      doc.rect(M, y, ANCHO, ALTO_IMG).fill(g);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#a7f3d0').text(d.evento.categoria.toUpperCase(), M + 24, y + 24, { characterSpacing: 2 });
    }
    // Franja oscura inferior para el título
    const franja = doc.linearGradient(M, y + ALTO_IMG - 90, M, y + ALTO_IMG);
    franja.stop(0, '#000000', 0).stop(1, '#000000', 0.75);
    doc.rect(M, y + ALTO_IMG - 90, ANCHO, 90).fill(franja);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text(d.evento.title, M + 22, y + ALTO_IMG - 52, { width: ANCHO - 44, height: 26, ellipsis: true, lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor('#e2e8f0').text(`Organiza: ${d.evento.organizador}`, M + 22, y + ALTO_IMG - 24, { width: ANCHO - 44, lineBreak: false, ellipsis: true });

    // Fecha, hora y lugar
    const yInfo = y + ALTO_IMG + 18;
    const col = (x: number, w: number, titulo: string, valor: string, extra?: string) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(SUAVE).text(titulo, x, yInfo, { width: w, characterSpacing: 1 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA).text(valor, x, yInfo + 13, { width: w });
      if (extra) doc.font('Helvetica').fontSize(9).fillColor(TEXTO).text(extra, x, doc.y + 2, { width: w });
    };
    col(M, 200, 'FECHA', fechaLarga(d.evento.date));
    col(M + 210, 70, 'HORA', `${hora(d.evento.date)} hrs`);
    col(M + 290, ANCHO - 290, 'LUGAR', d.evento.address);
    return yInfo + 62;
  };

  // Cuerpo del talón: datos a la izquierda y QR a la derecha, separados por una línea perforada
  const talon = (yTop: number, color: string, filas: [string, string][]) => {
    const alto = 212;
    doc.roundedRect(M, yTop, ANCHO, alto, 14).lineWidth(1).strokeColor(LINEA).stroke();
    doc.rect(M, yTop + 14, 5, alto - 28).fill(color);

    const xQr = M + ANCHO - 200;
    doc.save();
    doc.moveTo(xQr, yTop + 12).lineTo(xQr, yTop + alto - 12).dash(4, { space: 4 }).lineWidth(1).strokeColor(LINEA).stroke();
    doc.restore();
    // Muescas de la perforación
    doc.circle(xQr, yTop, 8).fill('#ffffff');
    doc.circle(xQr, yTop + alto, 8).fill('#ffffff');

    let y = yTop + 20;
    for (const [titulo, valor] of filas) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(SUAVE).text(titulo, M + 24, y, { width: xQr - M - 44, characterSpacing: 1 });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(TINTA).text(valor, M + 24, y + 11, { width: xQr - M - 44, lineBreak: false, ellipsis: true });
      y += 32;
    }
    return { xQr, alto };
  };

  const dibujarQr = async (yTop: number, xQr: number, alto: number, codigo: string, color: string, nota: string) => {
    const lado = 140;
    const x = xQr + (200 - lado) / 2;
    doc.image(await qr(codigo), x, yTop + 18, { width: lado, height: lado });
    doc.font('Courier-Bold').fontSize(15).fillColor(color).text(codigo, xQr, yTop + 18 + lado + 8, { width: 200, align: 'center', characterSpacing: 1.5 });
    doc.font('Helvetica').fontSize(8).fillColor(SUAVE).text(nota, xQr + 12, yTop + alto - 26, { width: 176, align: 'center' });
  };

  // Avisos y condiciones al pie
  const condiciones = (y: number, avisos: { titulo: string; texto: string; color: string }[], items: string[]) => {
    for (const a of avisos) {
      const alto = doc.font('Helvetica').fontSize(9).heightOfString(a.texto, { width: ANCHO - 32 }) + 30;
      doc.roundedRect(M, y, ANCHO, alto, 10).fillOpacity(0.08).fill(a.color).fillOpacity(1);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(a.color).text(a.titulo, M + 16, y + 10, { width: ANCHO - 32 });
      doc.font('Helvetica').fontSize(9).fillColor(TEXTO).text(a.texto, M + 16, y + 24, { width: ANCHO - 32 });
      y += alto + 8;
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA).text('Condiciones', M, y + 4);
    doc.font('Helvetica').fontSize(8.5).fillColor(TEXTO);
    doc.list(items, M, y + 18, { width: ANCHO, bulletRadius: 1.6, textIndent: 10, bulletIndent: 2, paragraphGap: 2 });

    // Pie (sin margen inferior para que no abra una página nueva)
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(SUAVE).text(
      `Comprada el ${fechaCorta(fechaCompra)} · Generada el ${fechaCorta(new Date())} ${hora(new Date())} hrs · ubik.cl`,
      M, 842 - M - 12, { width: ANCHO, align: 'center', lineBreak: false },
    );
  };

  const avisosEvento: { titulo: string; texto: string; color: string }[] = [];
  if (d.evento.edadMinima) {
    avisosEvento.push({
      titulo: `Evento para mayores de ${d.evento.edadMinima} años`,
      texto: 'En el acceso se puede pedir tu cédula de identidad. Si no cumples la edad mínima no podrás ingresar y la entrada no se devuelve.',
      color: '#b45309',
    });
  }
  if (d.evento.status === 'POSTPONED') {
    avisosEvento.push({
      titulo: 'Evento postergado',
      texto: 'Esta entrada sigue siendo válida para la nueva fecha. Revisa los anuncios del organizador en UBIK.',
      color: CIELO,
    });
  }

  for (const e of d.entradas) {
    const y = cabecera('Entrada electrónica');
    const { xQr, alto } = talon(y, INDIGO, [
      ['TITULAR', `${e.nombre} ${e.apellido}`],
      ['RUT', rutParcial(e.rut)],
      ['TIPO DE ENTRADA', e.tipo],
      ['VALOR', precio(e.precio)],
      ['ENTRADA', `${e.indice} de ${d.compra.cantidad}`],
    ]);
    await dibujarQr(y, xQr, alto, e.codigo, INDIGO, 'Muestra este código en el acceso');
    condiciones(y + alto + 18, avisosEvento, [
      'Presenta esta entrada impresa o en tu celular. El código QR es válido para un solo ingreso: una vez escaneado no se puede volver a usar.',
      'No compartas ni publiques este código. Quien lo presente primero podrá ingresar.',
      'La entrada es personal y está a nombre del titular indicado. El organizador puede pedir identificación en el acceso.',
      'Las entradas no tienen devolución, salvo que el evento sea cancelado.',
      'Ante cualquier problema, escríbenos a soporte@ubik.cl indicando el número de compra.',
    ]);
  }

  if (d.incluirEstacionamiento && d.compra.codigoEstacionamiento) {
    const n = d.compra.cantidadEstacionamiento;
    const y = cabecera('Estacionamiento');
    const { xQr, alto } = talon(y, CIELO, [
      ['ESTACIONAMIENTO', `${n} ${n === 1 ? 'vehículo' : 'vehículos'}`],
      ['COMPRA', d.compra.codigo],
      ['FECHA', `${fechaCorta(d.evento.date)} · ${hora(d.evento.date)} hrs`],
    ]);
    await dibujarQr(y, xQr, alto, d.compra.codigoEstacionamiento, CIELO, 'Muestra este código al ingresar con tu vehículo');
    condiciones(y + alto + 18, d.evento.indicacionesEstacionamiento
      ? [{ titulo: 'Indicaciones del organizador', texto: d.evento.indicacionesEstacionamiento, color: CIELO }]
      : [], [
      'Este código es válido para el ingreso de la cantidad de vehículos indicada, una sola vez.',
      'Debes presentar también tu entrada al evento.',
      'Los estacionamientos no tienen devolución, salvo que el evento sea cancelado.',
    ]);
  }

  doc.end();
  return fin;
}
