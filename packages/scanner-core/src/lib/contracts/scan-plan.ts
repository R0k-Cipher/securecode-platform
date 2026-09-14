import type {
  ScanMode,
  ScannerKind,
} from './scanner-types';

export interface ScanPlan {
  mode: ScanMode;

  scanners: ScannerKind[];

  sourceFiles: string[];

  dependencyFiles: string[];

  configurationFiles: string[];

  containerFiles: string[];

  ciCdFiles: string[];

  deletedFiles: string[];

  /**
   * Tous les fichiers réellement affectés,
   * sans doublons.
   */
  affectedFiles: string[];

  /**
   * Explications permettant de comprendre
   * pourquoi le planner a choisi ce plan.
   */
  reasons: string[];

  requiresProjectContext: boolean;
}
