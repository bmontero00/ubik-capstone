-- Ofertas del organizador: precio rebajado por entrada, con término opcional
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "ofertaCreadaEn" TIMESTAMP(3),
ADD COLUMN     "ofertaHasta" TIMESTAMP(3),
ADD COLUMN     "precioOferta" DOUBLE PRECISION;
