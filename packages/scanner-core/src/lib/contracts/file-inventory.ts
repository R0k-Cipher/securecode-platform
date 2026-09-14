export interface FileInventoryEntry {
  relativePath: string;

  absolutePath: string;

  sizeBytes: number;

  extension: string;

  sha256: string;

  isBinary: boolean;

  language: SupportedLanguage;

}

import type {
  SupportedLanguage,
} from './language';

export interface FileInventory {
  files: FileInventoryEntry[];

  totalFiles: number;

  totalSizeBytes: number;

  skippedFiles: number;

  ignoredFiles: number;
}
