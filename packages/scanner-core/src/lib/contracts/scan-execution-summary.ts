export interface ScannerExecutionSummaryItem {
  scannerId: string;

  scannerVersion: string;

  rulesetVersion: string;

  success: boolean;

  findingsCount: number;

  filesConsidered: number;

  filesScanned: number;

  skippedFiles: number;

  durationMs: number;

  cacheHits: number;

  cacheMisses: number;

  errors: string[];
}

export interface ScanExecutionSummary {
  complete: boolean;

  partial: boolean;

  totalScanners: number;

  successfulScanners: number;

  failedScanners: number;

  totalDurationMs: number;

  totalFindings: number;

  cacheHits: number;

  cacheMisses: number;

  scanners: ScannerExecutionSummaryItem[];
}
