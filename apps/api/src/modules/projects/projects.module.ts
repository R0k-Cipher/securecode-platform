import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';
import { RbacModule } from '../rbac/rbac.module';

import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

import {
  ProjectMembersController,
} from './project-members.controller';

import {
  ProjectMembersService,
} from './project-members.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
  ],
  controllers: [
    ProjectsController,
    ProjectMembersController,
  ],
  providers: [
    ProjectsService,
    ProjectMembersService,
  ],
  exports: [
    ProjectsService,
    ProjectMembersService,
  ],
})
export class ProjectsModule {}
