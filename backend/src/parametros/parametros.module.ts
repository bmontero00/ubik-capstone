import { Global, Module } from '@nestjs/common';
import { ParametrosService } from './parametros.service';

// Global: eventos, compras y administración leen el % de cargo vigente
@Global()
@Module({
  providers: [ParametrosService],
  exports: [ParametrosService],
})
export class ParametrosModule {}
