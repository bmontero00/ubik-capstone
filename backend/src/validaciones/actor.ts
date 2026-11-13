import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_SECRET, JwtAuthGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { PrismaService } from '../prisma/prisma.service';

// Quien valida en el acceso: el organizador con su cuenta, o alguien de su equipo con un acceso
// vinculado a un solo evento (token con purpose "validador", que el resto de la API rechaza).
export interface AccesoActivo {
  id: string;
  eventoId: string;
  nombre: string;
  puerta: string | null;
  tiposEntradaIds: string[]; // vacío = todos los tipos
  permiteEstacionamiento: boolean;
}

export type Actor =
  | { tipo: 'usuario'; user: AuthenticatedUser }
  | { tipo: 'validador'; acceso: AccesoActivo };

export const PROPOSITO_VALIDADOR = 'validador';
const HORA = 3_600_000;

// El acceso del equipo vence 12 horas después del inicio del evento (sigue la fecha si se posterga)
export const venceAcceso = (fechaEvento: Date) => new Date(fechaEvento.getTime() + 12 * HORA);

export const nombreValidador = (a: { nombre: string; puerta: string | null }) => (a.puerta ? `${a.nombre} · ${a.puerta}` : a.nombre);

@Injectable()
export class ValidacionAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly jwtGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Debes iniciar sesión para realizar esta acción');

    let payload: { sub: string; purpose?: string; v?: number };
    try {
      payload = this.jwtService.verify(token, { secret: JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Tu sesión expiró, vuelve a iniciar sesión');
    }

    if (payload.purpose === PROPOSITO_VALIDADOR) {
      const a = await this.prisma.accesoValidador.findUnique({
        where: { id: payload.sub },
        select: {
          id: true, eventoId: true, nombre: true, puerta: true, tiposEntradaIds: true, permiteEstacionamiento: true,
          version: true, revocadoEn: true, evento: { select: { date: true } },
        },
      });
      if (!a || a.version !== payload.v) throw new UnauthorizedException('Este celular ya no está vinculado: pide un nuevo código al organizador');
      if (a.revocadoEn) throw new UnauthorizedException('El organizador revocó este acceso');
      if (venceAcceso(a.evento.date) < new Date()) throw new UnauthorizedException('El acceso venció: el evento ya terminó');
      const { version, revocadoEn, evento, ...acceso } = a;
      request.actor = { tipo: 'validador', acceso } satisfies Actor;
      return true;
    }

    // Organizador o administrador con su sesión normal
    await this.jwtGuard.canActivate(context);
    const user: AuthenticatedUser = request.user;
    if (user.role !== 'ORGANIZER' && user.role !== 'ADMIN') throw new ForbiddenException('No tienes permisos para realizar esta acción');
    request.actor = { tipo: 'usuario', user } satisfies Actor;
    return true;
  }
}

export const ActorActual = createParamDecorator((_d: unknown, context: ExecutionContext): Actor => context.switchToHttp().getRequest().actor);
