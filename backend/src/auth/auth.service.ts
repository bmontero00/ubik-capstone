import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { normalizeRut } from './rut.util';
import { JWT_SECRET } from './auth.guards';
import * as bcrypt from 'bcrypt';

// Campos públicos del usuario, incluido el estado de su solicitud de organizador
const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  organizerProfile: {
    select: { status: true, rejectionReason: true, organizationName: true },
  },
} satisfies Prisma.UserSelect;

type PublicUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const isOrganizer = dto.accountType === 'ORGANIZER';
    const rut = isOrganizer ? normalizeRut(dto.rut!) : null;

    if (rut) {
      const rutInUse = await this.prisma.organizerProfile.findUnique({ where: { rut } });
      if (rutInUse) {
        throw new ConflictException('Ya existe una cuenta de organizador asociada a este RUT');
      }
    }

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
      select: { ...userSelect, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { password: _password, ...publicUser } = user;
    return {
      message: 'Inicio de sesión exitoso',
      user: this.toPublicUser(publicUser),
      accessToken: this.generateToken(user.id, user.email, user.role),
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
