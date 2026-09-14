import type {
  ScanMode,
} from './scanner-types';

import type {
  FileInventory,
} from './file-inventory';

export interface ScanContext {
  organizationId: string;

  projectId: string;

  repositoryId: string;

  scanId: string;

  workspacePath: string;

  mode: ScanMode;

  branch: string;

  commitSha: string;

    scannerProfile: string | null;

  affectedFiles: string[];

  deletedFiles: string[];

  sourceFiles: string[];

  dependencyFiles: string[];

  configurationFiles: string[];

  containerFiles: string[];

  ciCdFiles: string[];

  correlationId: string;

  fileInventory: FileInventory;


}
