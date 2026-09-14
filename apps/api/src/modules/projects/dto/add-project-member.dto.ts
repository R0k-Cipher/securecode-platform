import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsIn,
  IsUUID,
} from 'class-validator';

export const PROJECT_ROLE_CODES = [
  'PROJECT_ADMIN',
  'MANAGER',
  'SECURITY_ANALYST',
  'DEVELOPER',
  'AUDITOR',
  'VIEWER',
] as const;

export type ProjectRoleCode =
  (typeof PROJECT_ROLE_CODES)[number];

export class AddProjectMemberDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "Identifiant de l'utilisateur déjà membre de l'organisation",
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    enum: PROJECT_ROLE_CODES,
    example: 'DEVELOPER',
  })
  @IsIn(PROJECT_ROLE_CODES)
  roleCode!: ProjectRoleCode;
}
