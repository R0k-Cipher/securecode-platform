import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  GitProvider,
  RepositoryVisibility,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RepositoryQueryDto {
  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description:
      'Recherche dans le nom, le nom complet ou l’identifiant externe',
    example: 'securecode',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: GitProvider,
    description: 'Filtrer selon le fournisseur Git',
  })
  @IsOptional()
  @IsEnum(GitProvider)
  provider?: GitProvider;

  @ApiPropertyOptional({
    enum: RepositoryVisibility,
    description: 'Filtrer selon la visibilité',
  })
  @IsOptional()
  @IsEnum(RepositoryVisibility)
  visibility?: RepositoryVisibility;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Filtrer les dépôts archivés ou actifs',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({
    enum: ['name', 'createdAt', 'updatedAt', 'lastSyncedAt'],
    default: 'updatedAt',
  })
  @IsOptional()
  @IsIn([
    'name',
    'createdAt',
    'updatedAt',
    'lastSyncedAt',
  ])
  sortBy:
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | 'lastSyncedAt' = 'updatedAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
