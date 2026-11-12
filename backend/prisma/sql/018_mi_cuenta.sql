-- Mi cuenta: foto de perfil y datos opcionales del asistente (celular y RUT)
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fotoPerfil" TEXT,
ADD COLUMN     "rut" TEXT,
ADD COLUMN     "telefono" TEXT;

