import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AccountStatus, EventStatus, OrganizerStatus, Role } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminService } from './admin.service';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';

class RejectOrganizerDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class UpdateUserStatusDto {
  @IsIn(Object.values(AccountStatus), { message: 'Estado de cuenta no válido' })
  status: AccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class UpdateEventStatusDto {
  @IsIn(Object.values(EventStatus), { message: 'Estado de evento no válido' })
  status: EventStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// Devuelve el valor solo si pertenece al enum (filtros opcionales por query string)
const pick = <T extends string>(values: Record<string, T>, value?: string): T | undefined =>
  Object.values(values).includes(value as T) ? (value as T) : undefined;

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
  approve(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminService.reviewOrganizer(id, admin.sub, true);
  }

  @Patch('organizers/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectOrganizerDto, @CurrentUser() admin: AuthenticatedUser) {
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
      group: group === 'flagged' ? 'flagged' : 'active',
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

  // GET /admin/events?status=CANCELLED&search=feria
  @Get('events')
  listEvents(@Query('status') status?: string, @Query('search') search?: string) {
    return this.adminService.listEvents({ status: pick(EventStatus, status), search });
  }

  @Patch('events/:id/status')
  updateEventStatus(@Param('id') id: string, @Body() dto: UpdateEventStatusDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminService.updateEventStatus(id, admin.sub, dto.status, dto.reason);
  }
}
