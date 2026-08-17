import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  GitProvider,
  RepositoryVisibility,
} from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRepositoryDto {
  @ApiProperty({
    description: 'Identifiant UUID de la connexion Git',
    example: '1c250890-c8a5-4de9-a175-dbc44fdb752f',
  })
  @IsUUID()
  gitConnectionId!: string;

  @ApiProperty({
    enum: GitProvider,
    description: 'Fournisseur du dépôt Git',
    example: GitProvider.GITHUB,
  })
  @IsEnum(GitProvider)
  provider!: GitProvider;

  @ApiProperty({
    description:
      'Identifiant externe du dépôt chez GitHub ou GitLab',
    example: '987654321',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalId!: string;

  @ApiProperty({
    description: 'Nom court du dépôt',
    example: 'securecode-api',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description:
      'Nom complet du dépôt, incluant le propriétaire ou le groupe',
    example: 'optizaworks/securecode-api',
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  fullName!: string;

  @ApiProperty({
    description:
      'URL utilisée pour cloner le dépôt. HTTPS ou SSH.',
    example:
      'https://github.com/optizaworks/securecode-api.git',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  cloneUrl!: string;

  @ApiProperty({
    description: 'URL publique de consultation du dépôt',
    example:
      'https://github.com/optizaworks/securecode-api',
  })
  @IsUrl({
    require_protocol: true,
  })
  @MaxLength(3000)
  webUrl!: string;

  @ApiProperty({
    description: 'Branche principale du dépôt',
    example: 'main',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  defaultBranch!: string;

  @ApiPropertyOptional({
    enum: RepositoryVisibility,
    default: RepositoryVisibility.PRIVATE,
    description: 'Visibilité du dépôt',
  })
  @IsOptional()
  @IsEnum(RepositoryVisibility)
  visibility?: RepositoryVisibility;
}
