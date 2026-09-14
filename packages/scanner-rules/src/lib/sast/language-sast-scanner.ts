import type {
  ScanContext,
  ScannerResult,
  SecurityScanner,
  SupportedLanguage,
} from '@securecode-platform/scanner-core';

export interface LanguageSastScanner
  extends SecurityScanner
{
  readonly languages:
    readonly SupportedLanguage[];

  supportsLanguage(
    language:
      SupportedLanguage,
  ): boolean;
}

export abstract class BaseLanguageSastScanner
  implements LanguageSastScanner
{
  abstract readonly descriptor:
    SecurityScanner['descriptor'];

  abstract readonly languages:
    readonly SupportedLanguage[];

  supportsLanguage(
    language:
      SupportedLanguage,
  ): boolean {
    return this.languages.includes(
      language,
    );
  }

  supports(
    context:
      ScanContext,
  ): boolean {
    return context
      .fileInventory
      .files
      .some(
        (file) =>
          !file.isBinary &&
          this.supportsLanguage(
            file.language,
          ),
      );
  }

  abstract scan(
    context:
      ScanContext,
  ): Promise<ScannerResult>;
}
