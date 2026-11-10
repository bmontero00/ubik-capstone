import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsNumber,
  IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, Validate, ValidateIf, ValidateNested,
  ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface,
} from 'class-validator';
import { OFERTA_LIMITS, PORCENTAJE_CARGO_MAX } from '../../parametros/cargos';
import { IsReason } from '../../common/reason.validator';
import { TIPO_ENTRADA_LIMITS, errorDescripcionTipo, errorNombreTipo, normalizarNombreTipo } from '../tipos-entrada';

// Límites compartidos con el formulario del frontend (frontend/src/components/events/eventRules.ts)
export const EVENT_LIMITS = {
  titleMin: 5,
  titleMax: 100,
  descriptionMin: 20,
  descriptionMax: 2000,
  addressMin: 3,
  addressMax: 200,
  priceMax: 10_000_000,
  announcementTitleMin: 3,
  announcementTitleMax: 80,
  announcementMin: 10,
  announcementMax: 1000,
};

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.normalize('NFC').trim() : value));
// Los datos llegan como multipart/form-data, así que todo viene como texto
const toNumber = () => Type(() => Number);
const toBoolean = () => Transform(({ value }) => value === true || value === 'true');

@ValidatorConstraint({ name: 'nombreTipoEntrada' })
class NombreTipoEntrada implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && !errorNombreTipo(value);
  }
  defaultMessage(args: ValidationArguments) {
    return errorNombreTipo(String(args.value ?? '')) ?? 'Indica el nombre del tipo de entrada';
  }
}

@ValidatorConstraint({ name: 'textoSinContacto' })
class TextoSinContacto implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && !errorDescripcionTipo(value);
  }
  defaultMessage(args: ValidationArguments) {
    return errorDescripcionTipo(String(args.value ?? '')) ?? 'El texto no es válido';
  }
}

// Un tipo de entrada del evento. Al editar, "id" identifica a los que ya existen.
export class TipoEntradaDto {
  @IsOptional()
  @IsUUID('4', { message: 'El tipo de entrada no es válido' })
  id?: string;

  @Transform(({ value }) => (typeof value === 'string' ? normalizarNombreTipo(value) : value))
  @Validate(NombreTipoEntrada)
  nombre: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim() || undefined : value))
  @Validate(TextoSinContacto)
  descripcion?: string;

  @IsInt({ message: 'El precio de cada tipo de entrada debe ser un monto entero en pesos' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(EVENT_LIMITS.priceMax, { message: 'El precio supera el máximo permitido' })
  precio: number;

  @IsInt({ message: 'Indica el cupo de cada tipo de entrada' })
  @Min(1, { message: 'Cada tipo de entrada debe tener al menos 1 cupo' })
  @Max(TIPO_ENTRADA_LIMITS.cupoMax, { message: 'El cupo supera el máximo permitido' })
  cupo: number;
}

// Con multipart/form-data los tipos de entrada llegan como texto JSON
const tiposDesdeJson = () =>
  Transform(({ value }) => {
    let v: unknown = value;
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        return value;
      }
    }
    return Array.isArray(v) ? v.map((t) => plainToInstance(TipoEntradaDto, t)) : v;
  });

export const ESTACIONAMIENTO_OPCIONES = ['NINGUNO', 'GRATUITO', 'PAGADO'] as const;
export type OpcionEstacionamiento = (typeof ESTACIONAMIENTO_OPCIONES)[number];
const esPagado = (o: { estacionamiento?: OpcionEstacionamiento }) => o.estacionamiento === 'PAGADO';


