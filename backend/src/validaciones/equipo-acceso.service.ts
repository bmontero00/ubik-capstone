import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JWT_SECRET } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { PROPOSITO_VALIDADOR, venceAcceso } from './actor';

// Equipo de acceso de un evento: el organizador crea un acceso por persona o puerta, opcionalmente
// limitado a ciertos tipos de entrada, y entrega un código de un solo uso para vincular un celular.
// El celular recibe un token que solo sirve para validar entradas de ese evento.

const MAX_ACCESOS = 30;
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I/L
const bloque = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

// "val-abcd efgh" y "VAL-ABCD-EFGH" son el mismo código
const canonico = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (codigo: string) => createHash('sha256').update(canonico(codigo)).digest('hex');

export interface DatosAcceso {
  nombre?: string;
  puerta?: string | null;
  tiposEntradaIds?: string[];
  permiteEstacionamiento?: boolean;
}

type Estado = 'PENDIENTE' | 'ACTIVO' | 'REVOCADO' | 'VENCIDO';

@Injectable()
export class EquipoAccesoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async eventoPropio(user: AuthenticatedUser, eventoId: string) {
    const e = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: {
        id: true, title: true, date: true, status: true, organizerId: true, estacionamiento: true,
        tiposEntrada: { select: { id: true, nombre: true }, orderBy: { orden: 'asc' } },
      },
    });
    if (!e) throw new NotFoundException('Evento no encontrado');
    if (e.organizerId !== user.sub && user.role !== 'ADMIN') throw new ForbiddenException('Solo puedes gestionar el equipo de tus eventos');
    return e;
  }

  private async accesoPropio(user: AuthenticatedUser, id: string) {
    const a = await this.prisma.accesoValidador.findUnique({ where: { id }, select: { id: true, eventoId: true, revocadoEn: true } });
    if (!a) throw new NotFoundException('Acceso no encontrado');
    const e = await this.eventoPropio(user, a.eventoId);
    return { acceso: a, evento: e };
  }

  // Revisa nombre, puerta y que los tipos de entrada sean del evento
  private normalizar(datos: DatosAcceso, tiposDelEvento: { id: string }[]) {
    const out: DatosAcceso = {};
    if (datos.nombre !== undefined) {
      const n = datos.nombre.trim();
      if (n.length < 2) throw new BadRequestException('Escribe el nombre de la persona o del puesto');
      out.nombre = n.slice(0, 60);
    }
    if (datos.puerta !== undefined) out.puerta = datos.puerta?.trim() ? datos.puerta.trim().slice(0, 60) : null;
    if (datos.tiposEntradaIds !== undefined) {
      const ids = [...new Set(datos.tiposEntradaIds)];
      const validos = new Set(tiposDelEvento.map((t) => t.id));
      if (ids.some((id) => !validos.has(id))) throw new BadRequestException('Uno de los tipos de entrada no pertenece a este evento');
      // Elegir todos los tipos equivale a no limitar (así un tipo nuevo también queda incluido)
      out.tiposEntradaIds = ids.length === validos.size ? [] : ids;
    }
    if (datos.permiteEstacionamiento !== undefined) out.permiteEstacionamiento = datos.permiteEstacionamiento;
    return out;
  }

  private nuevoCodigo() {
    const codigo = `VAL-${bloque()}-${bloque()}`;
    return { codigo, codigoHash: hash(codigo) };
  }

  private estado(a: { revocadoEn: Date | null; vinculadoEn: Date | null }, fechaEvento: Date): Estado {
    if (a.revocadoEn) return 'REVOCADO';
    if (venceAcceso(fechaEvento) < new Date()) return 'VENCIDO';
    return a.vinculadoEn ? 'ACTIVO' : 'PENDIENTE';
  }

  // Equipo del evento con el estado de cada acceso y cuántos ingresos validó
  async listar(user: AuthenticatedUser, eventoId: string) {
    const e = await this.eventoPropio(user, eventoId);
    const accesos = await this.prisma.accesoValidador.findMany({
      where: { eventoId },
      orderBy: { fechaCreacion: 'asc' },
      select: {
        id: true, nombre: true, puerta: true, tiposEntradaIds: true, permiteEstacionamiento: true,
        vinculadoEn: true, dispositivo: true, ultimoUsoEn: true, revocadoEn: true, fechaCreacion: true,
        _count: { select: { entradasValidadas: true, validaciones: true } },
      },
    });
    const nombres = new Map(e.tiposEntrada.map((t) => [t.id, t.nombre]));
    return {
      evento: { id: e.id, titulo: e.title, fecha: e.date, estado: e.status, venceEn: venceAcceso(e.date), tieneEstacionamiento: e.estacionamiento === 'PAGADO' },
      tiposEntrada: e.tiposEntrada,
      accesos: accesos.map(({ _count, tiposEntradaIds, ...a }) => ({
        ...a,
        estado: this.estado(a, e.date),
        tiposEntradaIds,
        tiposEntrada: tiposEntradaIds.map((id) => ({ id, nombre: nombres.get(id) ?? 'Tipo eliminado' })),
        ingresos: _count.entradasValidadas,
        escaneos: _count.validaciones,
      })),
    };
  }

  async crear(user: AuthenticatedUser, eventoId: string, datos: DatosAcceso) {
    const e = await this.eventoPropio(user, eventoId);
    if (e.status === 'CANCELLED') throw new BadRequestException('El evento está cancelado');
    if (venceAcceso(e.date) < new Date()) throw new BadRequestException('El evento ya terminó');
    const activos = await this.prisma.accesoValidador.count({ where: { eventoId, revocadoEn: null } });
    if (activos >= MAX_ACCESOS) throw new ConflictException(`Puedes tener hasta ${MAX_ACCESOS} accesos activos por evento`);
    const d = this.normalizar({ tiposEntradaIds: [], permiteEstacionamiento: true, ...datos }, e.tiposEntrada);
    if (!d.nombre) throw new BadRequestException('Escribe el nombre de la persona o del puesto');
    const { codigo, codigoHash } = this.nuevoCodigo();
    const a = await this.prisma.accesoValidador.create({
      data: { eventoId, creadoPorId: user.sub, codigoHash, nombre: d.nombre, puerta: d.puerta ?? null, tiposEntradaIds: d.tiposEntradaIds ?? [], permiteEstacionamiento: d.permiteEstacionamiento ?? true },
      select: { id: true },
    });
    return { id: a.id, codigo, venceEn: venceAcceso(e.date) };
  }

  // Cambiar nombre, puerta o tipos permitidos rige de inmediato (el celular no necesita volver a vincularse)
  async actualizar(user: AuthenticatedUser, id: string, datos: DatosAcceso) {
    const { acceso, evento } = await this.accesoPropio(user, id);
    if (acceso.revocadoEn) throw new BadRequestException('Este acceso está revocado');
    const d = this.normalizar(datos, evento.tiposEntrada);
    await this.prisma.accesoValidador.update({ where: { id }, data: d });
    return { ok: true };
  }

  // Nuevo código de vinculación: el celular anterior queda desvinculado
  async regenerarCodigo(user: AuthenticatedUser, id: string) {
    const { acceso, evento } = await this.accesoPropio(user, id);
    if (acceso.revocadoEn) throw new BadRequestException('Este acceso está revocado');
    if (venceAcceso(evento.date) < new Date()) throw new BadRequestException('El evento ya terminó');
    const { codigo, codigoHash } = this.nuevoCodigo();
    await this.prisma.accesoValidador.update({
      where: { id },
      data: { codigoHash, version: { increment: 1 }, vinculadoEn: null, dispositivo: null },
    });
    return { id, codigo, venceEn: venceAcceso(evento.date) };
  }

  // Revoca el acceso: el celular deja de poder validar en su próximo escaneo
  async revocar(user: AuthenticatedUser, id: string) {
    const { acceso } = await this.accesoPropio(user, id);
    if (!acceso.revocadoEn) {
      await this.prisma.accesoValidador.update({ where: { id }, data: { revocadoEn: new Date(), codigoHash: null } });
    }
    return { ok: true };
  }

  // Vincula un celular con el código de un solo uso y le entrega su token de validador
  async vincular(codigo: string, dispositivo?: string) {
    const a = await this.prisma.accesoValidador.findUnique({
      where: { codigoHash: hash(codigo) },
      select: {
        id: true, nombre: true, puerta: true, tiposEntradaIds: true, permiteEstacionamiento: true, version: true, revocadoEn: true,
        evento: { select: { id: true, title: true, date: true, address: true, status: true, tiposEntrada: { select: { id: true, nombre: true } } } },
      },
    });
    if (!a || a.revocadoEn) throw new UnauthorizedException('El código no es válido o ya se usó. Pide uno nuevo al organizador.');
    const vence = venceAcceso(a.evento.date);
    if (vence < new Date()) throw new UnauthorizedException('El evento ya terminó');
    if (a.evento.status === 'CANCELLED') throw new UnauthorizedException('El evento está cancelado');

    // Un solo uso: el código se borra al vincular (si dos celulares lo usan a la vez, solo uno lo logra)
    const usado = await this.prisma.accesoValidador.updateMany({
      where: { id: a.id, codigoHash: hash(codigo) },
      data: { codigoHash: null, vinculadoEn: new Date(), dispositivo: dispositivo?.trim().slice(0, 80) || null },
    });
    if (usado.count !== 1) throw new UnauthorizedException('El código ya se usó. Pide uno nuevo al organizador.');

    const segundos = Math.max(60, Math.floor((vence.getTime() - Date.now()) / 1000));
    const accessToken = this.jwt.sign({ sub: a.id, purpose: PROPOSITO_VALIDADOR, v: a.version }, { secret: JWT_SECRET, expiresIn: segundos });
    const nombres = new Map(a.evento.tiposEntrada.map((t) => [t.id, t.nombre]));
    return {
      accessToken,
      venceEn: vence,
      acceso: {
        id: a.id,
        nombre: a.nombre,
        puerta: a.puerta,
        todosLosTipos: !a.tiposEntradaIds.length,
        tiposEntrada: a.tiposEntradaIds.map((id) => ({ id, nombre: nombres.get(id) ?? 'Tipo eliminado' })),
        permiteEstacionamiento: a.permiteEstacionamiento,
      },
      evento: { id: a.evento.id, titulo: a.evento.title, fecha: a.evento.date, direccion: a.evento.address },
    };
  }
}
