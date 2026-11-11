-- Restricción de edad de los eventos (14, 16 o 18; null = todo público)
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "edadMinima" INTEGER;


-- Solo se permiten las edades que ofrece el formulario
ALTER TABLE "events" ADD CONSTRAINT "events_edadMinima_check" CHECK ("edadMinima" IS NULL OR "edadMinima" IN (14, 16, 18));
