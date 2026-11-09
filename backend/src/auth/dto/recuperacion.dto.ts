import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const correo = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class SolicitarRecuperacionDto {
  @correo()
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @MaxLength(120)
  email: string;
}

export class VerificarCodigoDto extends SolicitarRecuperacionDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' })
  codigo: string;
}

// Mismas reglas de contraseña que el registro
export class RestablecerContrasenaDto extends VerificarCodigoDto {
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72, { message: 'La contraseña puede tener como máximo 72 caracteres' })
  password: string;
}
