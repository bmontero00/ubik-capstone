import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ReportesPlataformaService } from './reportes-plataforma.service';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, ReportesPlataformaService],
})
export class ReportesModule {}
