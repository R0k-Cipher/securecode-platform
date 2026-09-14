import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  FindingStatus,
} from '@prisma/client';

export class UpdateFindingStatusDto {
  @ApiProperty({
    enum: FindingStatus,
    enumName: 'FindingStatus',
    example: FindingStatus.TO_REVIEW,
    description:
      'Nouveau statut du finding.',
  })
  @IsEnum(FindingStatus)
  status!: FindingStatus;

  @ApiPropertyOptional({
    example:
      'Finding placé en revue manuelle.',
    maxLength: 2000,
    description:
      'Commentaire optionnel associé au changement de statut.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
