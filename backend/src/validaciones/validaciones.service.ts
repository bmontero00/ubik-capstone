import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCompra, ResultadoValidacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, nombreValidador } from './actor';

// Validación de entradas en el acceso (la usa la app de validación y sirve también desde la web).
// Valida el organizador con su cuenta o alguien de su equipo con un acceso a un solo evento, que
// puede estar limitado a ciertos tipos de entrada. Cada entrada se acepta una sola vez: la marca se
// hace con una actualización condicionada (solo si aún no tiene usadaEn), así que dos puertas que
// escanean la misma entrada al mismo tiempo no pueden aceptarla las dos.

const VALIDAS: EstadoCompra[] = ['PAGADA', 'CONFIRMADA'];
const HORA = 3_600_000;

const MENSAJES: Record<ResultadoValidacion, string> = {
  VALIDA: 'Entrada válida: puede ingresar',
  YA_USADA: 'Esta entrada ya se usó para ingresar',
  OTRO_EVENTO: 'Esta entrada es de otro evento',
  NO_PAGADA: 'La compra de esta entrada no está pagada',
  INEXISTENTE: 'No existe una entrada con este código',
  EVENTO_CANCELADO: 'El evento está cancelado: las entradas ya no son válidas',
  TIPO_NO_PERMITIDO: 'Este acceso no recibe este tipo de entrada: indícale al asistente su acceso',
};

// El QR lleva solo el código; al escribirlo a mano se aceptan minúsculas y espacios
export const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase().replace(/\s+/g, '');

// El equipo de acceso ve el RUT parcial; el organizador, completo (ya lo ve en su lista de acceso)
const rutParcial = (rut: string) => {
  const [cuerpo, dv] = rut.split('-');
  return cuerpo && dv ? `**.***.${cuerpo.slice(-3)}-${dv}` : '***';
};

