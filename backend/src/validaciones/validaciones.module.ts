import { Module } from '@nestjs/common';
import { ValidacionesController } from './validaciones.controller';
import { ValidacionesService } from './validaciones.service';
import { EquipoAccesoController } from './equipo-acceso.controller';
import { EquipoAccesoService } from './equipo-acceso.service';
import { ValidacionAuthGuard } from './actor';

@Module({
  controllers: [ValidacionesController, EquipoAccesoController],
  providers: [ValidacionesService, EquipoAccesoService, ValidacionAuthGuard],
})
export class ValidacionesModule {}
