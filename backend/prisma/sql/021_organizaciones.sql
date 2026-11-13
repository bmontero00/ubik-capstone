-- Organizaciones: entidad propia con RUT único, verificada por UBIK; un organizador pertenece a una (o a ninguna si organiza a título personal)
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script
-- Las organizaciones existentes (organizationName) se crean después con un script, como pendientes y sin RUT

-- CreateEnum
CREATE TYPE "EstadoOrganizacion" AS ENUM ('PENDIENTE', 'VERIFICADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "organizer_profiles" ADD COLUMN     "organizacionId" TEXT;

-- CreateTable
CREATE TABLE "organizaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "rut" TEXT,
    "estado" "EstadoOrganizacion" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "verificadaEn" TIMESTAMP(3),
    "verificadaPorId" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizaciones_rut_key" ON "organizaciones"("rut");

-- CreateIndex
CREATE INDEX "organizaciones_nombreNormalizado_idx" ON "organizaciones"("nombreNormalizado");

-- AddForeignKey
ALTER TABLE "organizer_profiles" ADD CONSTRAINT "organizer_profiles_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizaciones" ADD CONSTRAINT "organizaciones_verificadaPorId_fkey" FOREIGN KEY ("verificadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

