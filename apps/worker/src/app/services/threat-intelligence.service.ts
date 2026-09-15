import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface ThreatIntelligence {
  epssScore: number | null;
  knownExploited: boolean;
  sources: string[];
}

@Injectable()
export class ThreatIntelligenceService {
  private readonly logger = new Logger(ThreatIntelligenceService.name);
  private readonly cache = new Map<
    string,
    { value: ThreatIntelligence; expiresAt: number }
  >();
  private kevCache: { values: Set<string>; expiresAt: number } | null = null;
  private readonly ttlMs = 6 * 60 * 60 * 1000;

  async enrich(cveIds: string[]): Promise<Map<string, ThreatIntelligence>> {
    const ids = Array.from(new Set(cveIds.map((id) => id.toUpperCase())));
    const result = new Map<string, ThreatIntelligence>();
    const missing = ids.filter((id) => {
      const cached = this.cache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        result.set(id, cached.value);
        return false;
      }
      return true;
    });

    if (missing.length === 0) return result;

    const [epss, kev] = await Promise.all([
      this.fetchEpss(missing),
      this.fetchKev(),
    ]);

    for (const id of missing) {
      const value: ThreatIntelligence = {
        epssScore: epss.get(id) ?? null,
        knownExploited: kev.has(id),
        sources: [
          ...(epss.has(id) ? ['FIRST_EPSS'] : []),
          ...(kev.has(id) ? ['CISA_KEV'] : []),
        ],
      };
      this.cache.set(id, { value, expiresAt: Date.now() + this.ttlMs });
      result.set(id, value);
    }

    return result;
  }

  private async fetchEpss(ids: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    try {
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100);
        const response = await axios.get('https://api.first.org/data/v1/epss', {
          params: { cve: batch.join(',') },
          timeout: 7000,
        });
        const rows = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        for (const row of rows) {
          const score = Number(row?.epss);
          if (typeof row?.cve === 'string' && Number.isFinite(score)) {
            result.set(row.cve.toUpperCase(), score);
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `EPSS indisponible, calcul local conservé : ${this.message(error)}`,
      );
    }
    return result;
  }

  private async fetchKev(): Promise<Set<string>> {
    if (this.kevCache && this.kevCache.expiresAt > Date.now()) {
      return this.kevCache.values;
    }

    try {
      const response = await axios.get(
        'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
        { timeout: 10000 },
      );
      const values = new Set<string>();
      const rows = Array.isArray(response.data?.vulnerabilities)
        ? response.data.vulnerabilities
        : [];
      for (const row of rows) {
        if (typeof row?.cveID === 'string') values.add(row.cveID.toUpperCase());
      }
      this.kevCache = { values, expiresAt: Date.now() + this.ttlMs };
      return values;
    } catch (error) {
      this.logger.warn(
        `CISA KEV indisponible, calcul local conservé : ${this.message(error)}`,
      );
      return this.kevCache?.values ?? new Set<string>();
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'erreur inconnue';
  }
}
