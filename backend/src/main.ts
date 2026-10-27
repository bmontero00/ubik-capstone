import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express'; // 👈 1. Importar tipo de aplicación Express
import { join } from 'path'; // 👈 2. Importar join para manejar rutas del sistema de ficheros
import { AppModule } from './app.module';

async function bootstrap() {
  // 🚀 3. Tipar la app como NestExpressApplication para acceder a métodos de archivos estáticos
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 🚀 4. Exponer la carpeta local 'uploads' para que las imágenes sean accesibles vía URL
  // Ejemplo: http://localhost:3000/uploads/nombre-de-imagen.png
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 UBIK API escuchando en http://localhost:${port}`);
}
bootstrap();