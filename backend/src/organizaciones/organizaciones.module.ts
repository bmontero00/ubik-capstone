import { Global, Module } from '@nestjs/common';
import { OrganizacionesController } from './organizaciones.controller';
import { OrganizacionesService } from './organizaciones.service';

// Global: lo usan el registro de organizadores (auth) y la revisión de solicitudes (admin)
@Global()
@Module({
  controllers: [OrganizacionesController],
  providers: [OrganizacionesService],
  exports: [OrganizacionesService],
})
export class OrganizacionesModule {}
