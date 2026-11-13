import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Ip, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { Limitador } from '../common/limitador';
import { EquipoAccesoService } from './equipo-acceso.service';

class AccesoDto {
  @IsOptional()
  @IsString({ message: 'Escribe el nombre de la persona o del puesto' })
  @Length(2, 60, { message: 'El nombre debe tener entre 2 y 60 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'La puerta puede tener hasta 60 caracteres' })
  puerta?: string | null;

  // Vacío = todos los tipos de entrada
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true, message: 'Uno de los tipos de entrada no es válido' })
  tiposEntradaIds?: string[];

  @IsOptional()
  @IsBoolean()
  permiteEstacionamiento?: boolean;
}

class CrearAccesoDto extends AccesoDto {
  @IsString({ message: 'Escribe el nombre de la persona o del puesto' })
  @Length(2, 60, { message: 'El nombre debe tener entre 2 y 60 caracteres' })
  declare nombre: string;
}

class VincularDto {
  @IsString({ message: 'Ingresa el código de vinculación' })
  @Length(8, 30, { message: 'El código de vinculación no es válido' })
  codigo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dispositivo?: string;
}

// Frena a quien intente adivinar códigos de vinculación
const limiteVincular = new Limitador(10, 10 * 60_000);

// El organizador gestiona su equipo de acceso
@Controller('equipo-acceso')
export class EquipoAccesoController {
  constructor(private readonly equipo: EquipoAccesoService) {}

  @Get('eventos/:eventoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  listar(@CurrentUser() user: AuthenticatedUser, @Param('eventoId', ParseUUIDPipe) eventoId: string) {
    return this.equipo.listar(user, eventoId);
  }

  @Post('eventos/:eventoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  crear(@CurrentUser() user: AuthenticatedUser, @Param('eventoId', ParseUUIDPipe) eventoId: string, @Body() dto: CrearAccesoDto) {
    return this.equipo.crear(user, eventoId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  actualizar(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AccesoDto) {
    return this.equipo.actualizar(user, id, dto);
  }

  @Post(':id/codigo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  regenerar(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.equipo.regenerarCodigo(user, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  revocar(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.equipo.revocar(user, id);
  }

  // Público: el celular del validador se vincula con el código que le dio el organizador
  @Post('vincular')
  @HttpCode(200)
  vincular(@Ip() ip: string, @Body() dto: VincularDto) {
    if (!limiteVincular.permitir(ip)) {
      throw new HttpException('Demasiados intentos. Espera unos minutos e intenta de nuevo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.equipo.vincular(dto.codigo, dto.dispositivo);
  }
}
