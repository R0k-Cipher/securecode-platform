export const CONTEXTUAL_RISK_ENGINE_VERSION = '1.0.0';

export type ContextualPriority =
  | 'IMMEDIATE'
  | 'URGENT'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW';

export interface ContextualRiskInput {
  severity: string;
  cvssScore?: number | null;
  scanner: string;
  category?: string | null;
  owaspCategory?: string | null;
  cweId?: string | null;
  filePath?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  repositoryVisibility?: string | null;
  branch?: string | null;
  epssScore?: number | null;
  knownExploited?: boolean;
}

export interface ContextualRiskResult {
  contextualScore: number;
  priority: ContextualPriority;
  reachable: boolean | null;
  internetExposed: boolean | null;
  assetCriticality: number;
  confidence: number;
  factors: Record<string, number>;
  explanation: string[];
  evidence: Record<string, unknown>;
}

const severityScores: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 80,
  MEDIUM: 55,
  LOW: 30,
  INFO: 10,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function text(input: ContextualRiskInput): string {
  return [
    input.title,
    input.description,
    input.category,
    input.owaspCategory,
    input.cweId,
    input.filePath,
    input.scanner,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function metadataBoolean(
  metadata: Record<string, unknown> | null | undefined,
  names: string[],
): boolean | null {
  for (const name of names) {
    if (typeof metadata?.[name] === 'boolean') {
      return metadata[name] as boolean;
    }
  }

  return null;
}

function inferReachability(input: ContextualRiskInput): boolean | null {
  const explicit = metadataBoolean(input.metadata, [
    'reachable',
    'isReachable',
    'runtimeReachable',
  ]);

  if (explicit !== null) {
    return explicit;
  }

  const direct = metadataBoolean(input.metadata, ['direct']);
  const development = metadataBoolean(input.metadata, ['development']);

  if (development === true) {
    return false;
  }

  if (direct === true) {
    return true;
  }

  if (input.filePath && !/lock|manifest/i.test(input.filePath)) {
    return true;
  }

  return null;
}

function inferExposure(input: ContextualRiskInput): boolean | null {
  const explicit = metadataBoolean(input.metadata, [
    'internetExposed',
    'publicEndpoint',
    'externallyReachable',
  ]);

  if (explicit !== null) {
    return explicit;
  }

  const value = text(input);

  if (
    /controller|route|endpoint|webhook|api\/|auth|login|upload|redirect|ssrf/.test(
      value,
    )
  ) {
    return true;
  }

  return input.repositoryVisibility === 'PUBLIC' ? true : null;
}

function calculateAssetCriticality(input: ContextualRiskInput): number {
  const configured = Number(input.metadata?.['assetCriticality']);

  if (Number.isFinite(configured) && configured >= 0) {
    return clamp(configured);
  }

  let score = input.repositoryVisibility === 'PUBLIC' ? 85 : 65;

  if (/main|master|prod|production/i.test(input.branch ?? '')) {
    score += 15;
  }

  if (/auth|payment|billing|admin|secret|database|token/i.test(text(input))) {
    score += 10;
  }

  return clamp(score);
}

export function extractCveIds(
  ruleId: string,
  metadata?: Record<string, unknown> | null,
): string[] {
  const candidates = [
    ruleId,
    typeof metadata?.['vulnerabilityId'] === 'string'
      ? metadata['vulnerabilityId']
      : '',
    ...(Array.isArray(metadata?.['aliases'])
      ? (metadata?.['aliases'] as unknown[]).filter(
          (item): item is string => typeof item === 'string',
        )
      : []),
  ];

  return Array.from(
    new Set(
      candidates.flatMap(
        (value) => value.toUpperCase().match(/CVE-\d{4}-\d{4,}/g) ?? [],
      ),
    ),
  );
}

export function calculateContextualRisk(
  input: ContextualRiskInput,
): ContextualRiskResult {
  const baseSeverity = input.cvssScore
    ? clamp(input.cvssScore * 10)
    : (severityScores[input.severity] ?? 40);
  const epss = clamp((input.epssScore ?? 0) * 100);
  const reachable = inferReachability(input);
  const exposure = inferExposure(input);
  const assetCriticality = calculateAssetCriticality(input);
  const exploitability = input.knownExploited
    ? 100
    : epss > 0
      ? epss
      : baseSeverity * 0.55;
  const reachabilityScore =
    reachable === true ? 100 : reachable === false ? 15 : 50;
  const exposureScore = exposure === true ? 100 : exposure === false ? 20 : 50;
  const chainPotential =
    /injection|ssrf|auth|idor|secret|token|deserial|rce|command/.test(
      text(input),
    )
      ? 90
      : 35;

  let contextualScore =
    baseSeverity * 0.25 +
    exploitability * 0.2 +
    reachabilityScore * 0.2 +
    exposureScore * 0.15 +
    assetCriticality * 0.15 +
    chainPotential * 0.05;

  if (input.knownExploited && reachable !== false) {
    contextualScore = Math.max(contextualScore, 90);
  }

  contextualScore = Math.round(clamp(contextualScore) * 100) / 100;

  const priority: ContextualPriority =
    contextualScore >= 90
      ? 'IMMEDIATE'
      : contextualScore >= 75
        ? 'URGENT'
        : contextualScore >= 60
          ? 'HIGH'
          : contextualScore >= 40
            ? 'MEDIUM'
            : 'LOW';

  const explanation: string[] = [];
  if (input.knownExploited)
    explanation.push(
      'Vulnérabilité connue comme activement exploitée (CISA KEV).',
    );
  if ((input.epssScore ?? 0) >= 0.5)
    explanation.push('Probabilité EPSS élevée d’exploitation à court terme.');
  if (reachable === true)
    explanation.push('Le composant ou le code vulnérable paraît atteignable.');
  if (reachable === false)
    explanation.push(
      'Le code paraît non atteignable dans le contexte analysé.',
    );
  if (exposure === true)
    explanation.push(
      'Une exposition Internet ou un point d’entrée public est probable.',
    );
  if (assetCriticality >= 80)
    explanation.push(
      'Le dépôt ou l’actif concerné est considéré comme critique.',
    );
  if (chainPotential >= 80)
    explanation.push('Ce finding peut participer à une chaîne d’attaque.');
  if (explanation.length === 0)
    explanation.push(
      'Priorité calculée à partir de la sévérité et du contexte disponible.',
    );

  const knownSignals = [
    input.cvssScore != null,
    input.epssScore != null,
    input.knownExploited === true,
    reachable != null,
    exposure != null,
    input.metadata?.['assetCriticality'] != null,
  ].filter(Boolean).length;

  return {
    contextualScore,
    priority,
    reachable,
    internetExposed: exposure,
    assetCriticality,
    confidence: Math.round(clamp(45 + knownSignals * 9) * 100) / 100,
    factors: {
      baseSeverity,
      exploitability: Math.round(exploitability * 100) / 100,
      reachability: reachabilityScore,
      exposure: exposureScore,
      assetCriticality,
      chainPotential,
    },
    explanation,
    evidence: {
      engineVersion: CONTEXTUAL_RISK_ENGINE_VERSION,
      methodology:
        'CVSS/severity + EPSS/KEV + reachability + exposure + asset criticality + chain potential',
    },
  };
}
