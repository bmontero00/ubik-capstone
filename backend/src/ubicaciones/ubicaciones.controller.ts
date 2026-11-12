import { Controller, Get, HttpException, HttpStatus, Ip, Query } from '@nestjs/common';
import { Limitador } from '../common/limitador';
import { UbicacionesService } from './ubicaciones.service';

// Límites por IP: el autocompletado consulta mientras se escribe
const limiteBusqueda = new Limitador(90, 60_000);
const limiteContorno = new Limitador(20, 60_000);

const permitir = (limitador: Limitador, clave: string) => {
  if (!limitador.permitir(clave)) {
    throw new HttpException({ message: 'Demasiadas búsquedas seguidas. Espera unos segundos.', code: 'LIMITE_BUSQUEDA' }, HttpStatus.TOO_MANY_REQUESTS);
  }
};

// Búsqueda de sectores para el mapa (pública: también la usan quienes no iniciaron sesión)
@Controller('ubicaciones')
export class UbicacionesController {
  constructor(private readonly ubicaciones: UbicacionesService) {}

  // GET /ubicaciones/buscar?q=san mig
  @Get('buscar')
  buscar(@Query('q') q = '', @Ip() ip: string) {
    permitir(limiteBusqueda, ip);
    return this.ubicaciones.buscar(q.slice(0, 80));
  }

  // GET /ubicaciones/contorno?comuna=San Miguel
  @Get('contorno')
  contorno(@Query('comuna') comuna = '', @Ip() ip: string) {
    permitir(limiteContorno, ip);
    return this.ubicaciones.contorno(comuna.slice(0, 60));
  }
}
