import {
  BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException,
} from '@nestjs/common';
import { EstadoCompra, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { accountUnderReviewError } from '../auth/account-status';
import { normalizeRut } from '../auth/rut.util';
import { COMPRA_LIMITS, CreateCompraDto } from './dto/compra.dto';

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
      status: true,
      statusReason: true,
      price: true,
      latitude: true,
      longitude: true,
      category: { select: { id: true, name: true } },
      organizer: { select: { id: true, name: true, organizerProfile: { select: { organizationName: true } } } },
    },
  },
  entradas: { orderBy: { fechaCreacion: 'asc' } },
} satisfies Prisma.CompraInclude;

type CompraConDetalle = Prisma.CompraGetPayload<{ include: typeof compraInclude }>;

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  // Crea la compra con los datos de cada asistente. Si el evento es de pago queda pendiente
  // por unos minutos (las entradas quedan reservadas); si es gratuito se confirma de inmediato.
  async create(dto: CreateCompraDto, user: AuthenticatedUser) {
    if (user.status !== 'ACTIVE') throw accountUnderReviewError();

    const event = await this.prisma.event.findUnique({ where: { id: dto.eventoId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.status !== 'PUBLISHED' || event.date.getTime() <= Date.now()) {
      throw new BadRequestException('Este evento no tiene entradas disponibles en este momento');
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

    const gratis = event.price === 0;
    const compra = await this.prisma.compra.create({
      data: {
        codigo: `UBK-${codigo(6)}`,
        estado: gratis ? 'CONFIRMADA' : 'PENDIENTE_PAGO',
        cantidad: asistentes.length,
        precioUnitario: event.price,
        total: event.price * asistentes.length,
        expiraEn: gratis ? null : new Date(Date.now() + COMPRA_LIMITS.minutosParaPagar * 60_000),
        eventoId: event.id,
        compradorId: user.sub,
        entradas: { create: asistentes.map((a) => ({ ...a, codigo: codigo(10), eventoId: event.id })) },
      },
      include: compraInclude,
    });
    return this.serialize(compra);
  }

  // Pago simulado: reemplazar por la confirmación de la pasarela (Webpay, Mercado Pago) cuando se integre
  async pay(id: string, user: AuthenticatedUser, medioPago: string) {
    const compra = await this.findOwn(id, user);
    if (compra.estado !== 'PENDIENTE_PAGO') throw new BadRequestException('Esta compra no está pendiente de pago');
    if (compra.expiraEn && compra.expiraEn.getTime() < Date.now()) {
      await this.prisma.compra.update({ where: { id }, data: { estado: 'EXPIRADA' } });
      throw new GoneException('El tiempo para pagar expiró. Vuelve a seleccionar tus entradas.');
    }
    if (compra.evento.status !== 'PUBLISHED' || compra.evento.date.getTime() <= Date.now()) {
      throw new BadRequestException('Este evento ya no tiene entradas disponibles');
    }
    const pagada = await this.prisma.compra.update({
      where: { id },
      data: { estado: 'PAGADA', fechaPago: new Date(), medioPago, expiraEn: null },
      include: compraInclude,
    });
    return this.serialize(pagada);
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
  private serialize(compra: CompraConDetalle) {
    const valida = ESTADOS_VALIDOS.includes(compra.estado);
    return {
      ...compra,
      entradas: compra.entradas.map(({ eventoId, compraId, ...e }) => ({ ...e, codigo: valida ? e.codigo : null })),
    };
  }
}
