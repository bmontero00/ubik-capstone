// Portada diseñada con IA para eventos sin imagen: Claude elige entre opciones fijas y el frontend la dibuja.
// Los nombres deben coincidir con frontend/src/utils/portadas.ts.
export const PALETAS = ['atardecer', 'oceano', 'bosque', 'neon', 'fuego', 'lavanda', 'arena', 'noche', 'menta', 'rosa'] as const;
export const PATRONES = ['puntos', 'lineas', 'ondas', 'circulos', 'cuadricula', 'confeti'] as const;
export const FRASE_MAX = 60;

export interface PortadaIa {
  paleta: (typeof PALETAS)[number];
  patron: (typeof PATRONES)[number];
  emoji: string;
  frase: string;
}

// Deja pasar solo una portada válida (viene del formulario como JSON): si algo no calza, null
export function normalizarPortada(valor: unknown): PortadaIa | null {
  if (!valor || typeof valor !== 'object') return null;
  const p = valor as Record<string, unknown>;
  if (!PALETAS.includes(p.paleta as PortadaIa['paleta']) || !PATRONES.includes(p.patron as PortadaIa['patron'])) return null;
  const emoji = typeof p.emoji === 'string' ? p.emoji.trim() : '';
  // Un emoji (puede tener modificadores); nada de texto ni etiquetas
  if (!emoji || [...emoji].length > 4 || /[\p{L}\p{N}<>]/u.test(emoji)) return null;
  const frase = typeof p.frase === 'string' ? p.frase.replace(/\s+/g, ' ').trim().slice(0, FRASE_MAX) : '';
  return { paleta: p.paleta as PortadaIa['paleta'], patron: p.patron as PortadaIa['patron'], emoji, frase };
}
