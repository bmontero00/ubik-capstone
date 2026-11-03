// Mismas reglas que el backend (backend/src/events/tipos-entrada.ts)
export const TICKET_TYPE_LIMITS = {
  maxTipos: 8,
  nombreMin: 3,
  nombreMax: 30,
  descripcionMax: 120,
  cupoMax: 100_000,
  aforoMax: 100_000,
  estacionamientoCuposMax: 10_000,
  indicacionesMax: 120,
};

// Nombres frecuentes: se agregan con un clic y mantienen el catálogo ordenado
export const TICKET_TYPE_SUGGESTIONS = [
  'General', 'Preventa', 'Asistente', 'Expositor', 'Estudiante', 'Meet & Greet', 'Premium', 'VIP', 'Platea', 'Cancha', 'Familiar',
];

const PERMITIDOS = /^[\p{L}\p{N}][\p{L}\p{N} &+'.-]*$/u;
const CONTACTO = /(https?:|www\.|\.(cl|com|net|org|io)\b|@|\d{7,})/i;
const REPETIDOS = /(\p{L})\1{3,}/iu;
const OFENSIVAS = ['puta', 'puto', 'mierda', 'weon', 'culiao', 'ctm', 'conchetumare', 'maricon', 'verga', 'xxx', 'porno'];

const sinTildes = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const nameKey = (v: string) => sinTildes(v).toLowerCase().replace(/\s+/g, ' ').trim();

// Igual que el backend: sin espacios dobles, primera letra en mayúscula y, si viene todo en
// mayúsculas, en formato título (respetando siglas cortas como VIP)
export function normalizeTypeName(value: string): string {
  let v = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  const letras = v.replace(/[^\p{L}]/gu, '');
  if (letras.length > 4 && letras === letras.toUpperCase()) {
    v = v
      .split(' ')
      .map((w) => (w.replace(/[^\p{L}]/gu, '').length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
      .join(' ');
  }
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function typeNameError(value: string): string | null {
  const v = normalizeTypeName(value);
  const { nombreMin, nombreMax } = TICKET_TYPE_LIMITS;
  if (!v) return 'Ponle un nombre a esta entrada';
  if (v.length < nombreMin || v.length > nombreMax) return `Entre ${nombreMin} y ${nombreMax} caracteres`;
  if (!PERMITIDOS.test(v)) return "Usa solo letras, números, espacios y & - + ' .";
  if (CONTACTO.test(v)) return 'No incluyas enlaces, correos ni teléfonos';
  if (REPETIDOS.test(v)) return 'Evita repetir tantas veces la misma letra';
  if (OFENSIVAS.some((o) => nameKey(v).split(/[^a-z0-9ñ]+/).includes(o))) return 'El nombre contiene palabras no permitidas';
  return null;
}

export function typeDescriptionError(value: string): string | null {
  if (value.trim().length > TICKET_TYPE_LIMITS.descripcionMax) return `Máximo ${TICKET_TYPE_LIMITS.descripcionMax} caracteres`;
  if (CONTACTO.test(value)) return 'No incluyas enlaces, correos ni teléfonos';
  return null;
}
