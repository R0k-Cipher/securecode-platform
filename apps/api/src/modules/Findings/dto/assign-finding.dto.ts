import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsUUID,
} from 'class-validator';

export class AssignFindingDto {
  @ApiProperty({
    format:
      'uuid',

    description:
      'Utilisateur membre du projet auquel le finding doit être assigné.',
  })
  @IsUUID()
  assignedToId!: string;
}
