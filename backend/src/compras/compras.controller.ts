import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { ComprasService } from './compras.service';
import { CreateCompraDto, PagarCompraDto } from './dto/compra.dto';

// Compra de entradas: solo para asistentes
@Controller('compras')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ATTENDEE')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  create(@Body() dto: CreateCompraDto, @CurrentUser() user: AuthenticatedUser) {
    return this.comprasService.create(dto, user);
  }

  @Get('mias')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.comprasService.findMine(user);
  }

  @Post(':id/pagar')
  pay(@Param('id') id: string, @Body() dto: PagarCompraDto, @CurrentUser() user: AuthenticatedUser) {
    return this.comprasService.pay(id, user, dto.medioPago);
  }

  @Patch(':id/cancelar')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comprasService.cancel(id, user);
  }
}
