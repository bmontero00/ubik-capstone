import {
  Equals,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidRut } from '../rut.util';

// Solo se pueden crear estas cuentas desde el registro público.
// Los administradores se crean con el script `npm run create-admin`.
export const PUBLIC_ACCOUNT_TYPES = ['ATTENDEE', 'ORGANIZER'] as const;
export type PublicAccountType = (typeof PUBLIC_ACCOUNT_TYPES)[number];

@ValidatorConstraint({ name: 'isValidRut' })
export class IsValidRutConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidRut(value);
  }
  defaultMessage() {
    return 'El RUT ingresado no es válido';
  }
}

const isOrganizer = (dto: RegisterDto) => dto.accountType === 'ORGANIZER';

export class RegisterDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsOptional()
  @IsIn(PUBLIC_ACCOUNT_TYPES, { message: 'Tipo de cuenta no permitido' })
  accountType?: PublicAccountType;

  // --- Datos de verificación, obligatorios solo para organizadores ---

  @ValidateIf(isOrganizer)
  @IsString()
  @Validate(IsValidRutConstraint)
  rut?: string;

  @ValidateIf(isOrganizer)
  @IsString()
  @Matches(/^(\+?56)?\s?9\s?\d{4}\s?\d{4}$/, {
    message: 'El teléfono debe ser un celular chileno (ej: +56 9 1234 5678)',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  organizationName?: string;

  @ValidateIf(isOrganizer)
  @IsString()
  @MinLength(30, { message: 'Cuéntanos un poco más sobre tus eventos (mínimo 30 caracteres)' })
  @MaxLength(1000)
  eventDescription?: string;

  @IsOptional()
  @IsUrl({}, { message: 'El enlace a la red social o sitio web no es válido' })
  socialUrl?: string;

  @ValidateIf(isOrganizer)
  @Equals(true, { message: 'Debes declarar que la información entregada es verídica' })
  acceptsTerms?: boolean;
}
