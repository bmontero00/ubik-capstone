import { Module } from '@nestjs/common';
import { CuentaController } from './cuenta.controller';
import { CuentaService } from './cuenta.service';

@Module({
  controllers: [CuentaController],
  providers: [CuentaService],
})
export class CuentaModule {}
