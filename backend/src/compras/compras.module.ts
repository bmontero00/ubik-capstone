import { Module } from '@nestjs/common';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ComprasController],
  providers: [ComprasService, PrismaService],
})
export class ComprasModule {}
