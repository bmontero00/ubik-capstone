import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CLAVE_PORCENTAJE_CARGO, PORCENTAJE_CARGO_INICIAL } from './cargos';

// Parámetros de la plataforma que un administrador puede cambiar sin tocar el código
@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  // % de cargo que se fija a los eventos que se crean ahora
  async porcentajeCargoVigente(): Promise<number> {
    const parametro = await this.prisma.parametroPlataforma.findUnique({ where: { clave: CLAVE_PORCENTAJE_CARGO } });
    const valor = Number(parametro?.valor);
    return Number.isFinite(valor) ? valor : PORCENTAJE_CARGO_INICIAL;
  }

  async detallePorcentajeCargo() {
    const [parametro, historial] = await Promise.all([
      this.prisma.parametroPlataforma.findUnique({
        where: { clave: CLAVE_PORCENTAJE_CARGO },
        include: { actualizadoPor: { select: { id: true, name: true } } },
      }),
      this.prisma.historialParametro.findMany({
        where: { clave: CLAVE_PORCENTAJE_CARGO },
        include: { admin: { select: { id: true, name: true } } },
        orderBy: { fecha: 'desc' },
        take: 20,
      }),
    ]);
    return {
      porcentaje: await this.porcentajeCargoVigente(),
      actualizadoEn: parametro?.fechaActualizacion ?? null,
      actualizadoPor: parametro?.actualizadoPor ?? null,
      historial,
    };
  }

  // Cambia el % para los eventos que se creen desde ahora; los existentes conservan el suyo
  async cambiarPorcentajeCargo(porcentaje: number, motivo: string, adminId: string) {
    const anterior = await this.porcentajeCargoVigente();
    if (anterior === porcentaje) throw new BadRequestException('El porcentaje nuevo es igual al vigente');
    await this.prisma.$transaction([
      this.prisma.parametroPlataforma.upsert({
        where: { clave: CLAVE_PORCENTAJE_CARGO },
        create: { clave: CLAVE_PORCENTAJE_CARGO, valor: String(porcentaje), actualizadoPorId: adminId },
        update: { valor: String(porcentaje), actualizadoPorId: adminId },
      }),
      this.prisma.historialParametro.create({
        data: { clave: CLAVE_PORCENTAJE_CARGO, valorAnterior: String(anterior), valorNuevo: String(porcentaje), motivo, adminId },
      }),
    ]);
    return this.detallePorcentajeCargo();
  }
}
