import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, OptionalJwtAuthGuard, Roles, RolesGuard } from '../auth/auth.guards';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { ResenasService } from './resenas.service';
import { CrearResenaDto, GuardarResenaDto, ResponderResenaDto } from './dto/resena.dto';

@Controller('resenas')
export class ResenasController {
  constructor(private readonly resenasService: ResenasService) {}

  // GET /resenas/organizador/:id?pagina=1&estrellas=5 (público; al organizador le indica que puede responder)
  @Get('organizador/:id')
  @UseGuards(OptionalJwtAuthGuard)
  listar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() viewer: AuthenticatedUser | undefined,
    @Query('pagina') pagina?: string,
    @Query('estrellas') estrellas?: string,
  ) {
    const p = Math.max(1, Number.parseInt(pagina ?? '1', 10) || 1);
    const e = estrellas ? Number.parseInt(estrellas, 10) : undefined;
    if (e !== undefined && !(e >= 1 && e <= 5)) throw new BadRequestException('El filtro de estrellas no es válido');
    return this.resenasService.listarDeOrganizador(id, viewer, p, e);
  }

  // Estado de reseña de los eventos de los que el asistente tiene entradas
  @Get('mias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ATTENDEE')
  mias(@CurrentUser() user: AuthenticatedUser) {
    return this.resenasService.estadoDeMisEventos(user);
  }

  @Get('evento/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ATTENDEE')
  estadoEvento(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.resenasService.estadoParaEvento(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ATTENDEE')
  crear(@Body() dto: CrearResenaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resenasService.crear(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ATTENDEE')
  editar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GuardarResenaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resenasService.editar(id, dto, user);
  }

  // El autor o un admin
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.resenasService.eliminar(id, user);
  }

  @Put(':id/respuesta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  responder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResponderResenaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resenasService.responder(id, dto, user);
  }

  @Delete(':id/respuesta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  quitarRespuesta(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.resenasService.responder(id, null, user);
  }
}
