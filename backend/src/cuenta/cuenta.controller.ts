import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Patch, Post, Put, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser, JwtAuthGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { Limitador } from '../common/limitador';
import { CuentaService } from './cuenta.service';
import { ActualizarCuentaDto, CambiarContrasenaDto, esTipoFoto } from './dto/cuenta.dto';

// Intentos de contraseña actual: evita adivinarla desde una sesión robada
const limiteContrasena = new Limitador(5, 15 * 60_000);
const limiteFoto = new Limitador(15, 60 * 60_000);

// Mi cuenta: cualquier usuario con sesión (asistente, organizador o admin)
@Controller('cuenta')
@UseGuards(JwtAuthGuard)
export class CuentaController {
  constructor(private readonly cuenta: CuentaService) {}

  @Get()
  obtener(@CurrentUser() user: AuthenticatedUser) {
    return this.cuenta.obtener(user);
  }

  @Patch()
  actualizar(@CurrentUser() user: AuthenticatedUser, @Body() dto: ActualizarCuentaDto) {
    return this.cuenta.actualizar(user, dto);
  }

  @Put('foto')
  @UseInterceptors(FileInterceptor('foto', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
      if (!esTipoFoto(file.mimetype)) return callback(new BadRequestException('Usa una imagen JPG, PNG o WebP'), false);
      callback(null, true);
    },
  }))
  foto(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Elige una imagen');
    if (!limiteFoto.permitir(user.sub)) {
      throw new HttpException('Cambiaste tu foto muchas veces seguidas. Inténtalo más tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.cuenta.guardarFoto(user, file.buffer);
  }

  @Delete('foto')
  quitarFoto(@CurrentUser() user: AuthenticatedUser) {
    return this.cuenta.quitarFoto(user);
  }

  @Post('contrasena')
  @HttpCode(200)
  contrasena(@CurrentUser() user: AuthenticatedUser, @Body() dto: CambiarContrasenaDto) {
    if (!limiteContrasena.permitir(user.sub)) {
      throw new HttpException('Demasiados intentos. Espera unos minutos antes de volver a intentarlo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.cuenta.cambiarContrasena(user, dto);
  }
}
