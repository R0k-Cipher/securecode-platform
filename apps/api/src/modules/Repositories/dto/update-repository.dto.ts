import { ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryVisibility } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateRepositoryDto {
  @ApiPropertyOptional({
    description: 'Nom court du dépôt',
    example: 'securecode-backend',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Nom complet du dépôt',
    example: 'optizaworks/securecode-backend',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'URL de clonage HTTPS ou SSH',
    example:
      'https://github.com/optizaworks/securecode-backend.git',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  cloneUrl?: string;

  @ApiPropertyOptional({
    description: 'URL web du dépôt',
    example:
      'https://github.com/optizaworks/securecode-backend',
  })
  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  @MaxLength(3000)
  webUrl?: string;

  @ApiPropertyOptional({
    description: 'Branche principale',
    example: 'main',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  defaultBranch?: string;

  @ApiPropertyOptional({
    enum: RepositoryVisibility,
    description: 'Visibilité du dépôt',
  })
  @IsOptional()
  @IsEnum(RepositoryVisibility)
  visibility?: RepositoryVisibility;
}
