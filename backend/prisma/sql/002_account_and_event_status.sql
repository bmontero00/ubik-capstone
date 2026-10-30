-- Estados de cuenta (activa / en revisión / suspendida) y de eventos
-- Generado con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PUBLISHED', 'UNDER_REVIEW', 'POSTPONED', 'CANCELLED', 'FINISHED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedById" TEXT,
ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedById" TEXT,
ADD COLUMN     "statusReason" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

