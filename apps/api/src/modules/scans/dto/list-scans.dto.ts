import {
  Type,
} from 'class-transformer';

import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import {
  ScanStatus,
  ScanTrigger,
  ScanType,
} from '@prisma/client';

export class ListScansDto {
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
  perPage = 20;

  @IsOptional()
  @IsEnum(ScanStatus)
  status?: ScanStatus;

  @IsOptional()
  @IsEnum(ScanType)
  type?: ScanType;

  @IsOptional()
  @IsEnum(ScanTrigger)
  trigger?: ScanTrigger;
}
