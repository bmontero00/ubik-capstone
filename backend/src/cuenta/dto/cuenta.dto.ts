import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Length, Matches, MaxLength, MinLength, Validate, ValidateIf } from 'class-validator';
import { IsValidRutConstraint } from '../../auth/dto/register.dto';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : value);
// Vacío = quitar el dato (campos opcionales)
const vacioANull = ({ value }: { value: unknown }) => (typeof value === 'string' && !value.trim() ? null : value);

export const CELULAR_CHILENO = /^(\+?56)?\s?9\s?\d{4}\s?\d{4}$/;

// Datos editables de Mi cuenta. El correo, el RUT del organizador y el nombre de la organización no se
// editan aquí: son la identidad verificada de la cuenta.
export class ActualizarCuentaDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  name?: string;

  // Asistente: celular y RUT opcionales, para completar sus entradas al comprar
  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf((o: ActualizarCuentaDto) => o.telefono !== null)
  @Matches(CELULAR_CHILENO, { message: 'El celular debe ser chileno (ej: +56 9 1234 5678)' })
  telefono?: string | null;

  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf((o: ActualizarCuentaDto) => o.rut !== null)
  @IsString()
  @Validate(IsValidRutConstraint)
  rut?: string | null;

  // Organizador: celular de contacto (privado), descripción y red social (públicas)
  @IsOptional()
  @Matches(CELULAR_CHILENO, { message: 'El celular debe ser chileno (ej: +56 9 1234 5678)' })
  phone?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(30, { message: 'Cuéntanos un poco más sobre tus eventos (mínimo 30 caracteres)' })
  @MaxLength(1000, { message: 'La descripción puede tener como máximo 1000 caracteres' })
  eventDescription?: string;

  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf((o: ActualizarCuentaDto) => o.socialUrl !== null)
  @IsUrl({ require_protocol: true }, { message: 'El enlace debe ser una dirección web completa (ej: https://instagram.com/tu_cuenta)' })
  socialUrl?: string | null;
}

export class CambiarContrasenaDto {
  @IsString()
  @MinLength(1, { message: 'Ingresa tu contraseña actual' })
  actual: string;

  // Mismas reglas que el registro y la recuperación
  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72, { message: 'La contraseña puede tener como máximo 72 caracteres' })
  nueva: string;
}

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const esTipoFoto = (mime: string) => (TIPOS_FOTO as readonly string[]).includes(mime);
