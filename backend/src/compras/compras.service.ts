import {
  BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException,
} from '@nestjs/common';
import { EstadoCompra, Event, EventStatus, Prisma, TipoEntrada } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { accountUnderReviewError } from '../auth/account-status';
import { normalizeRut } from '../auth/rut.util';
import { COMPRA_LIMITS, CreateCompraDto } from './dto/compra.dto';
import { precioEntrada } from '../parametros/cargos';
import { compraOcupaCupo } from '../events/tipos-entrada';
import { webpayConfig } from '../pagos/webpay.config';

// Compras que reservan o ya son entradas válidas (cuentan para los límites y los RUT repetidos)
const ESTADOS_VIGENTES: EstadoCompra[] = ['PENDIENTE_PAGO', 'PAGADA', 'CONFIRMADA'];
const ESTADOS_VALIDOS: EstadoCompra[] = ['PAGADA', 'CONFIRMADA'];

// Sin letras ni números que se confundan (0/O, 1/I/L)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codigo = (largo: number) => Array.from({ length: largo }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

const compraInclude = {
  evento: {
    select: {
      id: true,
      title: true,
      date: true,
      address: true,
      imageUrl: true,
      portadaIa: true,
      status: true,
      statusReason: true,
      price: true,
      estacionamiento: true,
      indicacionesEstacionamiento: true,
      latitude: true,
      longitude: true,
      category: { select: { id: true, name: true } },
      organizer: { select: { id: true, name: true, organizerProfile: { select: { organizationName: true } } } },
    },
  },
  entradas: { orderBy: { fechaCreacion: 'asc' }, include: { tipoEntrada: { select: { id: true, nombre: true } } } },
  // Último intento de pago, para el comprobante (o para avisar que se rechazó)
  transacciones: { orderBy: { fechaCreacion: 'desc' }, take: 1 },
} satisfies Prisma.CompraInclude;

type CompraConDetalle = Prisma.CompraGetPayload<{ include: typeof compraInclude }>;

