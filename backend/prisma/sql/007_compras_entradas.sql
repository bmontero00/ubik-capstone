-- Compra de entradas: compras (una por transacción) y entradas nominativas por asistente
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('PENDIENTE_PAGO', 'PAGADA', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "EstadoCompra" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "medioPago" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "eventoId" TEXT NOT NULL,
    "compradorId" TEXT NOT NULL,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entradas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compraId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,

    CONSTRAINT "entradas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compras_codigo_key" ON "compras"("codigo");

-- CreateIndex
CREATE INDEX "compras_compradorId_fechaCreacion_idx" ON "compras"("compradorId", "fechaCreacion");

-- CreateIndex
CREATE INDEX "compras_eventoId_estado_idx" ON "compras"("eventoId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "entradas_codigo_key" ON "entradas"("codigo");

-- CreateIndex
CREATE INDEX "entradas_eventoId_rut_idx" ON "entradas"("eventoId", "rut");

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

