import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example:
      'rokia.karim@securecode.com',

    description:
      'Identifiant professionnel SecureCode',
  })
  @Transform(
    ({ value }) =>
      String(value)
        .trim()
        .toLowerCase(),
  )
  @IsString()
  @MinLength(3)
  @MaxLength(320)
  identifier!: string;

  @ApiProperty({
    example:
      'SecureCode@2026',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
