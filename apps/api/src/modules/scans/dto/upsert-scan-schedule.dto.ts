import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  ScanScheduleMode,
} from '@prisma/client';

export class UpsertScanScheduleDto {
  @ApiProperty({
    example:
      '0 2 * * *',

    description:
      'Expression cron utilisée par BullMQ.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  cronExpression!: string;

  @ApiPropertyOptional({
    example:
      'Africa/Casablanca',

    default:
      'UTC',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({
    enum:
      ScanScheduleMode,

    default:
      ScanScheduleMode.AUTO,
  })
  @IsOptional()
  @IsEnum(
    ScanScheduleMode,
  )
  mode?: ScanScheduleMode;

  @ApiPropertyOptional({
    default:
      true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
