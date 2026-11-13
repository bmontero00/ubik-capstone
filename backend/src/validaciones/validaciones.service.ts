import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCompra, ResultadoValidacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';

// Validación de entradas en el acceso (la usa la app de validación del organizador y sirve también
// desde la web). Cada entrada se acepta una sola vez: la marca se hace con una actualización
// condicionada (solo si aún no tiene usadaEn), así que dos puertas que escanean la misma entrada al
// mismo tiempo no pueden aceptarla las dos.

const VALIDAS: EstadoCompra[] = ['PAGADA', 'CONFIRMADA'];
const HORA = 3_600_000;

const MENSAJES: Record<ResultadoValidacion, string> = {
  VALIDA: 'Entrada válida: puede ingresar',
  YA_USADA: 'Esta entrada ya se usó para ingresar',
  OTRO_EVENTO: 'Esta entrada es de otro evento',
  NO_PAGADA: 'La compra de esta entrada no está pagada',
  INEXISTENTE: 'No existe una entrada con este código',
  EVENTO_CANCELADO: 'El evento está cancelado: las entradas ya no son válidas',
};

// El QR lleva solo el código; al escribirlo a mano se aceptan minúsculas, espacios y guiones extra
export const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase().replace(/\s+/g, '');

@Injectable()
export class ValidacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // Evento del organizador (o cualquiera si es ADMIN)
  private async evento(user: AuthenticatedUser, eventoId: string) {
    const e = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { id: true, title: true, date: true, address: true, status: true, edadMinima: true, organizerId: true, estacionamiento: true },
    });
    if (!e) throw new NotFoundException('Evento no encontrado');
    if (e.organizerId !== user.sub && user.role !== 'ADMIN') throw new ForbiddenException('Solo puedes validar entradas de tus eventos');
    return e;
  }

  // Eventos para elegir en la app: los de hoy y los próximos (incluye los que empezaron hace unas horas)
  async misEventos(user: AuthenticatedUser) {
    const eventos = await this.prisma.event.findMany({
      where: {
        organizerId: user.sub,
        status: { in: ['PUBLISHED', 'POSTPONED'] },
        date: { gte: new Date(Date.now() - 12 * HORA) },
      },
      select: { id: true, title: true, date: true, address: true, status: true, edadMinima: true, imageUrl: true },
      orderBy: { date: 'asc' },
      take: 50,
    });
    const ids = eventos.map((e) => e.id);
    const [vendidas, ingresados] = await Promise.all([
      this.prisma.entrada.groupBy({ by: ['eventoId'], where: { eventoId: { in: ids }, compra: { estado: { in: VALIDAS } } }, _count: { _all: true } }),
      this.prisma.entrada.groupBy({ by: ['eventoId'], where: { eventoId: { in: ids }, usadaEn: { not: null } }, _count: { _all: true } }),
    ]);
    const cuenta = (lista: { eventoId: string; _count: { _all: number } }[], id: string) => lista.find((x) => x.eventoId === id)?._count._all ?? 0;
    return eventos.map((e) => ({ ...e, vendidas: cuenta(vendidas, e.id), ingresados: cuenta(ingresados, e.id) }));
  }

  // Vendidas, ingresados y por ingresar (total, por tipo de entrada y estacionamiento)
  async resumen(user: AuthenticatedUser, eventoId: string) {
    const e = await this.evento(user, eventoId);
    const entradas = await this.prisma.entrada.findMany({
      where: { eventoId, compra: { estado: { in: VALIDAS } } },
      select: { usadaEn: true, tipoEntrada: { select: { nombre: true, orden: true } } },
    });
    const porTipo = new Map<string, { nombre: string; orden: number; vendidas: number; ingresados: number }>();
    for (const x of entradas) {
      const nombre = x.tipoEntrada?.nombre ?? 'General';
      const t = porTipo.get(nombre) ?? { nombre, orden: x.tipoEntrada?.orden ?? 0, vendidas: 0, ingresados: 0 };
      t.vendidas++;
      if (x.usadaEn) t.ingresados++;
      porTipo.set(nombre, t);
    }
    const vendidas = entradas.length;
    const ingresados = entradas.filter((x) => x.usadaEn).length;

    let estacionamiento: { vendidos: number; ingresados: number } | null = null;
    if (e.estacionamiento === 'PAGADO') {
      const compras = await this.prisma.compra.findMany({
        where: { eventoId, estado: { in: VALIDAS }, cantidadEstacionamiento: { gt: 0 } },
        select: { cantidadEstacionamiento: true, estacionamientoUsadoEn: true },
      });
      estacionamiento = {
        vendidos: compras.reduce((s, c) => s + c.cantidadEstacionamiento, 0),
        ingresados: compras.filter((c) => c.estacionamientoUsadoEn).reduce((s, c) => s + c.cantidadEstacionamiento, 0),
      };
    }

    return {
      evento: { id: e.id, titulo: e.title, fecha: e.date, direccion: e.address, estado: e.status, edadMinima: e.edadMinima },
      vendidas,
      ingresados,
      porIngresar: vendidas - ingresados,
      asistencia: vendidas ? Math.round((ingresados / vendidas) * 1000) / 10 : null,
      porTipo: [...porTipo.values()].sort((a, b) => a.orden - b.orden).map(({ orden, ...t }) => t),
      estacionamiento,
    };
  }

  // Últimos escaneos del evento (válidos y rechazados)
  async historial(user: AuthenticatedUser, eventoId: string, limite: number) {
    await this.evento(user, eventoId);
    const filas = await this.prisma.validacion.findMany({
      where: { eventoId },
      orderBy: { fecha: 'desc' },
      take: limite,
      select: {
        id: true, codigo: true, resultado: true, fecha: true,
        usuario: { select: { name: true } },
        entrada: { select: { nombre: true, apellido: true, tipoEntrada: { select: { nombre: true } } } },
      },
    });
    return filas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      resultado: f.resultado,
      mensaje: MENSAJES[f.resultado],
      fecha: f.fecha,
      validadoPor: f.usuario.name,
      asistente: f.entrada ? `${f.entrada.nombre} ${f.entrada.apellido}` : null,
      tipo: f.entrada ? f.entrada.tipoEntrada?.nombre ?? 'General' : null,
    }));
  }

  // Valida un código (de entrada o de estacionamiento) en el acceso de un evento
  async validar(user: AuthenticatedUser, eventoId: string, codigoIngresado: string) {
    const e = await this.evento(user, eventoId);
    const codigo = normalizarCodigo(codigoIngresado);
    const ahora = new Date();

    const responder = async (
      resultado: ResultadoValidacion,
      extra: { tipo?: 'ENTRADA' | 'ESTACIONAMIENTO'; entradaId?: string | null; detalle?: Record<string, unknown> } = {},
    ) => {
      await this.prisma.validacion.create({
        data: { codigo: codigo.slice(0, 64), resultado, eventoId, usuarioId: user.sub, entradaId: extra.entradaId ?? null },
      });
      const r = await this.resumen(user, eventoId);
      return {
        resultado,
        valida: resultado === 'VALIDA',
        mensaje: MENSAJES[resultado],
        codigo,
        tipo: extra.tipo ?? null,
        ...extra.detalle,
        evento: { id: e.id, titulo: e.title, edadMinima: e.edadMinima },
        contador: { vendidas: r.vendidas, ingresados: r.ingresados, porIngresar: r.porIngresar },
      };
    };

    if (e.status === 'CANCELLED') return responder('EVENTO_CANCELADO');
    if (codigo.length < 4 || codigo.length > 40) return responder('INEXISTENTE');

    // Estacionamiento: un solo ingreso por compra (vale para la cantidad de vehículos comprada)
    if (codigo.startsWith('EST-')) {
      const compra = await this.prisma.compra.findUnique({
        where: { codigoEstacionamiento: codigo },
        select: { id: true, eventoId: true, estado: true, codigo: true, cantidadEstacionamiento: true, estacionamientoUsadoEn: true },
      });
      if (!compra) return responder('INEXISTENTE', { tipo: 'ESTACIONAMIENTO' });
      if (compra.eventoId !== eventoId) return responder('OTRO_EVENTO', { tipo: 'ESTACIONAMIENTO' });
      if (!VALIDAS.includes(compra.estado)) return responder('NO_PAGADA', { tipo: 'ESTACIONAMIENTO' });
      const marcada = await this.prisma.compra.updateMany({
        where: { id: compra.id, estacionamientoUsadoEn: null },
        data: { estacionamientoUsadoEn: ahora },
      });
      const detalle = { estacionamiento: { vehiculos: compra.cantidadEstacionamiento, compra: compra.codigo } };
      if (marcada.count === 1) return responder('VALIDA', { tipo: 'ESTACIONAMIENTO', detalle: { ...detalle, usadaEn: ahora } });
      const actual = await this.prisma.compra.findUnique({ where: { id: compra.id }, select: { estacionamientoUsadoEn: true } });
      return responder('YA_USADA', { tipo: 'ESTACIONAMIENTO', detalle: { ...detalle, usadaEn: actual?.estacionamientoUsadoEn ?? null } });
    }

    const entrada = await this.prisma.entrada.findUnique({
      where: { codigo },
      select: {
        id: true, eventoId: true, nombre: true, apellido: true, rut: true,
        tipoEntrada: { select: { nombre: true } },
        compra: { select: { estado: true, codigo: true } },
      },
    });
    if (!entrada) return responder('INEXISTENTE', { tipo: 'ENTRADA' });
    // De otro evento: no se muestran datos del asistente (puede ser de otro organizador)
    if (entrada.eventoId !== eventoId) return responder('OTRO_EVENTO', { tipo: 'ENTRADA' });

    const asistente = {
      nombre: entrada.nombre,
      apellido: entrada.apellido,
      rut: entrada.rut,
      tipo: entrada.tipoEntrada?.nombre ?? 'General',
      compra: entrada.compra.codigo,
    };
    if (!VALIDAS.includes(entrada.compra.estado)) return responder('NO_PAGADA', { tipo: 'ENTRADA', entradaId: entrada.id, detalle: { asistente } });

    const marcada = await this.prisma.entrada.updateMany({
      where: { id: entrada.id, usadaEn: null },
      data: { usadaEn: ahora, validadaPorId: user.sub },
    });
    if (marcada.count === 1) {
      return responder('VALIDA', { tipo: 'ENTRADA', entradaId: entrada.id, detalle: { asistente, usadaEn: ahora } });
    }
    const actual = await this.prisma.entrada.findUnique({
      where: { id: entrada.id },
      select: { usadaEn: true, validadaPor: { select: { name: true } } },
    });
    return responder('YA_USADA', {
      tipo: 'ENTRADA',
      entradaId: entrada.id,
      detalle: { asistente, usadaEn: actual?.usadaEn ?? null, validadaPor: actual?.validadaPor?.name ?? null },
    });
  }
}
