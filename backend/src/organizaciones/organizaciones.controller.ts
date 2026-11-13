import { Body, Controller, Get, HttpException, HttpStatus, Ip, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, Length, Validate, ValidateIf } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { IsValidRutConstraint } from '../auth/dto/register.dto';
import { IsReason } from '../common/reason.validator';
import { Limitador } from '../common/limitador';
import { OrganizacionesService } from './organizaciones.service';

class VerificarDto {
  @IsOptional()
  @IsString()
  @Validate(IsValidRutConstraint)
  rut?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres' })
  nombre?: string;
}

class EditarDto {
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres' })
  nombre?: string;

  // null = quitar el RUT (solo en organizaciones no verificadas)
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Validate(IsValidRutConstraint)
  rut?: string | null;
}

class RechazarDto {
  @IsReason()
  motivo!: string;
}

class FusionarDto {
  @IsUUID('all', { message: 'Elige la organización de destino' })
  destinoId!: string;
}

// Consulta pública del RUT al registrarse: frena a quien intente recorrer RUTs
const limiteBusqueda = new Limitador(30, 10 * 60_000);

@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private readonly organizaciones: OrganizacionesService) {}

  // Público (formulario de registro): ¿este RUT ya es una organización en UBIK?
  @Get('buscar')
  buscar(@Ip() ip: string, @Query('rut') rut?: string) {
    if (!limiteBusqueda.permitir(ip)) throw new HttpException('Demasiadas consultas. Espera unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    const valido = rut && new IsValidRutConstraint().validate(rut);
    if (!valido) return { existe: false };
    return this.organizaciones.buscarPorRut(rut);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listar() {
    return this.organizaciones.listar();
  }

  @Patch(':id/verificar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  verificar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VerificarDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.organizaciones.verificar(id, admin.sub, dto);
  }

  @Patch(':id/rechazar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  rechazar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RechazarDto) {
    return this.organizaciones.rechazar(id, dto.motivo);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  editar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EditarDto) {
    return this.organizaciones.editar(id, dto);
  }

  @Post(':id/fusionar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  fusionar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FusionarDto) {
    return this.organizaciones.fusionar(id, dto.destinoId);
  }
}
