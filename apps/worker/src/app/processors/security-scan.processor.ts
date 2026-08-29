import {
  Logger,
} from '@nestjs/common';

import {
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import {
  Job,
} from 'bullmq';

import {
  Prisma,
  ScanStatus,
  ScanType,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  ScannerCore,
} from '@securecode-platform/scanner-core';

import type {
  ScanContext,
} from '@securecode-platform/scanner-core';

import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import type {
  SecurityScanJobData,
} from '@securecode-platform/queue-contracts';

import {
  RepositoryStateResolverService,
} from '../services/repository-state-resolver.service';

import {
  ChangeSetResolverService,
} from '../services/change-set-resolver.service';

import {
  ScannerRuntimeService,
} from '../services/scanner-runtime.service';

import {
  FileDiscoveryService,
} from '../services/file-discovery.service';

import {
  RepositoryDownloadService,
} from '../services/repository-download.service';

import {
  RepositoryWorkspaceService,
} from '../services/repository-workspace.service';

import {
  RepositoryExtractionService,
} from '../services/repository-extraction.service';

import {
  FindingNormalizerService,
} from '../services/finding-normalizer.service';

import {
  FindingPersistenceService,
} from '../services/finding-persistence.service';

import {
  FindingReconciliationService,
} from '../services/finding-reconciliation.service';

import {
  SecurityScoreService,
} from '../services/security-score.service';

import {
  ScanExecutionSummaryService,
} from '../services/scan-execution-summary.service';
import { RepositoryLanguageSummaryService } from '../services/repository-language-summary.service';

@Processor(
  QUEUE_NAMES.SECURITY_SCAN,
  {
    concurrency: 2,
  },
)
export class SecurityScanProcessor
  extends WorkerHost
{
  private readonly logger =
    new Logger(
      SecurityScanProcessor.name,
    );

  private readonly scannerCore =
    new ScannerCore();

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly stateResolver:
      RepositoryStateResolverService,

    private readonly changeSetResolver:
      ChangeSetResolverService,

    private readonly fileDiscovery:
      FileDiscoveryService,

    private readonly scannerRuntime:
      ScannerRuntimeService,

    private readonly workspaceService:
      RepositoryWorkspaceService,

    private readonly downloadService:
      RepositoryDownloadService,

    private readonly extractionService:
      RepositoryExtractionService,

    private readonly findingNormalizer:
      FindingNormalizerService,

    private readonly findingPersistence:
      FindingPersistenceService,

    private readonly findingReconciliation:
      FindingReconciliationService,

    private readonly securityScore:
      SecurityScoreService,

    private readonly executionSummary:
      ScanExecutionSummaryService,

    private readonly repositoryLanguageSummary:
      RepositoryLanguageSummaryService,
  ) {
    super();
  }

  async process(
    job: Job<SecurityScanJobData>,
  ): Promise<void> {
    if (
      job.name !==
      JOB_NAMES.SECURITY_SCAN
    ) {
      throw new Error(
        `Job non supporté : ${job.name}`,
      );
    }

    const data =
      job.data;

    let workspacePath:
      string | null = null;

    try {
      /*
       * ------------------------------------------------
       * 1. PREPARING
       * ------------------------------------------------
       */

      await this.markRunning(
        data.scanId,
        job,
      );

      await job.updateProgress(
        5,
      );

      /*
       * ------------------------------------------------
       * 2. Repository multi-tenant
       * ------------------------------------------------
       */

      const repository =
        await this.prisma.repository.findFirst({
          where: {
            id:
              data.repositoryId,

            organizationId:
              data.organizationId,

            projectId:
              data.projectId,

            gitConnectionId:
              data.gitConnectionId,
          },

          select: {
            id:
              true,

            provider:
              true,

            externalId:
              true,

            owner:
              true,

            name:
              true,

            fullName:
              true,

            defaultBranch:
              true,

            gitConnection: {
              select: {
                id:
                  true,

                provider:
                  true,

                installationId:
                  true,

                status:
                  true,
              },
            },
          },
        });

      if (!repository) {
        throw new Error(
          'Repository introuvable ou incohérent avec le job.',
        );
      }

      if (
        data.provider ===
          'GITHUB' &&
        !repository
          .gitConnection
          .installationId
      ) {
        throw new Error(
          "La connexion GitHub ne possède pas d'installationId.",
        );
      }

      await job.updateProgress(
        10,
      );

      /*
       * ------------------------------------------------
       * 3. État précédent
       * ------------------------------------------------
       */

      const state =
        await this.stateResolver.resolve(
          repository.id,
        );

      const fromSha =
        data.fromSha ??
        state.previousSuccessfulSha;

      /*
       * ------------------------------------------------
       * 4. ChangeSet
       * ------------------------------------------------
       */

      const changeSet =
        await this.changeSetResolver.resolve({
          provider:
            data.provider,

          repositoryId:
            repository.id,

          installationId:
            repository
              .gitConnection
              .installationId,

          owner:
            repository.owner,

          repositoryName:
            repository.name,

          fromSha,

          toSha:
            data.toSha,
        });

      await job.updateProgress(
        20,
      );

      /*
       * ------------------------------------------------
       * 5. Scan Planner
       * ------------------------------------------------
       */

      const plan =
        this.scannerCore.planScan(
          changeSet,
          {
            requestedMode:
              data.requestedMode,
          },
        );

      await this.prisma.scan.update({
        where: {
          id:
            data.scanId,
        },

        data: {
          type:
            this.mapScanType(
              plan.mode,
            ),

          status:
            ScanStatus.PREPARING,

          progress:
            20,

          configuration: {
            requestedMode:
              data.requestedMode,

            resolvedMode:
              plan.mode,

            scanners:
              plan.scanners,

            affectedFiles:
              plan.affectedFiles,

            deletedFiles:
              plan.deletedFiles,

            requiresProjectContext:
              plan.requiresProjectContext,

            reasons:
              plan.reasons,

            fromSha:
              changeSet.fromSha,

            toSha:
              changeSet.toSha,

            correlationId:
              data.correlationId,
          },
        },
      });

      /*
       * ------------------------------------------------
       * 6. Workspace
       * ------------------------------------------------
       */

      workspacePath =
        await this.workspaceService
          .createWorkspace(
            data.scanId,
          );

      /*
       * ------------------------------------------------
       * 7. Téléchargement
       * ------------------------------------------------
       */

      await this.prisma.scan.update({
        where: {
          id:
            data.scanId,
        },

        data: {
          status:
            ScanStatus.DOWNLOADING,

          progress:
            25,
        },
      });

      await job.updateProgress(
        25,
      );

      if (
        data.provider !==
        'GITHUB'
      ) {
        throw new Error(
          `Téléchargement du provider ${data.provider} non encore implémenté.`,
        );
      }

      const installationId =
        repository
          .gitConnection
          .installationId;

      if (!installationId) {
        throw new Error(
          'Installation GitHub absente.',
        );
      }

      const downloadResult =
        await this.downloadService
          .downloadGithubRepository({
            installationId,

            owner:
              repository.owner,

            repositoryName:
              repository.name,

            /*
             * Toujours privilégier le SHA exact.
             */
            ref:
              data.toSha,

            workspacePath,
          });

      await this.assertNotCancelled(
        data.scanId,
      );

      await job.updateProgress(
        35,
      );

      /*
       * ------------------------------------------------
       * 8. Extraction sécurisée
       * ------------------------------------------------
       */

      const extractedSourcePath =
        await this.extractionService
          .extractArchive({
            archivePath:
              downloadResult.archivePath,

            workspacePath,
          });

      await this.assertNotCancelled(
        data.scanId,
      );

      await job.updateProgress(
        45,
      );

      /*
       * ------------------------------------------------
       * 9. File Discovery
       * ------------------------------------------------
       */

      await this.prisma.scan.update({
        where: {
          id:
            data.scanId,
        },

        data: {
          status:
            ScanStatus.DETECTING,

          progress:
            45,
        },
      });

      const inventory =
        await this.fileDiscovery.discover(
            extractedSourcePath,
          );

      await this.assertNotCancelled(
        data.scanId,
      );

      const languageSummary =
        this.repositoryLanguageSummary
          .summarize(
            inventory,
          );

      await this.prisma.repository.update({
        where: {
          id:
            repository.id,
        },

        data: {
          primaryLanguage:
            languageSummary
              .primaryLanguage,
        },
      });

    const inventorySourceFiles =
      inventory.files
        .filter(
          (file) =>
            !file.isBinary &&
            file.language !== null,
        )
        .map(
          (file) =>
            file.relativePath,
        );

    const dependencyFileNames =
      new Set([
        'package.json',
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',

        'composer.json',
        'composer.lock',

        'requirements.txt',
        'poetry.lock',
        'pyproject.toml',

        'pom.xml',
        'build.gradle',
        'build.gradle.kts',

        'go.mod',
        'go.sum',

        'Cargo.toml',
        'Cargo.lock',
      ]);

    const inventoryDependencyFiles =
      inventory.files
        .filter(
          (file) => {
            if (file.isBinary) {
              return false;
            }

            const name =
              file.relativePath
                .split('/')
                .at(-1);

            return (
              Boolean(name) &&
              dependencyFileNames.has(
                name!,
              )
            );
          },
        )
        .map(
          (file) =>
            file.relativePath,
        );

    const inventoryConfigurationFiles =
      inventory.files
        .filter(
          (file) => {
            if (file.isBinary) {
              return false;
            }

            const path =
              file.relativePath
                .toLowerCase();

            return (
              path.endsWith('.yml') ||
              path.endsWith('.yaml') ||
              path.endsWith('.json') ||
              path.endsWith('.toml') ||
              path.endsWith('.ini') ||
              path.endsWith('.conf') ||
              path.endsWith('.env.example')
            );
          },
        )
        .map(
          (file) =>
            file.relativePath,
        );

    const inventoryContainerFiles =
      inventory.files
        .filter(
          (file) => {
            if (file.isBinary) {
              return false;
            }

            const name =
              file.relativePath
                .split('/')
                .at(-1)
                ?.toLowerCase();

            return (
              name === 'dockerfile' ||
              name?.startsWith('dockerfile.') ||
              name === 'docker-compose.yml' ||
              name === 'docker-compose.yaml' ||
              name === 'compose.yml' ||
              name === 'compose.yaml'
            );
          },
        )
        .map(
          (file) =>
            file.relativePath,
        );

    const inventoryCiCdFiles =
      inventory.files
        .filter(
          (file) => {
            if (file.isBinary) {
              return false;
            }

            const path =
              file.relativePath
                .replace(/\\/g, '/')
                .toLowerCase();

            return (
              path.startsWith(
                '.github/workflows/',
              ) ||
              path ===
                '.gitlab-ci.yml'
            );
          },
        )
        .map(
          (file) =>
            file.relativePath,
        );


      /*
       * ------------------------------------------------
       * 10. Fichiers réellement à scanner
       * ------------------------------------------------
       */

      let scanFiles:
        string[];

      if (
        plan.mode ===
        'FULL'
      ) {
        scanFiles =
          inventory.files
            .filter(
              (file) =>
                !file.isBinary,
            )
            .map(
              (file) =>
                file.relativePath,
            );
      } else {
        const affectedSet =
          new Set(
            plan.affectedFiles,
          );

        scanFiles =
          inventory.files
            .filter(
              (file) =>
                !file.isBinary &&
                affectedSet.has(
                  file.relativePath,
                ),
            )
            .map(
              (file) =>
                file.relativePath,
            );
      }

      await job.updateProgress(
        55,
      );

      /*
       * ------------------------------------------------
       * 11. Scan Context
       * ------------------------------------------------
       */

      const scanContext:
        ScanContext = {
        organizationId:
          data.organizationId,

        projectId:
          data.projectId,

        repositoryId:
          data.repositoryId,

        scanId:
          data.scanId,

        /*
         * Très important :
         * scanners = source extraite,
         * pas racine contenant repository.zip.
         */

        workspacePath:
          extractedSourcePath,

        mode:
          plan.mode,

        branch:
          data.branch,

        commitSha:
          data.toSha,

        scannerProfile:
          'DEFAULT',

        affectedFiles:
          scanFiles,

        deletedFiles:
          plan.deletedFiles,

        sourceFiles:
          plan.mode === 'FULL'
            ? inventorySourceFiles
            : plan.sourceFiles,

        dependencyFiles:
          plan.mode === 'FULL'
            ? inventoryDependencyFiles
            : plan.dependencyFiles,

        configurationFiles:
          plan.mode === 'FULL'
            ? inventoryConfigurationFiles
            : plan.configurationFiles,

        containerFiles:
          plan.mode === 'FULL'
            ? inventoryContainerFiles
            : plan.containerFiles,

        ciCdFiles:
          plan.mode === 'FULL'
            ? inventoryCiCdFiles
            : plan.ciCdFiles,

        correlationId:
          data.correlationId,

        fileInventory:
          inventory,
      };

      /*
       * ------------------------------------------------
       * 12. Scanner execution
       * ------------------------------------------------
       */

      await this.prisma.scan.update({
        where: {
          id:
            data.scanId,
        },

        data: {
          status:
            ScanStatus.SCANNING,

          progress:
            60,
        },
      });

      await job.updateProgress(
        60,
      );

      const scannerResults =
        await this.scannerRuntime.execute(
            scanContext,
            plan.scanners,
          );

      await this.assertNotCancelled(
        data.scanId,
      );

        if (
          plan.scanners.length > 0 &&
          scannerResults.length === 0
        ) {
          throw new Error(
            'Aucun scanner compatible n’a été exécuté pour ce plan de scan.',
          );
        }

      const executionSummary =
        this.executionSummary.build(
          scannerResults,
        );

      if (
        executionSummary.partial
      ) {
        const failedScannerIds =
          executionSummary.scanners
            .filter(
              (scanner) =>
                !scanner.success,
            )
            .map(
              (scanner) =>
                scanner.scannerId,
            );

        this.logger.warn(
          `Scan ${data.scanId} partiel : ` +
          `${executionSummary.failedScanners} scanner(s) en échec` +
          (
            failedScannerIds.length > 0
              ? ` [${failedScannerIds.join(', ')}]`
              : ''
          ) +
          '.',
        );
      }

      await this.prisma.scan.update({
      where: {
        id:
          data.scanId,
      },

      data: {
        status:
          ScanStatus.PROCESSING_RESULTS,

        progress:
          80,
      },
    });

    const successfulScannerResults =
      scannerResults.filter(
        (result) =>
          result.success,
      );

    const normalizedFindings =
      this.findingNormalizer.normalize(
          data.repositoryId,
          successfulScannerResults,
        );

    const persistenceResult =
      await this.findingPersistence.persist({
          organizationId:
            data.organizationId,

          projectId:
            data.projectId,

          repositoryId:
            data.repositoryId,

          scanId:
            data.scanId,

          commitSha:
            data.toSha,

          findings:
            normalizedFindings,
        });

    const reconciliationResult =
      executionSummary.complete
        ? await this.findingReconciliation.reconcile({
            repositoryId:
              data.repositoryId,

            scanId:
              data.scanId,

            mode:
              plan.mode,

            detectedFingerprints:
              normalizedFindings.map(
                (finding) =>
                  finding.fingerprint,
              ),

            scannedFiles:
              scanFiles,

            deletedFiles:
              plan.deletedFiles,
          })
        : {
            fixed: 0,
          };

        await this.prisma.scan.update({
          where: {
            id:
              data.scanId,
          },

          data: {
            status:
              ScanStatus.CALCULATING_SCORE,

            progress:
              94,
          },
        });

        const scoreResult =
          await this.securityScore.calculate(
              data.repositoryId,
              executionSummary.complete,
            );

        await job.updateProgress(
          96,
        );

      this.logger.log(
        `Scan ${data.scanId} exécuté sur ${repository.fullName} : ` +
        `${scannerResults.length} scanner(s), ` +
        `${persistenceResult.total} finding(s).`,
      );

    const scanStatistics =
      JSON.parse(
        JSON.stringify({
          changedFileCount:
            changeSet.changedFileCount,

          scannersPlanned:
            plan.scanners.length,

          scannersExecuted:
            scannerResults.length,

          successfulScanners:
            executionSummary.successfulScanners,

          failedScanners:
            executionSummary.failedScanners,

          partial:
            executionSummary.partial,

          complete:
            executionSummary.complete,

          scannerDurationMs:
            executionSummary.totalDurationMs,

          scannerExecution:
            executionSummary.scanners,

          affectedFileCount:
            scanFiles.length,

          deletedFileCount:
            plan.deletedFiles.length,

          inventoryFileCount:
            inventory.totalFiles,

          inventorySizeBytes:
            inventory.totalSizeBytes,

          skippedFiles:
            inventory.skippedFiles,

          ignoredFiles:
            inventory.ignoredFiles,

          archiveSizeBytes:
            downloadResult.sizeBytes,

          cacheHits:
            executionSummary.cacheHits,

          cacheMisses:
            executionSummary.cacheMisses,

          findingsCount:
            persistenceResult.total,

          newFindings:
            persistenceResult.created,

          existingFindings:
            persistenceResult.updated,

          reopenedFindings:
            persistenceResult.reopened,

          fixedFindings:
            reconciliationResult.fixed,

          activeCritical:
            scoreResult.critical,

          activeHigh:
            scoreResult.high,

          activeMedium:
            scoreResult.medium,

          activeLow:
            scoreResult.low,

          activeInfo:
            scoreResult.info,

          securityScore:
            scoreResult.score,

          securityScoreReliable:
            scoreResult.reliable,

          languages:
            languageSummary.languages,

          primaryLanguage:
            languageSummary.primaryLanguage,

          totalSourceFiles:
            languageSummary.totalSourceFiles,

        coverage: {
          secretScanner:
          true,

          sastLanguages:
            languageSummary.languages
              .filter(
                (item) =>
                  [
                    'JAVASCRIPT',
                    'TYPESCRIPT',
                    'PYTHON',
                    'PHP',
                    'JAVA',
                  ].includes(
                    item.language,
                  ),
              )
              .map(
                (item) =>
                  item.language,
              ),
          },
        }),
      ) as Prisma.InputJsonValue;

    /*
    * ------------------------------------------------
    * 13. Finalisation
    * ------------------------------------------------
    */

    const notificationTarget =
      await this.prisma.scan.findUnique({
        where: {
          id: data.scanId,
        },
        select: {
          requestedById: true,
          projectId: true,
          repository: {
            select: {
              fullName: true,
            },
          },
        },
      });


    await this.prisma.scan.update({
      where: {
        id:
          data.scanId,
      },

      data: {
        status:
          ScanStatus.COMPLETED,

        progress:
          100,

        completedAt:
          new Date(),

        score:
          scoreResult.score,

        statistics:
          scanStatistics,
      },
    });

    if (notificationTarget?.requestedById) {
      await this.prisma.notification.create({
        data: {
          userId: notificationTarget.requestedById,
          type: 'SCAN_COMPLETED',
          title: 'Scan terminé',
          message:
            `Le scan de ${notificationTarget.repository.fullName} est terminé avec un score de ${scoreResult.score}.`,
          metadata: {
            scanId: data.scanId,
            projectId: notificationTarget.projectId,
            repositoryId: data.repositoryId,
            score: scoreResult.score,
          },
        },
    });
  }


      await job.updateProgress(
        100,
      );

      this.logger.log(
        `Security scan ${data.scanId} terminé pour ${repository.fullName}.`,
      );
    } catch (
      error: unknown
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erreur inconnue du scan.';

      if (
        message ===
        'SCAN_CANCELLED'
      ) {
        this.logger.warn(
          `Scan ${data.scanId} annulé.`,
        );

        return;
      }

      this.logger.error(
        `Échec du scan ${data.scanId}: ${message}`,
        error instanceof Error
          ? error.stack
          : undefined,
      );

      await this.assertNotCancelled(
        data.scanId,
      );

      await this.prisma.scan.updateMany({
        where: {
          id:
            data.scanId,

          repositoryId:
            data.repositoryId,

          projectId:
            data.projectId,
        },

        data: {
          status:
            ScanStatus.FAILED,

          failedAt:
            new Date(),

          errorMessage:
            message.slice(
              0,
              2000,
            ),
        },
      });

      const failedTarget =
        await this.prisma.scan.findUnique({
          where: {
            id: data.scanId,
          },
          select: {
            requestedById: true,
            projectId: true,
            repository: {
              select: {
                fullName: true,
              },
            },
          },
        });

      if (failedTarget?.requestedById) {
        await this.prisma.notification.create({
          data: {
            userId: failedTarget.requestedById,
            type: 'SCAN_FAILED',
            title: 'Échec du scan',
            message:
              `Le scan de ${failedTarget.repository.fullName} a échoué : ${message}`,
            metadata: {
              scanId: data.scanId,
              projectId: failedTarget.projectId,
              repositoryId: data.repositoryId,
            },
          },
        });
      }

      /*
       * Indispensable pour laisser BullMQ
       * appliquer retry/backoff.
       */
      throw error;
    } finally {
      /*
       * ------------------------------------------------
       * 14. Cleanup
       * ------------------------------------------------
       */

      if (
        workspacePath
      ) {
        try {
          await this.workspaceService
            .cleanupWorkspace(
              workspacePath,
            );
        } catch (
          cleanupError: unknown
        ) {
          /*
           * Un échec de cleanup ne doit pas
           * transformer un scan réussi en FAILED.
           */
          this.logger.error(
            `Impossible de nettoyer le workspace du scan ${data.scanId}.`,
            cleanupError instanceof Error
              ? cleanupError.stack
              : String(
                  cleanupError,
                ),
          );
        }
      }
    }
  }

  private async markRunning(
    scanId: string,
    job: Job<SecurityScanJobData>,
  ): Promise<void> {

    await this.prisma.scan.update({
      where: {
        id:
          scanId,
      },

      data: {
        status:
          ScanStatus.PREPARING,

        startedAt:
          new Date(),

        progress:
          1,

        queueJobId:
          job.id
            ? String(
                job.id,
              )
            : null,

        errorMessage:
          null,

        failedAt:
          null,
      },
    });
  }

  private mapScanType(
    mode:
      | 'FULL'
      | 'INCREMENTAL'
      | 'PULL_REQUEST',
  ): ScanType {
    switch (
      mode
    ) {
      case 'FULL':
        return ScanType.FULL_SCAN;

      case 'PULL_REQUEST':
        return ScanType.PULL_REQUEST_SCAN;

      default:
        return ScanType.INCREMENTAL_SCAN;
    }
  }

  @OnWorkerEvent(
    'completed',
  )
  onCompleted(
    job:
      Job<SecurityScanJobData>,
  ): void {
    this.logger.log(
      `Security scan ${job.id ?? 'inconnu'} terminé.`,
    );
  }
  @OnWorkerEvent(
    'failed',
  )
  onFailed(
    job:
      Job<SecurityScanJobData> |
      undefined,

    error: Error,
  ): void {
    this.logger.error(
      `Security scan ${job?.id ?? 'inconnu'} échoué : ${error.message}`,
      error.stack,
    );
  }

  private async assertNotCancelled(
    scanId: string,
  ): Promise<void> {
    const scan =
      await this.prisma.scan.findUnique({
        where: {
          id:
            scanId,
        },

        select: {
          status:
            true,
        },
      });

    if (
      scan?.status ===
      ScanStatus.CANCELLED
    ) {
      throw new Error(
        'SCAN_CANCELLED',
      );
    }
  }
}
