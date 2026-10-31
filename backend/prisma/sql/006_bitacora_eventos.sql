-- Bitácora de eventos: anuncios del organizador y registro automático de cambios
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "TipoBitacora" AS ENUM ('CREACION', 'ANUNCIO', 'CAMBIO_DATOS', 'CAMBIO_ESTADO');

-- CreateTable
CREATE TABLE "bitacora_eventos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoBitacora" NOT NULL,
    "titulo" TEXT,
    "mensaje" TEXT,
    "cambios" JSONB,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,

    CONSTRAINT "bitacora_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bitacora_eventos_eventoId_fechaCreacion_idx" ON "bitacora_eventos"("eventoId", "fechaCreacion");

-- AddForeignKey
ALTER TABLE "bitacora_eventos" ADD CONSTRAINT "bitacora_eventos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_eventos" ADD CONSTRAINT "bitacora_eventos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Los eventos existentes parten su bitácora con la entrada de publicación
INSERT INTO "bitacora_eventos" ("id", "tipo", "fechaCreacion", "eventoId", "autorId")
SELECT gen_random_uuid()::text, 'CREACION', e."createdAt", e."id", e."organizerId"
FROM "events" e;
