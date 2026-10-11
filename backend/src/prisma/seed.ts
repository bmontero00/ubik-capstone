import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando carga de datos iniciales en Supabase...');

  // 1. Crear categorías oficiales de UBIK
  const catCultural = await prisma.category.upsert({
    where: { name: 'Cultural' },
    update: {},
    create: { name: 'Cultural' },
  });

  const catMusica = await prisma.category.upsert({
    where: { name: 'Música' },
    update: {},
    create: { name: 'Música' },
  });

  const catTalleres = await prisma.category.upsert({
    where: { name: 'Talleres' },
    update: {},
    create: { name: 'Talleres' },
  });

  // 2. Obtener un usuario existente como organizador (o crearlo si no existe)
  let organizer = await prisma.user.findFirst();
  if (!organizer) {
    organizer = await prisma.user.create({
      data: {
        email: 'organizador@ubik.cl',
        password: 'hashed_password_placeholder',
        name: 'Colectivo Cultural Santiago Centro',
        role: 'ORGANIZER',
      },
    });
  }

  // 3. Crear eventos reales georreferenciados (Santiago Centro / Barrio Parque Almagro)
  await prisma.event.createMany({
    data: [
      {
        title: 'Feria Costumbrista y Gastronómica Barrial',
        description: 'Muestra gastronómica tradicional y artesanía local.',
        price: 0, // Regla de negocio: Gratuito, sin emisión de ticket
        date: new Date('2026-10-18T16:00:00Z'),
        address: 'Parque Almagro, Santiago Centro',
        latitude: -33.4515,
        longitude: -70.6528,
        categoryId: catCultural.id,
        organizerId: organizer.id,
      },
      {
        title: 'Concierto Acústico Bandas Emergentes',
        description: 'Presentación en vivo de música indie y acústica.',
        price: 5000,
        date: new Date('2026-10-24T20:00:00Z'),
        address: 'Av. Libertador Bernardo O Higgins 1300, Santiago',
        latitude: -33.4442,
        longitude: -70.6558,
        categoryId: catMusica.id,
        organizerId: organizer.id,
      },
      {
        title: 'Taller Comunitario de Huertos Urbanos',
        description: 'Aprende a cultivar verduras y hierbas en balcones y patios.',
        price: 0,
        date: new Date('2026-10-26T10:30:00Z'),
        address: 'Santa Isabel 450, Santiago Centro',
        latitude: -33.4491,
        longitude: -70.6432,
        categoryId: catTalleres.id,
        organizerId: organizer.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed ejecutado con éxito en Supabase.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });