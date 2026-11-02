import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { OrganizersModule } from './organizers/organizers.module';
import { ComprasModule } from './compras/compras.module';
import { ParametrosModule } from './parametros/parametros.module';

@Module({
  imports: [AuthModule, EventsModule, PrismaModule, AdminModule, OrganizersModule, ComprasModule, ParametrosModule],
})
export class AppModule {}
