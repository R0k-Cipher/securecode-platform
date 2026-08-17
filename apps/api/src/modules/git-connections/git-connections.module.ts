import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';
import { RbacModule } from '../rbac/rbac.module';

import { GitConnectionsController } from './git-connections.controller';
import { GitConnectionsService } from './git-connections.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
  ],
  controllers: [
    GitConnectionsController,
  ],
  providers: [
    GitConnectionsService,
  ],
  exports: [
    GitConnectionsService,
  ],
})
export class GitConnectionsModule {}
