import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { OrganizersModule } from './organizers/organizers.module';
import { ComprasModule } from './compras/compras.module';
import { ParametrosModule } from './parametros/parametros.module';
import { PagosModule } from './pagos/pagos.module';
import { CorreoModule } from './correo/correo.module';
import { ResenasModule } from './resenas/resenas.module';
import { IaModule } from './ia/ia.module';
import { UbicacionesModule } from './ubicaciones/ubicaciones.module';
import { CuentaModule } from './cuenta/cuenta.module';
import { ReportesModule } from './reportes/reportes.module';
import { ValidacionesModule } from './validaciones/validaciones.module';
import { OrganizacionesModule } from './organizaciones/organizaciones.module';

@Module({
  imports: [AuthModule, EventsModule, PrismaModule, AdminModule, OrganizersModule, ComprasModule, ParametrosModule, PagosModule, CorreoModule, IaModule, ResenasModule, UbicacionesModule, CuentaModule, ReportesModule, ValidacionesModule, OrganizacionesModule],
})
export class AppModule {}
