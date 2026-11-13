import { Body, Controller, DefaultValuePipe, Get, HttpCode, HttpException, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, Length } from 'class-validator';
import { Limitador } from '../common/limitador';
import { ActorActual, ValidacionAuthGuard } from './actor';
import type { Actor } from './actor';
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
const claveActor = (a: Actor) => (a.tipo === 'validador' ? `acceso:${a.acceso.id}` : `usuario:${a.user.sub}`);

// Validación de entradas en el acceso: organizador (o admin) con su cuenta, o su equipo de acceso
@Controller('validaciones')
@UseGuards(ValidacionAuthGuard)
export class ValidacionesController {
  constructor(private readonly validaciones: ValidacionesService) {}

  @Post()
  @HttpCode(200)
  validar(@ActorActual() actor: Actor, @Body() dto: ValidarDto) {
    if (!limiteEscaneos.permitir(claveActor(actor))) {
      throw new HttpException('Demasiados escaneos seguidos. Espera un momento e intenta de nuevo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.validaciones.validar(actor, dto.eventoId, dto.codigo);
  }

  @Get('eventos')
  misEventos(@ActorActual() actor: Actor) {
    return this.validaciones.misEventos(actor);
  }

  @Get('eventos/:id/resumen')
  resumen(@ActorActual() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.validaciones.resumen(actor, id);
  }

  @Get('eventos/:id/historial')
  historial(
    @ActorActual() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limite', new DefaultValuePipe(50), ParseIntPipe) limite: number,
  ) {
    return this.validaciones.historial(actor, id, Math.min(Math.max(limite, 1), 200));
  }
}
