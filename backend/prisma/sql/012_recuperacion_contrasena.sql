-- Recuperación de contraseña por correo: códigos de un solo uso y fecha del último cambio de contraseña
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "contrasenaCambiadaEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "codigos_recuperacion" (
    "id" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "usadoEn" TIMESTAMP(3),
    "anuladoEn" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "codigos_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigos_recuperacion_usuarioId_fechaCreacion_idx" ON "codigos_recuperacion"("usuarioId", "fechaCreacion");

-- AddForeignKey
ALTER TABLE "codigos_recuperacion" ADD CONSTRAINT "codigos_recuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

