import { Module } from '@nestjs/common';
import { ComprasModule } from '../compras/compras.module';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';

@Module({
  imports: [ComprasModule],
  controllers: [PagosController],
  providers: [PagosService],
})
export class PagosModule {}
