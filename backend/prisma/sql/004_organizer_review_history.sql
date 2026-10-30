-- Historial de revisiones de solicitudes de organizador
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script
-- más una sección manual que traslada al historial las revisiones existentes.

-- AlterTable
ALTER TABLE "organizer_profiles" ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "organizer_reviews" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "decision" "OrganizerStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "applicantName" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "organizationName" TEXT,
    "eventDescription" TEXT NOT NULL,
    "socialUrl" TEXT,

    CONSTRAINT "organizer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizer_reviews_profileId_reviewedAt_idx" ON "organizer_reviews"("profileId", "reviewedAt");

-- AddForeignKey
ALTER TABLE "organizer_reviews" ADD CONSTRAINT "organizer_reviews_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "organizer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_reviews" ADD CONSTRAINT "organizer_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Datos existentes (manual)
-- ---------------------------------------------------------------------------

-- La fecha de envío de las solicitudes existentes es su fecha de creación
UPDATE "organizer_profiles" SET "submittedAt" = "createdAt";

-- Cada solicitud ya revisada pasa al historial con su última revisión.
-- Las aprobaciones anteriores a la nota obligatoria no tienen motivo guardado.
INSERT INTO "organizer_reviews" (
  "id", "profileId", "decision", "reason", "reviewedAt", "reviewedById",
  "submittedAt", "applicantName", "rut", "phone", "organizationName", "eventDescription", "socialUrl"
)
SELECT
  gen_random_uuid()::text, p."id", p."status",
  COALESCE(
    CASE WHEN p."status" = 'REJECTED' THEN p."rejectionReason" ELSE p."approvalNote" END,
    'Motivo no registrado (revisión anterior al historial)'
  ),
  p."reviewedAt", p."reviewedById",
  p."createdAt", u."name", p."rut", p."phone", p."organizationName", p."eventDescription", p."socialUrl"
FROM "organizer_profiles" p
JOIN "users" u ON u."id" = p."userId"
WHERE p."status" IN ('APPROVED', 'REJECTED') AND p."reviewedAt" IS NOT NULL;
