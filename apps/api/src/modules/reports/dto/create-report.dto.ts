import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  ReportFormat,
} from '@prisma/client';

import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export enum ReportScope {
  SCAN = 'SCAN',

  PROJECT = 'PROJECT',

  ORGANIZATION = 'ORGANIZATION',

  REPOSITORY = 'REPOSITORY',
}

export class CreateReportDto {
  @ApiProperty({
    enum: ReportFormat,
    default: ReportFormat.PDF,
  })
  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @ApiProperty({
    enum: [
      ReportScope.SCAN,
      ReportScope.PROJECT,
      ReportScope.ORGANIZATION,
    ],
    default: ReportScope.SCAN,
  })
  @IsEnum(ReportScope)
  scope!: ReportScope;



  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Obligatoire pour un rapport SCAN.',
  })
  @IsOptional()
  @IsUUID()
  scanId?: string;



  @ApiPropertyOptional({
    format: 'uuid',
    deprecated: true,
    description:
      'Ancien rapport repository. Conservé pour compatibilité.',
  })
  @IsOptional()
  @IsUUID()
  repositoryId?: string;



  @ApiPropertyOptional({
    description:
      'Début de période pour PROJECT ou ORGANIZATION.',
    example:
      '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'Fin de période pour PROJECT ou ORGANIZATION.',
    example:
      '2026-08-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
