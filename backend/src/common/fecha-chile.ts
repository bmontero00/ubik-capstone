// Fechas según el calendario de Chile (America/Santiago), con su horario de verano e invierno
const ZONA = 'America/Santiago';

const partesEnZona = (fecha: Date) => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(fecha);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return { anio: valor('year'), mes: valor('month'), dia: valor('day'), hora: valor('hour'), minuto: valor('minute'), segundo: valor('second') };
};

// Minutos de diferencia entre la hora de Chile y UTC en un instante (ej. -180 en verano)
const desfaseMinutos = (fecha: Date) => {
  const p = partesEnZona(fecha);
  return (Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo) - fecha.getTime()) / 60_000;
};

// Instante en que empieza (00:00 en Chile) el día calendario de la fecha dada
export function inicioDelDiaEnChile(fecha = new Date()): Date {
  const { anio, mes, dia } = partesEnZona(fecha);
  const medianocheUtc = Date.UTC(anio, mes - 1, dia);
  // Con el desfase del día anterior y el del siguiente se cubren los cambios de horario (en Chile
  // ocurren a medianoche: en septiembre las 00:00 no existen y el día empieza a la 01:00). El día
  // empieza en el primero de esos instantes que ya cae en la fecha buscada.
  const esDelDia = (instante: number) => {
    const p = partesEnZona(new Date(instante));
    return p.anio === anio && p.mes === mes && p.dia === dia;
  };
  const candidatos = [medianocheUtc - 86_400_000, medianocheUtc + 86_400_000]
    .map((referencia) => medianocheUtc - desfaseMinutos(new Date(referencia)) * 60_000)
    .filter(esDelDia);
  return new Date(Math.min(...candidatos));
}

// Instante en que empieza el día siguiente en Chile
export const proximaMedianocheEnChile = (fecha = new Date()) =>
  inicioDelDiaEnChile(new Date(inicioDelDiaEnChile(fecha).getTime() + 36 * 3_600_000));
