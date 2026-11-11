// Registro de categorías cargadas desde el backend (color y emoji los define el admin en el mantenedor).
// Se completa al cargar la página; mientras tanto se usan los colores de siempre.
import type { Category } from '../services/events';

export const CATEGORIA_OTRA = 'Otra';

const registro = new Map<string, Category>();

export function registrarCategorias(lista: Category[]) {
  registro.clear();
  lista.forEach((c) => registro.set(c.name.toLowerCase(), c));
}

export const infoCategoria = (nombre?: string) => (nombre ? registro.get(nombre.toLowerCase()) : undefined);

// Mezcla un color con blanco o negro (proporción 0 a 1), para derivar tonos de la portada
export function mezclar(hex: string, con: '#ffffff' | '#000000', proporcion: number) {
  const a = hex.replace('#', '');
  const b = con.replace('#', '');
  const canal = (i: number) => {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * proporcion).toString(16).padStart(2, '0');
  };
  return /^[0-9a-fA-F]{6}$/.test(a) ? `#${canal(0)}${canal(2)}${canal(4)}` : hex;
}
