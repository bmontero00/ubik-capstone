import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Reglas del motivo que el administrador escribe al cambiar un estado.
// Acepta cualquier carácter de redacción (tildes, ñ, ¿?, ¡!, comillas, saltos de línea…);
// solo exige un largo razonable y que contenga al menos una letra.
export const REASON_MIN = 10;
export const REASON_MAX = 500;

export function IsReason() {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.normalize('NFC').trim() : value)),
    IsString({ message: 'El motivo es obligatorio' }),
    MinLength(REASON_MIN, { message: `El motivo debe tener al menos ${REASON_MIN} caracteres` }),
    MaxLength(REASON_MAX, { message: `El motivo puede tener como máximo ${REASON_MAX} caracteres` }),
    Matches(/\p{L}/u, { message: 'El motivo debe contener texto' }),
  );
}
