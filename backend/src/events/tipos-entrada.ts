import { EstadoCompra, Prisma } from '@prisma/client';
import type { Disponibilidad } from '../parametros/cargos';

// Límites compartidos con el frontend (frontend/src/components/events/ticketTypeRules.ts)
export const TIPO_ENTRADA_LIMITS = {
  maxTipos: 8,
  nombreMin: 3,
  nombreMax: 30,
  descripcionMax: 120,
  cupoMax: 100_000,
  aforoMax: 100_000,
  estacionamientoCuposMax: 10_000,
  indicacionesMax: 120,
};

// Letras, números, espacios y & - + ' . (sin emojis ni símbolos decorativos)
const PERMITIDOS = /^[\p{L}\p{N}][\p{L}\p{N} &+'.-]*$/u;
// Enlaces, correos o teléfonos: el nombre no puede usarse para publicidad ni para vender fuera de UBIK
const CONTACTO = /(https?:|www\.|\.(cl|com|net|org|io)\b|@|\d{7,})/i;
const REPETIDOS = /(\p{L})\1{3,}/iu; // "VIPPPP"
// Lista básica de palabras ofensivas (se comparan sin tildes y como palabras completas)
const OFENSIVAS = ['puta', 'puto', 'mierda', 'weon', 'culiao', 'ctm', 'conchetumare', 'maricon', 'verga', 'xxx', 'porno'];

const sinTildes = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Clave para comparar nombres sin importar mayúsculas, tildes ni espacios
export const claveNombre = (v: string) => sinTildes(v).toLowerCase().replace(/\s+/g, ' ').trim();

// Ordena el texto: sin espacios dobles, primera letra en mayúscula y, si viene todo en mayúsculas,
// en formato título (respetando siglas cortas como VIP o DJ)
export function normalizarNombreTipo(valor: string): string {
  let v = valor.normalize('NFC').replace(/\s+/g, ' ').trim();
  const letras = v.replace(/[^\p{L}]/gu, '');
  if (letras.length > 4 && letras === letras.toUpperCase()) {
    v = v
      .split(' ')
      .map((w) => (w.replace(/[^\p{L}]/gu, '').length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
      .join(' ');
  }
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// Devuelve el motivo por el que un nombre de tipo de entrada no es válido (o null si está bien)
export function errorNombreTipo(valor: string): string | null {
  const v = normalizarNombreTipo(valor);
  const { nombreMin, nombreMax } = TIPO_ENTRADA_LIMITS;
  if (v.length < nombreMin || v.length > nombreMax) return `El nombre de cada tipo de entrada debe tener entre ${nombreMin} y ${nombreMax} caracteres`;
  if (!PERMITIDOS.test(v)) return `"${v}": usa solo letras, números, espacios y los signos & - + ' .`;
  if (CONTACTO.test(v)) return `"${v}": el nombre no puede incluir enlaces, correos ni teléfonos`;
  if (REPETIDOS.test(v)) return `"${v}": evita repetir tantas veces la misma letra`;
  const palabras = claveNombre(v).split(/[^a-z0-9ñ]+/);
  if (OFENSIVAS.some((o) => palabras.includes(o))) return `"${v}": el nombre contiene palabras no permitidas`;
  return null;
}

// Descripción opcional: texto plano, corto y sin datos de contacto
export function errorDescripcionTipo(valor: string): string | null {
  if (valor.length > TIPO_ENTRADA_LIMITS.descripcionMax) {
    return `La descripción de cada tipo de entrada puede tener como máximo ${TIPO_ENTRADA_LIMITS.descripcionMax} caracteres`;
  }
  if (CONTACTO.test(valor)) return 'La descripción no puede incluir enlaces, correos ni teléfonos';
  return null;
}

// Una entrada ocupa cupo si está pagada o confirmada, o si su compra aún espera el pago dentro de plazo
export const compraOcupaCupo = (): Prisma.CompraWhereInput => ({
  OR: [
    { estado: { in: ['PAGADA', 'CONFIRMADA'] as EstadoCompra[] } },
    { estado: 'PENDIENTE_PAGO', expiraEn: { gt: new Date() } },
  ],
});

type ClienteConsultas = Pick<Prisma.TransactionClient, 'entrada' | 'compra'>;

// Entradas y estacionamientos ocupados de varios eventos (una consulta para cada uno)
export async function disponibilidadEventos(db: ClienteConsultas, eventoIds: string[]): Promise<Disponibilidad> {
  if (!eventoIds.length) return { tipos: new Map(), estacionamientos: new Map() };
  const [porTipo, porEvento] = await Promise.all([
    db.entrada.groupBy({
      by: ['tipoEntradaId'],
      where: { eventoId: { in: eventoIds }, compra: compraOcupaCupo() },
      _count: { _all: true },
    }),
    db.compra.groupBy({
      by: ['eventoId'],
      where: { eventoId: { in: eventoIds }, cantidadEstacionamiento: { gt: 0 }, ...compraOcupaCupo() },
      _sum: { cantidadEstacionamiento: true },
    }),
  ]);
  return {
    tipos: new Map(porTipo.filter((t) => t.tipoEntradaId).map((t) => [t.tipoEntradaId!, t._count._all])),
    estacionamientos: new Map(porEvento.map((e) => [e.eventoId, e._sum.cantidadEstacionamiento ?? 0])),
  };
}
