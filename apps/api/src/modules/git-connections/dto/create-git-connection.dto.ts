import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GitProvider } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGitConnectionDto {
  @ApiProperty({
    enum: GitProvider,
    example: GitProvider.GITHUB,
    description: 'Fournisseur Git',
  })
  @IsEnum(GitProvider)
  provider!: GitProvider;

  @ApiProperty({
    example: '12345678',
    description: 'Identifiant externe du compte Git',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalAccountId!: string;

  @ApiPropertyOptional({
    example: 'optizaworks',
    description: 'Nom du compte ou du groupe externe',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalAccountName?: string;

  @ApiProperty({
    description: 'Jeton d’accès Git à chiffrer avant stockage',
  })
  @IsString()
  @MinLength(1)
  encryptedAccessToken!: string;

  @ApiPropertyOptional({
    description: 'Jeton de rafraîchissement chiffré',
  })
  @IsOptional()
  @IsString()
  encryptedRefreshToken?: string;

  @ApiPropertyOptional({
    description: 'Date d’expiration ISO 8601 du jeton',
    example: '2026-08-29T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  tokenExpiresAt?: string;
}
