export interface ScannerCacheKey {
  fileHash: string;

  scannerId: string;

  scannerVersion: string;

  rulesetVersion: string;
}

export interface ScannerCacheEntry {
  key: ScannerCacheKey;

  createdAt: string;

  resultFingerprint: string;
}
