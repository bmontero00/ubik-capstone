import { Transform } from 'class-transformer';
import { IsInt, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { RESENA } from '../resenas.reglas';

// Sin espacios al inicio o final y sin más de una línea en blanco seguida
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\n{3,}/g, '\n\n') : value);

export class GuardarResenaDto {
  @IsInt({ message: 'Elige de 1 a 5 estrellas' })
  @Min(1, { message: 'Elige de 1 a 5 estrellas' })
  @Max(5, { message: 'Elige de 1 a 5 estrellas' })
  estrellas: number;

  @Transform(recortar)
  @IsString({ message: 'Escribe un comentario' })
  @Length(RESENA.minComentario, RESENA.maxComentario, {
    message: `El comentario debe tener entre ${RESENA.minComentario} y ${RESENA.maxComentario} caracteres`,
  })
  comentario: string;
}

export class CrearResenaDto extends GuardarResenaDto {
  @IsUUID('4', { message: 'El evento no es válido' })
  eventoId: string;
}

export class ResponderResenaDto {
  @Transform(recortar)
  @IsString({ message: 'Escribe tu respuesta' })
  @Length(RESENA.minRespuesta, RESENA.maxRespuesta, {
    message: `La respuesta debe tener entre ${RESENA.minRespuesta} y ${RESENA.maxRespuesta} caracteres`,
  })
  respuesta: string;
}
