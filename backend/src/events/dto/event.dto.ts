import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsISO8601, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, Length, Max, Min,
} from 'class-validator';
import { IsReason } from '../../common/reason.validator';

// Límites compartidos con el formulario del frontend (frontend/src/components/events/eventRules.ts)
export const EVENT_LIMITS = {
  titleMin: 5,
  titleMax: 100,
  descriptionMin: 20,
  descriptionMax: 2000,
  addressMin: 3,
  addressMax: 200,
  priceMax: 10_000_000,
};

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.normalize('NFC').trim() : value));
// Los datos llegan como multipart/form-data, así que todo viene como texto
const toNumber = () => Type(() => Number);
const toBoolean = () => Transform(({ value }) => value === true || value === 'true');

export class CreateEventDto {
  @trim()
  @IsString()
  @Length(EVENT_LIMITS.titleMin, EVENT_LIMITS.titleMax, {
    message: `El título debe tener entre ${EVENT_LIMITS.titleMin} y ${EVENT_LIMITS.titleMax} caracteres`,
  })
  title: string;

  @trim()
  @IsString()
  @Length(EVENT_LIMITS.descriptionMin, EVENT_LIMITS.descriptionMax, {
    message: `La descripción debe tener entre ${EVENT_LIMITS.descriptionMin} y ${EVENT_LIMITS.descriptionMax} caracteres`,
  })
  description: string;

  @toNumber()
  @IsInt({ message: 'El precio debe ser un monto entero en pesos' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(EVENT_LIMITS.priceMax, { message: 'El precio supera el máximo permitido' })
  price: number;

  @IsISO8601({}, { message: 'La fecha y hora del evento no son válidas' })
  date: string;

  @trim()
  @IsString()
  @Length(EVENT_LIMITS.addressMin, EVENT_LIMITS.addressMax, { message: 'Indica la dirección del evento' })
  address: string;

  @toNumber()
  @IsLatitude({ message: 'La ubicación del evento no es válida' })
  latitude: number;

  @toNumber()
  @IsLongitude({ message: 'La ubicación del evento no es válida' })
  longitude: number;

  @IsString()
  @IsNotEmpty({ message: 'Selecciona una categoría' })
  categoryId: string;
}

export class UpdateEventDto {
  @IsOptional()
  @trim()
  @IsString()
  @Length(EVENT_LIMITS.titleMin, EVENT_LIMITS.titleMax, {
    message: `El título debe tener entre ${EVENT_LIMITS.titleMin} y ${EVENT_LIMITS.titleMax} caracteres`,
  })
  title?: string;

  @IsOptional()
  @trim()
  @IsString()
  @Length(EVENT_LIMITS.descriptionMin, EVENT_LIMITS.descriptionMax, {
    message: `La descripción debe tener entre ${EVENT_LIMITS.descriptionMin} y ${EVENT_LIMITS.descriptionMax} caracteres`,
  })
  description?: string;

  @IsOptional()
  @toNumber()
  @IsInt({ message: 'El precio debe ser un monto entero en pesos' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(EVENT_LIMITS.priceMax, { message: 'El precio supera el máximo permitido' })
  price?: number;

  @IsOptional()
  @IsISO8601({}, { message: 'La fecha y hora del evento no son válidas' })
  date?: string;

  @IsOptional()
  @trim()
  @IsString()
  @Length(EVENT_LIMITS.addressMin, EVENT_LIMITS.addressMax, { message: 'Indica la dirección del evento' })
  address?: string;

  @IsOptional()
  @toNumber()
  @IsLatitude({ message: 'La ubicación del evento no es válida' })
  latitude?: number;

  @IsOptional()
  @toNumber()
  @IsLongitude({ message: 'La ubicación del evento no es válida' })
  longitude?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Selecciona una categoría' })
  categoryId?: string;

  // true para quitar la imagen actual sin subir otra
  @IsOptional()
  @toBoolean()
  @IsBoolean()
  removeImage?: boolean;
}

export class CancelEventDto {
  @IsReason()
  reason: string;
}
