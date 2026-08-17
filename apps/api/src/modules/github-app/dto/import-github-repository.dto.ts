import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class ImportGithubRepositoryDto {
  @ApiProperty({
    description:
      'Identifiant de la connexion GitHub',
    format: 'uuid',
  })
  @IsUUID()
  gitConnectionId!: string;

  @ApiProperty({
    description:
      'Identifiant GitHub du repository',
    example: '123456789',
  })
  @IsString()
  githubRepositoryId!: string;

  @ApiPropertyOptional({
    description:
      'Déclencher la première synchronisation',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  triggerInitialSync = true;
}