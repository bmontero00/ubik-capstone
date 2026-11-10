import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { inicioDelDiaEnChile, proximaMedianocheEnChile } from '../common/fecha-chile';

// Estados que se finalizan solos. Los cancelados siguen cancelados y los "en revisión" quedan
// como los dejó el equipo de UBIK.
const ESTADOS_A_FINALIZAR: EventStatus[] = ['PUBLISHED', 'POSTPONED'];

// Finaliza los eventos que ya se realizaron. No importa la hora: un evento del día 20 se cierra el
// día 21 a las 00:00 (hora de Chile). Corre al iniciar el backend, en cada medianoche de Chile y,
// por si el servidor estuvo apagado a esa hora, una vez por hora.
@Injectable()
export class FinalizacionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Finalizacion');
  private medianoche?: NodeJS.Timeout;
  private cadaHora?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    void this.finalizarRealizados();
    this.programarMedianoche();
    this.cadaHora = setInterval(() => void this.finalizarRealizados(), 3_600_000);
  }

  onModuleDestroy() {
    clearTimeout(this.medianoche);
    clearInterval(this.cadaHora);
  }

  private programarMedianoche() {
    // Un segundo después de la medianoche, para que el día ya haya cambiado
    const espera = proximaMedianocheEnChile().getTime() - Date.now() + 1000;
    this.medianoche = setTimeout(() => {
      void this.finalizarRealizados();
      this.programarMedianoche();
    }, espera);
  }

  // Pasa a FINISHED los eventos de días anteriores a hoy (en Chile). statusChangedById queda vacío
  // porque el cambio lo hace el sistema, no una persona.
  async finalizarRealizados(): Promise<number> {
    try {
      const { count } = await this.prisma.event.updateMany({
        where: { status: { in: ESTADOS_A_FINALIZAR }, date: { lt: inicioDelDiaEnChile() } },
        data: { status: 'FINISHED', statusReason: null, statusChangedAt: new Date(), statusChangedById: null },
      });
      if (count) this.logger.log(`${count} ${count === 1 ? 'evento finalizado' : 'eventos finalizados'}`);
      return count;
    } catch (error) {
      this.logger.error(`No se pudieron finalizar los eventos realizados: ${(error as Error).message}`);
      return 0;
    }
  }
}
