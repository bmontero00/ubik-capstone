import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_EVENT_STATUSES } from '../events/events.service';
import { conPrecios } from '../parametros/cargos';
import { ResenasService } from '../resenas/resenas.service';

const eventSelect = {
  id: true,
  title: true,
  date: true,
  address: true,
  price: true,
  imageUrl: true,
  status: true,
  statusReason: true,
  latitude: true,
  longitude: true,
  description: true,
  porcentajeCargo: true,
  estadoCondicion: true,
  porcentajeOferta: true,
  estacionamiento: true,
  cuposEstacionamiento: true,
  tiposEntrada: true,
  ofertaHasta: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.EventSelect;

const LIST_LIMIT = 6;

@Injectable()
export class OrganizersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resenas: ResenasService,
  ) {}

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        organizerProfile: {
          select: { status: true, organizationName: true, eventDescription: true, socialUrl: true, reviewedAt: true },
        },
      },
    });
    // Solo organizadores verificados y con la cuenta activa tienen perfil público
    const profile = user?.organizerProfile;
    if (!user || user.role !== 'ORGANIZER' || user.status !== 'ACTIVE' || profile?.status !== 'APPROVED') {
      throw new NotFoundException('Este organizador no existe o su perfil no está disponible');
    }

    // Los eventos en revisión son moderación interna: no se cuentan ni se muestran
    const now = new Date();
    const visible = { organizerId: id, status: { in: [...PUBLIC_EVENT_STATUSES, 'FINISHED' as const] } };
    const completedWhere: Prisma.EventWhereInput = {
      organizerId: id,
      OR: [{ status: 'FINISHED' }, { status: 'PUBLISHED', date: { lt: now } }],
    };

    const [total, completed, cancelled, postponed, upcoming, past, byCategory] = await Promise.all([
      this.prisma.event.count({ where: visible }),
      this.prisma.event.count({ where: completedWhere }),
      this.prisma.event.count({ where: { organizerId: id, status: 'CANCELLED' } }),
      this.prisma.event.count({ where: { organizerId: id, status: 'POSTPONED' } }),
      this.prisma.event.findMany({
        where: { organizerId: id, status: { in: ['PUBLISHED', 'POSTPONED'] }, date: { gte: now } },
        select: eventSelect,
        orderBy: { date: 'asc' },
        take: LIST_LIMIT,
      }),
      this.prisma.event.findMany({ where: completedWhere, select: eventSelect, orderBy: { date: 'desc' }, take: LIST_LIMIT }),
      this.prisma.event.groupBy({ by: ['categoryId'], where: visible, _count: { _all: true } }),
    ]);

    const categories = await this.prisma.category.findMany({
      where: { id: { in: byCategory.map((c) => c.categoryId) } },
      select: { id: true, name: true },
    });
    const topCategories = byCategory
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 3)
      .map((c) => ({ ...categories.find((cat) => cat.id === c.categoryId)!, eventos: c._count._all }));

    const [upcomingCount, calificacion, ultimaResena] = await Promise.all([
      this.prisma.event.count({ where: { organizerId: id, status: { in: ['PUBLISHED', 'POSTPONED'] }, date: { gte: now } } }),
      this.resenas.resumen(id),
      this.resenas.ultima(id),
    ]);

    return {
      id: user.id,
      nombre: profile.organizationName || user.name,
      responsable: profile.organizationName ? user.name : null,
      descripcion: profile.eventDescription,
      redSocial: /^https?:\/\//i.test(profile.socialUrl ?? '') ? profile.socialUrl : null,
      verificadoDesde: profile.reviewedAt ?? user.createdAt,
      miembroDesde: user.createdAt,
      estadisticas: {
        eventosPublicados: total,
        proximos: upcomingCount,
        realizados: completed,
        cancelados: cancelled,
        postergados: postponed,
        // Porcentaje de eventos que se realizaron entre los que ya debían ocurrir (realizados + cancelados)
        cumplimiento: completed + cancelled > 0 ? Math.round((completed / (completed + cancelled)) * 100) : null,
      },
      categoriasFrecuentes: topCategories,
      proximosEventos: upcoming.map((e) => conPrecios(e)),
      eventosRealizados: past.map((e) => conPrecios(e)),
      // Promedio de estrellas y la reseña más reciente; el listado completo está en GET /resenas/organizador/:id
      calificacion,
      ultimaResena,
    };
  }
}
