import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import sharp from 'sharp';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CorreoService } from '../correo/correo.service';
import { correoContrasenaActualizada } from '../correo/plantillas';
import { JWT_SECRET } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { normalizeRut } from '../auth/rut.util';
import { ModeracionImagenService } from '../ia/moderacion-imagen.service';
import { ActualizarCuentaDto, CambiarContrasenaDto } from './dto/cuenta.dto';

const CARPETA = join(process.cwd(), 'uploads');

// Celular a formato "+56912345678"
export const normalizarCelular = (v: string) => {
  const digitos = v.replace(/\D/g, '');
  return `+56${digitos.slice(-9)}`;
};

const cuentaSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  fotoPerfil: true,
  telefono: true,
  rut: true,
  organizerProfile: {
    select: { status: true, organizationName: true, rut: true, phone: true, eventDescription: true, socialUrl: true, reviewedAt: true },
  },
} as const;

@Injectable()
export class CuentaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly correo: CorreoService,
    private readonly moderacionImagen: ModeracionImagenService,
  ) {}

  async obtener(user: AuthenticatedUser) {
    const u = await this.prisma.user.findUnique({ where: { id: user.sub }, select: cuentaSelect });
    if (!u) throw new NotFoundException('Cuenta no encontrada');
    return u;
  }

  async actualizar(user: AuthenticatedUser, dto: ActualizarCuentaDto) {
    const esOrganizador = user.role === 'ORGANIZER';
    const datosAsistente = dto.telefono !== undefined || dto.rut !== undefined;
    const datosOrganizador = dto.phone !== undefined || dto.eventDescription !== undefined || dto.socialUrl !== undefined;
    if (esOrganizador && datosAsistente) throw new BadRequestException('Como organizador, tu celular y RUT están en tu perfil de organizador');
    if (!esOrganizador && datosOrganizador) throw new BadRequestException('Estos datos solo aplican a organizadores');

    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono ? normalizarCelular(dto.telefono) : null }),
        ...(dto.rut !== undefined && { rut: dto.rut ? normalizeRut(dto.rut) : null }),
        ...(esOrganizador && datosOrganizador && {
          organizerProfile: {
            update: {
              ...(dto.phone !== undefined && { phone: normalizarCelular(dto.phone) }),
              ...(dto.eventDescription !== undefined && { eventDescription: dto.eventDescription }),
              ...(dto.socialUrl !== undefined && { socialUrl: dto.socialUrl }),
            },
          },
        }),
      },
    });
    return this.obtener(user);
  }

  // Foto de perfil. Organizadores: su logo completo, sin recortar y con transparencia (máx. 512 px).
  // Asistentes: foto cuadrada recortada al centro de interés (400 px). Siempre se guarda en WebP liviano.
  async guardarFoto(user: AuthenticatedUser, archivo: Buffer) {
    let procesada: Buffer;
    try {
      const base = sharp(archivo, { failOn: 'error' }).rotate(); // respeta la orientación de fotos de celular
      procesada = user.role === 'ORGANIZER'
        ? await base.resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 }).toBuffer()
        : await base.resize(400, 400, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException('No pudimos leer la imagen. Usa un archivo JPG, PNG o WebP válido.');
    }

    const revision = await this.moderacionImagen.revisar(procesada, 'image/webp');
    if (revision.estado === 'RECHAZADA') {
      throw new BadRequestException({ message: revision.mensaje, code: 'IMAGEN_RECHAZADA', motivo: revision.motivo });
    }

    await mkdir(CARPETA, { recursive: true });
    const nombre = `perfil-${user.sub}-${Date.now()}.webp`;
    await writeFile(join(CARPETA, nombre), procesada);
    const anterior = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { fotoPerfil: true } });
    await this.prisma.user.update({ where: { id: user.sub }, data: { fotoPerfil: `/uploads/${nombre}` } });
    await this.borrarArchivo(anterior?.fotoPerfil);
    return this.obtener(user);
  }

  async quitarFoto(user: AuthenticatedUser) {
    const anterior = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { fotoPerfil: true } });
    await this.prisma.user.update({ where: { id: user.sub }, data: { fotoPerfil: null } });
    await this.borrarArchivo(anterior?.fotoPerfil);
    return this.obtener(user);
  }

  private async borrarArchivo(ruta?: string | null) {
    if (ruta?.startsWith('/uploads/perfil-')) await unlink(join(process.cwd(), ruta)).catch(() => {});
  }

  // Cambio de contraseña con la actual. Cierra las sesiones de otros dispositivos (los tokens emitidos
  // antes dejan de servir) y entrega un token nuevo para que esta sesión siga abierta. Avisa por correo.
  async cambiarContrasena(user: AuthenticatedUser, dto: CambiarContrasenaDto) {
    const u = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { email: true, name: true, role: true, password: true } });
    if (!u) throw new NotFoundException('Cuenta no encontrada');
    if (!(await bcrypt.compare(dto.actual, u.password))) {
      throw new UnauthorizedException({ message: 'La contraseña actual no es correcta', code: 'CONTRASENA_INCORRECTA' });
    }
    if (dto.actual === dto.nueva) throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');

    // Al segundo exacto: el token nuevo (iat en segundos) debe quedar vigente y los anteriores no
    const fecha = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { password: await bcrypt.hash(dto.nueva, 10), contrasenaCambiadaEn: fecha },
    });
    void this.correo.enviar({ para: u.email, ...correoContrasenaActualizada({ nombre: u.name, fecha }) });
    return {
      mensaje: 'Actualizamos tu contraseña. Cerramos tu sesión en los demás dispositivos.',
      accessToken: this.jwt.sign({ sub: user.sub, email: u.email, role: u.role }, { secret: JWT_SECRET, expiresIn: '7d' }),
    };
  }
}
