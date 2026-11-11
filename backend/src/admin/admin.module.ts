import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CargosAdminService } from './cargos-admin.service';
import { CategoriasAdminController } from './categorias-admin.controller';
import { CategoriasAdminService } from './categorias-admin.service';

@Module({
  controllers: [AdminController, CategoriasAdminController],
  providers: [AdminService, CargosAdminService, CategoriasAdminService],
})
export class AdminModule {}
