import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsUUID } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { PagosService } from './pagos.service';
import type { RetornoWebpay } from './pagos.service';

class IniciarPagoDto {
  @IsUUID('4', { message: 'Compra no válida' })
  compraId: string;
}

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  // Medios de pago disponibles (el frontend oculta el pago simulado en producción)
  @Get('configuracion')
  configuracion() {
    return this.pagosService.configuracion();
  }

  // El asistente inicia el pago de su compra: recibe la URL y el token del formulario de Webpay
  @Post('webpay/iniciar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ATTENDEE')
  iniciar(@Body() dto: IniciarPagoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pagosService.iniciarWebpay(dto.compraId, user);
  }

  // Transbank devuelve aquí al comprador (por GET o POST según el caso). No lleva sesión: el
  // pago se valida confirmándolo directamente con Transbank. Luego se le redirige al sitio.
  @Get('webpay/retorno')
  async retornoGet(@Query() query: RetornoWebpay, @Res() res: Response) {
    res.redirect(303, await this.pagosService.procesarRetorno(query));
  }

  @Post('webpay/retorno')
  async retornoPost(@Body() body: RetornoWebpay, @Query() query: RetornoWebpay, @Res() res: Response) {
    res.redirect(303, await this.pagosService.procesarRetorno({ ...query, ...body }));
  }
}
