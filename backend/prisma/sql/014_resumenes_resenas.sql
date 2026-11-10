-- Resumen de reseñas por organizador generado con IA (o modo de prueba)
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateTable
CREATE TABLE "resumenes_resenas" (
    "id" TEXT NOT NULL,
    "organizadorId" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "destacados" JSONB NOT NULL,
    "aMejorar" JSONB NOT NULL,
    "sugerencias" JSONB NOT NULL,
    "totalResenas" INTEGER NOT NULL,
    "promedio" DOUBLE PRECISION NOT NULL,
    "origen" TEXT NOT NULL,
    "modelo" TEXT,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumenes_resenas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumenes_resenas_organizadorId_key" ON "resumenes_resenas"("organizadorId");

-- AddForeignKey
ALTER TABLE "resumenes_resenas" ADD CONSTRAINT "resumenes_resenas_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

