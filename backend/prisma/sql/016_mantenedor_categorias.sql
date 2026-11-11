-- Mantenedor de categorías: color, emoji, visibilidad y orden; categoría "Otra" con sugerencia del organizador
-- Estructura generada con: prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script
-- Datos: color y emoji de las categorías actuales y 9 categorías nuevas

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#818cf8',
ADD COLUMN     "emoji" TEXT NOT NULL DEFAULT '✨',
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "categoriaSugerida" TEXT;

-- Categorías actuales: mismos colores que ya usaba el sitio
UPDATE "categories" AS c SET "color" = v.color, "emoji" = v.emoji, "orden" = v.orden
FROM (VALUES
  ('Cultural', '#60a5fa', '🎭', 1),
  ('Música', '#a78bfa', '🎵', 2),
  ('Deporte', '#34d399', '🏅', 3),
  ('Gastronomía', '#fb923c', '🍽️', 4),
  ('Talleres', '#facc15', '🛠️', 5),
  ('Diversión', '#f472b6', '🎉', 6),
  ('Videojuegos', '#c084fc', '🎮', 7),
  ('Vehículos', '#f59e0b', '🚗', 8)
) AS v(nombre, color, emoji, orden)
WHERE c."name" = v.nombre;

-- Categorías nuevas ("Otra" siempre al final)
INSERT INTO "categories" ("id", "name", "color", "emoji", "orden") VALUES
  (gen_random_uuid()::text, 'Mascotas', '#fb7185', '🐾', 9),
  (gen_random_uuid()::text, 'Familia y niños', '#38bdf8', '🧸', 10),
  (gen_random_uuid()::text, 'Bienestar y salud', '#2dd4bf', '🧘', 11),
  (gen_random_uuid()::text, 'Educación y charlas', '#818cf8', '🎓', 12),
  (gen_random_uuid()::text, 'Tecnología', '#22d3ee', '💻', 13),
  (gen_random_uuid()::text, 'Solidario', '#4ade80', '🤝', 14),
  (gen_random_uuid()::text, 'Ferias y emprendimiento', '#e879f9', '🛍️', 15),
  (gen_random_uuid()::text, 'Aire libre', '#a3e635', '⛰️', 16),
  (gen_random_uuid()::text, 'Otra', '#94a3b8', '🧩', 999)
ON CONFLICT ("name") DO NOTHING;
