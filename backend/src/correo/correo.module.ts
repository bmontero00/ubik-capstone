import { Global, Module } from '@nestjs/common';
import { CorreoService } from './correo.service';

// Global: cualquier módulo puede enviar correos (recuperación de contraseña y, más adelante,
// entradas y comprobantes)
@Global()
@Module({
  providers: [CorreoService],
  exports: [CorreoService],
})
export class CorreoModule {}