// Portada con IA: llega como texto JSON (o "null" para quitarla); su contenido se valida en el servicio
const portadaDesdeJson = () =>
  Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '' || value === 'null') return null;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return 'invalida';
    }
  });

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

  @tiposDesdeJson()
  @IsArray({ message: 'Agrega al menos un tipo de entrada' })
  @ArrayMinSize(1, { message: 'Agrega al menos un tipo de entrada' })
  @ArrayMaxSize(TIPO_ENTRADA_LIMITS.maxTipos, { message: `Puedes tener como máximo ${TIPO_ENTRADA_LIMITS.maxTipos} tipos de entrada` })
  @ValidateNested({ each: true })
  tiposEntrada: TipoEntradaDto[];

  // Aforo total: debe ser igual a la suma de los cupos de los tipos de entrada
  @toNumber()
  @IsInt({ message: 'Indica el aforo del evento' })
  @Min(1, { message: 'El aforo debe ser de al menos 1 persona' })
  @Max(TIPO_ENTRADA_LIMITS.aforoMax, { message: 'El aforo supera el máximo permitido' })
  aforo: number;

  @IsOptional()
  @IsIn(ESTACIONAMIENTO_OPCIONES, { message: 'Indica si el evento tiene estacionamiento' })
  estacionamiento?: OpcionEstacionamiento;

  @ValidateIf(esPagado)
  @toNumber()
  @IsInt({ message: 'Indica el valor del estacionamiento' })
  @Min(1, { message: 'Indica el valor del estacionamiento' })
  @Max(EVENT_LIMITS.priceMax, { message: 'El valor del estacionamiento supera el máximo permitido' })
  precioEstacionamiento?: number;

  @ValidateIf(esPagado)
  @toNumber()
  @IsInt({ message: 'Indica cuántos estacionamientos hay disponibles' })
  @Min(1, { message: 'Debe haber al menos 1 estacionamiento disponible' })
  @Max(TIPO_ENTRADA_LIMITS.estacionamientoCuposMax, { message: 'Los cupos de estacionamiento superan el máximo permitido' })
  cuposEstacionamiento?: number;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(TIPO_ENTRADA_LIMITS.indicacionesMax, {
    message: `Las indicaciones del estacionamiento pueden tener como máximo ${TIPO_ENTRADA_LIMITS.indicacionesMax} caracteres`,
  })
  @Validate(TextoSinContacto)
  indicacionesEstacionamiento?: string;

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

  // Al duplicar un evento sin subir una imagen nueva, se reutiliza la del evento original
  @IsOptional()
  @IsUUID('4', { message: 'El evento de origen no es válido' })
  sourceEventId?: string;

  // Solicitud de condición especial de cargo (solo al crear y en eventos con valor).
  // Mientras un admin no responda, la venta de entradas queda en pausa.
  @IsOptional()
  @toBoolean()
  @IsBoolean()
  solicitarCondicionEspecial?: boolean;

  @ValidateIf((o: CreateEventDto) => o.solicitarCondicionEspecial === true)
  @IsReason()
  justificacionCondicion?: string;

  // % que propone el organizador (opcional): el admin decide el definitivo
  @ValidateIf((o: CreateEventDto) => o.solicitarCondicionEspecial === true && o.porcentajeSolicitado !== undefined)
  @toNumber()
  @IsNumber({}, { message: 'El porcentaje propuesto no es válido' })
  @Min(0, { message: 'El porcentaje propuesto no puede ser negativo' })
  @Max(PORCENTAJE_CARGO_MAX, { message: `El porcentaje propuesto puede ser como máximo ${PORCENTAJE_CARGO_MAX}%` })
  porcentajeSolicitado?: number;

  // Portada diseñada con IA para eventos sin imagen
  @IsOptional()
  @portadaDesdeJson()
  @IsObject({ message: 'La portada no es válida' })
  portadaIa?: Record<string, unknown> | null;
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
  @tiposDesdeJson()
  @IsArray({ message: 'Agrega al menos un tipo de entrada' })
  @ArrayMinSize(1, { message: 'Agrega al menos un tipo de entrada' })
  @ArrayMaxSize(TIPO_ENTRADA_LIMITS.maxTipos, { message: `Puedes tener como máximo ${TIPO_ENTRADA_LIMITS.maxTipos} tipos de entrada` })
  @ValidateNested({ each: true })
  tiposEntrada?: TipoEntradaDto[];

  // Aforo total: obligatorio si se envían los tipos de entrada
  @ValidateIf((o: UpdateEventDto) => o.tiposEntrada !== undefined || o.aforo !== undefined)
  @toNumber()
  @IsInt({ message: 'Indica el aforo del evento' })
  @Min(1, { message: 'El aforo debe ser de al menos 1 persona' })
  @Max(TIPO_ENTRADA_LIMITS.aforoMax, { message: 'El aforo supera el máximo permitido' })
  aforo?: number;

  @IsOptional()
  @IsIn(ESTACIONAMIENTO_OPCIONES, { message: 'Indica si el evento tiene estacionamiento' })
  estacionamiento?: OpcionEstacionamiento;

  @ValidateIf(esPagado)
  @toNumber()
  @IsInt({ message: 'Indica el valor del estacionamiento' })
  @Min(1, { message: 'Indica el valor del estacionamiento' })
  @Max(EVENT_LIMITS.priceMax, { message: 'El valor del estacionamiento supera el máximo permitido' })
  precioEstacionamiento?: number;

  @ValidateIf(esPagado)
  @toNumber()
  @IsInt({ message: 'Indica cuántos estacionamientos hay disponibles' })
  @Min(1, { message: 'Debe haber al menos 1 estacionamiento disponible' })
  @Max(TIPO_ENTRADA_LIMITS.estacionamientoCuposMax, { message: 'Los cupos de estacionamiento superan el máximo permitido' })
  cuposEstacionamiento?: number;

  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(TIPO_ENTRADA_LIMITS.indicacionesMax, {
    message: `Las indicaciones del estacionamiento pueden tener como máximo ${TIPO_ENTRADA_LIMITS.indicacionesMax} caracteres`,
  })
  @Validate(TextoSinContacto)
  indicacionesEstacionamiento?: string;

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

  // Portada diseñada con IA para eventos sin imagen
  @IsOptional()
  @portadaDesdeJson()
  @IsObject({ message: 'La portada no es válida' })
  portadaIa?: Record<string, unknown> | null;
}

