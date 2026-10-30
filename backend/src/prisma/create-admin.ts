// Crea un administrador o promueve a ADMIN un usuario existente.
// Los administradores no se pueden crear desde el registro público.
//
// Uso:
//   npm run create-admin -- <correo> "<nombre>" <contraseña>   (usuario nuevo)
//   npm run create-admin -- <correo>                            (promover usuario existente)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email) {
    throw new Error('Uso: npm run create-admin -- <correo> "<nombre>" <contraseña>');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`El usuario ${email} ahora es administrador.`);
    return;
  }

  if (!name || !password || password.length < 8) {
    throw new Error('Para crear un usuario nuevo indica nombre y una contraseña de al menos 8 caracteres.');
  }

  await prisma.user.create({
    data: { email, name, password: await bcrypt.hash(password, 10), role: 'ADMIN' },
  });
  console.log(`Administrador ${email} creado.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
