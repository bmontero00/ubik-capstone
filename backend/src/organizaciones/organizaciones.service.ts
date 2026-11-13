import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeRut } from '../auth/rut.util';
import { compararNombres, normalizarNombre } from './nombre-organizacion';

// Organizaciones a las que pertenecen los organizadores. Reglas:
// - El RUT de la organización es único: con un RUT ya registrado no se crea otra, la persona se suma
//   a la existente (y un administrador de UBIK aprueba su solicitud).
// - No se puede crear una organización nueva con el mismo nombre que una ya verificada.
// - Los nombres parecidos no se bloquean, pero se le muestran al administrador como alerta.
// - "organizationName" del perfil es la copia del nombre que ve el público; se sincroniza aquí.

export type TipoOrganizador = 'PERSONAL' | 'ORGANIZACION';

export interface DatosOrganizacion {
  tipo?: TipoOrganizador;
  rut?: string;
  nombre?: string;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class OrganizacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // Para el formulario de registro: si el RUT ya existe, se muestra a qué organización se sumará
  async buscarPorRut(rutIngresado: string) {
    const rut = normalizeRut(rutIngresado);
    const org = await this.prisma.organizacion.findUnique({ where: { rut }, select: { nombre: true, estado: true } });
    if (!org) return { existe: false as const };
    return { existe: true as const, nombre: org.nombre, verificada: org.estado === 'VERIFICADA', rechazada: org.estado === 'RECHAZADA' };
  }

