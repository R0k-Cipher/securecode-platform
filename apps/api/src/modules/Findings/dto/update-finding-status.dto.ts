import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  FindingStatus,
} from '@prisma/client';

export class UpdateFindingStatusDto {
  @IsEnum(FindingStatus)
  status:
    FindingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
