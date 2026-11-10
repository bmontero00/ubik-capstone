import { Module } from '@nestjs/common';
import { ResenasController } from './resenas.controller';
import { ResenasService } from './resenas.service';
import { ModeracionService } from './moderacion.service';
import { ResumenIaService } from './resumen-ia.service';

@Module({
  controllers: [ResenasController],
  providers: [ResenasService, ModeracionService, ResumenIaService],
  exports: [ResenasService],
})
export class ResenasModule {}
