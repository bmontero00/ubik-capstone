import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsString, IsUUID, Length, Matches, MaxLength, Validate,
  ValidateNested,
} from 'class-validator';
import { IsValidRutConstraint } from '../../auth/dto/register.dto';

// Límites compartidos con el frontend (frontend/src/components/tickets/ticketRules.ts)
export const COMPRA_LIMITS = {
  maxPorCompra: 10, // entradas en una sola compra
  maxPorEvento: 10, // entradas vigentes de un mismo comprador para un evento
  minutosParaPagar: 15,
};

const trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : value));
// Letras (con tildes y ñ), espacios, apóstrofo, punto y guion: "María José", "O'Higgins", "Pérez-Cotapos"
const NOMBRE = /^\p{L}[\p{L}' .-]*$/u;

// Datos de la persona que usará cada entrada (las entradas son nominativas)
export class AsistenteDto {
  @trim()
  @IsString({ message: 'Ingresa el nombre' })
  @Length(2, 50, { message: 'El nombre debe tener entre 2 y 50 caracteres' })
  @Matches(NOMBRE, { message: 'El nombre solo puede contener letras' })
  nombre: string;

  @trim()
  @IsString({ message: 'Ingresa el apellido' })
  @Length(2, 50, { message: 'El apellido debe tener entre 2 y 50 caracteres' })
  @Matches(NOMBRE, { message: 'El apellido solo puede contener letras' })
  apellido: string;

  @IsString({ message: 'Ingresa el RUT' })
  @Validate(IsValidRutConstraint)
  rut: string;

  @IsString({ message: 'Ingresa el teléfono' })
  @Matches(/^(\+?56)?\s?9\s?\d{4}\s?\d{4}$/, { message: 'El teléfono debe ser un celular chileno (ej: +56 9 1234 5678)' })
  telefono: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(120)
  correo: string;
}

export class CreateCompraDto {
  @IsUUID('4', { message: 'El evento no es válido' })
  eventoId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Selecciona al menos una entrada' })
  @ArrayMaxSize(COMPRA_LIMITS.maxPorCompra, {
    message: `Puedes comprar como máximo ${COMPRA_LIMITS.maxPorCompra} entradas por compra`,
  })
  @ValidateNested({ each: true })
  @Type(() => AsistenteDto)
  asistentes: AsistenteDto[];
}

// Mientras no exista pasarela de pago solo se acepta el pago simulado
export class PagarCompraDto {
  @IsIn(['SIMULADO'], { message: 'Medio de pago no disponible' })
  medioPago: 'SIMULADO';
}
