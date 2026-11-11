import { infoCategoria, mezclar } from './categorias';
// Portadas para eventos sin imagen. Los nombres de paletas y patrones coinciden con backend/src/ia/portada.ts
// (Claude elige entre ellos al diseñar una portada con IA).

export interface PortadaIa {
  paleta: string;
  patron: string;
  emoji: string;
  frase: string;
  colores?: [string, string, string]; // solo en portadas por defecto de categorías nuevas
}

// [color principal, color secundario, fondo oscuro]
export const PALETAS: Record<string, [string, string, string]> = {
  atardecer: ['#f97316', '#db2777', '#1e1b4b'],
  oceano: ['#0ea5e9', '#2563eb', '#0b1530'],
  bosque: ['#10b981', '#15803d', '#052e16'],
  neon: ['#a855f7', '#ec4899', '#12082a'],
  fuego: ['#ef4444', '#f59e0b', '#1f0a05'],
  lavanda: ['#a78bfa', '#818cf8', '#1e1b4b'],
  arena: ['#f59e0b', '#d97706', '#1c1410'],
  noche: ['#6366f1', '#0ea5e9', '#020617'],
  menta: ['#2dd4bf', '#22c55e', '#042f2e'],
  rosa: ['#f472b6', '#fb7185', '#2a0a1a'],
};

// Patrón dibujado sobre el fondo (CSS puro, sin imágenes)
export const PATRONES: Record<string, { backgroundImage: string; backgroundSize?: string }> = {
  puntos: { backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1.5px, transparent 1.6px)', backgroundSize: '18px 18px' },
  lineas: { backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 16px)' },
  ondas: { backgroundImage: 'repeating-radial-gradient(circle at 0% 100%, transparent 0 22px, rgba(255,255,255,0.13) 22px 24px)' },
  circulos: {
    backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.28) 0 18%, transparent 18.5%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.18) 0 26%, transparent 26.5%), radial-gradient(circle at 55% 60%, rgba(255,255,255,0.1) 0 9%, transparent 9.5%)',
  },
  cuadricula: {
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
    backgroundSize: '22px 22px',
  },
  confeti: {
    backgroundImage: [
      'radial-gradient(circle at 12% 20%, rgba(255,255,255,0.7) 0 3px, transparent 4px)',
      'radial-gradient(circle at 78% 30%, rgba(253,224,71,0.8) 0 4px, transparent 5px)',
      'radial-gradient(circle at 35% 75%, rgba(255,255,255,0.6) 0 3px, transparent 4px)',
      'radial-gradient(circle at 60% 12%, rgba(244,114,182,0.8) 0 3px, transparent 4px)',
      'radial-gradient(circle at 88% 80%, rgba(110,231,183,0.8) 0 4px, transparent 5px)',
      'radial-gradient(circle at 22% 55%, rgba(147,197,253,0.8) 0 3px, transparent 4px)',
    ].join(', '),
    backgroundSize: '160px 120px',
  },
};

// Portada por defecto según la categoría (sin IA)
const POR_CATEGORIA: Record<string, Omit<PortadaIa, 'frase'>> = {
  cultural: { paleta: 'oceano', patron: 'circulos', emoji: '🎭' },
  deporte: { paleta: 'bosque', patron: 'lineas', emoji: '🏅' },
  diversión: { paleta: 'rosa', patron: 'confeti', emoji: '🎉' },
  gastronomía: { paleta: 'fuego', patron: 'puntos', emoji: '🍽️' },
  música: { paleta: 'neon', patron: 'ondas', emoji: '🎵' },
  talleres: { paleta: 'arena', patron: 'cuadricula', emoji: '🛠️' },
  vehículos: { paleta: 'atardecer', patron: 'lineas', emoji: '🚗' },
  videojuegos: { paleta: 'lavanda', patron: 'cuadricula', emoji: '🎮' },
};

const PATRONES_DEFECTO = ['puntos', 'circulos', 'lineas', 'ondas', 'cuadricula'];

export const portadaPorCategoria = (categoria?: string): PortadaIa => {
  const info = infoCategoria(categoria);
  const clasica = POR_CATEGORIA[categoria?.toLowerCase() ?? ''];
  if (clasica) return { ...clasica, emoji: info?.emoji ?? clasica.emoji, frase: '' };
  if (info?.color) {
    // Categorías creadas en el mantenedor: tonos derivados de su color y un patrón estable según el nombre
    const hash = [...info.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    return {
      paleta: 'personalizada',
      colores: [info.color, mezclar(info.color, '#ffffff', 0.25), mezclar(info.color, '#000000', 0.85)],
      patron: PATRONES_DEFECTO[hash % PATRONES_DEFECTO.length],
      emoji: info.emoji ?? '✨',
      frase: '',
    };
  }
  return { paleta: 'noche', patron: 'puntos', emoji: info?.emoji ?? '✨', frase: '' };
};
