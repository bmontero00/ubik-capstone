-- Cargo por servicio: % fijo por evento, condiciones especiales, desglose en compras y parámetros de la plataforma
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "EstadoCondicionEspecial" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "cargoServicio" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "porcentajeCargo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "precioBase" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "condicionRevisadaEn" TIMESTAMP(3),
ADD COLUMN     "condicionRevisadaPorId" TEXT,
ADD COLUMN     "estadoCondicion" "EstadoCondicionEspecial",
ADD COLUMN     "justificacionCondicion" TEXT,
ADD COLUMN     "porcentajeCargo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "porcentajeSolicitado" DOUBLE PRECISION,
ADD COLUMN     "respuestaCondicion" TEXT;

-- CreateTable
CREATE TABLE "parametros_plataforma" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" TEXT,

    CONSTRAINT "parametros_plataforma_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "historial_parametros" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,

    CONSTRAINT "historial_parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_cargos_evento" (
    "id" TEXT NOT NULL,
    "porcentajeAnterior" DOUBLE PRECISION NOT NULL,
    "porcentajeNuevo" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,

    CONSTRAINT "historial_cargos_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historial_parametros_clave_fecha_idx" ON "historial_parametros"("clave", "fecha");

-- CreateIndex
CREATE INDEX "historial_cargos_evento_eventoId_fecha_idx" ON "historial_cargos_evento"("eventoId", "fecha");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_condicionRevisadaPorId_fkey" FOREIGN KEY ("condicionRevisadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_plataforma" ADD CONSTRAINT "parametros_plataforma_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_parametros" ADD CONSTRAINT "historial_parametros_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_cargos_evento" ADD CONSTRAINT "historial_cargos_evento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_cargos_evento" ADD CONSTRAINT "historial_cargos_evento_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- % de cargo vigente para los eventos que se creen desde ahora
INSERT INTO "parametros_plataforma" ("clave", "valor", "descripcion", "fechaActualizacion")
VALUES ('PORCENTAJE_CARGO_SERVICIO', '10', 'Porcentaje de cargo por servicio que se fija a cada evento al crearlo', NOW());

-- Los eventos existentes se crearon sin cargo: mantienen 0% (el precio que ve el público no cambia)
UPDATE "events" SET "porcentajeCargo" = 0;

-- Las compras anteriores no tenían cargo: el precio base es el mismo que pagó el asistente
UPDATE "compras" SET "precioBase" = "precioUnitario", "porcentajeCargo" = 0, "cargoServicio" = 0;
