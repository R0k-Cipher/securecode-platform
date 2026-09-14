export type DependencyEcosystem =
  | 'NPM'
  | 'COMPOSER'
  | 'PYPI'
  | 'MAVEN'
  | 'GO'
  | 'CARGO';

export interface NormalizedDependency {
  name: string;

  version: string;

  ecosystem: DependencyEcosystem;

  manifestPath: string;

  direct: boolean;

  development: boolean;
}

export interface DependencyVulnerability {
  id: string;

  aliases: string[];

  summary: string | null;

  details: string | null;

  severity:
    | 'INFO'
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

  fixedVersions: string[];

  references: string[];

  publishedAt: string | null;

  modifiedAt: string | null;
}

export interface DependencyVulnerabilityQuery {
  dependency: NormalizedDependency;
}

export interface DependencyVulnerabilityMatch {
  dependency: NormalizedDependency;

  vulnerabilities:
    DependencyVulnerability[];
}

export interface DependencyVulnerabilityProvider {
  queryMany(
    queries: DependencyVulnerabilityQuery[],
  ): Promise<DependencyVulnerabilityMatch[]>;
}
