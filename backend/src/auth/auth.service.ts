import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrganizerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ReapplyDto } from './dto/reapply.dto';
import { normalizeRut } from './rut.util';
import { JWT_SECRET } from './auth.guards';
import { accountSuspendedError } from './account-status';
import * as bcrypt from 'bcrypt';

// Campos públicos del usuario, incluidos el estado de la cuenta y de su solicitud de organizador
const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  status: true,
  statusReason: true,
  statusChangedAt: true,
  organizerProfile: {
    select: { status: true, rejectionReason: true, organizationName: true },
  },
} satisfies Prisma.UserSelect;

type PublicUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

const REAPPLY_PURPOSE = 'organizer-reapply';

// Mensaje cuando el correo ya está registrado, según el estado de la última solicitud
const EMAIL_IN_USE_MESSAGES: Record<OrganizerStatus | 'DEFAULT', string> = {
  PENDING:
    'Ya existe una solicitud de organizador en revisión con este correo. Te avisaremos cuando un administrador la revise.',
  REJECTED:
    'La última solicitud de organizador con este correo fue rechazada. Inicia sesión con ese correo para ver el motivo y volver a postular.',
  APPROVED: 'Ya existe una cuenta activa con este correo.',
  DEFAULT: 'Ya existe una cuenta activa con este correo.',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { status: true, organizerProfile: { select: { status: true } } },
    });

    if (existingUser) {
      const organizerStatus = existingUser.organizerProfile?.status ?? null;
      throw new ConflictException({
        statusCode: 409,
        code: 'EMAIL_IN_USE',
        message: EMAIL_IN_USE_MESSAGES[organizerStatus ?? 'DEFAULT'],
        organizerStatus,
      });
    }

    const isOrganizer = dto.accountType === 'ORGANIZER';
    const rut = isOrganizer ? normalizeRut(dto.rut!) : null;
    if (rut) await this.assertRutAvailable(rut);

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: isOrganizer ? 'ORGANIZER' : 'ATTENDEE',
        organizerProfile: rut
          ? {
              create: {
                rut,
                phone: dto.phone!.replace(/\s/g, ''),
                organizationName: dto.organizationName?.trim() || null,
                eventDescription: dto.eventDescription!.trim(),
                socialUrl: dto.socialUrl?.trim() || null,
              },
            }
          : undefined,
      },
      select: userSelect,
    });

    return {
      message: isOrganizer
        ? 'Solicitud de organizador enviada. Te avisaremos cuando sea revisada.'
        : 'Usuario registrado exitosamente',
      user: this.toPublicUser(user),
      accessToken: this.generateToken(user.id, user.email, user.role),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        ...userSelect,
        password: true,
        organizerProfile: {
          select: {
            status: true,
            rejectionReason: true,
            reviewedAt: true,
            organizationName: true,
            rut: true,
            phone: true,
            eventDescription: true,
            socialUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status === 'SUSPENDED') throw accountSuspendedError(user);

    // Organizador rechazado: en vez de sesión recibe lo necesario para volver a postular
    const profile = user.organizerProfile;
    if (user.role === 'ORGANIZER' && profile?.status === 'REJECTED') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ORGANIZER_REJECTED',
        message: 'La creación de tu cuenta de organizador fue rechazada por un administrador.',
        reason: profile.rejectionReason,
        reviewedAt: profile.reviewedAt,
        reapplyToken: this.jwtService.sign(
          { sub: user.id, purpose: REAPPLY_PURPOSE },
          { secret: JWT_SECRET, expiresIn: '30m' },
        ),
        application: {
          name: user.name,
          email: user.email,
          rut: profile.rut,
          phone: profile.phone,
          organizationName: profile.organizationName,
          eventDescription: profile.eventDescription,
          socialUrl: profile.socialUrl,
        },
      });
    }

    const { password: _password, ...publicUser } = user;
    return {
      message: 'Inicio de sesión exitoso',
      user: this.toPublicUser(publicUser),
      accessToken: this.generateToken(user.id, user.email, user.role),
    };
  }

  // Un organizador rechazado envía una nueva solicitud (retomando la anterior o desde cero)
  async reapply(dto: ReapplyDto) {
    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string; purpose?: string }>(dto.reapplyToken, { secret: JWT_SECRET });
      if (payload.purpose !== REAPPLY_PURPOSE) throw new Error();
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('El tiempo para volver a postular expiró. Inicia sesión nuevamente.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, statusReason: true, statusChangedAt: true, organizerProfile: { select: { id: true, status: true } } },
    });
    if (!user?.organizerProfile) throw new NotFoundException('Solicitud no encontrada');
    if (user.status === 'SUSPENDED') throw accountSuspendedError(user);
    if (user.organizerProfile.status !== 'REJECTED') {
      throw new BadRequestException('Tu solicitud ya no está rechazada, inicia sesión nuevamente.');
    }

    const rut = normalizeRut(dto.rut);
    await this.assertRutAvailable(rut, user.organizerProfile.id);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name.trim(),
        organizerProfile: {
          update: {
            rut,
            phone: dto.phone.replace(/\s/g, ''),
            organizationName: dto.organizationName?.trim() || null,
            eventDescription: dto.eventDescription.trim(),
            socialUrl: dto.socialUrl?.trim() || null,
            status: 'PENDING',
            rejectionReason: null,
            approvalNote: null,
            reviewedAt: null,
            reviewedById: null,
          },
        },
      },
      select: userSelect,
    });

    return {
      message: 'Nueva solicitud enviada. Un administrador la revisará nuevamente.',
      user: this.toPublicUser(updated),
      accessToken: this.generateToken(updated.id, updated.email, updated.role),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toPublicUser(user);
  }

  private async assertRutAvailable(rut: string, ownProfileId?: string) {
    const rutInUse = await this.prisma.organizerProfile.findUnique({ where: { rut }, select: { id: true } });
    if (rutInUse && rutInUse.id !== ownProfileId) {
      throw new ConflictException('Ya existe una cuenta de organizador asociada a este RUT');
    }
  }

  // Aplana el perfil de organizador para que el frontend lea user.organizerStatus
  private toPublicUser({ organizerProfile, ...user }: PublicUser) {
    return {
      ...user,
      organizerStatus: organizerProfile?.status ?? null,
      rejectionReason: organizerProfile?.rejectionReason ?? null,
      organizationName: organizerProfile?.organizationName ?? null,
    };
  }

  private generateToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({ sub: userId, email, role }, { secret: JWT_SECRET, expiresIn: '7d' });
  }
}
