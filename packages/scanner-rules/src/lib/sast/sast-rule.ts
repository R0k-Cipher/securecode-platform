import * as ts from 'typescript';

export type SastRuleSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface SastDetection {
  node: ts.Node;

  description?: string;

  recommendation?: string;

  confidence?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface SastRule {
  id: string;

  title: string;

  description: string;

  severity: SastRuleSeverity;

  category: string;

  cweId?: string;

  owaspCategory?: string;

  recommendation: string;

  confidence: number;

  match(
    node: ts.Node,
    sourceFile: ts.SourceFile,
  ): SastDetection | null;
}
