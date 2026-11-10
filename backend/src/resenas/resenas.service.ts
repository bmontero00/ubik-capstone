import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { accountUnderReviewError } from '../auth/account-status';
import { CrearResenaDto, GuardarResenaDto, ResponderResenaDto } from './dto/resena.dto';
import { RESENA, cierreResenas, nombrePublico } from './resenas.reglas';
import { ModeracionService } from './moderacion.service';
import { ResumenIaService } from './resumen-ia.service';

const resenaPublica = {
  id: true,
  estrellas: true,
  comentario: true,
  respuesta: true,
  fechaRespuesta: true,
  fechaCreacion: true,
  fechaEdicion: true,
  autorId: true,
  autor: { select: { name: true } },
  evento: { select: { id: true, title: true, date: true } },
} satisfies Prisma.ResenaSelect;

type ResenaConDatos = Prisma.ResenaGetPayload<{ select: typeof resenaPublica }>;

// Puede reseñar quien compró (o confirmó, si era gratis) entradas de un evento que ya finalizó
const COMPRA_VALIDA = { in: ['PAGADA', 'CONFIRMADA'] } satisfies Prisma.EnumEstadoCompraFilter;

export type MotivoSinResena = 'SIN_ENTRADAS' | 'CANCELADO' | 'NO_FINALIZADO' | 'PLAZO_VENCIDO';

const MENSAJES: Record<MotivoSinResena, string> = {
  SIN_ENTRADAS: 'Solo quienes compraron o confirmaron entradas pueden reseñar este evento',
  CANCELADO: 'Los eventos cancelados no se pueden reseñar',
  NO_FINALIZADO: 'Podrás reseñar este evento cuando finalice',
  PLAZO_VENCIDO: `El plazo para reseñar este evento terminó (${RESENA.diasParaResenar} días desde que finalizó)`,
};

