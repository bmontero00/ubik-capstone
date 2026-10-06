import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Evitar correos duplicados
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya se encuentra registrado en UBIK');
    }

    // 2. Hash seguro de contraseña (Salt rounds = 10)
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. Persistir en PostgreSQL Supabase
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // 4. Firmar token JWT
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Usuario registrado exitosamente',
      user,
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    // 1. Buscar usuario en base de datos
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Comparar hash de contraseña
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generar token JWT
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken: token,
    };
  }

  private generateToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: process.env.JWT_SECRET || 'UBIK_JWT_DEV_SECRET_2026_CAPSTONE',
        expiresIn: '7d',
      },
    );
  }
}