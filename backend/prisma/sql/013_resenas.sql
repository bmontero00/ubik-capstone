-- Reseñas de eventos: calificación y comentario de asistentes, con respuesta del organizador
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateTable
CREATE TABLE "resenas" (
    "id" TEXT NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "respuesta" TEXT,
    "fechaRespuesta" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEdicion" TIMESTAMP(3),
    "eventoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "organizadorId" TEXT NOT NULL,

    CONSTRAINT "resenas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resenas_organizadorId_fechaCreacion_idx" ON "resenas"("organizadorId", "fechaCreacion");

-- CreateIndex
CREATE UNIQUE INDEX "resenas_eventoId_autorId_key" ON "resenas"("eventoId", "autorId");

-- AddForeignKey
ALTER TABLE "resenas" ADD CONSTRAINT "resenas_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resenas" ADD CONSTRAINT "resenas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resenas" ADD CONSTRAINT "resenas_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Las estrellas van de 1 a 5
ALTER TABLE "resenas" ADD CONSTRAINT "resenas_estrellas_check" CHECK ("estrellas" BETWEEN 1 AND 5);