@Injectable()
export class ResenasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderacion: ModeracionService,
    private readonly resumenIa: ResumenIaService,
  ) {}

  // Formato público: el autor se muestra con su nombre y la inicial del apellido
  static publica(r: ResenaConDatos, viewerId?: string) {
    return {
      id: r.id,
      autor: nombrePublico(r.autor.name),
      estrellas: r.estrellas,
      comentario: r.comentario,
      fecha: r.fechaCreacion,
      editada: !!r.fechaEdicion,
      evento: r.evento,
      respuesta: r.respuesta ? { texto: r.respuesta, fecha: r.fechaRespuesta } : null,
      propia: !!viewerId && r.autorId === viewerId,
    };
  }

  // Promedio, total y cuántas reseñas hay de cada cantidad de estrellas
  async resumen(organizadorId: string) {
    const grupos = await this.prisma.resena.groupBy({ by: ['estrellas'], where: { organizadorId }, _count: { _all: true } });
    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    grupos.forEach((g) => (distribucion[g.estrellas] = g._count._all));
    const total = grupos.reduce((n, g) => n + g._count._all, 0);
    const suma = grupos.reduce((n, g) => n + g.estrellas * g._count._all, 0);
    return { promedio: total ? Math.round((suma / total) * 10) / 10 : null, total, distribucion };
  }

  // Resumen de sus reseñas generado con IA (las sugerencias, solo para el propio organizador)
  resumenDeOrganizador(organizadorId: string, viewer?: AuthenticatedUser) {
    return this.resumenIa.obtener(organizadorId, viewer?.sub === organizadorId);
  }

  // La reseña más reciente (la que se destaca en el perfil del organizador)
  async ultima(organizadorId: string) {
    const r = await this.prisma.resena.findFirst({ where: { organizadorId }, select: resenaPublica, orderBy: { fechaCreacion: 'desc' } });
    return r ? ResenasService.publica(r) : null;
  }

  // Todas las reseñas de un organizador, de la más reciente a la más antigua (filtro opcional por estrellas)
  async listarDeOrganizador(organizadorId: string, viewer: AuthenticatedUser | undefined, pagina = 1, estrellas?: number) {
    const organizador = await this.prisma.user.findUnique({ where: { id: organizadorId }, select: { role: true } });
    if (organizador?.role !== 'ORGANIZER') throw new NotFoundException('Este organizador no existe');
    const where: Prisma.ResenaWhereInput = { organizadorId, ...(estrellas && { estrellas }) };
    const esOrganizador = viewer?.sub === organizadorId;
    const [resumen, total, resenas, sinResponder] = await Promise.all([
      this.resumen(organizadorId),
      this.prisma.resena.count({ where }),
      this.prisma.resena.findMany({
        where,
        select: resenaPublica,
        orderBy: { fechaCreacion: 'desc' },
        skip: (pagina - 1) * RESENA.porPagina,
        take: RESENA.porPagina,
      }),
      esOrganizador ? this.prisma.resena.count({ where: { organizadorId, respuesta: null } }) : Promise.resolve(0),
    ]);
    return {
      resumen,
      resenas: resenas.map((r) => ResenasService.publica(r, viewer?.sub)),
      pagina,
      totalPaginas: Math.max(1, Math.ceil(total / RESENA.porPagina)),
      total,
      esOrganizador,
      sinResponder, // solo para el organizador
    };
  }

  // Si el asistente puede reseñar el evento (o editar su reseña) y, si ya lo hizo, su reseña
  async estadoParaEvento(eventoId: string, user: AuthenticatedUser) {
    const evento = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { status: true, date: true } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    const [compras, resena] = await Promise.all([
      this.prisma.compra.count({ where: { eventoId, compradorId: user.sub, estado: COMPRA_VALIDA } }),
      this.prisma.resena.findUnique({ where: { eventoId_autorId: { eventoId, autorId: user.sub } }, select: resenaPublica }),
    ]);
    const cierre = cierreResenas(evento.date);
    let motivo: MotivoSinResena | null = null;
    if (!compras) motivo = 'SIN_ENTRADAS';
    else if (evento.status === 'CANCELLED') motivo = 'CANCELADO';
    else if (evento.status !== 'FINISHED') motivo = 'NO_FINALIZADO';
    else if (Date.now() > cierre.getTime()) motivo = 'PLAZO_VENCIDO';
    return {
      eventoId,
      puedeResenar: !motivo && !resena,
      puedeEditar: !motivo && !!resena,
      motivo,
      cierre,
      resena: resena ? ResenasService.publica(resena, user.sub) : null,
    };
  }

  // Estado de reseña de cada evento del que el asistente tiene entradas (para "Mis entradas")
  async estadoDeMisEventos(user: AuthenticatedUser) {
    const [compras, resenas] = await Promise.all([
      this.prisma.compra.findMany({
        where: { compradorId: user.sub, estado: COMPRA_VALIDA },
        select: { evento: { select: { id: true, status: true, date: true } } },
        distinct: ['eventoId'],
      }),
      this.prisma.resena.findMany({ where: { autorId: user.sub }, select: resenaPublica }),
    ]);
    const porEvento = new Map(resenas.map((r) => [r.evento.id, r]));
    return compras.map(({ evento }) => {
      const cierre = cierreResenas(evento.date);
      const abierta = evento.status === 'FINISHED' && Date.now() <= cierre.getTime();
      const resena = porEvento.get(evento.id);
      return {
        eventoId: evento.id,
        puedeResenar: abierta && !resena,
        puedeEditar: abierta && !!resena,
        cierre,
        resena: resena ? ResenasService.publica(resena, user.sub) : null,
      };
    });
  }

  private async assertPuedeEscribir(eventoId: string, user: AuthenticatedUser) {
    if (user.status !== 'ACTIVE') throw accountUnderReviewError();
    const estado = await this.estadoParaEvento(eventoId, user);
    if (estado.motivo) throw new ForbiddenException({ message: MENSAJES[estado.motivo], code: estado.motivo });
    return estado;
  }

  async crear(dto: CrearResenaDto, user: AuthenticatedUser) {
    const estado = await this.assertPuedeEscribir(dto.eventoId, user);
    if (estado.resena) throw new ConflictException('Ya reseñaste este evento: puedes editar tu reseña');
    const evento = await this.prisma.event.findUniqueOrThrow({ where: { id: dto.eventoId }, select: { organizerId: true } });
    if (evento.organizerId === user.sub) throw new ForbiddenException('No puedes reseñar tus propios eventos');
    await this.moderacion.revisar(dto.comentario, 'resena');
    try {
      const r = await this.prisma.resena.create({
        data: { estrellas: dto.estrellas, comentario: dto.comentario, eventoId: dto.eventoId, autorId: user.sub, organizadorId: evento.organizerId },
        select: resenaPublica,
      });
      this.resumenIa.programar(evento.organizerId);
      return ResenasService.publica(r, user.sub);
    } catch (e) {
      // Dos envíos al mismo tiempo: la restricción única deja pasar solo uno
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya reseñaste este evento: puedes editar tu reseña');
      }
      throw e;
    }
  }

  private async buscar(id: string) {
    const r = await this.prisma.resena.findUnique({ where: { id }, select: { autorId: true, eventoId: true, organizadorId: true } });
    if (!r) throw new NotFoundException('Reseña no encontrada');
    return r;
  }

  // El autor puede editarla mientras siga abierto el plazo
  async editar(id: string, dto: GuardarResenaDto, user: AuthenticatedUser) {
    const r = await this.buscar(id);
    if (r.autorId !== user.sub) throw new ForbiddenException('Solo el autor puede editar esta reseña');
    await this.assertPuedeEscribir(r.eventoId, user);
    await this.moderacion.revisar(dto.comentario, 'resena');
    const actualizada = await this.prisma.resena.update({
      where: { id },
      data: { estrellas: dto.estrellas, comentario: dto.comentario, fechaEdicion: new Date() },
      select: resenaPublica,
    });
    this.resumenIa.programar(r.organizadorId);
    return ResenasService.publica(actualizada, user.sub);
  }

  // La elimina su autor (en cualquier momento) o un administrador (moderación)
  async eliminar(id: string, user: AuthenticatedUser) {
    const r = await this.buscar(id);
    if (r.autorId !== user.sub && user.role !== 'ADMIN') throw new ForbiddenException('No puedes eliminar esta reseña');
    await this.prisma.resena.delete({ where: { id } });
    this.resumenIa.programar(r.organizadorId);
    return { ok: true };
  }

  // Respuesta pública del organizador del evento: una por reseña, se puede editar o quitar
  async responder(id: string, dto: ResponderResenaDto | null, user: AuthenticatedUser) {
    const r = await this.buscar(id);
    if (r.organizadorId !== user.sub) throw new ForbiddenException('Solo el organizador del evento puede responder esta reseña');
    if (dto && user.status !== 'ACTIVE') throw accountUnderReviewError();
    if (dto) await this.moderacion.revisar(dto.respuesta, 'respuesta');
    const actualizada = await this.prisma.resena.update({
      where: { id },
      data: dto ? { respuesta: dto.respuesta, fechaRespuesta: new Date() } : { respuesta: null, fechaRespuesta: null },
      select: resenaPublica,
    });
    return ResenasService.publica(actualizada, user.sub);
  }
}
