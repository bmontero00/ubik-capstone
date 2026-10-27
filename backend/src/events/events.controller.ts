import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  UploadedFile, 
  UseInterceptors, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // 🚀 NUEVO ENDPOINT: Obtener las categorías reales desde Supabase para el selector del Frontend
  @Get('categories')
  async getCategories() {
    return this.eventsService.findAllCategories();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads', // Carpeta local sincronizada con main.ts
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `event-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
          return callback(new BadRequestException('Solo se permiten archivos de imagen .jpg, .jpeg o .png'), false);
        }
        callback(null, true);
      },
    }),
  )
  async create(
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Si se adjuntó un archivo de imagen, generamos la ruta estática accesible
    const imageUrl = file ? `/uploads/${file.filename}` : null;

    // Procesamos y limpiamos los tipos de datos recibidos del FormData
    const eventData = {
      ...body,
      price: Number(body.price),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      categoryId: body.categoryId ? String(body.categoryId) : undefined,
      imageUrl,
    };

    return this.eventsService.create(eventData);
  }

  @Get()
  async findAll(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
  ) {
    return this.eventsService.findAll(
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      radius ? Number(radius) : undefined,
    );
  }
}