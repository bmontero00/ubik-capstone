import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Periodo } from './reportes.service';

// Reportes de toda la plataforma para el administrador. Igual que en los del organizador, solo
// cuentan las compras pagadas o confirmadas y la fecha de una venta es la del pago.
// "Ventas" = lo que pagó el público; "Cargo por servicio" = lo que recibe UBIK;
// "Para organizadores" = ventas menos el cargo.

const COMPRA_VALIDA = { in: ['PAGADA', 'CONFIRMADA'] } satisfies Prisma.EnumEstadoCompraFilter;
const DIA = 86_400_000;
const ZONA = 'America/Santiago';
const diaChile = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA });
const redondear = (n: number) => Math.round(n);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const variacion = (actual: number, anterior: number) => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null);

const enPeriodo = (p: { desde: Date; hasta: Date }) => ({
  OR: [
    { fechaPago: { gte: p.desde, lte: p.hasta } },
    { fechaPago: null, fechaCreacion: { gte: p.desde, lte: p.hasta } },
  ],
});

const compraSelect = {
  total: true, cargoServicio: true, cantidad: true, compradorId: true, eventoId: true, fechaPago: true, fechaCreacion: true,
} satisfies Prisma.CompraSelect;

@Injectable()
export class ReportesPlataformaService {
  constructor(private readonly prisma: PrismaService) {}

  private compras(p: { desde: Date; hasta: Date }) {
    return this.prisma.compra.findMany({ where: { estado: COMPRA_VALIDA, ...enPeriodo(p) }, select: compraSelect });
  }

  private totales(compras: { total: number; cargoServicio: number; cantidad: number; compradorId: string }[]) {
    const ventas = compras.reduce((n, c) => n + c.total, 0);
    const cargo = compras.reduce((n, c) => n + c.cargoServicio, 0);
    return {
      ventas: redondear(ventas),
      cargoServicio: redondear(cargo),
      paraOrganizadores: redondear(ventas - cargo),
      entradas: compras.reduce((n, c) => n + c.cantidad, 0),
      compras: compras.length,
      compradores: new Set(compras.map((c) => c.compradorId)).size,
      ticketPromedio: compras.length ? redondear(ventas / compras.length) : 0,
    };
  }

  // 1. Resumen de la plataforma en el período, comparado con el período anterior de igual largo
  async resumen(p: Periodo) {
    const largo = p.hasta.getTime() - p.desde.getTime();
    const anterior = { desde: new Date(p.desde.getTime() - largo), hasta: new Date(p.desde.getTime() - 1) };
    const [actuales, previas] = await Promise.all([this.compras(p), this.compras(anterior)]);
    const ahora = this.totales(actuales);
    const antes = this.totales(previas);

    const rango = { gte: p.desde, lte: p.hasta };
    const [eventosConFecha, publicados, nuevosAsistentes, nuevosOrganizadores, resenas] = await Promise.all([
      this.prisma.event.findMany({ where: { date: rango }, select: { id: true, status: true } }),
      this.prisma.event.count({ where: { createdAt: rango } }),
      this.prisma.user.count({ where: { role: 'ATTENDEE', createdAt: rango } }),
      this.prisma.user.count({ where: { role: 'ORGANIZER', createdAt: rango } }),
      this.prisma.resena.aggregate({ where: { fechaCreacion: rango }, _avg: { estrellas: true }, _count: { _all: true } }),
    ]);
    const organizadoresConVentas = await this.prisma.event.findMany({
      where: { id: { in: [...new Set(actuales.map((c) => c.eventoId))] } },
      select: { organizerId: true },
      distinct: ['organizerId'],
    });

    // Asistencia: solo de los eventos del período en que se validaron entradas en el acceso
    const ids = eventosConFecha.filter((e) => e.status !== 'CANCELLED').map((e) => e.id);
    const [vendidas, ingresadas] = await Promise.all([
      this.prisma.entrada.groupBy({ by: ['eventoId'], where: { eventoId: { in: ids }, compra: { estado: COMPRA_VALIDA } }, _count: { _all: true } }),
      this.prisma.entrada.groupBy({ by: ['eventoId'], where: { eventoId: { in: ids }, usadaEn: { not: null }, compra: { estado: COMPRA_VALIDA } }, _count: { _all: true } }),
    ]);
    const conAcceso = new Set(ingresadas.map((x) => x.eventoId));
    const asistencia = conAcceso.size
      ? pct(ingresadas.reduce((n, x) => n + x._count._all, 0), vendidas.filter((x) => conAcceso.has(x.eventoId)).reduce((n, x) => n + x._count._all, 0))
      : null;

    return {
      ...ahora,
      eventosEnPeriodo: eventosConFecha.length,
      eventosCancelados: eventosConFecha.filter((e) => e.status === 'CANCELLED').length,
      eventosPublicados: publicados,
      organizadoresConVentas: organizadoresConVentas.length,
      nuevosAsistentes,
      nuevosOrganizadores,
      asistencia,
      eventosConAcceso: conAcceso.size,
      calificacion: resenas._count._all ? Math.round((resenas._avg.estrellas ?? 0) * 10) / 10 : null,
      resenas: resenas._count._all,
      variacion: {
        ventas: variacion(ahora.ventas, antes.ventas),
        cargoServicio: variacion(ahora.cargoServicio, antes.cargoServicio),
        entradas: variacion(ahora.entradas, antes.entradas),
      },
    };
  }

