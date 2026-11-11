// Reglas compartidas de las categorías de eventos

// Categoría comodín: el organizador la elige cuando ninguna calza y propone cuál faltaría
export const CATEGORIA_OTRA = 'Otra';
export const ORDEN_OTRA = 999; // siempre al final

export const SUGERENCIA_LIMITES = { min: 3, max: 40 };

// Sugerencias equivalentes ("mascotas", " Mascotas ") cuentan como una sola
export const normalizarSugerencia = (texto: string) =>
  texto.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

// Un emoji (puede traer modificadores), sin letras ni números
export const esEmojiValido = (valor: string) => {
  const v = valor.trim();
  return !!v && [...v].length <= 4 && !/[\p{L}\p{N}<>]/u.test(v);
};

// Restricción de edad de un evento: se elige al crearlo y no cambia después
export const EDADES_MINIMAS = [14, 16, 18] as const;
