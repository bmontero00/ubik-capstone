import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { OrganizerStatus } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminService } from './admin.service';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { JwtPayload } from '../auth/auth.guards';

class RejectOrganizerDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // GET /admin/organizers?status=PENDING
  @Get('organizers')
  list(@Query('status') status?: string) {
    const valid = Object.values(OrganizerStatus).includes(status as OrganizerStatus);
    return this.adminService.listOrganizerRequests(valid ? (status as OrganizerStatus) : undefined);
  }

  @Patch('organizers/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.reviewOrganizer(id, admin.sub, true);
  }

  @Patch('organizers/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectOrganizerDto, @CurrentUser() admin: JwtPayload) {
    return this.adminService.reviewOrganizer(id, admin.sub, false, dto.reason);
  }
}
