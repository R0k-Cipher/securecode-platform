import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectionStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateGitConnectionDto {
  @ApiPropertyOptional({
    example: 'optizaworks',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalAccountName?: string;

  @ApiPropertyOptional({
    description: 'Nouveau jeton d’accès chiffré',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  encryptedAccessToken?: string;

  @ApiPropertyOptional({
    description: 'Nouveau jeton de rafraîchissement chiffré',
  })
  @IsOptional()
  @IsString()
  encryptedRefreshToken?: string;

  @ApiPropertyOptional({
    description: 'Date d’expiration ISO 8601',
  })
  @IsOptional()
  @IsString()
  tokenExpiresAt?: string;

  @ApiPropertyOptional({
    enum: ConnectionStatus,
  })
  @IsOptional()
  @IsEnum(ConnectionStatus)
  status?: ConnectionStatus;
}
