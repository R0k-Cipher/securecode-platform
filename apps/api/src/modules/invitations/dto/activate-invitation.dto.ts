import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActivateInvitationDto {
  @ApiProperty({
    description:
      'Mot de passe temporaire reçu par email',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword!: string;

  @ApiProperty({
    example:
      'MySecurePassword@2026',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    {
      message:
        'Le nouveau mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.',
    },
  )
  newPassword!: string;
}
