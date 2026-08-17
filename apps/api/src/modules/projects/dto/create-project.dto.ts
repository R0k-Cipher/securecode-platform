import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Nom du projet',
    example: 'SecureCode API',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description:
      "Slug du projet. S'il est absent, il sera généré automatiquement.",
    example: 'securecode-api',
    minLength: 2,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Le slug doit contenir uniquement des lettres minuscules, des chiffres et des tirets.',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Description du projet',
    example: 'API principale de la plateforme SecureCode-AI.',
    maxLength: 3000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Branche Git utilisée par défaut',
    example: 'main',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultBranch?: string;
}
