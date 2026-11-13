-- Equipo de acceso: validadores sin cuenta, vinculados a un evento (y opcionalmente a ciertos tipos de entrada)
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterEnum
ALTER TYPE "ResultadoValidacion" ADD VALUE 'TIPO_NO_PERMITIDO';

-- AlterTable
ALTER TABLE "entradas" ADD COLUMN     "validadaPorAccesoId" TEXT;

-- AlterTable
ALTER TABLE "validaciones" ADD COLUMN     "accesoValidadorId" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "accesos_validador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "puerta" TEXT,
    "tiposEntradaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permiteEstacionamiento" BOOLEAN NOT NULL DEFAULT true,
    "codigoHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "vinculadoEn" TIMESTAMP(3),
    "dispositivo" TEXT,
    "ultimoUsoEn" TIMESTAMP(3),
    "revocadoEn" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,

    CONSTRAINT "accesos_validador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accesos_validador_codigoHash_key" ON "accesos_validador"("codigoHash");

-- CreateIndex
CREATE INDEX "accesos_validador_eventoId_idx" ON "accesos_validador"("eventoId");

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_validadaPorAccesoId_fkey" FOREIGN KEY ("validadaPorAccesoId") REFERENCES "accesos_validador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validaciones" ADD CONSTRAINT "validaciones_accesoValidadorId_fkey" FOREIGN KEY ("accesoValidadorId") REFERENCES "accesos_validador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_validador" ADD CONSTRAINT "accesos_validador_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_validador" ADD CONSTRAINT "accesos_validador_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

