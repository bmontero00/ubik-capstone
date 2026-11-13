import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { AccountStatus, EventStatus, OrganizerStatus, Role } from '@prisma/client';
import { IsIn, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { AdminService } from './admin.service';
import { CargosAdminService } from './cargos-admin.service';
import { PORCENTAJE_CARGO_MAX } from '../parametros/cargos';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { IsReason } from '../common/reason.validator';

// Todo cambio de estado exige un motivo (ver IsReason)
class ReviewOrganizerDto {
  @IsReason()
  reason: string;

  // Al aprobar: qué hacer con su organización. VERIFICAR la deja verificada (necesita RUT),
  // MANTENER no la cambia (ej. se suma a una ya verificada) y QUITAR lo aprueba a título personal.
  @IsOptional()
  @IsIn(['VERIFICAR', 'MANTENER', 'QUITAR'], { message: 'Opción de organización no válida' })
  organizacion?: 'VERIFICAR' | 'MANTENER' | 'QUITAR';
}

class UpdateUserStatusDto {
  @IsIn(Object.values(AccountStatus), { message: 'Estado de cuenta no válido' })
  status: AccountStatus;

  @IsReason()
  reason: string;
}

class UpdateEventStatusDto {
  @IsIn(Object.values(EventStatus), { message: 'Estado de evento no válido' })
  status: EventStatus;

  @IsReason()
  reason: string;
}

// % de cargo por servicio: número entre 0 y el máximo permitido (admite decimales, ej. 7.5)
const IsPorcentaje = () => (target: object, key: string) => {
  Type(() => Number)(target, key);
  IsNumber({ maxDecimalPlaces: 2 }, { message: 'Indica un porcentaje válido' })(target, key);
  Min(0, { message: 'El porcentaje no puede ser negativo' })(target, key);
  Max(PORCENTAJE_CARGO_MAX, { message: `El porcentaje puede ser como máximo ${PORCENTAJE_CARGO_MAX}%` })(target, key);
};

class PorcentajeDto {
  @IsPorcentaje()
  porcentaje: number;

  @IsReason()
  reason: string;
}

class ResponderCondicionDto {
  @IsIn(['APROBADA', 'RECHAZADA'], { message: 'Decisión no válida' })
  decision: 'APROBADA' | 'RECHAZADA';

  // Solo al aprobar: el % definitivo para el evento
  @ValidateIf((o: ResponderCondicionDto) => o.decision === 'APROBADA')
  @IsPorcentaje()
  porcentaje?: number;

  @IsReason()
  reason: string;
}

// Devuelve el valor solo si pertenece al enum (filtros opcionales por query string)
const pick = <T extends string>(values: Record<string, T>, value?: string): T | undefined =>
  Object.values(values).includes(value as T) ? (value as T) : undefined;

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly cargosService: CargosAdminService,
  ) {}

  @Get('overview')
  overview() {
    return this.adminService.getOverview();
  }

  // GET /admin/organizers?status=PENDING
  @Get('organizers')
  listOrganizers(@Query('status') status?: string) {
    return this.adminService.listOrganizerRequests(pick(OrganizerStatus, status));
  }

  @Patch('organizers/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ReviewOrganizerDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminService.reviewOrganizer(id, admin.sub, true, dto.reason, dto.organizacion ?? 'MANTENER');
  }

  @Patch('organizers/:id/reject')
  reject(@Param('id') id: string, @Body() dto: ReviewOrganizerDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminService.reviewOrganizer(id, admin.sub, false, dto.reason);
  }

  // GET /admin/users?group=active|flagged&role=ATTENDEE&status=SUSPENDED&search=juan
  @Get('users')
  listUsers(
    @Query('group') group?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers({
      group: group === 'flagged' || group === 'rejected' ? group : 'active',
      role: pick(Role, role),
      status: pick(AccountStatus, status),
      search,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/status')
  updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminService.updateUserStatus(id, admin.sub, dto.status, dto.reason);
  }

  // GET /admin/events?status=CANCELLED,POSTPONED&search=feria (uno o varios estados)
  @Get('events')
  listEvents(@Query('status') status?: string, @Query('search') search?: string) {
    const statuses = (status ?? '').split(',').map((s) => pick(EventStatus, s.trim())).filter((s): s is EventStatus => !!s);
    return this.adminService.listEvents({ statuses, search });
  }

  @Patch('events/:id/status')
  updateEventStatus(@Param('id') id: string, @Body() dto: UpdateEventStatusDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminService.updateEventStatus(id, admin.sub, dto.status, dto.reason);
  }

  // --- Cargo por servicio ---

  @Get('cargos')
  cargos() {
    return this.cargosService.resumen();
  }

  // Nuevo % para los eventos que se creen desde ahora
  @Patch('cargos/porcentaje')
  cambiarPorcentajeGlobal(@Body() dto: PorcentajeDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.cargosService.cambiarPorcentajeGlobal(dto.porcentaje, dto.reason, admin.sub);
  }

  @Patch('events/:id/condicion')
  responderCondicion(@Param('id') id: string, @Body() dto: ResponderCondicionDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.cargosService.responderCondicion(id, admin.sub, dto.decision, dto.reason, dto.porcentaje);
  }

  @Patch('events/:id/cargo')
  cambiarPorcentajeEvento(@Param('id') id: string, @Body() dto: PorcentajeDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.cargosService.cambiarPorcentajeEvento(id, admin.sub, dto.porcentaje, dto.reason);
  }
}
