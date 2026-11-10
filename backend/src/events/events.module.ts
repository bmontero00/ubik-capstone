import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { FinalizacionService } from './finalizacion.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, FinalizacionService],
  exports: [EventsService],
})
export class EventsModule {}