  // 2. Ventas y cargo por servicio en el tiempo (por día hasta ~2 meses; si no, por semana)
  async ventas(p: Periodo) {
    const compras = await this.compras(p);
    const porSemana = p.hasta.getTime() - p.desde.getTime() > 62 * DIA;
    const clave = (d: Date) => {
      if (!porSemana) return diaChile(d);
      const dia = new Date(`${diaChile(d)}T12:00:00Z`);
      dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() + 6) % 7));
      return dia.toISOString().slice(0, 10);
    };
    const serie = new Map<string, { ventas: number; cargo: number; entradas: number }>();
    for (let t = p.desde.getTime(); t <= p.hasta.getTime(); t += porSemana ? 7 * DIA : DIA) serie.set(clave(new Date(t)), { ventas: 0, cargo: 0, entradas: 0 });
    serie.set(clave(p.hasta), serie.get(clave(p.hasta)) ?? { ventas: 0, cargo: 0, entradas: 0 });
    for (const c of compras) {
      const k = clave(c.fechaPago ?? c.fechaCreacion);
      const punto = serie.get(k) ?? { ventas: 0, cargo: 0, entradas: 0 };
      punto.ventas += c.total;
      punto.cargo += c.cargoServicio;
      punto.entradas += c.cantidad;
      serie.set(k, punto);
    }
    return {
      agrupacion: porSemana ? 'semana' : 'dia',
      puntos: [...serie.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, v]) => ({ fecha, ventas: redondear(v.ventas), cargo: redondear(v.cargo), entradas: v.entradas })),
    };
  }

  // 3. Desglose del período: por organizador, por categoría y eventos con más ventas
  async desglose(p: Periodo) {
    const compras = await this.compras(p);
    const eventoIds = [...new Set(compras.map((c) => c.eventoId))];
    const eventos = await this.prisma.event.findMany({
      where: { id: { in: eventoIds } },
      select: {
        id: true, title: true, date: true, status: true, organizerId: true,
        category: { select: { name: true } },
        organizer: { select: { name: true, organizerProfile: { select: { organizationName: true } } } },
      },
    });
    const porEvento = new Map<string, { ventas: number; cargo: number; entradas: number }>();
    for (const c of compras) {
      const v = porEvento.get(c.eventoId) ?? { ventas: 0, cargo: 0, entradas: 0 };
      v.ventas += c.total;
      v.cargo += c.cargoServicio;
      v.entradas += c.cantidad;
      porEvento.set(c.eventoId, v);
    }

    const sumar = <K extends string>(clave: (e: (typeof eventos)[number]) => K, nombre: (e: (typeof eventos)[number]) => string) => {
      const m = new Map<K, { nombre: string; eventos: number; ventas: number; cargo: number; entradas: number }>();
      for (const e of eventos) {
        const v = porEvento.get(e.id)!;
        const fila = m.get(clave(e)) ?? { nombre: nombre(e), eventos: 0, ventas: 0, cargo: 0, entradas: 0 };
        fila.eventos++;
        fila.ventas += v.ventas;
        fila.cargo += v.cargo;
        fila.entradas += v.entradas;
        m.set(clave(e), fila);
      }
      return [...m.entries()]
        .map(([id, f]) => ({ id, ...f, ventas: redondear(f.ventas), cargo: redondear(f.cargo) }))
        .sort((a, b) => b.ventas - a.ventas);
    };

    // Calificación de cada organizador (todas sus reseñas)
    const organizadores = sumar((e) => e.organizerId, (e) => e.organizer.organizerProfile?.organizationName || e.organizer.name);
    const calificaciones = await this.prisma.resena.groupBy({
      by: ['organizadorId'],
      where: { organizadorId: { in: organizadores.map((o) => o.id) } },
      _avg: { estrellas: true },
      _count: { _all: true },
    });

    return {
      organizadores: organizadores.map((o) => {
        const r = calificaciones.find((x) => x.organizadorId === o.id);
        return { ...o, calificacion: r ? Math.round((r._avg.estrellas ?? 0) * 10) / 10 : null, resenas: r?._count._all ?? 0 };
      }),
      categorias: sumar((e) => e.category.name, (e) => e.category.name),
      eventos: eventos
        .map((e) => {
          const v = porEvento.get(e.id)!;
          return {
            id: e.id,
            titulo: e.title,
            fecha: e.date,
            estado: e.status,
            categoria: e.category.name,
            organizador: e.organizer.organizerProfile?.organizationName || e.organizer.name,
            entradas: v.entradas,
            ventas: redondear(v.ventas),
            cargo: redondear(v.cargo),
          };
        })
        .sort((a, b) => b.ventas - a.ventas),
    };
  }
}
