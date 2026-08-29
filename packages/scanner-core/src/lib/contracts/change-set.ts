export interface RenamedFile {
  from: string;
  to: string;
}

export interface ChangeSet {
  repositoryId: string;

  fromSha: string | null;
  toSha: string;

  added: string[];
  modified: string[];
  deleted: string[];

  renamed: RenamedFile[];

  changedFileCount: number;

  /**
   * Indique qu'un scan incrémental
   * ne peut pas être considéré comme fiable.
   */
  requiresFullScan: boolean;

  /**
   * Raisons techniques ayant provoqué
   * le fallback vers un Full Scan.
   */
  fullScanReasons: string[];
}
