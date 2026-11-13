import { BadRequestException, Controller, Get, HttpCode, HttpException, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { Limitador } from '../common/limitador';
import { Periodo, ReportesService } from './reportes.service';
import { ReportesPlataformaService } from './reportes-plataforma.service';
import { inicioDelDiaEnChile } from '../common/fecha-chile';

const DIA = 86_400_000;
const limiteAnalisis = new Limitador(10, 3_600_000);

// Período desde la query: ?desde=2026-10-01&hasta=2026-10-31 (por defecto, los últimos 30 días)
// Los días se cuentan en hora de Chile (con su horario de verano e invierno)
const diaValido = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const inicioDe = (v: string) => inicioDelDiaEnChile(new Date(`${v}T12:00:00Z`));

function periodo(desde?: string, hasta?: string, eventoId?: string): Periodo {
  if ((desde && !diaValido(desde)) || (hasta && !diaValido(hasta))) throw new BadRequestException('Las fechas deben tener formato AAAA-MM-DD');
  const fin = hasta ? new Date(inicioDe(new Date(new Date(`${hasta}T12:00:00Z`).getTime() + DIA).toISOString().slice(0, 10)).getTime() - 1) : new Date();
  const inicio = desde ? inicioDe(desde) : new Date(fin.getTime() - 30 * DIA);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || inicio > fin) throw new BadRequestException('El período no es válido');
  if (fin.getTime() - inicio.getTime() > 3 * 366 * DIA) throw new BadRequestException('El período puede ser de hasta 3 años');
  if (eventoId && !/^[0-9a-f-]{36}$/i.test(eventoId)) throw new BadRequestException('El evento no es válido');
  return { desde: inicio, hasta: fin, eventoId: eventoId || undefined };
}

// Reportes de ventas para el organizador (solo de sus propios eventos)
@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ORGANIZER', 'ADMIN')
export class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly plataforma: ReportesPlataformaService,
  ) {}

  // Reportes de toda la plataforma: solo administradores
  @Get('plataforma/resumen')
  @Roles('ADMIN')
  plataformaResumen(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.plataforma.resumen(periodo(desde, hasta));
  }

  @Get('plataforma/ventas')
  @Roles('ADMIN')
  plataformaVentas(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.plataforma.ventas(periodo(desde, hasta));
  }

  @Get('plataforma/desglose')
  @Roles('ADMIN')
  plataformaDesglose(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.plataforma.desglose(periodo(desde, hasta));
  }

  @Get('resumen')
  resumen(@CurrentUser() user: AuthenticatedUser, @Query('desde') desde?: string, @Query('hasta') hasta?: string, @Query('eventoId') eventoId?: string) {
    return this.reportes.resumen(user, periodo(desde, hasta, eventoId));
  }

  @Get('ventas')
  ventas(@CurrentUser() user: AuthenticatedUser, @Query('desde') desde?: string, @Query('hasta') hasta?: string, @Query('eventoId') eventoId?: string) {
    return this.reportes.ventas(user, periodo(desde, hasta, eventoId));
  }

  @Get('eventos')
  eventos(@CurrentUser() user: AuthenticatedUser, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.eventos(user, periodo(desde, hasta));
  }

  @Get('eventos/:id')
  detalle(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportes.detalleEvento(user, id);
  }

  // Lista de acceso con RUT para validar en la puerta (y base para la futura app de validación)
  @Get('eventos/:id/asistentes')
  asistentes(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportes.asistentes(user, id);
  }

  @Post('analisis')
  @HttpCode(200)
  analisis(@CurrentUser() user: AuthenticatedUser, @Query('desde') desde?: string, @Query('hasta') hasta?: string, @Query('eventoId') eventoId?: string) {
    if (!limiteAnalisis.permitir(user.sub)) {
      throw new HttpException('Alcanzaste el límite de análisis por ahora. Vuelve a intentarlo en un rato.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.reportes.analisis(user, periodo(desde, hasta, eventoId));
  }
}
