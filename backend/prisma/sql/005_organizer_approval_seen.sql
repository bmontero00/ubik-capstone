-- Aviso de cuenta verificada: se muestra solo en el primer ingreso tras la aprobación
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "organizer_profiles" ADD COLUMN     "approvalSeenAt" TIMESTAMP(3);


-- Los organizadores ya aprobados han ingresado antes con el aviso visible:
-- se marca como visto para que solo lo vean quienes se aprueben desde ahora.
UPDATE "organizer_profiles" SET "approvalSeenAt" = NOW() WHERE "status" = 'APPROVED';
