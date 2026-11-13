// Comparación de nombres de organizaciones para detectar duplicados o suplantaciones:
// "DUOC UC", "Duoc S.A." y "duoc" quedan como "duoc uc" / "duoc", y se consideran parecidos.

// Sufijos y palabras de forma jurídica que no distinguen a una organización de otra
const SUFIJOS = [
  'sociedad anonima', 'sociedad por acciones', 'limitada', 'ltda', 'spa', 's a', 'sa', 'eirl', 'e i r l',
  'cia', 'compania', 'y cia', 'corporacion', 'fundacion', 'asociacion', 'agrupacion', 'organizacion',
];

export function normalizarNombre(nombre: string): string {
  let n = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  // Quita sufijos al final (pueden venir varios: "Comercial Ltda SpA")
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const s of SUFIJOS) {
      if (n.endsWith(` ${s}`) && n.length > s.length + 2) {
        n = n.slice(0, -(s.length + 1)).trim();
        cambio = true;
      }
    }
  }
  return n;
}

// Distancia de edición (Levenshtein), con corte temprano para nombres muy distintos
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = temp;
    }
  }
  return fila[b.length];
}

// Dos nombres normalizados son "iguales" si coinciden exactamente y "parecidos" si uno contiene al
// otro como palabra(s) completa(s) o difieren en un par de letras (errores de tipeo o variaciones).
export function compararNombres(a: string, b: string): 'igual' | 'parecido' | null {
  if (!a || !b) return null;
  if (a === b) return 'igual';
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  if (corto.length >= 3 && ` ${largo} `.includes(` ${corto} `)) return 'parecido';
  if (corto.length >= 5 && distancia(a, b) <= 2) return 'parecido';
  return null;
}
