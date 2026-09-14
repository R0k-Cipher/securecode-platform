import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsIn,
} from 'class-validator';

import {
  PROJECT_ROLE_CODES,
  type ProjectRoleCode,
} from './add-project-member.dto';

export class UpdateProjectMemberRoleDto {
  @ApiProperty({
    enum: PROJECT_ROLE_CODES,
    example: 'SECURITY_ANALYST',
  })
  @IsIn(PROJECT_ROLE_CODES)
  roleCode!: ProjectRoleCode;
}
