import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, EventStatus, OrganizerStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cambioEstado } from '../events/bitacora';

// El admin solo gestiona asistentes y organizadores, nunca a otros administradores
const MANAGED_ROLES: Role[] = ['ATTENDEE', 'ORGANIZER'];

export type UserGroup = 'active' | 'flagged' | 'rejected';

export interface UserFilters {
  group?: UserGroup;
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
  organizerProfile: {
    select: {
      status: true,
      reviewedAt: true,
      _count: { select: { reviews: { where: { decision: 'REJECTED' } } } },
    },
  },
  _count: { select: { events: true } },
} satisfies Prisma.UserSelect;

// Los organizadores rechazados tienen su propia pestaña y no se mezclan con el resto
const NOT_REJECTED: Prisma.UserWhereInput = { NOT: { organizerProfile: { is: { status: 'REJECTED' } } } };
const IS_REJECTED: Prisma.UserWhereInput = { role: 'ORGANIZER', organizerProfile: { is: { status: 'REJECTED' } } };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Resumen ---

  async getOverview() {
    const [usersByRoleStatus, pendingOrganizers, rejectedOrganizers, eventsByStatus, upcomingEvents] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role', 'status'], where: NOT_REJECTED, _count: { _all: true } }),
      this.prisma.organizerProfile.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: IS_REJECTED }),
      this.prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.event.count({ where: { status: 'PUBLISHED', date: { gte: new Date() } } }),
    ]);

    return {
      users: usersByRoleStatus.map((g) => ({ role: g.role, status: g.status, count: g._count._all })),
      pendingOrganizers,
      rejectedOrganizers,
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

  // reason ya viene validado por IsReason (obligatorio, 10 a 500 caracteres)
  async reviewOrganizer(profileId: string, adminId: string, approve: boolean, reason: string) {
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { name: true } } },
    });
    if (!profile) throw new NotFoundException('Solicitud no encontrada');

    const decision: OrganizerStatus = approve ? 'APPROVED' : 'REJECTED';
    const reviewedAt = new Date();

    // El perfil guarda el estado actual y el historial una copia de lo que se revisó
    const [updated] = await this.prisma.$transaction([
      this.prisma.organizerProfile.update({
        where: { id: profileId },
        data: {
          status: decision,
          rejectionReason: approve ? null : reason,
          approvalNote: approve ? reason : null,
          approvalSeenAt: null, // el aviso de aprobación se muestra en el próximo ingreso
          reviewedAt,
          reviewedById: adminId,
        },
        include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      }),
      this.prisma.organizerReview.create({
        data: {
          profileId,
          decision,
          reason,
          reviewedAt,
          reviewedById: adminId,
          submittedAt: profile.submittedAt,
          applicantName: profile.user.name,
          rut: profile.rut,
          phone: profile.phone,
          organizationName: profile.organizationName,
          eventDescription: profile.eventDescription,
          socialUrl: profile.socialUrl,
        },
      }),
    ]);
    return updated;
  }

  // --- Usuarios ---

  listUsers({ group = 'active', role, status, search }: UserFilters) {
    const searchFilter: Prisma.UserWhereInput = search?.trim()
      ? {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { email: { contains: search.trim(), mode: 'insensitive' } },
          ],
        }
      : {};

    // Rechazados: solo organizadores, del rechazo más reciente al más antiguo
    if (group === 'rejected') {
      return this.prisma.user.findMany({
        where: { ...IS_REJECTED, ...searchFilter },
        select: userListSelect,
        orderBy: { organizerProfile: { reviewedAt: 'desc' } },
        take: 200,
      });
    }

    const statusFilter: Prisma.UserWhereInput['status'] = status
      ? status
      : group === 'flagged'
        ? { in: ['UNDER_REVIEW', 'SUSPENDED'] }
        : 'ACTIVE';

    return this.prisma.user.findMany({
      where: {
        role: role && MANAGED_ROLES.includes(role) ? role : { in: MANAGED_ROLES },
        status: statusFilter,
        AND: [NOT_REJECTED, searchFilter],
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
            approvalNote: true,
            reviewedAt: true,
            submittedAt: true,
            createdAt: true,
            _count: { select: { reviews: { where: { decision: 'REJECTED' } } } },
            // Historial de rechazos, el más reciente primero
            reviews: {
              where: { decision: 'REJECTED' },
              orderBy: { reviewedAt: 'desc' },
              select: {
                id: true,
                reason: true,
                reviewedAt: true,
                reviewedBy: { select: { id: true, name: true } },
                submittedAt: true,
                applicantName: true,
                rut: true,
                phone: true,
                organizationName: true,
                eventDescription: true,
                socialUrl: true,
              },
            },
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

  async updateUserStatus(id: string, adminId: string, status: AccountStatus, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, organizerProfile: { select: { status: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!MANAGED_ROLES.includes(user.role)) {
      throw new ForbiddenException('No puedes cambiar el estado de un administrador');
    }
    if (user.organizerProfile?.status === 'REJECTED') {
      throw new ForbiddenException(
        'No se puede cambiar el estado de un organizador con la solicitud rechazada; solo puede consultarse su información',
      );
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        status,
        statusReason: reason,
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

  async updateEventStatus(id: string, adminId: string, status: EventStatus, reason: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    // El cambio queda en la bitácora del evento (firmado como "Equipo UBIK")
    const [updated] = await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id },
        data: {
          status,
          statusReason: reason,
          statusChangedAt: new Date(),
          statusChangedById: adminId,
        },
        include: {
          category: { select: { id: true, name: true } },
          organizer: { select: { id: true, name: true, email: true, status: true } },
          statusChangedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.bitacoraEvento.create({
        data: {
          tipo: 'CAMBIO_ESTADO',
          eventoId: id,
          autorId: adminId,
          mensaje: reason,
          cambios: [cambioEstado(event.status, status)] as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    return updated;
  }
}
