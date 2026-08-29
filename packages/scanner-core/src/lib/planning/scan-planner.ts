import type {
  ChangeSet,
} from '../contracts/change-set';

import type {
  ScanPlan,
} from '../contracts/scan-plan';

import type {
  ScanMode,
  ScannerKind,
} from '../contracts/scanner-types';

import {
  ImpactAnalyzer,
} from '../impact/impact-analyzer';

export interface ScanPlannerOptions {
  requestedMode?:
    | ScanMode
    | 'AUTO';

  repositoryFileCount?: number;

  maxIncrementalFiles?: number;

  maxIncrementalRatio?: number;
}

export class ScanPlanner {
  constructor(
    private readonly impactAnalyzer =
      new ImpactAnalyzer(),
  ) {}

  createPlan(
    changeSet: ChangeSet,
    options: ScanPlannerOptions = {},
  ): ScanPlan {
    const impact =
      this.impactAnalyzer.analyze(
        changeSet,
      );

    const reasons = [
      ...changeSet.fullScanReasons,
      ...impact.reasons,
    ];

    const mode =
      this.resolveMode(
        changeSet,
        options,
        reasons,
      );

    const scanners =
      new Set<ScannerKind>();

    /*
     * Secrets :
     * applicable sur pratiquement
     * tous les fichiers texte affectés.
     */
    if (
      impact.sourceFiles.length > 0 ||
      impact.configurationFiles.length > 0
    ) {
      scanners.add( 'SECRET');
    }

    if (
      impact.sourceFiles.length > 0
    ) {
      scanners.add('SAST');
    }

    if (
      impact.dependencyFiles.length > 0
    ) {
      scanners.add(
        'DEPENDENCY',
      );
    }

    if (
      impact.containerFiles.length > 0
    ) {
      scanners.add(
        'CONTAINER',
      );

      scanners.add(
        'CONFIGURATION',
      );
    }

    if (
      impact.configurationFiles.length > 0
    ) {
      scanners.add(
        'CONFIGURATION',
      );
    }

    if (
      impact.ciCdFiles.length > 0
    ) {
      scanners.add(
        'CI_CD',
      );
    }

    if (
      impact.requiresProjectContext
    ) {
      scanners.add(
        'API',
      );
    }

    if (
      impact.containerFiles.length > 0 ||
      impact.configurationFiles.length > 0 ||
      impact.ciCdFiles.length > 0
    ) {
      scanners.add(
        'SECRET',
      );
    }

    /*
     * En Full Scan, le registry décidera
     * ensuite quels scanners sont réellement
     * compatibles avec les technologies
     * détectées.
     */
    if (
      mode === 'FULL'
    ) {
      scanners.add(
        'SECRET',
      );

      scanners.add(
        'SAST',
      );

      scanners.add(
        'DEPENDENCY',
      );

      scanners.add(
        'CONFIGURATION',
      );
      scanners.add(
        'CONTAINER',
      );

      scanners.add(
        'CI_CD',
      );
    }

    const affectedFiles =
      this.unique([
        ...impact.sourceFiles,
        ...impact.dependencyFiles,
        ...impact.configurationFiles,
        ...impact.containerFiles,
        ...impact.ciCdFiles,
      ]);

    return {
      mode,

      scanners:
        [...scanners],

      sourceFiles:
        impact.sourceFiles,

      dependencyFiles:
        impact.dependencyFiles,

      configurationFiles:
        impact.configurationFiles,

      containerFiles:
        impact.containerFiles,

      ciCdFiles:
        impact.ciCdFiles,

      deletedFiles:
        impact.deletedFiles,

      affectedFiles,

      reasons:
        this.unique(reasons),

      requiresProjectContext:
        impact.requiresProjectContext,
    };
  }

  private resolveMode(
    changeSet: ChangeSet,
    options: ScanPlannerOptions,
    reasons: string[],
  ): ScanMode {
    if (
      options.requestedMode &&
      options.requestedMode !==
        'AUTO'
    ) {
      return options.requestedMode;
    }

    if (
      changeSet.fromSha === null
    ) {
      reasons.push(
        'Aucun scan précédent : Full Scan obligatoire.',
      );

      return 'FULL';
    }

    if (
      changeSet.requiresFullScan
    ) {
      reasons.push(
        'L’état incrémental n’est pas fiable.',
      );

      return 'FULL';
    }

    const maxFiles =
      options.maxIncrementalFiles ??
      5_000;

    if (
      changeSet.changedFileCount >
      maxFiles
    ) {
      reasons.push(
        `Nombre de fichiers modifiés supérieur au seuil (${maxFiles}).`,
      );

      return 'FULL';
    }

    const repositoryFileCount =
      options.repositoryFileCount;

    if (
      repositoryFileCount &&
      repositoryFileCount > 0
    ) {
      const ratio =
        changeSet.changedFileCount /
        repositoryFileCount;

      const maximumRatio =
        options.maxIncrementalRatio ??
        0.3;

      if (
        ratio >
        maximumRatio
      ) {
        reasons.push(
          `Ratio de modification ${(ratio * 100).toFixed(2)} % supérieur au seuil ${(maximumRatio * 100).toFixed(2)} %.`,
        );

        return 'FULL';
      }
    }

    return 'INCREMENTAL';
  }

  private unique<T>(
    values: T[],
  ): T[] {
    return [
      ...new Set(values),
    ];
  }
}
