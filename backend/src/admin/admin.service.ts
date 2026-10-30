import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, EventStatus, OrganizerStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Estados que exigen explicar el motivo del cambio
const ACCOUNT_STATUSES_WITH_REASON: AccountStatus[] = ['UNDER_REVIEW', 'SUSPENDED'];
const EVENT_STATUSES_WITH_REASON: EventStatus[] = ['UNDER_REVIEW', 'POSTPONED', 'CANCELLED'];

// El admin solo gestiona asistentes y organizadores, nunca a otros administradores
const MANAGED_ROLES: Role[] = ['ATTENDEE', 'ORGANIZER'];

export interface UserFilters {
  group?: 'active' | 'flagged';
  role?: Role;
  status?: AccountStatus;
  search?: string;
}

export interface EventFilters {
  status?: EventStatus;
  search?: string;
}

const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  statusReason: true,
  statusChangedAt: true,
  createdAt: true,
  organizerProfile: { select: { status: true } },
  _count: { select: { events: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Resumen ---

  async getOverview() {
    const [usersByRoleStatus, pendingOrganizers, eventsByStatus, upcomingEvents] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role', 'status'], _count: { _all: true } }),
      this.prisma.organizerProfile.count({ where: { status: 'PENDING' } }),
      this.prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.event.count({ where: { status: 'PUBLISHED', date: { gte: new Date() } } }),
    ]);

    return {
      users: usersByRoleStatus.map((g) => ({ role: g.role, status: g.status, count: g._count._all })),
      pendingOrganizers,
      events: eventsByStatus.map((g) => ({ status: g.status, count: g._count._all })),
      upcomingEvents,
    };
  }

  // --- Solicitudes de organizadores ---

  listOrganizerRequests(status?: OrganizerStatus) {
    return this.prisma.organizerProfile.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' }, // Las más antiguas primero
    });
  }

  async reviewOrganizer(profileId: string, adminId: string, approve: boolean, reason?: string) {
    const profile = await this.prisma.organizerProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Solicitud no encontrada');

    if (!approve && !reason?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo para que el organizador pueda corregirlo');
    }

    return this.prisma.organizerProfile.update({
      where: { id: profileId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        rejectionReason: approve ? null : reason!.trim(),
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
  }

  // --- Usuarios ---

  listUsers({ group = 'active', role, status, search }: UserFilters) {
    const statusFilter: Prisma.UserWhereInput['status'] = status
      ? status
      : group === 'flagged'
        ? { in: ['UNDER_REVIEW', 'SUSPENDED'] }
        : 'ACTIVE';

    return this.prisma.user.findMany({
      where: {
        role: role && MANAGED_ROLES.includes(role) ? role : { in: MANAGED_ROLES },
        status: statusFilter,
        ...(search?.trim() && {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { email: { contains: search.trim(), mode: 'insensitive' } },
          ],
        }),
      },
      select: userListSelect,
      orderBy: group === 'flagged' ? { statusChangedAt: 'desc' } : { createdAt: 'desc' },
      take: 200,
    });
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...userListSelect,
        statusChangedBy: { select: { id: true, name: true } },
        organizerProfile: {
          select: {
            status: true,
            rut: true,
            phone: true,
            organizationName: true,
            eventDescription: true,
            socialUrl: true,
            rejectionReason: true,
            reviewedAt: true,
            createdAt: true,
          },
        },
        events: {
          select: { id: true, title: true, date: true, status: true },
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });
    if (!user || !MANAGED_ROLES.includes(user.role)) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateUserStatus(id: string, adminId: string, status: AccountStatus, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!MANAGED_ROLES.includes(user.role)) {
      throw new ForbiddenException('No puedes cambiar el estado de un administrador');
    }
    if (ACCOUNT_STATUSES_WITH_REASON.includes(status) && !reason?.trim()) {
      throw new BadRequestException('Indica el motivo del cambio de estado');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status,
        statusReason: reason?.trim() || null,
        statusChangedAt: new Date(),
        statusChangedById: adminId,
      },
    });
    return this.getUser(id);
  }

  // --- Eventos ---

  listEvents({ status, search }: EventFilters) {
    return this.prisma.event.findMany({
      where: {
        ...(status && { status }),
        ...(search?.trim() && {
          OR: [
            { title: { contains: search.trim(), mode: 'insensitive' } },
            { address: { contains: search.trim(), mode: 'insensitive' } },
            { organizer: { name: { contains: search.trim(), mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        category: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true, email: true, status: true } },
        statusChangedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });
  }

  async updateEventStatus(id: string, adminId: string, status: EventStatus, reason?: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (EVENT_STATUSES_WITH_REASON.includes(status) && !reason?.trim()) {
      throw new BadRequestException('Indica el motivo del cambio de estado del evento');
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        status,
        statusReason: reason?.trim() || null,
        statusChangedAt: new Date(),
        statusChangedById: adminId,
      },
      include: {
        category: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true, email: true, status: true } },
        statusChangedBy: { select: { id: true, name: true } },
      },
    });
  }
}
