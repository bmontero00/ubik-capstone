import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CargosAdminService } from './cargos-admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, CargosAdminService],
})
export class AdminModule {}
