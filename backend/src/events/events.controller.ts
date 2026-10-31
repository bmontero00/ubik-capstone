import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser, JwtAuthGuard, OptionalJwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { CancelEventDto, CreateAnnouncementDto, CreateEventDto, PostponeEventDto, UpdateEventDto } from './dto/event.dto';

// Imagen del evento: se guarda en ./uploads (expuesta en main.ts), máximo 5 MB, jpg o png
const eventImageInterceptor = FileInterceptor('image', {
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      callback(null, `event-${uniqueSuffix}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
      return callback(new BadRequestException('Solo se permiten archivos de imagen .jpg, .jpeg o .png'), false);
    }
    callback(null, true);
  },
});

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('categories')
  async getCategories() {
    return this.eventsService.findAllCategories();
  }

  // Eventos del organizador que inició sesión (todos sus estados)
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.findMine(user.sub);
  }

  // Solo organizadores aprobados (o administradores) pueden publicar eventos
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @UseInterceptors(eventImageInterceptor)
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.eventsService.assertCanPublish(user);
    // El organizador sale del token, nunca del formulario
    return this.eventsService.create(dto, user, file ? `/uploads/${file.filename}` : null);
  }

  // El organizador edita solo sus eventos; el admin puede editar cualquiera
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @UseInterceptors(eventImageInterceptor)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.eventsService.update(id, user, dto, file ? `/uploads/${file.filename}` : undefined);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  async cancel(@Param('id') id: string, @Body() dto: CancelEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.cancel(id, user, dto.reason);
  }

  @Patch(':id/postpone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  async postpone(@Param('id') id: string, @Body() dto: PostponeEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.postpone(id, user, dto.date, dto.reason);
  }

  @Patch(':id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  async resume(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.resume(id, user);
  }

  // Anuncios del organizador en la bitácora del evento
  @Post(':id/bitacora')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  async addAnnouncement(@Param('id') id: string, @Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.addAnnouncement(id, user, dto);
  }

  @Delete(':id/bitacora/:entradaId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  async removeAnnouncement(
    @Param('id') id: string,
    @Param('entradaId') entradaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.eventsService.removeAnnouncement(id, entradaId, user);
  }

  @Get()
  async findAll(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
  ) {
    return this.eventsService.findAll(
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      radius ? Number(radius) : undefined,
    );
  }

  // Detalle público con la bitácora; con sesión, su organizador y los admins ven más
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.eventsService.findOne(id, user);
  }
}