// Un evento postergado sigue vendiendo mientras le queden entradas (valen para la nueva fecha)
const ESTADOS_CON_VENTA: EventStatus[] = ['PUBLISHED', 'POSTPONED'];

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  // Crea la compra con los datos de cada asistente. Si el evento es de pago queda pendiente
  // por unos minutos (las entradas quedan reservadas); si es gratuito se confirma de inmediato.
  async create(dto: CreateCompraDto, user: AuthenticatedUser) {
    if (user.status !== 'ACTIVE') throw accountUnderReviewError();

    const event = await this.prisma.event.findUnique({ where: { id: dto.eventoId }, include: { tiposEntrada: true } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (!ESTADOS_CON_VENTA.includes(event.status) || event.date.getTime() <= Date.now()) {
      throw new BadRequestException('Este evento no tiene entradas disponibles en este momento');
    }
    if (event.estadoCondicion === 'PENDIENTE') {
      throw new BadRequestException({
        message: 'La venta de entradas para este evento se habilitará muy pronto',
        code: 'VENTA_PAUSADA',
      });
    }

    const tipos = new Map(event.tiposEntrada.map((t) => [t.id, t]));
    if (dto.asistentes.some((a) => !tipos.has(a.tipoEntradaId))) {
      throw new BadRequestException('Uno de los tipos de entrada no pertenece a este evento');
    }
    const estacionamientos = dto.estacionamientos ?? 0;
    if (estacionamientos > 0 && event.estacionamiento !== 'PAGADO') {
      throw new BadRequestException('Este evento no vende estacionamientos');
    }
    if (estacionamientos > dto.asistentes.length) {
      throw new BadRequestException('Puedes agregar como máximo un estacionamiento por entrada');
    }

    const asistentes = dto.asistentes.map((a) => ({
      ...a,
      rut: normalizeRut(a.rut),
      telefono: '+56' + a.telefono.replace(/\D/g, '').slice(-9),
    }));
    const repetidos = asistentes.map((a) => a.rut).filter((rut, i, all) => all.indexOf(rut) !== i);
    if (repetidos.length) {
      throw new BadRequestException({
        message: 'Cada entrada debe quedar a nombre de una persona distinta (hay RUT repetidos)',
        code: 'RUT_REPETIDO',
        ruts: [...new Set(repetidos)],
      });
    }

    await this.expirePending();
    // Un nuevo intento reemplaza la compra pendiente anterior del mismo evento
    await this.prisma.compra.updateMany({
      where: { compradorId: user.sub, eventoId: event.id, estado: 'PENDIENTE_PAGO' },
      data: { estado: 'CANCELADA' },
    });

    const vigentes = await this.prisma.entrada.count({
      where: { eventoId: event.id, compra: { compradorId: user.sub, estado: { in: ESTADOS_VIGENTES } } },
    });
    if (vigentes + asistentes.length > COMPRA_LIMITS.maxPorEvento) {
      const restantes = Math.max(0, COMPRA_LIMITS.maxPorEvento - vigentes);
      throw new BadRequestException({
        message: restantes
          ? `Ya tienes ${vigentes} entradas para este evento: puedes agregar como máximo ${restantes} más`
          : `Ya tienes el máximo de ${COMPRA_LIMITS.maxPorEvento} entradas para este evento`,
        code: 'LIMITE_POR_EVENTO',
      });
    }

    const tomados = await this.prisma.entrada.findMany({
      where: {
        eventoId: event.id,
        rut: { in: asistentes.map((a) => a.rut) },
        compra: { estado: { in: ESTADOS_VIGENTES } },
      },
      select: { rut: true },
    });
    if (tomados.length) {
      throw new ConflictException({
        message: 'Algunas personas ya tienen una entrada para este evento',
        code: 'RUT_CON_ENTRADA',
        ruts: [...new Set(tomados.map((t) => t.rut))],
      });
    }

    // Precio de cada entrada según su tipo: lo del organizador (con la oferta vigente) más el cargo por
    // servicio fijado en el evento. Se guarda en cada entrada para que no cambie si después se edita el evento.
    const entradas = asistentes.map((a) => ({ ...a, ...precioEntrada(event, tipos.get(a.tipoEntradaId)!.precio) }));
    const cantidad = entradas.length;
    const subtotal = entradas.reduce((n, e) => n + e.final, 0);
    const cargoServicio = entradas.reduce((n, e) => n + e.cargo, 0);
    const precioEstacionamiento = estacionamientos > 0 ? event.precioEstacionamiento ?? 0 : 0;
    const total = subtotal + precioEstacionamiento * estacionamientos;
    const gratis = total === 0;

    // Los cupos se revisan y se descuentan dentro de una transacción que bloquea el evento: dos compras
    // simultáneas del mismo evento no pueden vender el mismo último cupo
    const compra = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "events" WHERE id = ${event.id} FOR UPDATE`;
      await this.assertCupos(tx, event, entradas.map((e) => e.tipoEntradaId), estacionamientos);
      return tx.compra.create({
        data: {
          codigo: `UBK-${codigo(6)}`,
          estado: gratis ? 'CONFIRMADA' : 'PENDIENTE_PAGO',
          cantidad,
          // Promedios por entrada (el detalle por tipo queda en cada entrada)
          precioUnitario: Math.round(subtotal / cantidad),
          precioBase: Math.round(entradas.reduce((n, e) => n + e.base, 0) / cantidad),
          porcentajeCargo: cargoServicio > 0 ? event.porcentajeCargo : 0,
          cargoServicio,
          cantidadEstacionamiento: estacionamientos,
          precioEstacionamiento,
          codigoEstacionamiento: estacionamientos > 0 ? `EST-${codigo(8)}` : null,
          total,
          expiraEn: gratis ? null : new Date(Date.now() + COMPRA_LIMITS.minutosParaPagar * 60_000),
          eventoId: event.id,
          compradorId: user.sub,
          entradas: {
            create: entradas.map(({ base, final, cargo, ...a }) => ({
              ...a, precio: final, cargo, codigo: codigo(10), eventoId: event.id,
            })),
          },
        },
        include: compraInclude,
      });
    });
    return this.serialize(compra);
  }

  // Cupos disponibles de cada tipo pedido y de estacionamiento (cuentan las compras pagadas, las
  // confirmadas y las que esperan el pago dentro de plazo)
  private async assertCupos(
    tx: Prisma.TransactionClient,
    event: Event & { tiposEntrada: TipoEntrada[] },
    tiposPedidos: string[],
    estacionamientos: number,
  ) {
    const pedidos = new Map<string, number>();
    tiposPedidos.forEach((id) => pedidos.set(id, (pedidos.get(id) ?? 0) + 1));
    const ocupadas = await tx.entrada.groupBy({
      by: ['tipoEntradaId'],
      where: { tipoEntradaId: { in: [...pedidos.keys()] }, compra: compraOcupaCupo() },
      _count: { _all: true },
    });
    const sinCupo = event.tiposEntrada
      .filter((t) => pedidos.has(t.id) && t.cupo !== null)
      .map((t) => ({ id: t.id, nombre: t.nombre, disponibles: Math.max(0, t.cupo! - (ocupadas.find((o) => o.tipoEntradaId === t.id)?._count._all ?? 0)) }))
      .filter((t) => t.disponibles < pedidos.get(t.id)!);
    if (sinCupo.length) {
      throw new ConflictException({
        message: sinCupo
          .map((t) => (t.disponibles ? `De "${t.nombre}" quedan solo ${t.disponibles}` : `"${t.nombre}" está agotada`))
          .join('. '),
        code: 'SIN_CUPO',
        tipos: sinCupo,
      });
    }
    if (estacionamientos > 0) {
      const { _sum } = await tx.compra.aggregate({
        where: { eventoId: event.id, ...compraOcupaCupo() },
        _sum: { cantidadEstacionamiento: true },
      });
      const disponibles = Math.max(0, (event.cuposEstacionamiento ?? 0) - (_sum.cantidadEstacionamiento ?? 0));
      if (disponibles < estacionamientos) {
        throw new ConflictException({
          message: disponibles ? `Quedan solo ${disponibles} estacionamientos` : 'Los estacionamientos están agotados',
          code: 'SIN_CUPO_ESTACIONAMIENTO',
          disponibles,
        });
      }
    }
  }

  // Pago simulado, solo fuera de producción (para probar sin pasar por Webpay)
  async pay(id: string, user: AuthenticatedUser, medioPago: string) {
    if (!webpayConfig().pagoSimulado) throw new BadRequestException('Medio de pago no disponible');
    await this.findPayable(id, user);
    const pagada = await this.prisma.compra.update({
      where: { id },
      data: { estado: 'PAGADA', fechaPago: new Date(), medioPago, expiraEn: null },
      include: compraInclude,
    });
    return this.serialize(pagada);
  }

  // Compra propia que todavía se puede pagar (pendiente, dentro de plazo y con el evento vigente)
  async findPayable(id: string, user: AuthenticatedUser) {
    const compra = await this.findOwn(id, user);
    if (compra.estado !== 'PENDIENTE_PAGO') throw new BadRequestException('Esta compra no está pendiente de pago');
    if (compra.expiraEn && compra.expiraEn.getTime() < Date.now()) {
      await this.prisma.compra.update({ where: { id }, data: { estado: 'EXPIRADA' } });
      throw new GoneException('El tiempo para pagar expiró. Vuelve a seleccionar tus entradas.');
    }
    if (!ESTADOS_CON_VENTA.includes(compra.evento.status) || compra.evento.date.getTime() <= Date.now()) {
      throw new BadRequestException('Este evento ya no tiene entradas disponibles');
    }
    return compra;
  }

  // Una compra propia (ej. al volver de Webpay, para mostrar el comprobante)
  async findOne(id: string, user: AuthenticatedUser) {
    await this.expirePending();
    return this.serialize(await this.findOwn(id, user));
  }

  // El comprador abandona el pago: libera las entradas reservadas
  async cancel(id: string, user: AuthenticatedUser) {
    const compra = await this.findOwn(id, user);
    if (compra.estado !== 'PENDIENTE_PAGO') {
      throw new BadRequestException('Solo se puede anular una compra pendiente de pago');
    }
    const anulada = await this.prisma.compra.update({ where: { id }, data: { estado: 'CANCELADA' }, include: compraInclude });
    return this.serialize(anulada);
  }

  // Entradas válidas y compras aún pendientes de pago del asistente
  async findMine(user: AuthenticatedUser) {
    await this.expirePending();
    const compras = await this.prisma.compra.findMany({
      where: { compradorId: user.sub, estado: { in: ESTADOS_VIGENTES } },
      include: compraInclude,
      orderBy: { fechaCreacion: 'desc' },
    });
    return compras.map((c) => this.serialize(c));
  }

  private async findOwn(id: string, user: AuthenticatedUser) {
    const compra = await this.prisma.compra.findUnique({ where: { id }, include: compraInclude });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    if (compra.compradorId !== user.sub) throw new ForbiddenException('Esta compra no te pertenece');
    return compra;
  }

  private expirePending() {
    return this.prisma.compra.updateMany({
      where: { estado: 'PENDIENTE_PAGO', expiraEn: { lt: new Date() } },
      data: { estado: 'EXPIRADA' },
    });
  }

  // Los códigos de acceso solo se entregan cuando la entrada es válida (pagada o confirmada)
  private serialize({ transacciones, ...compra }: CompraConDetalle) {
    const valida = ESTADOS_VALIDOS.includes(compra.estado);
    const t = transacciones[0];
    return {
      ...compra,
      // Datos del comprobante del último intento de pago (sin el token ni la respuesta completa)
      pago: t
        ? {
            medio: t.medio,
            estado: t.estado,
            ordenCompra: t.ordenCompra,
            monto: t.monto,
            codigoAutorizacion: t.codigoAutorizacion,
            tipoPago: t.tipoPago,
            cuotas: t.cuotas,
            montoCuota: t.montoCuota,
            ultimosDigitos: t.ultimosDigitos,
            fecha: t.fechaTransaccion ?? t.fechaActualizacion,
          }
        : null,
      codigoEstacionamiento: valida ? compra.codigoEstacionamiento : null,
      entradas: compra.entradas.map(({ eventoId, compraId, tipoEntrada, ...e }) => ({
        ...e,
        tipo: tipoEntrada?.nombre ?? 'General',
        codigo: valida ? e.codigo : null,
      })),
    };
  }
}
