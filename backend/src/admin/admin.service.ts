import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listOrganizerRequests(status?: OrganizerStatus) {
    return this.prisma.organizerProfile.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' }, // Las más antiguas primero
    });
  }

  async reviewOrganizer(profileId: string, adminId: string, approve: boolean, reason?: string) {
    const profile = await this.prisma.organizerProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Solicitud no encontrada');

    if (!approve && !reason?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo para que el organizador pueda corregirlo');
    }

    return this.prisma.organizerProfile.update({
      where: { id: profileId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        rejectionReason: approve ? null : reason!.trim(),
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
  }
}
