-- Nota del administrador al aprobar una solicitud de organizador (el motivo es obligatorio en todo cambio)
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "organizer_profiles" ADD COLUMN     "approvalNote" TEXT;

