import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { CategoriasAdminService } from './categorias-admin.service';
import { esEmojiValido } from '../common/categorias';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : value);

@ValidatorConstraint({ name: 'emoji' })
class EmojiValido implements ValidatorConstraintInterface {
  validate(valor: unknown) {
    return typeof valor === 'string' && esEmojiValido(valor);
  }
  defaultMessage() {
    return 'Elige un solo emoji';
  }
}

class CrearCategoriaDto {
  @Transform(recortar)
  @IsString()
  @Length(3, 40, { message: 'El nombre debe tener entre 3 y 40 caracteres' })
  name: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color debe tener formato #RRGGBB' })
  color: string;

  @Validate(EmojiValido)
  emoji: string;
}

class EditarCategoriaDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @Length(3, 40, { message: 'El nombre debe tener entre 3 y 40 caracteres' })
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color debe tener formato #RRGGBB' })
  color?: string;

  @IsOptional()
  @Validate(EmojiValido)
  emoji?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(998)
  orden?: number;
}

class MoverSugerenciaDto {
  @IsString()
  @Length(1, 60)
  sugerencia: string;
}

// Mantenedor de categorías (solo administradores)
@Controller('admin/categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CategoriasAdminController {
  constructor(private readonly categorias: CategoriasAdminService) {}

  // Todas las categorías (también las ocultas) con su cantidad de eventos y las sugerencias de "Otra"
  @Get()
  listar() {
    return this.categorias.listar();
  }

  @Post()
  crear(@Body() dto: CrearCategoriaDto) {
    return this.categorias.crear(dto);
  }

  @Patch(':id')
  editar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EditarCategoriaDto) {
    return this.categorias.editar(id, dto);
  }

  // POST /admin/categorias/:id/mover { sugerencia: "mascotas" }
  @Post(':id/mover')
  mover(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoverSugerenciaDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.categorias.moverSugerencia(id, dto.sugerencia, admin);
  }
}
