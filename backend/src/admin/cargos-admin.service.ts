import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParametrosService } from '../parametros/parametros.service';
import { conPrecios } from '../parametros/cargos';

const eventoCargoInclude = {
  category: { select: { id: true, name: true } },
  organizer: { select: { id: true, name: true, email: true, organizerProfile: { select: { organizationName: true } } } },
  condicionRevisadaPor: { select: { id: true, name: true } },
} satisfies Prisma.EventInclude;

// Cargo por servicio: % de la plataforma, solicitudes de condición especial y % especial por evento
@Injectable()
export class CargosAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
  ) {}

  async resumen() {
    const [configuracion, pendientes, resueltas, especiales, eventosConCargo] = await Promise.all([
      this.parametros.detallePorcentajeCargo(),
      this.prisma.event.findMany({
        where: { estadoCondicion: 'PENDIENTE' },
        include: eventoCargoInclude,
        orderBy: { createdAt: 'asc' }, // las más antiguas primero
      }),
      this.prisma.event.findMany({
        where: { estadoCondicion: { in: ['APROBADA', 'RECHAZADA'] } },
        include: eventoCargoInclude,
        orderBy: { condicionRevisadaEn: 'desc' },
        take: 20,
      }),
      // Eventos cuyo % se modificó (condición aprobada o ajuste de un admin), con su historial
      this.prisma.event.findMany({
        where: { historialCargos: { some: {} } },
        include: {
          ...eventoCargoInclude,
          historialCargos: { include: { admin: { select: { id: true, name: true } } }, orderBy: { fecha: 'desc' } },
        },
        orderBy: { date: 'desc' },
        take: 50,
      }),
      this.prisma.event.count({ where: { price: { gt: 0 } } }),
    ]);
    return {
      configuracion,
      eventosConCargo,
      pendientes: pendientes.map((e) => conPrecios(e, true)),
      resueltas: resueltas.map((e) => conPrecios(e, true)),
      especiales: especiales.map((e) => conPrecios(e, true)),
    };
  }

  // El nuevo % solo aplica a los eventos que se creen desde ahora
  async cambiarPorcentajeGlobal(porcentaje: number, motivo: string, adminId: string) {
    const configuracion = await this.parametros.cambiarPorcentajeCargo(porcentaje, motivo, adminId);
    const eventosQueMantienen = await this.prisma.event.count({ where: { date: { gte: new Date() } } });
    return { configuracion, eventosQueMantienen };
  }

  // Responde la solicitud de condición especial: al aprobar se fija el % definitivo. En ambos casos
  // se habilita la venta de entradas y el organizador recibe el aviso en la bitácora (entrada interna).
  async responderCondicion(id: string, adminId: string, decision: 'APROBADA' | 'RECHAZADA', motivo: string, porcentaje?: number) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.estadoCondicion !== 'PENDIENTE') throw new BadRequestException('Este evento no tiene una solicitud pendiente');
    if (decision === 'APROBADA' && porcentaje === undefined) {
      throw new BadRequestException('Indica el porcentaje de cargo que se aplicará al evento');
    }

    const nuevo = decision === 'APROBADA' ? porcentaje! : event.porcentajeCargo;
    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.event.update({
        where: { id },
        data: {
          estadoCondicion: decision,
          respuestaCondicion: motivo,
          condicionRevisadaEn: new Date(),
          condicionRevisadaPorId: adminId,
          porcentajeCargo: nuevo,
        },
      }),
      // Aviso interno al organizador con la decisión y el %
      this.prisma.bitacoraEvento.create({
        data: {
          tipo: 'CAMBIO_DATOS',
          eventoId: id,
          autorId: adminId,
          titulo: decision === 'APROBADA' ? 'Condición especial aprobada' : 'Condición especial rechazada',
          mensaje: motivo,
          cambios: [{ campo: 'cargo', anterior: event.porcentajeCargo, nuevo }] as Prisma.InputJsonValue,
        },
      }),
      // Aviso público: ya se pueden comprar entradas
      this.prisma.bitacoraEvento.create({
        data: {
          tipo: 'CAMBIO_DATOS',
          eventoId: id,
          autorId: adminId,
          cambios: [{ campo: 'venta', anterior: 'PAUSADA', nuevo: 'HABILITADA' }] as Prisma.InputJsonValue,
        },
      }),
    ];
    if (nuevo !== event.porcentajeCargo) {
      ops.push(this.prisma.historialCargoEvento.create({
        data: { eventoId: id, adminId, porcentajeAnterior: event.porcentajeCargo, porcentajeNuevo: nuevo, motivo },
      }));
    }
    await this.prisma.$transaction(ops);
    return this.eventoConCargo(id);
  }

  // % especial fijado por un admin. Bajarlo siempre se puede; subirlo no, si el evento ya vendió
  // entradas (el precio que el público ya vio no debe subir).
  async cambiarPorcentajeEvento(id: string, adminId: string, porcentaje: number, motivo: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.estadoCondicion === 'PENDIENTE') {
      throw new BadRequestException('Este evento tiene una solicitud de condición especial pendiente: respóndela primero');
    }
    if (porcentaje === event.porcentajeCargo) throw new BadRequestException('El porcentaje es igual al actual');
    if (porcentaje > event.porcentajeCargo) {
      const vendidas = await this.prisma.compra.count({ where: { eventoId: id, estado: { in: ['PAGADA', 'CONFIRMADA'] } } });
      if (vendidas > 0) {
        throw new BadRequestException('Este evento ya vendió entradas: solo puedes bajar su cargo por servicio');
      }
    }
    await this.prisma.$transaction([
      this.prisma.event.update({ where: { id }, data: { porcentajeCargo: porcentaje } }),
      this.prisma.historialCargoEvento.create({
        data: { eventoId: id, adminId, porcentajeAnterior: event.porcentajeCargo, porcentajeNuevo: porcentaje, motivo },
      }),
      this.prisma.bitacoraEvento.create({
        data: {
          tipo: 'CAMBIO_DATOS',
          eventoId: id,
          autorId: adminId,
          titulo: 'Cargo por servicio actualizado',
          mensaje: motivo,
          cambios: [{ campo: 'cargo', anterior: event.porcentajeCargo, nuevo: porcentaje }] as Prisma.InputJsonValue,
        },
      }),
    ]);
    return this.eventoConCargo(id);
  }

  private async eventoConCargo(id: string) {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id },
      include: {
        ...eventoCargoInclude,
        historialCargos: { include: { admin: { select: { id: true, name: true } } }, orderBy: { fecha: 'desc' } },
      },
    });
    return conPrecios(event, true);
  }
}
