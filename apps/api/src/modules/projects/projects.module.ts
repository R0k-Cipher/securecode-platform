import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';
import { RbacModule } from '../rbac/rbac.module';

import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
  ],
  controllers: [
    ProjectsController,
  ],
  providers: [
    ProjectsService,
  ],
  exports: [
    ProjectsService,
  ],
})
export class ProjectsModule {}
