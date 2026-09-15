import { calculateContextualRisk, extractCveIds } from './contextual-risk';

describe('contextual risk engine', () => {
  it('forces an immediate priority for a reachable KEV vulnerability', () => {
    const result = calculateContextualRisk({
      severity: 'HIGH',
      cvssScore: 8.1,
      scanner: 'dependency-scanner',
      title: 'CVE actively exploited',
      metadata: { direct: true },
      knownExploited: true,
      epssScore: 0.86,
      repositoryVisibility: 'PUBLIC',
      branch: 'main',
    });

    expect(result.contextualScore).toBeGreaterThanOrEqual(90);
    expect(result.priority).toBe('IMMEDIATE');
    expect(result.reachable).toBe(true);
  });

  it('reduces reachability for a development-only dependency', () => {
    const result = calculateContextualRisk({
      severity: 'HIGH',
      scanner: 'dependency-scanner',
      title: 'Development dependency',
      metadata: { direct: true, development: true },
      repositoryVisibility: 'PRIVATE',
      branch: 'feature/test',
    });

    expect(result.reachable).toBe(false);
    expect(result.factors['reachability']).toBe(15);
  });

  it('extracts and deduplicates CVE identifiers', () => {
    expect(
      extractCveIds('DEPENDENCY-CVE-2025-12345', {
        aliases: ['CVE-2025-12345', 'CVE-2024-9999'],
      }),
    ).toEqual(['CVE-2025-12345', 'CVE-2024-9999']);
  });
});
