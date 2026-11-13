import { Body, Controller, DefaultValuePipe, Get, HttpCode, HttpException, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, Length } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { Limitador } from '../common/limitador';
import { ValidacionesService } from './validaciones.service';

class ValidarDto {
  @IsUUID('all', { message: 'El evento no es válido' })
  eventoId!: string;

  @IsString({ message: 'Ingresa el código de la entrada' })
  @Length(1, 64, { message: 'El código debe tener entre 1 y 64 caracteres' })
  codigo!: string;
}

// En una puerta se escanea rápido, pero no tanto: el límite frena a quien intente adivinar códigos
const limiteEscaneos = new Limitador(120, 60_000);

// Validación de entradas en el acceso (app de validación del organizador)
@Controller('validaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ORGANIZER', 'ADMIN')
export class ValidacionesController {
  constructor(private readonly validaciones: ValidacionesService) {}

  @Post()
  @HttpCode(200)
  validar(@CurrentUser() user: AuthenticatedUser, @Body() dto: ValidarDto) {
    if (!limiteEscaneos.permitir(user.sub)) {
      throw new HttpException('Demasiados escaneos seguidos. Espera un momento e intenta de nuevo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.validaciones.validar(user, dto.eventoId, dto.codigo);
  }

  @Get('eventos')
  misEventos(@CurrentUser() user: AuthenticatedUser) {
    return this.validaciones.misEventos(user);
  }

  @Get('eventos/:id/resumen')
  resumen(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.validaciones.resumen(user, id);
  }

  @Get('eventos/:id/historial')
  historial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limite', new DefaultValuePipe(50), ParseIntPipe) limite: number,
  ) {
    return this.validaciones.historial(user, id, Math.min(Math.max(limite, 1), 200));
  }
}
