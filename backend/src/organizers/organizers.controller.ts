import { Controller, Get, Param } from '@nestjs/common';
import { OrganizersService } from './organizers.service';

@Controller('organizers')
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  // Perfil público de un organizador verificado (sin datos de contacto ni de verificación)
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.organizersService.getPublicProfile(id);
  }
}
