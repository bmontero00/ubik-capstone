import { BitacoraEvento, Event, EventStatus, Prisma } from '@prisma/client';

// Un cambio registrado en la bitácora. Para la descripción y la imagen solo se indica que cambiaron.
export interface CambioBitacora {
  campo: 'titulo' | 'fecha' | 'direccion' | 'precio' | 'categoria' | 'descripcion' | 'imagen' | 'estado';
  anterior?: string | number | null;
  nuevo?: string | number | null;
}

type EventSnapshot = Pick<Event, 'title' | 'date' | 'address' | 'price' | 'categoryId' | 'description' | 'imageUrl'>;

// Compara el evento antes y después de editarlo. Las categorías se guardan por nombre.
export function diffEvent(
  before: EventSnapshot,
  after: EventSnapshot,
  categoryName: (id: string) => string | undefined,
): CambioBitacora[] {
  const cambios: CambioBitacora[] = [];
  if (before.title !== after.title) cambios.push({ campo: 'titulo', anterior: before.title, nuevo: after.title });
  if (before.date.getTime() !== after.date.getTime()) {
    cambios.push({ campo: 'fecha', anterior: before.date.toISOString(), nuevo: after.date.toISOString() });
  }
  if (before.address !== after.address) cambios.push({ campo: 'direccion', anterior: before.address, nuevo: after.address });
  if (before.price !== after.price) cambios.push({ campo: 'precio', anterior: before.price, nuevo: after.price });
  if (before.categoryId !== after.categoryId) {
    cambios.push({ campo: 'categoria', anterior: categoryName(before.categoryId), nuevo: categoryName(after.categoryId) });
  }
  if ((before.description ?? '') !== (after.description ?? '')) cambios.push({ campo: 'descripcion' });
  if (before.imageUrl !== after.imageUrl) cambios.push({ campo: 'imagen' });
  return cambios;
}

export const cambioEstado = (anterior: EventStatus, nuevo: EventStatus): CambioBitacora => ({
  campo: 'estado',
  anterior,
  nuevo,
});

export const bitacoraInclude = {
  autor: { select: { id: true, name: true, role: true, organizerProfile: { select: { organizationName: true } } } },
} satisfies Prisma.BitacoraEventoInclude;

type EntradaConAutor = BitacoraEvento & {
  autor: { id: string; name: string; role: string; organizerProfile: { organizationName: string | null } | null };
};

// Las revisiones de moderación (entrar o salir de "En revisión") son internas:
// solo las ven el organizador del evento y los administradores.
const esInterna = (entrada: BitacoraEvento) =>
  entrada.tipo === 'CAMBIO_ESTADO' &&
  ((entrada.cambios as CambioBitacora[] | null) ?? []).some(
    (c) => c.campo === 'estado' && (c.anterior === 'UNDER_REVIEW' || c.nuevo === 'UNDER_REVIEW'),
  );

// Lo que ve cada persona de la bitácora. Los administradores firman como "Equipo UBIK".
export function serializeBitacora(entradas: EntradaConAutor[], canManage: boolean) {
  return entradas
    .filter((e) => canManage || !esInterna(e))
    .map((e) => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      mensaje: e.mensaje,
      cambios: (e.cambios as CambioBitacora[] | null) ?? [],
      fechaCreacion: e.fechaCreacion,
      interna: esInterna(e),
      autor: {
        id: e.autor.id,
        esEquipoUbik: e.autor.role === 'ADMIN',
        nombre: e.autor.role === 'ADMIN' ? 'Equipo UBIK' : e.autor.organizerProfile?.organizationName || e.autor.name,
      },
    }));
}
