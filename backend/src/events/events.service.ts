import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { accountUnderReviewError } from '../auth/account-status';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';

// Estados visibles en el catálogo público. Los cancelados y postergados se muestran
// con su aviso para que los asistentes se enteren; los en revisión y finalizados no.
export const PUBLIC_EVENT_STATUSES: EventStatus[] = ['PUBLISHED', 'POSTPONED', 'CANCELLED'];

// Un organizador solo edita sus eventos vigentes; los demás estados los gestiona un admin
const ORGANIZER_EDITABLE_STATUSES: EventStatus[] = ['PUBLISHED', 'POSTPONED'];

const eventInclude = {
  category: { select: { id: true, name: true } },
  organizer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEventDto, organizerId: string, imageUrl: string | null) {
    await this.assertCategoryExists(dto.categoryId);
    const date = this.parseFutureDate(dto.date);

    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        date,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        categoryId: dto.categoryId,
        organizerId,
        imageUrl,
      },
      include: eventInclude,
    });
  }

  async findAll(lat?: number, lng?: number, radiusKm?: number) {
    const events = await this.prisma.event.findMany({
      where: { status: { in: PUBLIC_EVENT_STATUSES } },
      include: eventInclude,
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

  // Eventos del organizador en todos sus estados, los próximos primero
  findMine(organizerId: string) {
    return this.prisma.event.findMany({
      where: { organizerId },
      include: eventInclude,
      orderBy: { date: 'desc' },
    });
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateEventDto, imageUrl: string | null | undefined) {
    const event = await this.assertCanManage(id, user);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    // La fecha solo se exige futura si cambia (un admin puede corregir otros datos de un evento pasado)
    const dateChanged = dto.date && new Date(dto.date).getTime() !== event.date.getTime();
    const { removeImage, date, ...fields } = dto;

    return this.prisma.event.update({
      where: { id },
      data: {
        ...fields,
        ...(dateChanged && { date: this.parseFutureDate(date!) }),
        ...(imageUrl ? { imageUrl } : removeImage ? { imageUrl: null } : {}),
      },
      include: eventInclude,
    });
  }

  // El organizador cancela su propio evento; queda visible con el aviso y el motivo
  async cancel(id: string, user: AuthenticatedUser, reason: string) {
    await this.assertCanManage(id, user);
    return this.prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED', statusReason: reason, statusChangedAt: new Date(), statusChangedById: user.sub },
      include: eventInclude,
    });
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

  // El admin puede modificar cualquier evento; el organizador, solo los suyos y vigentes
  private async assertCanManage(id: string, user: AuthenticatedUser) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (user.role === 'ADMIN') return event;

    if (event.organizerId !== user.sub) {
      throw new ForbiddenException('Solo puedes modificar tus propios eventos');
    }
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
