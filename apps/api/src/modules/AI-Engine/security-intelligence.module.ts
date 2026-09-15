import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { SecurityIntelligenceController } from './security-intelligence.controller';
import { SecurityIntelligenceService } from './security-intelligence.service';

@Module({
  imports: [RbacModule],
  controllers: [SecurityIntelligenceController],
  providers: [SecurityIntelligenceService],
  exports: [SecurityIntelligenceService],
})
export class SecurityIntelligenceModule {}
