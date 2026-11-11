import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { CATEGORIA_OTRA, ORDEN_OTRA, normalizarSugerencia } from '../common/categorias';

export interface DatosCategoria {
  name?: string;
  color?: string;
  emoji?: string;
  activa?: boolean;
  orden?: number;
}

// Mantenedor de categorías: crear, editar, ocultar y mover a una categoría nueva los eventos
// que quedaron en "Otra" con la misma sugerencia
@Injectable()
export class CategoriasAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    const [categorias, enOtra] = await Promise.all([
      this.prisma.category.findMany({ orderBy: [{ orden: 'asc' }, { name: 'asc' }], include: { _count: { select: { events: true } } } }),
      this.prisma.event.findMany({
        where: { category: { name: CATEGORIA_OTRA }, categoriaSugerida: { not: null } },
        select: { id: true, title: true, categoriaSugerida: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Agrupa las sugerencias equivalentes y muestra la forma más usada (ej. "Mascotas")
    const grupos = new Map<string, { formas: Map<string, number>; eventos: { id: string; title: string }[] }>();
    for (const e of enOtra) {
      const clave = normalizarSugerencia(e.categoriaSugerida!);
      if (!clave) continue;
      const g = grupos.get(clave) ?? { formas: new Map<string, number>(), eventos: [] as { id: string; title: string }[] };
      const forma = e.categoriaSugerida!.trim().replace(/\s+/g, ' ');
      g.formas.set(forma, (g.formas.get(forma) ?? 0) + 1);
      g.eventos.push({ id: e.id, title: e.title });
      grupos.set(clave, g);
    }
    const sugerencias = [...grupos.entries()]
      .map(([clave, g]) => ({
        clave,
        sugerencia: [...g.formas.entries()].sort((a, b) => b[1] - a[1])[0][0],
        cantidad: g.eventos.length,
        eventos: g.eventos.slice(0, 5), // ejemplos
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    return {
      categorias: categorias.map(({ _count, ...c }) => ({ ...c, eventos: _count.events, esOtra: c.name === CATEGORIA_OTRA })),
      sugerencias,
    };
  }

  async crear(datos: Required<Pick<DatosCategoria, 'name' | 'color' | 'emoji'>>) {
    await this.assertNombreLibre(datos.name);
    const ultima = await this.prisma.category.aggregate({ where: { orden: { lt: ORDEN_OTRA } }, _max: { orden: true } });
    return this.prisma.category.create({
      data: { name: datos.name, color: datos.color.toLowerCase(), emoji: datos.emoji.trim(), orden: (ultima._max.orden ?? 0) + 1 },
    });
  }

  async editar(id: string, datos: DatosCategoria) {
    const actual = await this.prisma.category.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Categoría no encontrada');
    if (actual.name === CATEGORIA_OTRA && (datos.name !== undefined && datos.name !== CATEGORIA_OTRA || datos.activa === false || datos.orden !== undefined)) {
      throw new BadRequestException('La categoría "Otra" no se puede renombrar, ocultar ni mover: es la opción para eventos que no calzan en ninguna');
    }
    if (datos.name !== undefined && datos.name !== actual.name) await this.assertNombreLibre(datos.name, id);
    if (datos.orden !== undefined && datos.orden >= ORDEN_OTRA) throw new BadRequestException(`El orden debe ser menor que ${ORDEN_OTRA}`);
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(datos.name !== undefined && { name: datos.name }),
        ...(datos.color !== undefined && { color: datos.color.toLowerCase() }),
        ...(datos.emoji !== undefined && { emoji: datos.emoji.trim() }),
        ...(datos.activa !== undefined && { activa: datos.activa }),
        ...(datos.orden !== undefined && { orden: datos.orden }),
      },
    });
  }

  // Mueve a la categoría indicada los eventos de "Otra" que sugirieron lo mismo (queda en sus novedades)
  async moverSugerencia(id: string, sugerencia: string, admin: AuthenticatedUser) {
    const destino = await this.prisma.category.findUnique({ where: { id } });
    if (!destino) throw new NotFoundException('Categoría no encontrada');
    if (destino.name === CATEGORIA_OTRA) throw new BadRequestException('Elige una categoría distinta de "Otra"');

    const clave = normalizarSugerencia(sugerencia);
    const candidatos = await this.prisma.event.findMany({
      where: { category: { name: CATEGORIA_OTRA }, categoriaSugerida: { not: null } },
      select: { id: true, categoriaSugerida: true },
    });
    const ids = candidatos.filter((e) => normalizarSugerencia(e.categoriaSugerida!) === clave).map((e) => e.id);
    if (!ids.length) throw new BadRequestException('No hay eventos en "Otra" con esa sugerencia');

    const cambios = [{ campo: 'categoria', anterior: CATEGORIA_OTRA, nuevo: destino.name }] as Prisma.InputJsonValue;
    await this.prisma.$transaction([
      this.prisma.event.updateMany({ where: { id: { in: ids } }, data: { categoryId: id, categoriaSugerida: null } }),
      this.prisma.bitacoraEvento.createMany({
        data: ids.map((eventoId) => ({ tipo: 'CAMBIO_DATOS' as const, eventoId, autorId: admin.sub, cambios })),
      }),
    ]);
    return { movidos: ids.length, categoria: destino.name };
  }

  private async assertNombreLibre(name: string, exceptoId?: string) {
    const existente = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptoId && { id: { not: exceptoId } }) },
      select: { id: true },
    });
    if (existente) throw new ConflictException(`Ya existe la categoría "${name}"`);
  }
}
