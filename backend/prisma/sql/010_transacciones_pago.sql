-- Pagos con Webpay Plus: cada intento de pago de una compra y los datos de su comprobante
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "EstadoTransaccion" AS ENUM ('INICIADA', 'AUTORIZADA', 'RECHAZADA', 'ANULADA', 'REVERSADA', 'ERROR');

-- CreateTable
CREATE TABLE "transacciones_pago" (
    "id" TEXT NOT NULL,
    "medio" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ordenCompra" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoTransaccion" NOT NULL DEFAULT 'INICIADA',
    "codigoRespuesta" INTEGER,
    "codigoAutorizacion" TEXT,
    "tipoPago" TEXT,
    "cuotas" INTEGER,
    "montoCuota" DOUBLE PRECISION,
    "ultimosDigitos" TEXT,
    "fechaTransaccion" TIMESTAMP(3),
    "respuesta" JSONB,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    "compraId" TEXT NOT NULL,

    CONSTRAINT "transacciones_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_pago_token_key" ON "transacciones_pago"("token");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_pago_ordenCompra_key" ON "transacciones_pago"("ordenCompra");

-- CreateIndex
CREATE INDEX "transacciones_pago_compraId_fechaCreacion_idx" ON "transacciones_pago"("compraId", "fechaCreacion");

-- AddForeignKey
ALTER TABLE "transacciones_pago" ADD CONSTRAINT "transacciones_pago_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

