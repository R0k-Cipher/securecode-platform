import {
  Type,
} from 'class-transformer';

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

export class ListFindingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 25;

  @IsOptional()
  @IsEnum(
    FindingSeverity,
  )
  severity?:
    FindingSeverity;

  @IsOptional()
  @IsEnum(
    FindingStatus,
  )
  status?:
    FindingStatus;

  @IsOptional()
  @IsString()
  scanner?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  cweId?: string;

  @IsOptional()
  @IsString()
  owaspCategory?: string;

  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
