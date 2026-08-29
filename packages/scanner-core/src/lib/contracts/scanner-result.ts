export type ScannerFindingSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface ScannerFinding {
  ruleId: string;

  title: string;

  description: string;

  severity: ScannerFindingSeverity;

  category?: string;

  cweId?: string;

  owaspCategory?: string;

  filePath?: string;

  startLine?: number;

  startColumn?: number;

  endLine?: number;

  endColumn?: number;

  codeSnippet?: string;

  recommendation?: string;

  confidence?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ScannerExecutionStatistics {
  filesConsidered: number;

  filesScanned: number;

  findingsCount: number;

  durationMs: number;

  skippedFiles: number;

  cacheHits?: number;

  cacheMisses?: number;
}

export interface ScannerResult {
  scannerId: string;

  scannerVersion: string;

  rulesetVersion: string;

  success: boolean;

  findings: ScannerFinding[];

  statistics: ScannerExecutionStatistics;

  errors: string[];
}
