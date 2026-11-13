import { Equals, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, Validate, ValidateIf } from 'class-validator';
import { IsValidRutConstraint } from './register.dto';

// Nueva solicitud de un organizador rechazado. reapplyToken lo entrega el login
// después de validar la contraseña, así nadie más puede re-postular por él.
export class ReapplyDto {
  @IsString()
  @IsNotEmpty()
  reapplyToken: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsString()
  @Validate(IsValidRutConstraint)
  rut: string;

  @IsString()
  @Matches(/^(\+?56)?\s?9\s?\d{4}\s?\d{4}$/, {
    message: 'El teléfono debe ser un celular chileno (ej: +56 9 1234 5678)',
  })
  phone: string;


  // Organiza a título personal o en representación de una organización (con su RUT)
  @ValidateIf(() => true)
  @IsIn(['PERSONAL', 'ORGANIZACION'], { message: 'Indica si organizas a título personal o por una organización' })
  tipoOrganizador?: 'PERSONAL' | 'ORGANIZACION';

  @ValidateIf((dto: ReapplyDto) => dto.tipoOrganizador === 'ORGANIZACION')
  @IsString({ message: 'Ingresa el RUT de la organización' })
  @Validate(IsValidRutConstraint, { message: 'El RUT de la organización no es válido' })
  rutOrganizacion?: string;

  // Nombre de la organización (solo se usa si su RUT aún no está registrado en UBIK)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  organizationName?: string;

  @IsString()
  @MinLength(30, { message: 'Cuéntanos un poco más sobre tus eventos (mínimo 30 caracteres)' })
  @MaxLength(1000)
  eventDescription: string;

  @IsOptional()
  @IsUrl({}, { message: 'El enlace a la red social o sitio web no es válido' })
  socialUrl?: string;

  @Equals(true, { message: 'Debes declarar que la información entregada es verídica' })
  acceptsTerms: boolean;
}
