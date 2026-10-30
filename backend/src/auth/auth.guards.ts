import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { accountSuspendedError } from './account-status';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

// Lo que queda en request.user: el rol y el estado se leen de la base en cada request,
// así una suspensión o un cambio de rol aplica de inmediato aunque el token siga vigente
export interface AuthenticatedUser extends JwtPayload {
  status: AccountStatus;
}

export const JWT_SECRET = process.env.JWT_SECRET || 'UBIK_CAPSTONE_SECRET_KEY_2026';

// Verifica el token "Authorization: Bearer <token>" y deja el usuario en request.user
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Debes iniciar sesión para realizar esta acción');
    }

    let payload: JwtPayload & { purpose?: string };
    try {
      payload = this.jwtService.verify(token, { secret: JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Tu sesión expiró, vuelve a iniciar sesión');
    }
    // Los tokens de re-postulación no sirven como sesión
    if (payload.purpose) throw new UnauthorizedException('Debes iniciar sesión para realizar esta acción');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, status: true, statusReason: true, statusChangedAt: true },
    });
    if (!user) throw new UnauthorizedException('Tu sesión ya no es válida, vuelve a iniciar sesión');
    if (user.status === 'SUSPENDED') throw accountSuspendedError(user);

    request.user = { sub: payload.sub, email: payload.email, role: user.role, status: user.status } satisfies AuthenticatedUser;
    return true;
  }
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// Usar después de JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...)
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => context.switchToHttp().getRequest().user,
);
