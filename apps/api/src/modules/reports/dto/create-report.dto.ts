import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  ReportFormat,
} from '@prisma/client';

import {
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateReportDto {
  @ApiProperty({
    enum:
      ReportFormat,

    default:
      ReportFormat.PDF,
  })
  @IsEnum(
    ReportFormat,
  )
  format!:
    ReportFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scanId?:
    string;
}