  // Decide la organización de un perfil al registrarse o re-postular. Devuelve el id y el nombre público.
  // Debe llamarse dentro de la misma transacción que crea o actualiza el perfil.
  async resolver(tx: Tx, datos: DatosOrganizacion): Promise<{ organizacionId: string | null; organizationName: string | null }> {
    if (datos.tipo !== 'ORGANIZACION') return { organizacionId: null, organizationName: null };
    if (!datos.rut) throw new BadRequestException('Ingresa el RUT de la organización');
    const rut = normalizeRut(datos.rut);

    const existente = await tx.organizacion.findUnique({ where: { rut } });
    if (existente) {
      if (existente.estado === 'RECHAZADA') {
        throw new BadRequestException('Esa organización no fue aprobada en UBIK. Si crees que es un error, escríbenos a soporte@ubik.cl.');
      }
      return { organizacionId: existente.id, organizationName: existente.nombre };
    }

    const nombre = datos.nombre?.trim().replace(/\s+/g, ' ') ?? '';
    if (nombre.length < 2) throw new BadRequestException('Escribe el nombre de la organización');
    const nombreNormalizado = normalizarNombre(nombre);
    const verificadas = await tx.organizacion.findMany({ where: { estado: 'VERIFICADA' }, select: { nombre: true, nombreNormalizado: true } });
    const igual = verificadas.find((o) => compararNombres(o.nombreNormalizado, nombreNormalizado) === 'igual');
    if (igual) {
      throw new ConflictException({
        code: 'ORGANIZACION_EXISTE',
        message: `Ya existe una organización verificada llamada "${igual.nombre}". Si perteneces a ella, ingresa su RUT para sumarte.`,
      });
    }
    try {
      const org = await tx.organizacion.create({ data: { nombre: nombre.slice(0, 120), nombreNormalizado, rut } });
      return { organizacionId: org.id, organizationName: org.nombre };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Otra persona acaba de registrar esa organización. Vuelve a intentarlo para sumarte a ella.');
      }
      throw e;
    }
  }

  // Organizaciones con nombre igual o parecido (alerta para el administrador)
  async parecidas(org: { id: string; nombreNormalizado: string }) {
    const otras = await this.prisma.organizacion.findMany({
      where: { id: { not: org.id }, estado: { not: 'RECHAZADA' } },
      select: { id: true, nombre: true, nombreNormalizado: true, rut: true, estado: true },
    });
    return otras
      .map((o) => ({ ...o, coincidencia: compararNombres(o.nombreNormalizado, org.nombreNormalizado) }))
      .filter((o) => o.coincidencia)
      .map(({ nombreNormalizado, ...o }) => o);
  }

  // --- Administración ---

  async listar() {
    const orgs = await this.prisma.organizacion.findMany({
      orderBy: [{ estado: 'asc' }, { nombre: 'asc' }],
      include: {
        verificadaPor: { select: { name: true } },
        miembros: { select: { id: true, status: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    return orgs.map((o) => {
      const parecidas = orgs
        .filter((x) => x.id !== o.id && x.estado !== 'RECHAZADA')
        .map((x) => ({ id: x.id, nombre: x.nombre, rut: x.rut, estado: x.estado, coincidencia: compararNombres(x.nombreNormalizado, o.nombreNormalizado) }))
        .filter((x) => x.coincidencia);
      return {
        id: o.id,
        nombre: o.nombre,
        rut: o.rut,
        estado: o.estado,
        motivoRechazo: o.motivoRechazo,
        verificadaEn: o.verificadaEn,
        verificadaPor: o.verificadaPor?.name ?? null,
        fechaCreacion: o.fechaCreacion,
        miembros: o.miembros.map((m) => ({ perfilId: m.id, estado: m.status, nombre: m.user.name, email: m.user.email })),
        parecidas,
      };
    });
  }

  // El nombre público de todos sus miembros sigue al de la organización
  private sincronizar(tx: Tx, organizacionId: string, nombre: string | null) {
    return tx.organizerProfile.updateMany({ where: { organizacionId }, data: { organizationName: nombre } });
  }

  async verificar(id: string, adminId: string, datos: { rut?: string; nombre?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organizacion.findUnique({ where: { id } });
      if (!org) throw new NotFoundException('Organización no encontrada');
      const rut = datos.rut ? normalizeRut(datos.rut) : org.rut;
      if (!rut) throw new BadRequestException('Para verificar la organización ingresa su RUT');
      if (rut !== org.rut) {
        const otra = await tx.organizacion.findUnique({ where: { rut }, select: { nombre: true } });
        if (otra) throw new ConflictException(`Ese RUT ya pertenece a "${otra.nombre}". Si son la misma, fusiónalas.`);
      }
      const nombre = datos.nombre?.trim() || org.nombre;
      const actualizada = await tx.organizacion.update({
        where: { id },
        data: { rut, nombre, nombreNormalizado: normalizarNombre(nombre), estado: 'VERIFICADA', motivoRechazo: null, verificadaEn: new Date(), verificadaPorId: adminId },
      });
      await this.sincronizar(tx, id, nombre);
      return actualizada;
    });
  }

  // Rechazar: sus miembros pasan a organizar a título personal (el público ve su nombre)
  async rechazar(id: string, motivo: string) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organizacion.findUnique({ where: { id }, select: { id: true } });
      if (!org) throw new NotFoundException('Organización no encontrada');
      await tx.organizerProfile.updateMany({ where: { organizacionId: id }, data: { organizacionId: null, organizationName: null } });
      return tx.organizacion.update({ where: { id }, data: { estado: 'RECHAZADA', motivoRechazo: motivo, verificadaEn: null, verificadaPorId: null } });
    });
  }

  async editar(id: string, datos: { nombre?: string; rut?: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organizacion.findUnique({ where: { id } });
      if (!org) throw new NotFoundException('Organización no encontrada');
      const nombre = datos.nombre?.trim() || org.nombre;
      let rut = org.rut;
      if (datos.rut !== undefined) {
        rut = datos.rut ? normalizeRut(datos.rut) : null;
        if (!rut && org.estado === 'VERIFICADA') throw new BadRequestException('Una organización verificada debe tener RUT');
        if (rut && rut !== org.rut) {
          const otra = await tx.organizacion.findUnique({ where: { rut }, select: { nombre: true } });
          if (otra) throw new ConflictException(`Ese RUT ya pertenece a "${otra.nombre}". Si son la misma, fusiónalas.`);
        }
      }
      const actualizada = await tx.organizacion.update({ where: { id }, data: { nombre, nombreNormalizado: normalizarNombre(nombre), rut } });
      if (org.estado !== 'RECHAZADA') await this.sincronizar(tx, id, nombre);
      return actualizada;
    });
  }

  // Fusiona una organización duplicada en otra: sus miembros pasan a la de destino y la duplicada se borra
  async fusionar(origenId: string, destinoId: string) {
    if (origenId === destinoId) throw new BadRequestException('Elige otra organización de destino');
    return this.prisma.$transaction(async (tx) => {
      const [origen, destino] = await Promise.all([
        tx.organizacion.findUnique({ where: { id: origenId }, select: { id: true } }),
        tx.organizacion.findUnique({ where: { id: destinoId }, select: { id: true, nombre: true, estado: true } }),
      ]);
      if (!origen || !destino) throw new NotFoundException('Organización no encontrada');
      if (destino.estado === 'RECHAZADA') throw new BadRequestException('No puedes fusionar en una organización rechazada');
      const movidos = await tx.organizerProfile.updateMany({ where: { organizacionId: origenId }, data: { organizacionId: destinoId, organizationName: destino.nombre } });
      await tx.organizacion.delete({ where: { id: origenId } });
      return { movidos: movidos.count, destino: destino.nombre };
    });
  }
}
