import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // 🚀 NUEVO MÉTODO: Registrar y guardar el evento en Supabase/PostgreSQL vía Prisma
  async create(data: {
    title: string;
    description: string;
    price: number;
    date: string | Date;
    address: string;
    latitude: number;
    longitude: number;
    categoryId?: string | number;
    organizerId?: string;
    imageUrl?: string;
  }) {
    return this.prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        price: Number(data.price),
        date: new Date(data.date),
        address: data.address,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        categoryId: String(data.categoryId || '1'), // 👈 Cambiado a string para solucionar el error de tipo
        organizerId: data.organizerId || '1',
        imageUrl: data.imageUrl || null,
      },
      include: {
        category: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAll(lat?: number, lng?: number, radiusKm?: number) {
    const events = await this.prisma.event.findMany({
      include: {
        category: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { date: 'asc' },
    });

    if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
      return events
        .map((evt) => {
          const distance = this.calculateHaversine(lat, lng, evt.latitude, evt.longitude);
          return { ...evt, distanceKm: Math.round(distance * 10) / 10 };
        })
        .filter((evt) => evt.distanceKm <= radiusKm);
    }

    return events;
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { category: true, organizer: { select: { id: true, name: true } } },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  private calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  
}