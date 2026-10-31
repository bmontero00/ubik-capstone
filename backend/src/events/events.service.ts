import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Event, EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { accountUnderReviewError } from '../auth/account-status';
import { CreateAnnouncementDto, CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { bitacoraInclude, cambioEstado, diffEvent, serializeBitacora } from './bitacora';

// Estados visibles en el catálogo público. Los cancelados y postergados se muestran
// con su aviso para que los asistentes se enteren; los en revisión y finalizados no.
export const PUBLIC_EVENT_STATUSES: EventStatus[] = ['PUBLISHED', 'POSTPONED', 'CANCELLED'];

// Un organizador solo edita sus eventos vigentes; los demás estados los gestiona un admin
const ORGANIZER_EDITABLE_STATUSES: EventStatus[] = ['PUBLISHED', 'POSTPONED'];

// El organizador puede seguir informando a los asistentes de un evento cancelado (ej. devoluciones)
const ORGANIZER_ANNOUNCE_STATUSES: EventStatus[] = ['PUBLISHED', 'POSTPONED', 'CANCELLED'];

// En el catálogo público no se expone el correo del organizador
const publicInclude = {
  category: { select: { id: true, name: true } },
  organizer: { select: { id: true, name: true, organizerProfile: { select: { organizationName: true } } } },
} satisfies Prisma.EventInclude;

const eventInclude = {
  category: { select: { id: true, name: true } },
  organizer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEventDto, user: AuthenticatedUser, imageUrl: string | null) {
    await this.assertCategoryExists(dto.categoryId);
    const date = this.parseFutureDate(dto.date);
    const { sourceEventId, ...fields } = dto;

    // Duplicar: sin imagen nueva se reutiliza la del evento original (solo de un evento propio)
    if (!imageUrl && sourceEventId) {
      const source = await this.prisma.event.findUnique({
        where: { id: sourceEventId },
        select: { organizerId: true, imageUrl: true },
      });
      if (source && (source.organizerId === user.sub || user.role === 'ADMIN')) imageUrl = source.imageUrl;
    }

    return this.prisma.event.create({
      data: {
        ...fields,
        date,
        organizerId: user.sub,
        imageUrl,
        bitacora: { create: { tipo: 'CREACION', autorId: user.sub } },
      },
      include: eventInclude,
    });
  }

  async findAll(lat?: number, lng?: number, radiusKm?: number) {
    const events = await this.prisma.event.findMany({
      where: { status: { in: PUBLIC_EVENT_STATUSES } },
      include: publicInclude,
      orderBy: { date: 'asc' },
    });

    if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
      return events
        .map((evt) => {
          const distance = this.calculateHaversine(lat, lng, evt.latitude, evt.longitude);
          return { ...evt, distanceKm: Math.round(distance * 10) / 10 };
        })
        .filter((evt) => evt.distanceKm <= radiusKm);
    }

    return events;
  }

  // Detalle con la bitácora. Los eventos no públicos solo los ven su organizador y los admins.
  async findOne(id: string, viewer?: AuthenticatedUser) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        ...publicInclude,
        bitacora: { include: bitacoraInclude, orderBy: { fechaCreacion: 'desc' } },
      },
    });
    const canManage = !!viewer && (viewer.role === 'ADMIN' || viewer.sub === event?.organizerId);
    if (!event || (!PUBLIC_EVENT_STATUSES.includes(event.status) && !canManage)) {
      throw new NotFoundException('Este evento no existe o ya no está disponible');
    }

    const { bitacora, ...rest } = event;
    return {
      ...rest,
      canManage,
      canAnnounce: canManage && (viewer!.role === 'ADMIN' || ORGANIZER_ANNOUNCE_STATUSES.includes(event.status)),
      bitacora: serializeBitacora(bitacora, canManage),
    };
  }

  // Eventos del organizador en todos sus estados, con el último aviso del equipo UBIK
  // (cambio de estado o de datos hecho por un admin) y la cantidad de anuncios publicados
  async findMine(organizerId: string) {
    const events = await this.prisma.event.findMany({
      where: { organizerId },
      include: {
        ...eventInclude,
        bitacora: {
          where: { autor: { role: 'ADMIN' }, tipo: { in: ['CAMBIO_ESTADO', 'CAMBIO_DATOS', 'ANUNCIO'] } },
          include: bitacoraInclude,
          orderBy: { fechaCreacion: 'desc' },
          take: 1,
        },
        _count: { select: { bitacora: { where: { tipo: 'ANUNCIO' } } } },
      },
      orderBy: { date: 'desc' },
    });
    return events.map(({ bitacora, _count, ...evt }) => ({
      ...evt,
      ultimoAvisoEquipo: serializeBitacora(bitacora, true)[0] ?? null,
      totalAnuncios: _count.bitacora,
    }));
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateEventDto, imageUrl: string | null | undefined) {
    const event = await this.assertCanManage(id, user);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    // La fecha solo se exige futura si cambia (un admin puede corregir otros datos de un evento pasado)
    const dateChanged = dto.date && new Date(dto.date).getTime() !== event.date.getTime();
    const { removeImage, date, ...fields } = dto;

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...fields,
        ...(dateChanged && { date: this.parseFutureDate(date!) }),
        ...(imageUrl ? { imageUrl } : removeImage ? { imageUrl: null } : {}),
      },
      include: eventInclude,
    });

    const categories = await this.prisma.category.findMany({ select: { id: true, name: true } });
    const cambios = diffEvent(event, updated, (cid) => categories.find((c) => c.id === cid)?.name);
    if (cambios.length) {
      await this.prisma.bitacoraEvento.create({
        data: { tipo: 'CAMBIO_DATOS', eventoId: id, autorId: user.sub, cambios: cambios as unknown as Prisma.InputJsonValue },
      });
    }
    return updated;
  }

  // El organizador cancela su propio evento; queda visible con el aviso y el motivo
  async cancel(id: string, user: AuthenticatedUser, reason: string) {
    const event = await this.assertCanManage(id, user);
    return this.changeStatus(event, user, 'CANCELLED', reason);
  }

  // Postergar con una nueva fecha: el evento sigue visible con el aviso y la fecha nueva
  async postpone(id: string, user: AuthenticatedUser, dateValue: string, reason: string) {
    const event = await this.assertCanManage(id, user);
    const date = this.parseFutureDate(dateValue);
    if (date.getTime() === event.date.getTime()) {
      throw new BadRequestException('La nueva fecha debe ser distinta de la actual');
    }
    return this.changeStatus(event, user, 'POSTPONED', reason, {
      date,
      cambios: [{ campo: 'fecha', anterior: event.date.toISOString(), nuevo: date.toISOString() }],
    });
  }

  // Vuelve a publicar un evento que el propio organizador había postergado.
  // Si lo postergó el equipo UBIK, solo un admin puede reactivarlo.
  async resume(id: string, user: AuthenticatedUser) {
    const event = await this.assertCanManage(id, user);
    if (event.status !== 'POSTPONED') throw new BadRequestException('Solo se puede reactivar un evento postergado');
    if (user.role !== 'ADMIN' && event.statusChangedById && event.statusChangedById !== event.organizerId) {
      throw new ForbiddenException('El equipo de UBIK postergó este evento. Contáctanos para volver a publicarlo.');
    }
    if (event.date.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha del evento ya pasó: posterga el evento con una nueva fecha');
    }
    return this.changeStatus(event, user, 'PUBLISHED', null);
  }

  // Cambia el estado y lo deja en la bitácora (el admin usa este mismo registro desde su panel)
  async changeStatus(
    event: Event,
    user: { sub: string },
    status: EventStatus,
    reason: string | null,
    extra: { date?: Date; cambios?: object[] } = {},
  ) {
    const [updated] = await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id: event.id },
        data: {
          status,
          statusReason: reason,
          statusChangedAt: new Date(),
          statusChangedById: user.sub,
          ...(extra.date && { date: extra.date }),
        },
        include: eventInclude,
      }),
      this.prisma.bitacoraEvento.create({
        data: {
          tipo: 'CAMBIO_ESTADO',
          eventoId: event.id,
          autorId: user.sub,
          mensaje: reason,
          cambios: [cambioEstado(event.status, status), ...(extra.cambios ?? [])] as Prisma.InputJsonValue,
        },
      }),
    ]);
    return updated;
  }

  async addAnnouncement(id: string, user: AuthenticatedUser, dto: CreateAnnouncementDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (user.role !== 'ADMIN') {
      this.assertOwner(event, user);
      await this.assertCanPublish(user);
      if (!ORGANIZER_ANNOUNCE_STATUSES.includes(event.status)) {
        throw new ForbiddenException('Por el estado actual de este evento no puedes publicar anuncios');
      }
    }
    const entrada = await this.prisma.bitacoraEvento.create({
      data: { tipo: 'ANUNCIO', eventoId: id, autorId: user.sub, titulo: dto.titulo || null, mensaje: dto.mensaje },
      include: bitacoraInclude,
    });
    return serializeBitacora([entrada], true)[0];
  }

  // Solo se pueden borrar anuncios (los cambios quedan como registro); los borra su autor o un admin
  async removeAnnouncement(eventId: string, entradaId: string, user: AuthenticatedUser) {
    const entrada = await this.prisma.bitacoraEvento.findUnique({ where: { id: entradaId } });
    if (!entrada || entrada.eventoId !== eventId || entrada.tipo !== 'ANUNCIO') {
      throw new NotFoundException('Anuncio no encontrado');
    }
    if (user.role !== 'ADMIN' && entrada.autorId !== user.sub) {
      throw new ForbiddenException('Solo puedes eliminar tus propios anuncios');
    }
    await this.prisma.bitacoraEvento.delete({ where: { id: entradaId } });
  }

  // Un organizador solo puede publicar si un administrador aprobó su solicitud
  async assertCanPublish(user: AuthenticatedUser) {
    if (user.status !== 'ACTIVE') throw accountUnderReviewError();
    if (user.role === 'ADMIN') return;
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId: user.sub },
      select: { status: true },
    });
    if (profile?.status !== 'APPROVED') {
      throw new ForbiddenException(
        'Tu cuenta de organizador aún no ha sido aprobada por un administrador',
      );
    }
  }

  private assertOwner(event: Event, user: AuthenticatedUser) {
    if (event.organizerId !== user.sub) {
      throw new ForbiddenException('Solo puedes modificar tus propios eventos');
    }
  }

  // El admin puede modificar cualquier evento; el organizador, solo los suyos y vigentes
  private async assertCanManage(id: string, user: AuthenticatedUser) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (user.role === 'ADMIN') return event;

    this.assertOwner(event, user);
    await this.assertCanPublish(user);
    if (!ORGANIZER_EDITABLE_STATUSES.includes(event.status)) {
      throw new ForbiddenException(
        'Este evento ya no se puede modificar por su estado actual. Si necesitas cambios, contacta al equipo de UBIK.',
      );
    }
    return event;
  }

  private async assertCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new BadRequestException('La categoría seleccionada no existe');
  }

  private parseFutureDate(value: string) {
    const date = new Date(value);
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha y hora del evento deben ser posteriores al momento actual');
    }
    return date;
  }

  async findAllCategories() {
    return this.prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  private calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
