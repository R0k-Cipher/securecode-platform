export type SupportedLanguage =
  | 'JAVASCRIPT'
  | 'TYPESCRIPT'
  | 'PYTHON'
  | 'PHP'
  | 'JAVA'
  | 'GO'
  | 'CSHARP'
  | 'RUBY'
  | 'RUST'
  | 'SQL'
  | 'UNKNOWN';

export interface LanguageDetection {
  language: SupportedLanguage;

  confidence: number;
}

export interface RepositoryLanguageSummary {
  languages: Array<{
    language: SupportedLanguage;
    files: number;
    sizeBytes: number;
  }>;

  primaryLanguage:
    SupportedLanguage | null;

  totalSourceFiles:
    number;
}
