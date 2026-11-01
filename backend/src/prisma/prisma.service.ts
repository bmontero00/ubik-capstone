import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// El pooler de Supabase en modo sesión admite pocas conexiones en total (pool_size: 15), compartidas
// por todo el equipo y los scripts de Prisma. Por defecto Prisma abre núm. de CPU × 2 + 1 conexiones,
// así que se limita aquí, salvo que DATABASE_URL ya indique su propio connection_limit.
const DEFAULT_CONNECTION_LIMIT = 5;

function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${DEFAULT_CONNECTION_LIMIT}`;
}

// Única conexión a la base de datos de la app: la entrega PrismaModule (global) a todos los módulos.
// No agregar PrismaService a los providers de otros módulos: cada copia abriría su propio pool.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasourceUrl: databaseUrl() });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
