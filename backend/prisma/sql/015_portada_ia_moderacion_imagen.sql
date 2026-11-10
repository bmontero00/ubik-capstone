-- Portada diseñada con IA y moderación de la imagen del evento
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "imagenModeradaEn" TIMESTAMP(3),
ADD COLUMN     "portadaIa" JSONB;

