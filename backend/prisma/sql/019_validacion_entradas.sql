-- Validación de entradas en el acceso: entrada usada (una sola vez), estacionamiento usado y registro de escaneos
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "ResultadoValidacion" AS ENUM ('VALIDA', 'YA_USADA', 'OTRO_EVENTO', 'NO_PAGADA', 'INEXISTENTE', 'EVENTO_CANCELADO');

-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "estacionamientoUsadoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "entradas" ADD COLUMN     "usadaEn" TIMESTAMP(3),
ADD COLUMN     "validadaPorId" TEXT;

-- CreateTable
CREATE TABLE "validaciones" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "resultado" "ResultadoValidacion" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entradaId" TEXT,

    CONSTRAINT "validaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "validaciones_eventoId_fecha_idx" ON "validaciones"("eventoId", "fecha");

-- CreateIndex
CREATE INDEX "entradas_eventoId_usadaEn_idx" ON "entradas"("eventoId", "usadaEn");

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_validadaPorId_fkey" FOREIGN KEY ("validadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validaciones" ADD CONSTRAINT "validaciones_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validaciones" ADD CONSTRAINT "validaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validaciones" ADD CONSTRAINT "validaciones_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "entradas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