// Oferta: % de descuento sobre el precio de todos los tipos de entrada
export class OfertaEventDto {
  @Type(() => Number)
  @IsInt({ message: 'El descuento debe ser un porcentaje entero' })
  @Min(OFERTA_LIMITS.descuentoMin, { message: `El descuento debe ser de al menos ${OFERTA_LIMITS.descuentoMin}%` })
  @Max(OFERTA_LIMITS.descuentoMax, { message: `El descuento puede ser como máximo ${OFERTA_LIMITS.descuentoMax}%` })
  porcentaje: number;

  // Término de la oferta; si no viene, dura hasta el evento
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de término de la oferta no es válida' })
  hasta?: string;

  // Mensaje opcional para la comunidad en las novedades del evento
  @IsOptional()
  @trim()
  @IsString()
  @Length(EVENT_LIMITS.announcementMin, EVENT_LIMITS.announcementMax, {
    message: `El mensaje debe tener entre ${EVENT_LIMITS.announcementMin} y ${EVENT_LIMITS.announcementMax} caracteres`,
  })
  mensaje?: string;
}

export class CancelEventDto {
  @IsReason()
  reason: string;
}

export class PostponeEventDto {
  @IsISO8601({}, { message: 'La nueva fecha y hora no son válidas' })
  date: string;

  @IsReason()
  reason: string;
}

// Anuncio del organizador a la comunidad del evento
export class CreateAnnouncementDto {
  @IsOptional()
  @trim()
  @IsString()
  @Length(EVENT_LIMITS.announcementTitleMin, EVENT_LIMITS.announcementTitleMax, {
    message: `El título del anuncio debe tener entre ${EVENT_LIMITS.announcementTitleMin} y ${EVENT_LIMITS.announcementTitleMax} caracteres`,
  })
  titulo?: string;

  @trim()
  @IsString({ message: 'Escribe el mensaje del anuncio' })
  @Length(EVENT_LIMITS.announcementMin, EVENT_LIMITS.announcementMax, {
    message: `El anuncio debe tener entre ${EVENT_LIMITS.announcementMin} y ${EVENT_LIMITS.announcementMax} caracteres`,
  })
  @Matches(/\p{L}/u, { message: 'El anuncio debe contener texto' })
  mensaje: string;
}