@Injectable()
export class ValidacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // Evento sobre el que puede actuar: el organizador, los suyos (un ADMIN, cualquiera);
  // el equipo de acceso, solo el evento de su acceso
  private async evento(actor: Actor, eventoId: string) {
    const e = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { id: true, title: true, date: true, address: true, status: true, edadMinima: true, organizerId: true, estacionamiento: true },
    });
    if (!e) throw new NotFoundException('Evento no encontrado');
    const permitido = actor.tipo === 'validador'
      ? actor.acceso.eventoId === e.id
      : e.organizerId === actor.user.sub || actor.user.role === 'ADMIN';
    if (!permitido) throw new ForbiddenException('Solo puedes validar entradas de tus eventos');
    return e;
  }

  // Lo que puede recibir el acceso del equipo (para mostrarlo en la app)
  private async alcance(actor: Actor) {
    if (actor.tipo !== 'validador') return null;
    const a = actor.acceso;
    const tipos = a.tiposEntradaIds.length
      ? await this.prisma.tipoEntrada.findMany({ where: { id: { in: a.tiposEntradaIds } }, select: { id: true, nombre: true }, orderBy: { orden: 'asc' } })
      : [];
    return { nombre: a.nombre, puerta: a.puerta, todosLosTipos: !a.tiposEntradaIds.length, tiposEntrada: tipos, permiteEstacionamiento: a.permiteEstacionamiento };
  }

  // Eventos para elegir en la app: los de hoy y próximos (incluye los que empezaron hace unas horas).
  // Para el equipo de acceso, solo el evento de su acceso.
  async misEventos(actor: Actor) {
    const eventos = await this.prisma.event.findMany({
      where: actor.tipo === 'validador'
        ? { id: actor.acceso.eventoId }
        : { organizerId: actor.user.sub, status: { in: ['PUBLISHED', 'POSTPONED'] }, date: { gte: new Date(Date.now() - 12 * HORA) } },
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
    const alcance = await this.alcance(actor);
    return eventos.map((e) => ({ ...e, vendidas: cuenta(vendidas, e.id), ingresados: cuenta(ingresados, e.id), acceso: alcance }));
  }

  // Vendidas, ingresados y por ingresar (total, por tipo de entrada y estacionamiento)
  async resumen(actor: Actor, eventoId: string) {
    const e = await this.evento(actor, eventoId);
    const entradas = await this.prisma.entrada.findMany({
      where: { eventoId, compra: { estado: { in: VALIDAS } } },
      select: { usadaEn: true, tipoEntrada: { select: { id: true, nombre: true, orden: true } } },
    });
    const porTipo = new Map<string, { id: string | null; nombre: string; orden: number; vendidas: number; ingresados: number }>();
    for (const x of entradas) {
      const nombre = x.tipoEntrada?.nombre ?? 'General';
      const t = porTipo.get(nombre) ?? { id: x.tipoEntrada?.id ?? null, nombre, orden: x.tipoEntrada?.orden ?? 0, vendidas: 0, ingresados: 0 };
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
      acceso: await this.alcance(actor),
    };
  }

  // Últimos escaneos del evento (válidos y rechazados), con quién y en qué puerta
  async historial(actor: Actor, eventoId: string, limite: number) {
    await this.evento(actor, eventoId);
    const filas = await this.prisma.validacion.findMany({
      where: { eventoId },
      orderBy: { fecha: 'desc' },
      take: limite,
      select: {
        id: true, codigo: true, resultado: true, fecha: true,
        usuario: { select: { name: true } },
        accesoValidador: { select: { nombre: true, puerta: true } },
        entrada: { select: { nombre: true, apellido: true, tipoEntrada: { select: { nombre: true } } } },
      },
    });
    return filas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      resultado: f.resultado,
      mensaje: MENSAJES[f.resultado],
      fecha: f.fecha,
      validadoPor: f.accesoValidador ? nombreValidador(f.accesoValidador) : f.usuario?.name ?? null,
      asistente: f.entrada ? `${f.entrada.nombre} ${f.entrada.apellido}` : null,
      tipo: f.entrada ? f.entrada.tipoEntrada?.nombre ?? 'General' : null,
    }));
  }

  // Valida un código (de entrada o de estacionamiento) en el acceso de un evento
  async validar(actor: Actor, eventoId: string, codigoIngresado: string) {
    const e = await this.evento(actor, eventoId);
    const codigo = normalizarCodigo(codigoIngresado);
    const ahora = new Date();
    const quien = actor.tipo === 'validador'
      ? { usuarioId: null, accesoValidadorId: actor.acceso.id }
      : { usuarioId: actor.user.sub, accesoValidadorId: null };

    const responder = async (
      resultado: ResultadoValidacion,
      extra: { tipo?: 'ENTRADA' | 'ESTACIONAMIENTO'; entradaId?: string | null; detalle?: Record<string, unknown> } = {},
    ) => {
      await this.prisma.validacion.create({
        data: { codigo: codigo.slice(0, 64), resultado, eventoId, entradaId: extra.entradaId ?? null, ...quien },
      });
      if (actor.tipo === 'validador') {
        await this.prisma.accesoValidador.update({ where: { id: actor.acceso.id }, data: { ultimoUsoEn: ahora } });
      }
      const r = await this.resumen(actor, eventoId);
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
        select: { id: true, eventoId: true, estado: true, codigo: true, cantidadEstacionamiento: true },
      });
      if (!compra) return responder('INEXISTENTE', { tipo: 'ESTACIONAMIENTO' });
      if (compra.eventoId !== eventoId) return responder('OTRO_EVENTO', { tipo: 'ESTACIONAMIENTO' });
      if (actor.tipo === 'validador' && !actor.acceso.permiteEstacionamiento) return responder('TIPO_NO_PERMITIDO', { tipo: 'ESTACIONAMIENTO' });
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
        id: true, eventoId: true, nombre: true, apellido: true, rut: true, tipoEntradaId: true,
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
      rut: actor.tipo === 'validador' ? rutParcial(entrada.rut) : entrada.rut,
      tipo: entrada.tipoEntrada?.nombre ?? 'General',
      compra: entrada.compra.codigo,
    };
    // Acceso limitado a ciertos tipos: la entrada no se marca, para que pueda ingresar por su acceso
    if (actor.tipo === 'validador' && actor.acceso.tiposEntradaIds.length && !actor.acceso.tiposEntradaIds.includes(entrada.tipoEntradaId ?? '')) {
      return responder('TIPO_NO_PERMITIDO', { tipo: 'ENTRADA', entradaId: entrada.id, detalle: { asistente } });
    }
    if (!VALIDAS.includes(entrada.compra.estado)) return responder('NO_PAGADA', { tipo: 'ENTRADA', entradaId: entrada.id, detalle: { asistente } });

    const marcada = await this.prisma.entrada.updateMany({
      where: { id: entrada.id, usadaEn: null },
      data: { usadaEn: ahora, validadaPorId: quien.usuarioId, validadaPorAccesoId: quien.accesoValidadorId },
    });
    if (marcada.count === 1) {
      return responder('VALIDA', { tipo: 'ENTRADA', entradaId: entrada.id, detalle: { asistente, usadaEn: ahora } });
    }
    const actual = await this.prisma.entrada.findUnique({
      where: { id: entrada.id },
      select: { usadaEn: true, validadaPor: { select: { name: true } }, validadaPorAcceso: { select: { nombre: true, puerta: true } } },
    });
    return responder('YA_USADA', {
      tipo: 'ENTRADA',
      entradaId: entrada.id,
      detalle: {
        asistente,
        usadaEn: actual?.usadaEn ?? null,
        validadaPor: actual?.validadaPorAcceso ? nombreValidador(actual.validadaPorAcceso) : actual?.validadaPor?.name ?? null,
      },
    });
  }
}
