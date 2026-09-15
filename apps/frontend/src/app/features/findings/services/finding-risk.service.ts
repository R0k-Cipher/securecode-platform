import { Injectable, inject } from '@angular/core';
import { ApiClientService } from '../../../core/api/api-client.service';

export interface FindingRiskAssessment {
  id: string;
  findingId: string;
  contextualScore: number;
  priority: 'IMMEDIATE' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  epssScore: number | null;
  knownExploited: boolean;
  reachable: boolean | null;
  internetExposed: boolean | null;
  assetCriticality: number;
  confidence: number;
  factors: Record<string, number>;
  explanation: string[];
  evidence: Record<string, unknown>;
  engineVersion: string;
  calculatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class FindingRiskService {
  private readonly api = inject(ApiClientService);

  get(organizationId: string, projectId: string, findingId: string) {
    return this.api.get<FindingRiskAssessment | null>(
      `/organizations/${organizationId}/projects/${projectId}/security-intelligence/findings/${findingId}`,
    );
  }
}
