import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import {
  PermissionsGuard,
} from '../rbac/guards/permissions.guard';

import {
  RequirePermissions,
} from '../rbac/decorators/require-permissions.decorator';

import {
  PERMISSION_CODES,
} from '../rbac/types/permission-code.type';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import type {
  AuthenticatedUser,
} from '../auth/interfaces/jwt-payload.interface';

import {
  AssignFindingDto,
} from './dto/assign-finding.dto';

import {
  FindingAssignmentsService,
} from './finding-assignments.service';

@ApiTags('Finding Assignments')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId',
)
export class FindingAssignmentsController {
  constructor(
    private readonly assignments:
      FindingAssignmentsService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Assigner
  |--------------------------------------------------------------------------
  */

  @Post(
    'findings/:findingId/assign',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_ASSIGN,
  )
  assign(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @Param(
      'findingId',
      ParseUUIDPipe,
    )
    findingId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: AssignFindingDto,
  ) {
    return this.assignments.assign(
      organizationId,
      projectId,
      findingId,
      user.id,
      dto.assignedToId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Retirer l'assignation
  |--------------------------------------------------------------------------
  */

  @Delete(
    'findings/:findingId/assignment',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_ASSIGN,
  )
  unassign(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @Param(
      'findingId',
      ParseUUIDPipe,
    )
    findingId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.assignments.unassign(
      organizationId,
      projectId,
      findingId,
      user.id,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Affectation active
  |--------------------------------------------------------------------------
  */

  @Get(
    'findings/:findingId/assignment',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_READ,
  )
  getActive(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @Param(
      'findingId',
      ParseUUIDPipe,
    )
    findingId: string,
  ) {
    return this.assignments.getActive(
      organizationId,
      projectId,
      findingId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Mes tâches dans CE projet
  |--------------------------------------------------------------------------
  */

  @Patch(
    'my-tasks/:findingId/start',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_UPDATE,
  )
  startWork(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @Param(
      'findingId',
      ParseUUIDPipe,
    )
    findingId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.assignments.startWork(
      organizationId,
      projectId,
      findingId,
      user.id,
    );
  }

  @Patch(
    'my-tasks/:findingId/ready-for-retest',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_UPDATE,
  )
  markReadyForRetest(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @Param(
      'findingId',
      ParseUUIDPipe,
    )
    findingId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.assignments.markReadyForRetest(
      organizationId,
      projectId,
      findingId,
      user.id,
    );
  }

  @Get('my-tasks')
  @RequirePermissions(
    PERMISSION_CODES.FINDING_READ,
  )
  myTasks(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.assignments.myTasks(
      organizationId,
      projectId,
      user.id,
    );
  }
}
