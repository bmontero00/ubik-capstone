import {
  BadRequestException, Body, Controller, HttpCode, HttpException, HttpStatus, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { Limitador } from '../common/limitador';
import { AsistenteEventosService } from './asistente-eventos.service';
import { ModeracionImagenService, tipoImagen } from './moderacion-imagen.service';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class DatosEventoIaDto {
  @Transform(recortar)
  @IsString({ message: 'Escribe el título del evento' })
  @Length(3, 100, { message: 'Escribe el título del evento' })
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @Transform(recortar)
  @IsString()
  @MaxLength(2000)
  descripcion: string;
}

// Límites por organizador para que nadie consuma la IA sin control
const limiteTexto = new Limitador(20, 3_600_000); // 20 por hora (descripción y portada)
const limiteImagen = new Limitador(30, 3_600_000);

const permitir = (limitador: Limitador, clave: string) => {
  if (!limitador.permitir(clave)) {
    throw new HttpException(
      { message: 'Alcanzaste el límite de usos de IA por ahora. Vuelve a intentarlo en un rato.', code: 'LIMITE_IA' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
};

// Ayudas con IA para crear eventos: solo organizadores y administradores
@Controller('ia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ORGANIZER', 'ADMIN')
export class IaController {
  constructor(
    private readonly asistente: AsistenteEventosService,
    private readonly moderacionImagen: ModeracionImagenService,
  ) {}

  // POST /ia/descripcion: propone una versión mejorada (el organizador decide si la usa)
  @Post('descripcion')
  @HttpCode(200)
  descripcion(@Body() dto: DatosEventoIaDto, @CurrentUser() user: AuthenticatedUser) {
    if (dto.descripcion.length < 10) throw new BadRequestException('Escribe al menos una idea del evento (10 caracteres) para mejorarla');
    permitir(limiteTexto, `desc:${user.sub}`);
    return this.asistente.mejorarDescripcion(dto);
  }

  // POST /ia/portada: elige colores, patrón, emoji y frase según el evento
  @Post('portada')
  @HttpCode(200)
  portada(@Body() dto: DatosEventoIaDto, @CurrentUser() user: AuthenticatedUser) {
    permitir(limiteTexto, `portada:${user.sub}`);
    return this.asistente.disenarPortada(dto);
  }

  // POST /ia/imagen/verificar: revisa la imagen apenas se elige, antes de guardar el evento (no la guarda)
  @Post('imagen/verificar')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
        return callback(new BadRequestException('Solo se permiten archivos de imagen .jpg, .jpeg o .png'), false);
      }
      callback(null, true);
    },
  }))
  async verificarImagen(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('Elige una imagen');
    permitir(limiteImagen, `img:${user.sub}`);
    return this.moderacionImagen.revisar(file.buffer, tipoImagen(file.originalname));
  }
}
