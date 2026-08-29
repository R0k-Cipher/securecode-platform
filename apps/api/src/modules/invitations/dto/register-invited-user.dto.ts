import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterInvitedUserDto {
  @ApiProperty({
    example: 'Rkia',
  })
  @Transform(
    ({ value }) =>
      String(value)
        .trim(),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!:
    string;

  @ApiProperty({
    example: 'Ait Abdelkarim',
  })
  @Transform(
    ({ value }) =>
      String(value)
        .trim(),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!:
    string;

  @ApiProperty({
    example:
      'SecureCode@2026',
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
  password!:
    string;
}
