import type {
  ScanContext,
} from '../contracts/scan-context';

import type {
  ScannerKind,
  SecurityScanner,
} from '../contracts/scanner-types';

export class ScannerRegistry {
  private readonly scanners =
    new Map<
      string,
      SecurityScanner
    >();

  register(
    scanner: SecurityScanner,
  ): void {
    const id =
      scanner.descriptor.id;

    if (
      this.scanners.has(id)
    ) {
      throw new Error(
        `Scanner déjà enregistré : ${id}`,
      );
    }

    this.scanners.set(
      id,
      scanner,
    );
  }

  registerMany(
    scanners:
      SecurityScanner[],
  ): void {
    for (
      const scanner of scanners
    ) {
      this.register(
        scanner,
      );
    }
  }

  getById(
    id: string,
  ): SecurityScanner | null {
    return (
      this.scanners.get(id) ??
      null
    );
  }

  findCompatible(
    context: ScanContext,
    requestedKinds:
      ScannerKind[],
  ): SecurityScanner[] {
    const requested =
      new Set(
        requestedKinds,
      );

    return [
      ...this.scanners.values(),
    ].filter(
      (scanner) =>
        requested.has(
          scanner.descriptor.kind,
        ) &&
        scanner.supports(
          context,
        ),
    );
  }

  list():
    ScannerDescriptorSummary[] {
    return [
      ...this.scanners.values(),
    ].map(
      (scanner) => ({
        ...scanner.descriptor,
      }),
    );
  }
}

export interface ScannerDescriptorSummary {
  id: string;

  name: string;

  version: string;

  rulesetVersion: string;

  kind: ScannerKind;

  scope: string;

  supportedExtensions?:
    string[];

  supportedFiles?:
    string[];
}
