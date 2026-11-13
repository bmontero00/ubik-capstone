// Filtros por fecha, orden y agrupación de los eventos de "Explorar" (en hora de Chile).

const ZONA = 'America/Santiago';
const DIA = 86_400_000;

// Fecha calendario en Chile, "2026-11-14", y su día de la semana (0 = domingo)
const diaChile = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA });
const diaSemana = (clave: string) => new Date(`${clave}T12:00:00Z`).getUTCDay();
const sumarDias = (clave: string, n: number) => new Date(new Date(`${clave}T12:00:00Z`).getTime() + n * DIA).toISOString().slice(0, 10);

export type FiltroFecha = 'todos' | 'hoy' | 'finde' | 'semana' | 'mes';
export type OrdenEventos = 'fecha' | 'distancia' | 'precio';

export const FILTROS_FECHA: { id: FiltroFecha; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'finde', label: 'Este fin de semana' },
  { id: 'semana', label: 'Próximos 7 días' },
  { id: 'mes', label: 'Este mes' },
];

export const ORDENES: { id: OrdenEventos; label: string }[] = [
  { id: 'fecha', label: 'Próximos primero' },
  { id: 'distancia', label: 'Más cercanos' },
  { id: 'precio', label: 'Menor precio' },
];

// Sábado y domingo de este fin de semana (si hoy es sábado o domingo, el que está en curso)
function finDeSemana(hoy: string) {
  const d = diaSemana(hoy);
  const sabado = d === 0 ? sumarDias(hoy, -1) : sumarDias(hoy, (6 - d + 7) % 7);
  return { sabado, domingo: sumarDias(sabado, 1) };
}

export function enFecha(filtro: FiltroFecha, ahora = new Date()) {
  const hoy = diaChile(ahora);
  const { sabado, domingo } = finDeSemana(hoy);
  const enSiete = sumarDias(hoy, 7);
  return (evento: { date: string }) => {
    if (filtro === 'todos') return true;
    const dia = diaChile(new Date(evento.date));
    if (filtro === 'hoy') return dia === hoy;
    if (filtro === 'finde') return dia >= sabado && dia <= domingo;
    if (filtro === 'semana') return dia >= hoy && dia < enSiete;
    return dia.slice(0, 7) === hoy.slice(0, 7);
  };
}

// Grupos de la lista ordenada por fecha
export type Grupo = 'hoy' | 'manana' | 'finde' | 'semana' | 'adelante' | 'pasados';
export const TITULO_GRUPO: Record<Grupo, string> = {
  pasados: 'En curso o recién terminados',
  hoy: 'Hoy',
  manana: 'Mañana',
  finde: 'Este fin de semana',
  semana: 'Esta semana',
  adelante: 'Más adelante',
};

export function grupoDe(fecha: string, ahora = new Date()): Grupo {
  const hoy = diaChile(ahora);
  const dia = diaChile(new Date(fecha));
  const { sabado, domingo } = finDeSemana(hoy);
  if (dia < hoy) return 'pasados';
  if (dia === hoy) return 'hoy';
  if (dia === sumarDias(hoy, 1)) return 'manana';
  if (dia >= sabado && dia <= domingo) return 'finde';
  if (dia < sumarDias(hoy, 7)) return 'semana';
  return 'adelante';
}

export function ordenar<T extends { date: string; distanceKm?: number | null }>(lista: T[], orden: OrdenEventos, precio: (e: T) => number) {
  const copia = [...lista];
  if (orden === 'distancia') return copia.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.date.localeCompare(b.date));
  if (orden === 'precio') return copia.sort((a, b) => precio(a) - precio(b) || a.date.localeCompare(b.date));
  return copia.sort((a, b) => a.date.localeCompare(b.date));
}
