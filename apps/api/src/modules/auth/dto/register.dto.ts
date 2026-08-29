import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example:
      'admin@entreprise.ma',
  })
  @Transform(
    ({ value }) =>
      String(value)
        .trim()
        .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    example:
      'rkia ',
  })
  @Transform(
    ({ value }) =>
      String(value).trim(),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    example:
      'karim',
  })
  @Transform(
    ({ value }) =>
      String(value).trim(),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    example:
      'wacillaServices',
    description:
      'Organisation créée lors de la première inscription.',
  })
  @Transform(
    ({ value }) =>
      String(value).trim(),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  organizationName!: string;

  @ApiProperty({
    required:
      false,
    example:
      'Équipe cybersécurité et développement.',
  })
  @Transform(
    ({ value }) =>
      typeof value ===
      'string'
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  organizationDescription?:
    string;

  @ApiProperty({
    example:
      'SecureCode@2026',
    description:
      '12 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    {
      message:
        'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.',
    },
  )
  password!: string;
}