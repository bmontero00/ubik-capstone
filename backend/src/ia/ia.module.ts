import { Global, Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaController } from './ia.controller';
import { AsistenteEventosService } from './asistente-eventos.service';
import { ModeracionImagenService } from './moderacion-imagen.service';

@Global()
@Module({
  controllers: [IaController],
  providers: [IaService, AsistenteEventosService, ModeracionImagenService],
  exports: [IaService, ModeracionImagenService],
})
export class IaModule {}
