import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ReapplyDto } from './dto/reapply.dto';
import { CurrentUser, JwtAuthGuard } from './auth.guards';
import type { AuthenticatedUser } from './auth.guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Organizador rechazado vuelve a enviar su solicitud
  @Post('organizer/reapply')
  async reapply(@Body() dto: ReapplyDto) {
    return this.authService.reapply(dto);
  }

  // El organizador vio el aviso de cuenta verificada
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('organizer/approval-notice/seen')
  async approvalNoticeSeen(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.markApprovalNoticeSeen(user.sub);
  }

  // Datos actualizados del usuario (por ejemplo, si un admin aprobó su solicitud)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.sub);
  }
}
