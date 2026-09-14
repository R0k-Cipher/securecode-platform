import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class GithubInstallationCallbackDto {
  @ApiProperty({
    example: '157146420',
    description:
      "Identifiant de l'installation GitHub App.",
  })
  @IsString()
  @Matches(/^\d+$/)
  installation_id!: string;

  @ApiProperty({
    example:
      '54f629b8-5be4-4b83-a2de-b5d7ae747b6e',
    description:
      "État sécurisé créé avant l'installation GitHub.",
  })
  @IsString()
  @IsUUID()
  state!: string;

  @ApiPropertyOptional({
    enum: [
      'install',
      'update',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'install',
    'update',
  ])
  setup_action?: string;
}
