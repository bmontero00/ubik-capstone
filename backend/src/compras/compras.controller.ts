import { Body, Controller, Get, Param, Patch, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
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

  // Entradas en PDF con su código QR. ?entrada=<id> descarga solo esa entrada
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Query('entrada') entrada: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    const { buffer, nombre } = await this.comprasService.pdf(id, user, entrada || undefined);
    return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="${nombre}"`, length: buffer.length });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comprasService.findOne(id, user);
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
