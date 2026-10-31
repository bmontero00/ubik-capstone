import { Module } from '@nestjs/common';
import { OrganizersController } from './organizers.controller';
import { OrganizersService } from './organizers.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [OrganizersController],
  providers: [OrganizersService, PrismaService],
})
export class OrganizersModule {}
