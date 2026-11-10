// Reglas de las reseñas (el frontend muestra los mismos límites)
export const RESENA = {
  minComentario: 20,
  maxComentario: 500,
  minRespuesta: 10,
  maxRespuesta: 500,
  // Días para reseñar desde que el evento se finaliza (a la medianoche siguiente a su fecha)
  diasParaResenar: 60,
  porPagina: 10,
};

const DIA = 86_400_000;

// Último momento para reseñar un evento: la finalización automática ocurre a la medianoche del día
// siguiente a su fecha y desde ahí corre el plazo (se suma un día completo como margen)
export const cierreResenas = (fechaEvento: Date) => new Date(fechaEvento.getTime() + (RESENA.diasParaResenar + 1) * DIA);

// Nombre público del autor: nombre y la inicial del apellido (ej. "Matías M.")
export const nombrePublico = (nombre: string) => {
  const [primero, ...resto] = nombre.trim().split(/\s+/);
  const inicial = resto.find(Boolean)?.[0];
  return inicial ? `${primero} ${inicial.toUpperCase()}.` : primero;
};
