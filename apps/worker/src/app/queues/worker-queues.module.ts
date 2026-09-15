import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { BullModule } from '@nestjs/bullmq';

import { QUEUE_NAMES } from '@securecode-platform/queue-contracts';

import { RepositoryWorkspaceService } from '../services/repository-workspace.service';

import { GithubWorkerClientService } from '../services/github-worker-client.service';

import { RepositorySyncProcessor } from '../processors/repository-sync.processor';

import { RepositoryDownloadService } from '../services/repository-download.service';

import { SecurityScanProcessor } from '../processors/security-scan.processor';

import { ScheduledScanProcessor } from '../processors/scheduled-scan.processor';

import { RepositoryStateResolverService } from '../services/repository-state-resolver.service';

import { GithubCompareService } from '../services/github-compare.service';

import { ChangeSetResolverService } from '../services/change-set-resolver.service';

import { ScannerRuntimeService } from '../services/scanner-runtime.service';

import { FileDiscoveryService } from '../services/file-discovery.service';

import { RepositoryExtractionService } from '../services/repository-extraction.service';

import { FindingPersistenceService } from '../services/finding-persistence.service';

import { FindingNormalizerService } from '../services/finding-normalizer.service';

import { FindingReconciliationService } from '../services/finding-reconciliation.service';

import { SecurityScoreService } from '../services/security-score.service';

import { OsvVulnerabilityProviderService } from '../services/osv-vulnerability-provider.service';

import { ScannerFileCacheService } from '../services/scanner-file-cache.service';

import { ScanExecutionSummaryService } from '../services/scan-execution-summary.service';

import { OsvCacheService } from '../services/osv-cache.service';

import { ExternalServiceCircuitBreakerService } from '../services/external-service-circuit-breaker.service';

import { RepositoryLanguageSummaryService } from '../services/repository-language-summary.service';

import { ContextualRiskService } from '../services/contextual-risk.service';
import { ThreatIntelligenceService } from '../services/threat-intelligence.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redis.host'),

          port: configService.getOrThrow<number>('redis.port'),

          password: configService.get<string>('redis.password') || undefined,

          db: configService.get<number>('redis.database') ?? 0,
        },
      }),
    }),

    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.REPOSITORY_SYNC,
      },

      {
        name: QUEUE_NAMES.SECURITY_SCAN,
      },

      {
        name: QUEUE_NAMES.SCAN_SCHEDULER,
      },
    ),
  ],

  providers: [
    RepositorySyncProcessor,
    SecurityScanProcessor,
    ScheduledScanProcessor,

    RepositoryWorkspaceService,
    GithubWorkerClientService,
    RepositoryDownloadService,

    RepositoryStateResolverService,
    GithubCompareService,
    ChangeSetResolverService,

    FileDiscoveryService,
    RepositoryExtractionService,

    FindingPersistenceService,
    FindingNormalizerService,
    FindingReconciliationService,

    SecurityScoreService,
    ScannerRuntimeService,

    OsvVulnerabilityProviderService,
    ScannerFileCacheService,
    ScanExecutionSummaryService,
    OsvCacheService,
    ExternalServiceCircuitBreakerService,
    RepositoryLanguageSummaryService,
    ContextualRiskService,
    ThreatIntelligenceService,
  ],
})
export class WorkerQueuesModule {}
