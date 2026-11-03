import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Event, EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { accountUnderReviewError } from '../auth/account-status';
import { CreateAnnouncementDto, CreateEventDto, OfertaEventDto, UpdateEventDto } from './dto/event.dto';
import { bitacoraInclude, cambioEstado, diffEvent, serializeBitacora } from './bitacora';
import { ParametrosService } from '../parametros/parametros.service';
import { OFERTA_LIMITS, conPrecios, ofertaVigente, porcentajeDescuento, precioFinal } from '../parametros/cargos';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
  ) {}

  // Lo que el formulario de eventos necesita saber antes de crear (ej. el % de cargo vigente)
  async configuracionPublica() {
    return { porcentajeCargoServicio: await this.parametros.porcentajeCargoVigente() };
  }

  async create(dto: CreateEventDto, user: AuthenticatedUser, imageUrl: string | null) {
    await this.assertCategoryExists(dto.categoryId);
    const date = this.parseFutureDate(dto.date);
    const { sourceEventId, solicitarCondicionEspecial, justificacionCondicion, porcentajeSolicitado, ...fields } = dto;
    if (solicitarCondicionEspecial && dto.price <= 0) {
      throw new BadRequestException('Los eventos gratuitos no tienen cargo por servicio: no necesitas solicitar una condición especial');
    }
    // El % de cargo queda fijo para este evento aunque después cambie el de la plataforma
    const porcentajeCargo = await this.parametros.porcentajeCargoVigente();

    // Duplicar: sin imagen nueva se reutiliza la del evento original (solo de un evento propio)
    if (!imageUrl && sourceEventId) {
      const source = await this.prisma.event.findUnique({
        where: { id: sourceEventId },
        select: { organizerId: true, imageUrl: true },
      });
      if (source && (source.organizerId === user.sub || user.role === 'ADMIN')) imageUrl = source.imageUrl;
    }

    const created = await this.prisma.event.create({
      data: {
        ...fields,
        date,
        organizerId: user.sub,
        imageUrl,
        porcentajeCargo,
        // Con una condición especial pendiente, la venta queda en pausa hasta que un admin responda
        ...(solicitarCondicionEspecial && {
          estadoCondicion: 'PENDIENTE',
          justificacionCondicion,
          porcentajeSolicitado: porcentajeSolicitado ?? null,
        }),
        bitacora: { create: { tipo: 'CREACION', autorId: user.sub } },
      },
      include: eventInclude,
    });
    return conPrecios(created, true);
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
          return { ...conPrecios(evt), distanceKm: Math.round(distance * 10) / 10 };
        })
        .filter((evt) => evt.distanceKm <= radiusKm);
    }

    return events.map((evt) => conPrecios(evt));
  }

  // Detalle con la bitácora. Los eventos no públicos solo los ven su organizador y los admins.
  async findOne(id: string, viewer?: AuthenticatedUser) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        ...publicInclude,
        organizer: {
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
            organizerProfile: { select: { organizationName: true, status: true } },
          },
        },
        bitacora: { include: bitacoraInclude, orderBy: { fechaCreacion: 'desc' } },
      },
    });
    const canManage = !!viewer && (viewer.role === 'ADMIN' || viewer.sub === event?.organizerId);
    // Los finalizados no salen en el catálogo, pero su detalle sigue disponible (ej. desde el perfil del organizador)
    const publiclyVisible = event && (PUBLIC_EVENT_STATUSES.includes(event.status) || event.status === 'FINISHED');
    if (!event || (!publiclyVisible && !canManage)) {
      throw new NotFoundException('Este evento no existe o ya no está disponible');
    }

    const { bitacora, organizer, ...rest } = event;
    // Solo los organizadores verificados y activos tienen perfil público. Los eventos creados por un
    // admin se muestran como del "Equipo UBIK"; los de cuentas antiguas, sin enlace al perfil.
    const perfilPublico =
      organizer.role === 'ORGANIZER' && organizer.status === 'ACTIVE' && organizer.organizerProfile?.status === 'APPROVED';
    return {
      ...conPrecios(rest, canManage),
      organizer: {
        id: organizer.id,
        name: organizer.role === 'ADMIN' ? 'Equipo UBIK' : organizer.name,
        organizerProfile: organizer.organizerProfile && { organizationName: organizer.organizerProfile.organizationName },
        perfilPublico,
      },
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
      ...conPrecios(evt, true),
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
    if (dto.price !== undefined && dto.price !== event.price && ofertaVigente(event)) {
      throw new BadRequestException('El evento está en oferta: termina la oferta antes de cambiar el precio de la entrada');
    }

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
    const cambios = diffEvent(event, updated, (cid) => categories.find((c) => c.id === cid)?.name)
      // En la bitácora el precio se muestra como lo ve el público (con el cargo del evento)
      .map((c) => (c.campo === 'precio'
        ? { ...c, anterior: precioFinal(Number(c.anterior), event.porcentajeCargo), nuevo: precioFinal(Number(c.nuevo), event.porcentajeCargo) }
        : c));
    if (cambios.length) {
      await this.prisma.bitacoraEvento.create({
        data: { tipo: 'CAMBIO_DATOS', eventoId: id, autorId: user.sub, cambios: cambios as unknown as Prisma.InputJsonValue },
      });
    }
    return conPrecios(updated, true);
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

  // Oferta del organizador: un precio rebajado que se anuncia en las novedades del evento.
  // Se puede cambiar mientras está vigente (queda registrado cada cambio).
  async setOffer(id: string, user: AuthenticatedUser, dto: OfertaEventDto) {
    const event = await this.assertCanManage(id, user);
    if (event.price <= 0) throw new BadRequestException('Los eventos gratuitos no pueden tener ofertas');
    if (event.status !== 'PUBLISHED' || event.date.getTime() <= Date.now()) {
      throw new BadRequestException('Solo puedes poner en oferta un evento publicado que aún no se realiza');
    }
    if (dto.precioOferta >= event.price) {
      throw new BadRequestException('El precio de oferta debe ser menor al precio actual de la entrada');
    }

    const hasta = dto.hasta ? new Date(dto.hasta) : null;
    if (hasta && hasta.getTime() <= Date.now() + 60 * 60_000) {
      throw new BadRequestException('La oferta debe durar al menos una hora desde ahora');
    }
    if (hasta && hasta.getTime() > event.date.getTime()) {
      throw new BadRequestException('La oferta no puede terminar después del inicio del evento');
    }

    // El descuento se mide sobre lo que paga el público, que incluye el cargo por servicio
    const normal = precioFinal(event.price, event.porcentajeCargo);
    const oferta = precioFinal(dto.precioOferta, event.porcentajeCargo);
    const descuento = porcentajeDescuento(normal, oferta);
    if (descuento < OFERTA_LIMITS.descuentoMin || descuento > OFERTA_LIMITS.descuentoMax) {
      throw new BadRequestException(
        `El descuento para el público debe estar entre ${OFERTA_LIMITS.descuentoMin}% y ${OFERTA_LIMITS.descuentoMax}% (hoy sería ${descuento}%)`,
      );
    }

    const anterior = ofertaVigente(event) ? precioFinal(event.precioOferta!, event.porcentajeCargo) : normal;
    const [updated] = await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id },
        data: { precioOferta: dto.precioOferta, ofertaHasta: hasta, ofertaCreadaEn: new Date() },
        include: eventInclude,
      }),
      this.prisma.bitacoraEvento.create({
        data: {
          tipo: 'CAMBIO_DATOS',
          eventoId: id,
          autorId: user.sub,
          titulo: `¡Entradas en oferta con ${descuento}% de descuento!`,
          mensaje: dto.mensaje || null,
          cambios: [
            { campo: 'oferta', anterior, nuevo: oferta, descuento, hasta: hasta?.toISOString() ?? null },
          ] as Prisma.InputJsonValue,
        },
      }),
    ]);
    return conPrecios(updated, true);
  }

  // Termina la oferta: el precio vuelve a ser el normal
  async endOffer(id: string, user: AuthenticatedUser) {
    const event = await this.assertCanManage(id, user);
    if (!ofertaVigente(event)) throw new BadRequestException('Este evento no tiene una oferta vigente');
    const [updated] = await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id },
        data: { precioOferta: null, ofertaHasta: null, ofertaCreadaEn: null },
        include: eventInclude,
      }),
      this.prisma.bitacoraEvento.create({
        data: {
          tipo: 'CAMBIO_DATOS',
          eventoId: id,
          autorId: user.sub,
          titulo: 'Terminó la oferta',
          cambios: [{
            campo: 'oferta',
            anterior: precioFinal(event.precioOferta!, event.porcentajeCargo),
            nuevo: precioFinal(event.price, event.porcentajeCargo),
          }] as Prisma.InputJsonValue,
        },
      }),
    ]);
    return conPrecios(updated, true);
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
    return conPrecios(updated, true);
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
