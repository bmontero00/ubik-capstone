-- Tipos de entrada con cupos (aforo), estacionamiento y ofertas como % de descuento
-- Estructura generada con prisma migrate diff; los pasos de datos (marcados con "Datos") se agregaron a mano.

-- CreateEnum
CREATE TYPE "TipoEstacionamiento" AS ENUM ('GRATUITO', 'PAGADO');

-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "cantidadEstacionamiento" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codigoEstacionamiento" TEXT,
ADD COLUMN     "precioEstacionamiento" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "entradas" ADD COLUMN     "cargo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "precio" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tipoEntradaId" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "aforo" INTEGER,
ADD COLUMN     "cuposEstacionamiento" INTEGER,
ADD COLUMN     "estacionamiento" "TipoEstacionamiento",
ADD COLUMN     "indicacionesEstacionamiento" TEXT,
ADD COLUMN     "porcentajeOferta" INTEGER,
ADD COLUMN     "precioEstacionamiento" DOUBLE PRECISION;

-- Datos: las ofertas vigentes pasan de precio rebajado a % de descuento sobre el precio del organizador
UPDATE "events"
SET "porcentajeOferta" = LEAST(90, GREATEST(5, ROUND((1 - "precioOferta" / "price") * 100)::int))
WHERE "precioOferta" IS NOT NULL AND "price" > 0;

ALTER TABLE "events" DROP COLUMN "precioOferta";

-- CreateTable
CREATE TABLE "tipos_entrada" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DOUBLE PRECISION NOT NULL,
    "cupo" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,

    CONSTRAINT "tipos_entrada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tipos_entrada_eventoId_orden_idx" ON "tipos_entrada"("eventoId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "compras_codigoEstacionamiento_key" ON "compras"("codigoEstacionamiento");

-- CreateIndex
CREATE INDEX "entradas_tipoEntradaId_idx" ON "entradas"("tipoEntradaId");

-- AddForeignKey
ALTER TABLE "tipos_entrada" ADD CONSTRAINT "tipos_entrada_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_tipoEntradaId_fkey" FOREIGN KEY ("tipoEntradaId") REFERENCES "tipos_entrada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Datos: cada evento existente queda con un único tipo "General" a su precio actual y sin cupo (sin aforo)
INSERT INTO "tipos_entrada" ("id", "nombre", "precio", "cupo", "orden", "eventoId")
SELECT gen_random_uuid()::text, 'General', "price", NULL, 0, "id" FROM "events";

-- Datos: las entradas ya vendidas pasan al tipo "General" de su evento, con el precio y cargo que se pagaron
UPDATE "entradas" e
SET "tipoEntradaId" = t."id",
    "precio" = c."precioUnitario",
    "cargo" = CASE WHEN c."cantidad" > 0 THEN c."cargoServicio" / c."cantidad" ELSE 0 END
FROM "tipos_entrada" t, "compras" c
WHERE t."eventoId" = e."eventoId" AND c."id" = e."compraId";
